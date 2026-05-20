require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { apiLimiter } = require('./middleware/rateLimiter');

// Nodemon reload trigger
const authRoutes = require('./routes/auth.routes');
const sessionRoutes = require('./routes/session.routes');
const attendanceRoutes = require('./routes/attendance.routes');
const studentRoutes = require('./routes/student.routes');
const courseRoutes = require('./routes/course.routes');
const notificationRoutes = require('./routes/notification.routes');
const grievanceRoutes = require('./routes/grievance.routes');
const reportRoutes = require('./routes/report.routes');
const lecturerRoutes = require('./routes/lecturer.routes');

const prisma = require('./lib/prisma');
const { protect } = require('./middleware/auth');
const seed = require('./seed');

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS with credentials support
const allowedOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'https://gctu-attendance-system-chi.vercel.app', // Deployed Vercel frontend
  process.env.FRONTEND_URL // Additional frontend URL via env var
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Body parsers and cookie-parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Apply rate limiter globally to all API endpoints
app.use('/api', apiLimiter);

// Health Check
app.get('/api/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({
      status: 'OK',
      database: 'CONNECTED',
      timestamp: new Date()
    });
  } catch (err) {
    res.status(500).json({
      status: 'ERROR',
      database: 'DISCONNECTED',
      error: err.message,
      timestamp: new Date()
    });
  }
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
    } else if (req.user.role === 'LECTURER') {
      const assignments = await prisma.lecturerAssignment.findMany({
        where: { lecturerId: req.user.id }
      });
      const classIds = assignments.map(a => a.classId);
      const courseIds = assignments.map(a => a.courseId);

      whereClause = {
        classId: { in: classIds },
        courseId: { in: courseIds }
      };
    }

    const sessions = await prisma.attendanceSession.findMany({
      where: whereClause,
      orderBy: { startTime: 'desc' },
      take: 20,
      include: {
        course: true,
        class: true,
        rep: { select: { username: true } }
      }
    });

    const mappedSessions = sessions.map(s => ({
      id: s.id,
      courseName: s.course.name,
      courseCode: s.course.code,
      classId: s.classId,
      classDisplayName: s.class?.displayName || 'N/A',
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
app.use('/api/notifications', protect, notificationRoutes);
app.use('/api/grievances', grievanceRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/lecturer', lecturerRoutes);
app.use('/api/admin', require('./routes/admin.routes'));

// Serve uploaded files (logos etc.)
const path = require('path');
app.use('/uploads', express.static(path.join(__dirname, '../public/uploads')));

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Server Error:', err.stack);
  res.status(500).json({ error: 'Something went wrong on the server!' });
});

let server;

// Verify Prisma database connection on boot with automatic retry support
const connectWithRetry = async (attempts = 5, delay = 5000) => {
  for (let i = 1; i <= attempts; i++) {
    try {
      await prisma.$queryRaw`SELECT 1`;
      console.log('Prisma client connection verified successfully.');
      return;
    } catch (err) {
      console.error(`[Resilience] Database connection attempt ${i} of ${attempts} failed:`, err.message);
      if (i === attempts) {
        console.error('Fatal: All database connection retries exhausted. Shutting down server...');
        process.exit(1);
      }
      console.log(`Waiting ${delay / 1000} seconds before next database retry...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
};

// Graceful shutdown function to close active connections cleanly
const gracefulShutdown = async (originSignal) => {
  console.log(`[Resilience] Clean shutdown triggered via: ${originSignal}`);
  
  if (server) {
    server.close(async () => {
      console.log('HTTP connection sockets closed.');
      try {
        await prisma.$disconnect();
        console.log('Prisma client disconnected successfully.');
        process.exit(originSignal === 'uncaughtException' || originSignal === 'unhandledRejection' ? 1 : 0);
      } catch (err) {
        console.error('Error disconnecting database during shutdown:', err);
        process.exit(1);
      }
    });
  } else {
    process.exit(0);
  }
};

// Bind process signal interrupts
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Bind process crash events
process.on('unhandledRejection', (reason, promise) => {
  console.error('[Resilience] Fatal Unhandled Rejection at:', promise, 'Reason:', reason);
  gracefulShutdown('unhandledRejection');
});

process.on('uncaughtException', (err) => {
  console.error('[Resilience] Fatal Uncaught Exception thrown:', err.message, err.stack);
  gracefulShutdown('uncaughtException');
});

// Bootstrapped server startup
const bootstrap = async () => {
  await connectWithRetry();
  
  // Check if the database has any users; if not, auto-seed the initial records
  try {
    const userCount = await prisma.user.count();
    if (userCount === 0) {
      console.log('Database appears to be empty (0 users found). Running auto-seed...');
      await seed();
      console.log('Database auto-seeded successfully.');
    } else {
      console.log(`Database has ${userCount} users. Auto-seed not needed.`);
    }
  } catch (err) {
    console.error('Failed to run auto-seed check:', err.message);
  }

  server = app.listen(PORT, () => {
    console.log(`Class Attendance API running on port ${PORT}`);
    console.log('Active handles:', process._getActiveHandles().map(h => h.constructor.name));
  });
};

bootstrap();

// Force nodemon reload to pick up newly generated prisma client: 2
