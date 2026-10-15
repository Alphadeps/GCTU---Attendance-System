const jwt = require('jsonwebtoken');
const prisma = require('../lib/prisma');

const JWT_SECRET = process.env.JWT_SECRET || 'attendance-secret-key';

const PASSWORD_CHANGE_ALLOWED = ['/api/auth/change-password', '/api/auth/logout'];

// Protect middleware to verify JWT
const protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Not authorized, no token provided' });
    }

    const token = authHeader.split(' ')[1];
    
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      // Provide more specific error messages for token issues
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ 
          error: 'Token expired',
          code: 'TOKEN_EXPIRED',
          expiredAt: err.expiredAt
        });
      } else if (err.name === 'JsonWebTokenError') {
        return res.status(401).json({ 
          error: 'Invalid token',
          code: 'INVALID_TOKEN'
        });
      }
      return res.status(401).json({ error: 'Not authorized, invalid token' });
    }

    // Fetch user from DB
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { id: true, username: true, role: true, isActive: true, mustChangePassword: true }
    });

    if (!user) {
      return res.status(401).json({ error: 'User not found or token invalid' });
    }

    if (!user.isActive) {
      return res.status(403).json({ error: 'Account deactivated' });
    }

    // Until a temporary password is replaced, only allow changing it (or logging out)
    if (user.mustChangePassword && !PASSWORD_CHANGE_ALLOWED.some(p => req.originalUrl.startsWith(p))) {
      return res.status(403).json({
        error: 'You must change your password before continuing.',
        code: 'PASSWORD_CHANGE_REQUIRED'
      });
    }

    req.user = user;
    next();
  } catch (err) {
    console.error('Auth protect middleware error:', err);
    return res.status(401).json({ error: 'Not authorized, invalid token' });
  }
};

// Authorize roles middleware
const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authorized' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: `Forbidden: Role '${req.user.role}' is not authorized to access this resource` });
    }
    next();
  };
};

module.exports = {
  protect,
  authorizeRoles,
  JWT_SECRET
};
