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
// The signed-in person's own notifications: staff by user id, students by index number
const ownerFilter = (req) => (req.user ? { userId: req.user.id } : { studentIndex: req.student.indexNumber });

const getNotifications = async (req, res) => {
  try {
    const whereClause = ownerFilter(req);

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

    const result = await prisma.notification.updateMany({
      where: { id, ...ownerFilter(req) },
      data: { isRead: true }
    });
    if (result.count === 0) return res.status(404).json({ error: 'Notification not found' });

    res.json({ id, isRead: true });
  } catch (err) {
    console.error('Mark notification as read error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Delete notification
const deleteNotification = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await prisma.notification.deleteMany({
      where: { id, ...ownerFilter(req) }
    });
    if (result.count === 0) return res.status(404).json({ error: 'Notification not found' });

    res.json({ message: 'Notification deleted successfully' });
  } catch (err) {
    console.error('Delete notification error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Clear all notifications
const clearAll = async (req, res) => {
  try {
    await prisma.notification.deleteMany({
      where: ownerFilter(req)
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
