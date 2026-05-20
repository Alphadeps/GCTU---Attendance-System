require('dotenv').config();
const express = require('express');
const cors = require('cors');

// Nodemon reload trigger
const authRoutes = require('./routes/auth.routes');
const sessionRoutes = require('./routes/session.routes');
const attendanceRoutes = require('./routes/attendance.routes');
const studentRoutes = require('./routes/student.routes');
const courseRoutes = require('./routes/course.routes');
const notificationRoutes = require('./routes/notification.routes');

const prisma = require('./lib/prisma');
const { protect } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Body parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health Check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date() });
});

// Stats for dashboard views
app.get('/api/stats', protect, async (req, res) => {
  try {
    let whereClause = {};
    if (req.user.role === 'REP') {
      const repClass = await prisma.class.findFirst({
        where: { repId: req.user.id }
      });
      if (repClass) {
        whereClause = { classId: repClass.id };
      } else {
        whereClause = { id: 'none' };
      }
    }

    const sessions = await prisma.attendanceSession.findMany({
      where: whereClause,
      orderBy: { startTime: 'desc' },
      take: 20,
      include: {
        course: true,
        rep: { select: { username: true } }
      }
    });

    const mappedSessions = sessions.map(s => ({
      id: s.id,
      courseName: s.course.name,
      courseCode: s.course.code,
      startTime: s.startTime,
      sessionType: s.sessionType,
      status: s.status
    }));

    res.json({
      recentSessions: mappedSessions
    });
  } catch (err) {
    console.error('Stats fetch error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Route mount points
app.use('/api/auth', authRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/admin', require('./routes/admin.routes'));

// Serve uploaded files (logos etc.)
const path = require('path');
app.use('/uploads', express.static(path.join(__dirname, '../public/uploads')));

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Server Error:', err.stack);
  res.status(500).json({ error: 'Something went wrong on the server!' });
});

app.listen(PORT, () => {
  console.log(`Class Attendance API running on port ${PORT}`);
  console.log('Active handles:', process._getActiveHandles().map(h => h.constructor.name));
});

// Force nodemon reload to pick up newly generated prisma client: 2
