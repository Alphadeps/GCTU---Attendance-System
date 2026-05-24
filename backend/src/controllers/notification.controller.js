const prisma = require('../lib/prisma');

// Helper to create notifications programmatically
const createNotificationHelper = async ({ userId, studentIndex, title, message, type = 'INFO' }) => {
  try {
    const notification = await prisma.notification.create({
      data: {
        userId,
        studentIndex,
        title,
        message,
        type
      }
    });
    return notification;
  } catch (err) {
    console.error('Error creating notification:', err);
  }
};

// Retrieve notifications for authenticated user or studentIndex
const getNotifications = async (req, res) => {
  try {
    const { studentIndex } = req.query;
    const userId = req.user?.id;

    let whereClause = {};

    if (userId) {
      // Authenticated User (rep, lecturer, admin)
      whereClause = { userId };
    } else if (studentIndex) {
      // Student portal querying notifications
      whereClause = { studentIndex };
    } else {
      return res.status(400).json({ error: 'User identifier or Student Index Number required' });
    }

    const notifications = await prisma.notification.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      take: 100 // Limit to 100 most recent notifications for performance
    });

    res.json(notifications);
  } catch (err) {
    console.error('Get notifications error:', err);
    
    // Handle specific database errors
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'Notifications not found' });
    }
    
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Mark notification as read
const markAsRead = async (req, res) => {
  try {
    const { id } = req.params;

    const updated = await prisma.notification.update({
      where: { id },
      data: { isRead: true }
    });

    res.json(updated);
  } catch (err) {
    console.error('Mark notification as read error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Delete notification
const deleteNotification = async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.notification.delete({
      where: { id }
    });

    res.json({ message: 'Notification deleted successfully' });
  } catch (err) {
    console.error('Delete notification error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Clear all notifications
const clearAll = async (req, res) => {
  try {
    const { studentIndex } = req.query;
    const userId = req.user?.id;

    let whereClause = {};

    if (userId) {
      whereClause = { userId };
    } else if (studentIndex) {
      whereClause = { studentIndex };
    } else {
      return res.status(400).json({ error: 'User identifier or Student Index Number required' });
    }

    await prisma.notification.deleteMany({
      where: whereClause
    });

    res.json({ message: 'All notifications cleared successfully' });
  } catch (err) {
    console.error('Clear all notifications error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  createNotificationHelper,
  getNotifications,
  markAsRead,
  deleteNotification,
  clearAll
};
