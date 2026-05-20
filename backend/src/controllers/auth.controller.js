const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { z } = require('zod');
const prisma = require('../lib/prisma');
const { JWT_SECRET } = require('../middleware/auth');

// Zod schemas for input validation
const registerSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters long').max(20, 'Username must be under 20 characters'),
  password: z.string().min(6, 'Password must be at least 6 characters long'),
  role: z.enum(['ADMIN', 'LECTURER', 'REP'], {
    errorMap: () => ({ message: 'Role must be either ADMIN, LECTURER, or REP' })
  })
});

const loginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required')
});

// Refresh token secret key (derived from main secret for safety)
const REFRESH_JWT_SECRET = process.env.REFRESH_JWT_SECRET || (JWT_SECRET + '_refresh');

/**
 * Register a new user with input sanitization and validation
 */
const register = async (req, res) => {
  try {
    // Validate inputs
    const validation = registerSchema.safeParse(req.body);
    if (!validation.success) {
      const errorMsg = validation.error.errors.map(err => err.message).join(', ');
      return res.status(400).json({ error: errorMsg });
    }

    const { username, password, role } = validation.data;

    // Check if any users exist in the DB (for bootstrap purposes)
    const userCount = await prisma.user.count();
    
    // If users exist, enforce admin authorization
    if (userCount > 0) {
      if (!req.user || !['ADMIN', 'SUPERADMIN'].includes(req.user.role)) {
        return res.status(403).json({ error: 'Forbidden: Only administrators can register new users' });
      }
    }

    // Check if username is taken
    const existingUser = await prisma.user.findUnique({ where: { username } });
    if (existingUser) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const newUser = await prisma.user.create({
      data: {
        username,
        password: hashedPassword,
        role
      }
    });

    res.status(201).json({
      message: 'User registered successfully',
      user: {
        id: newUser.id,
        username: newUser.username,
        role: newUser.role
      }
    });
  } catch (err) {
    console.error('Register controller error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Login user: returns short access token, sets HttpOnly Refresh Token
 */
const login = async (req, res) => {
  try {
    // Validate inputs
    const validation = loginSchema.safeParse(req.body);
    if (!validation.success) {
      const errorMsg = validation.error.errors.map(err => err.message).join(', ');
      return res.status(400).json({ error: errorMsg });
    }

    const { username, password } = validation.data;

    const user = await prisma.user.findUnique({
      where: { username },
      include: {
        assignedClass: {
          include: {
            _count: { select: { courses: true, students: true } }
          }
        }
      }
    });

    if (!user) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    if (!user.isActive) {
      return res.status(403).json({ error: 'Your account has been deactivated. Please contact the administrator.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    // Sign Short Access Token (15 mins)
    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: '15m' }
    );

    // Sign Long Refresh Token (7 days)
    const refreshToken = jwt.sign(
      { id: user.id },
      REFRESH_JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Set Refresh Token in secure HttpOnly cookie
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days in milliseconds
    });

    const needsPasswordChange = user.role === 'SUPERADMIN' && password === 'admin123';

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        assignedClass: user.assignedClass
          ? {
              id: user.assignedClass.id,
              displayName: user.assignedClass.displayName,
              courseCount: user.assignedClass._count?.courses ?? 0,
              studentCount: user.assignedClass._count?.students ?? 0
            }
          : null,
        needsPasswordChange
      }
    });
  } catch (err) {
    console.error('Login controller error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Refresh Access Token using HttpOnly Refresh Token
 */
const refresh = async (req, res) => {
  try {
    const refreshToken = req.cookies?.refreshToken;
    if (!refreshToken) {
      return res.status(401).json({ error: 'Not authorized, refresh token missing' });
    }

    // Verify Refresh Token
    let decoded;
    try {
      decoded = jwt.verify(refreshToken, REFRESH_JWT_SECRET);
    } catch (err) {
      return res.status(401).json({ error: 'Invalid or expired refresh token' });
    }

    // Fetch user to check active status
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { id: true, username: true, role: true, isActive: true }
    });

    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'User not found or account deactivated' });
    }

    // Generate new Access Token (15 mins)
    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: '15m' }
    );

    res.json({ token });
  } catch (err) {
    console.error('Refresh token error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Logout: Clears the HttpOnly Refresh Token cookie
 */
const logout = async (req, res) => {
  try {
    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict'
    });
    res.json({ message: 'Logged out successfully' });
  } catch (err) {
    console.error('Logout error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current password and new password are required' });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Incorrect current password' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword }
    });

    res.json({ message: 'Password changed successfully' });
  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  register,
  login,
  refresh,
  logout,
  changePassword
};
