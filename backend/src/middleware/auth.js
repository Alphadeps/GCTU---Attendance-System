const jwt = require('jsonwebtoken');
const prisma = require('../lib/prisma');

const JWT_SECRET = process.env.JWT_SECRET || 'attendance-secret-key';

// Protect middleware to verify JWT
const protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Not authorized, no token provided' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);

    // Fetch user from DB
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { id: true, username: true, role: true }
    });

    if (!user) {
      return res.status(401).json({ error: 'User not found or token invalid' });
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
