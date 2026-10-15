const express = require('express');
const { protectAny } = require('../middleware/auth');
const {
  getNotifications,
  markAsRead,
  deleteNotification,
  clearAll
} = require('../controllers/notification.controller');

const router = express.Router();

// Route definitions: staff and students each see only their own notifications
router.get('/', protectAny, getNotifications);
router.patch('/:id/read', protectAny, markAsRead);
router.delete('/clear', protectAny, clearAll);
router.delete('/:id', protectAny, deleteNotification);

module.exports = router;
