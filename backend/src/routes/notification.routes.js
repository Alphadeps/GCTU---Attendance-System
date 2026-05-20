const express = require('express');
const jwt = require('jsonwebtoken');
const prisma = require('../lib/prisma');
const { JWT_SECRET } = require('../middleware/auth');
const {
  getNotifications,
  markAsRead,
  deleteNotification,
  clearAll
} = require('../controllers/notification.controller');

const router = express.Router();

// Optional protection middleware to populate req.user if a token is present
const optionalProtect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, JWT_SECRET);
      
      const user = await prisma.user.findUnique({
        where: { id: decoded.id },
        select: { id: true, username: true, role: true }
      });
      
      if (user) {
        req.user = user;
      }
    }
    next();
  } catch (err) {
    // If token is invalid or expired, we just log and proceed without raising error (as it is optional)
    console.log('Optional auth error (proceeding without auth):', err.message);
    next();
  }
};

// Route definitions
router.get('/', optionalProtect, getNotifications);
router.patch('/:id/read', markAsRead);
router.delete('/clear', optionalProtect, clearAll);
router.delete('/:id', deleteNotification);

module.exports = router;
