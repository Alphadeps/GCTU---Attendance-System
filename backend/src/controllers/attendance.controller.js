const jwt = require('jsonwebtoken');
const prisma = require('../lib/prisma');
const { JWT_SECRET } = require('../middleware/auth');
const { createNotificationHelper } = require('./notification.controller');

// Haversine formula helper
function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Earth's radius in meters
  const phi1 = lat1 * Math.PI / 180;
  const phi2 = lat2 * Math.PI / 180;
  const deltaPhi = (lat2 - lat1) * Math.PI / 180;
  const deltaLambda = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
            Math.cos(phi1) * Math.cos(phi2) *
            Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // distance in meters
}

// 1. Mark attendance
const { resetFailures } = require('../lib/securityCache');
const markAttendance = async (req, res) => {
  try {
    const { student, session, attendanceStatus } = req.bodyguard;
    const { latitude, longitude, deviceInfo } = req.body;

    const ipAddress = req.ip || req.headers['x-forwarded-for'] || '127.0.0.1';

    // Save record — unique constraint on (sessionId, studentId) prevents duplicates at DB level
    let newAttendance;
    try {
      newAttendance = await prisma.attendance.create({
        data: {
          sessionId: session.id,
          studentId: student.id,
          status: attendanceStatus,
          ipAddress,
          deviceInfo: deviceInfo || 'Unknown Browser',
          locationData: latitude && longitude ? JSON.stringify({ latitude, longitude }) : null
        }
      });
    } catch (err) {
      // P2002 = unique constraint violation: concurrent duplicate check-in
      if (err.code === 'P2002') {
        return res.status(409).json({ error: 'You have already checked in for this session.' });
      }
      throw err;
    }

    // Reset security failure counters for this student and IP on successful check-in
    resetFailures(student.indexNumber);
    resetFailures(ipAddress);

    // Trigger notifications asynchronously — does not block the response
    setImmediate(async () => {
      try {
        const courseName = session.courseName || 'Class';
        const courseCode = session.courseCode || '';

        await createNotificationHelper({
          studentIndex: student.indexNumber,
          title: 'Attendance Checked In',
          message: `Checked in successfully for ${courseName} (${courseCode}) as ${attendanceStatus}.`,
          type: 'SUCCESS'
        });

        await createNotificationHelper({
          userId: session.repId,
          title: 'Student Checked In',
          message: `${student.name} (${student.indexNumber}) marked attendance for ${courseName} (${courseCode}).`,
          type: 'INFO'
        });
      } catch (notifyErr) {
        console.error('Failed to trigger attendance mark notifications:', notifyErr);
      }
    });

    res.status(201).json({
      message: `Check-in successful! Marked as ${attendanceStatus}.`,
      attendance: newAttendance
    });
  } catch (err) {
    console.error('Mark attendance controller error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// 2. Get session attendance
const getSessionAttendance = async (req, res) => {
  try {
    const { sessionId } = req.params;

    const attendances = await prisma.attendance.findMany({
      where: { sessionId },
      include: {
        student: {
          select: { name: true, indexNumber: true, email: true }
        }
      },
      orderBy: { checkInTime: 'asc' }
    });

    res.json(attendances);
  } catch (err) {
    console.error('Get session attendance error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// 3. Get student attendance history
const getStudentHistory = async (req, res) => {
  try {
    const { indexNumber } = req.params;

    const student = await prisma.student.findUnique({
      where: { indexNumber }
    });

    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    const history = await prisma.attendance.findMany({
      where: { studentId: student.id },
      include: {
        session: {
          include: {
            course: true
          }
        }
      },
      orderBy: { checkInTime: 'desc' }
    });

    res.json({
      student: {
        name: student.name,
        indexNumber: student.indexNumber,
        email: student.email
      },
      history
    });
  } catch (err) {
    console.error('Get student history error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const updateAttendanceStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['PRESENT', 'ABSENT', 'LATE'].includes(status)) {
      return res.status(400).json({ error: 'Invalid attendance status. Must be PRESENT, ABSENT, or LATE' });
    }

    const updated = await prisma.attendance.update({
      where: { id },
      data: { status }
    });

    res.json({ message: 'Attendance status updated successfully', attendance: updated });
  } catch (err) {
    console.error('Update attendance status error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Rep Self Check-In
 * Allows rep to mark their own attendance for sessions in their class
 */
const repSelfCheckIn = async (req, res) => {
  try {
    // Verify user is a rep
    if (!req.user || req.user.role !== 'REP') {
      return res.status(403).json({ error: 'Only class representatives can use this endpoint' });
    }

    const { sessionId } = req.body;

    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID is required' });
    }

    // Parallel queries for better performance
    const [repClass, session, repUser] = await Promise.all([
      prisma.class.findFirst({
        where: { repId: req.user.id },
        select: { id: true }
      }),
      prisma.attendanceSession.findUnique({
        where: { id: sessionId },
        include: { course: { select: { name: true, code: true } } }
      }),
      prisma.user.findUnique({
        where: { id: req.user.id },
        select: { indexNumber: true }
      })
    ]);

    if (!repClass) {
      return res.status(403).json({ error: 'You are not assigned to any class' });
    }

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (session.classId !== repClass.id) {
      return res.status(403).json({ error: 'This session does not belong to your class' });
    }

    if (session.status !== 'OPEN') {
      return res.status(400).json({ error: 'This session is not open for attendance' });
    }

    if (!repUser.indexNumber) {
      return res.status(400).json({ error: 'Your account does not have an index number. Please contact admin.' });
    }

    const repStudent = await prisma.student.findUnique({
      where: { indexNumber: repUser.indexNumber },
      select: { id: true, indexNumber: true }
    });

    if (!repStudent) {
      return res.status(400).json({ error: 'Student record not found. Please contact admin.' });
    }

    // Check if already checked in
    const existingAttendance = await prisma.attendance.findFirst({
      where: {
        sessionId: sessionId,
        studentId: repStudent.id
      }
    });

    if (existingAttendance) {
      return res.status(400).json({ error: 'You have already checked in for this session' });
    }

    // Determine attendance status based on time
    const now = new Date();
    const sessionStart = new Date(session.startTime);
    
    // Use cached system settings (default to 15 if not available)
    const settings = await prisma.systemSettings.findFirst().catch(() => null);
    const lateWindowMinutes = settings?.lateWindowMinutes || 15;
    const lateThreshold = new Date(sessionStart.getTime() + lateWindowMinutes * 60000);

    let attendanceStatus = 'PRESENT';
    if (now > lateThreshold) {
      attendanceStatus = 'LATE';
    }

    // Create attendance record
    const ipAddress = req.ip || req.headers['x-forwarded-for'] || '127.0.0.1';
    
    const newAttendance = await prisma.attendance.create({
      data: {
        sessionId: session.id,
        studentId: repStudent.id,
        status: attendanceStatus,
        ipAddress,
        deviceInfo: 'Rep Dashboard',
        locationData: null
      }
    });

    // Create notification in background (non-blocking)
    setImmediate(async () => {
      try {
        await createNotificationHelper({
          studentIndex: repStudent.indexNumber,
          title: 'Attendance Checked In',
          message: `You checked in successfully for ${session.course.name} (${session.course.code}) as ${attendanceStatus}.`,
          type: 'SUCCESS'
        });
      } catch (err) {
        console.error('Failed to create notification:', err);
      }
    });

    res.status(201).json({
      message: `Check-in successful! Marked as ${attendanceStatus}.`,
      attendance: newAttendance
    });
  } catch (err) {
    console.error('Rep self check-in error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Proxy Attendance — a present student marks attendance for an absent classmate
 */
const markProxyAttendance = async (req, res) => {
  try {
    const { submitterIndexNumber, targetIndexNumber, reason, sessionId, qrCode, latitude, longitude } = req.body;

    if (!submitterIndexNumber || !targetIndexNumber || !reason) {
      return res.status(400).json({ error: 'Submitter index number, target index number, and reason are all required.' });
    }
    if (!sessionId && !qrCode) {
      return res.status(400).json({ error: 'A session ID or attendance code is required.' });
    }
    if (submitterIndexNumber.trim().toLowerCase() === targetIndexNumber.trim().toLowerCase()) {
      return res.status(400).json({ error: 'You cannot mark attendance for yourself using this form.' });
    }

    const [submitter, target] = await Promise.all([
      prisma.student.findUnique({ where: { indexNumber: submitterIndexNumber } }),
      prisma.student.findUnique({ where: { indexNumber: targetIndexNumber } })
    ]);

    if (!submitter) return res.status(404).json({ error: 'Your student record was not found. Check your index number.' });
    if (!target) return res.status(404).json({ error: 'Target student not found. Check the index number.' });

    // Resolve session
    let session;
    const jwt = require('jsonwebtoken');
    const { JWT_SECRET } = require('../middleware/auth');

    if (qrCode) {
      if (/^\d{6}$/.test(qrCode)) {
        session = await prisma.attendanceSession.findFirst({
          where: { manualCode: qrCode, status: 'OPEN' },
          include: { course: { select: { code: true, name: true } } }
        });
      } else {
        try {
          const decoded = jwt.verify(qrCode, JWT_SECRET);
          session = await prisma.attendanceSession.findUnique({
            where: { id: decoded.sessionId },
            include: { course: { select: { code: true, name: true } } }
          });
        } catch (_) {
          return res.status(400).json({ error: 'Invalid or expired code.' });
        }
      }
    } else {
      session = await prisma.attendanceSession.findUnique({
        where: { id: sessionId },
        include: { course: { select: { code: true, name: true } } }
      });
    }

    if (!session) return res.status(404).json({ error: 'Session not found.' });
    if (session.status !== 'OPEN') return res.status(400).json({ error: 'This session is closed.' });

    // Geofence check for the submitter
    if (session.latitude !== null && session.longitude !== null) {
      if (!latitude || !longitude) {
        return res.status(400).json({ error: 'Your GPS location is required to mark attendance.' });
      }
      const dist = getDistance(
        session.latitude, session.longitude,
        parseFloat(latitude), parseFloat(longitude)
      );
      const settings = await prisma.systemSettings.findFirst();
      const radius = settings?.geofenceRadiusMeters || 100;
      if (dist > radius) {
        return res.status(400).json({
          error: `You are ${Math.round(dist)}m away. You must be within ${radius}m to mark attendance.`
        });
      }
    }

    // Enrollment checks
    if (session.classId) {
      const [submitterMember, targetMember] = await Promise.all([
        prisma.classStudent.findUnique({
          where: { classId_studentId: { classId: session.classId, studentId: submitter.id } }
        }),
        prisma.classStudent.findUnique({
          where: { classId_studentId: { classId: session.classId, studentId: target.id } }
        })
      ]);

      if (!submitterMember) {
        return res.status(403).json({ error: 'You are not enrolled in this class.' });
      }
      if (!targetMember) {
        return res.status(403).json({ error: `${target.name} is not enrolled in this class.` });
      }
    }

    // Check target hasn't already checked in
    const existing = await prisma.attendance.findFirst({
      where: { sessionId: session.id, studentId: target.id }
    });
    if (existing) {
      return res.status(409).json({ error: `${target.name} has already checked in for this session.` });
    }

    // Determine status
    const settings = await prisma.systemSettings.findFirst();
    const lateWindow = settings?.lateWindowMinutes || 15;
    const minutesElapsed = (new Date() - new Date(session.startTime)) / 60000;
    const status = minutesElapsed > lateWindow ? 'LATE' : 'PRESENT';

    const ipAddress = req.ip || req.headers['x-forwarded-for'] || '127.0.0.1';

    let newAttendance;
    try {
      newAttendance = await prisma.attendance.create({
        data: {
          sessionId: session.id,
          studentId: target.id,
          status,
          ipAddress,
          deviceInfo: `Proxy by ${submitterIndexNumber}`,
          locationData: latitude && longitude ? JSON.stringify({ latitude, longitude }) : null,
          markedBy: submitterIndexNumber,
          markReason: reason.trim()
        }
      });
    } catch (err) {
      if (err.code === 'P2002') {
        return res.status(409).json({ error: `${target.name} has already checked in for this session.` });
      }
      throw err;
    }

    // Notifications (non-blocking)
    setImmediate(async () => {
      try {
        const courseName = session.course?.name || 'Class';
        const courseCode = session.course?.code || '';

        await createNotificationHelper({
          studentIndex: target.indexNumber,
          title: 'Attendance Marked',
          message: `${submitter.name} marked you as ${status} for ${courseName} (${courseCode}). Reason: ${reason}`,
          type: 'INFO'
        });

        if (session.repId) {
          await createNotificationHelper({
            userId: session.repId,
            title: 'Proxy Attendance',
            message: `${submitter.name} (${submitterIndexNumber}) marked ${target.name} (${targetIndexNumber}) as ${status} for ${courseName}. Reason: ${reason}`,
            type: 'WARNING'
          });
        }
      } catch (err) {
        console.error('Proxy attendance notification error:', err);
      }
    });

    res.status(201).json({
      message: `${target.name} marked as ${status}.`,
      attendance: newAttendance
    });
  } catch (err) {
    console.error('Proxy attendance error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Search classmates in a session's class by name (for proxy attendance)
 */
const searchClassmates = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { q, submitterIndex } = req.query;

    if (!q || String(q).trim().length < 2) {
      return res.json({ students: [] });
    }

    const session = await prisma.attendanceSession.findUnique({
      where: { id: sessionId },
      select: { classId: true, status: true }
    });

    if (!session || session.status !== 'OPEN') {
      return res.status(404).json({ error: 'Session not found or closed.' });
    }

    if (!session.classId) {
      return res.json({ students: [] });
    }

    const classStudents = await prisma.classStudent.findMany({
      where: {
        classId: session.classId,
        student: {
          name: { contains: String(q).trim(), mode: 'insensitive' },
          ...(submitterIndex ? { indexNumber: { not: String(submitterIndex) } } : {})
        }
      },
      include: {
        student: { select: { name: true, indexNumber: true } }
      },
      take: 10
    });

    res.json({
      students: classStudents.map(cs => ({
        name: cs.student.name,
        indexNumber: cs.student.indexNumber
      }))
    });
  } catch (err) {
    console.error('Search classmates error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  markAttendance,
  getSessionAttendance,
  getStudentHistory,
  updateAttendanceStatus,
  repSelfCheckIn,
  markProxyAttendance,
  searchClassmates
};
