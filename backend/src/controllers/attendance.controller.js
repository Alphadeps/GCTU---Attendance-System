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

    // Save record
    const newAttendance = await prisma.attendance.create({
      data: {
        sessionId: session.id,
        studentId: student.id,
        status: attendanceStatus,
        ipAddress,
        deviceInfo: deviceInfo || 'Unknown Browser',
        locationData: latitude && longitude ? JSON.stringify({ latitude, longitude }) : null
      }
    });

    // Reset security failure counters for this student and IP on successful check-in
    resetFailures(student.indexNumber);
    resetFailures(ipAddress);

    // Trigger Notifications in background
    (async () => {
      try {
        const courseName = session.courseName || 'Class';
        const courseCode = session.courseCode || '';

        // Student notification
        await createNotificationHelper({
          studentIndex: student.indexNumber,
          title: 'Attendance Checked In',
          message: `Checked in successfully for ${courseName} (${courseCode}) as ${attendanceStatus}.`,
          type: 'SUCCESS'
        });

        // Representative notification
        await createNotificationHelper({
          userId: session.repId,
          title: 'Student Checked In',
          message: `${student.name} (${student.indexNumber}) marked attendance for ${courseName} (${courseCode}).`,
          type: 'INFO'
        });
      } catch (notifyErr) {
        console.error('Failed to trigger attendance mark notifications:', notifyErr);
      }
    })();

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

    // Get rep's assigned class
    const repClass = await prisma.class.findFirst({
      where: { repId: req.user.id }
    });

    if (!repClass) {
      return res.status(403).json({ error: 'You are not assigned to any class' });
    }

    // Get session and verify it belongs to rep's class
    const session = await prisma.attendanceSession.findUnique({
      where: { id: sessionId },
      include: {
        course: true
      }
    });

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (session.classId !== repClass.id) {
      return res.status(403).json({ error: 'This session does not belong to your class' });
    }

    if (session.status !== 'OPEN') {
      return res.status(400).json({ error: 'This session is not open for attendance' });
    }

    // Get rep's student record (should exist if they have index number)
    const repUser = await prisma.user.findUnique({
      where: { id: req.user.id }
    });

    if (!repUser.indexNumber) {
      return res.status(400).json({ error: 'Your account does not have an index number. Please contact admin.' });
    }

    const repStudent = await prisma.student.findUnique({
      where: { indexNumber: repUser.indexNumber }
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
    const settings = await prisma.systemSettings.findFirst();
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

    // Create notification
    await createNotificationHelper({
      studentIndex: repStudent.indexNumber,
      title: 'Attendance Checked In',
      message: `You checked in successfully for ${session.course.name} (${session.course.code}) as ${attendanceStatus}.`,
      type: 'SUCCESS'
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

module.exports = {
  markAttendance,
  getSessionAttendance,
  getStudentHistory,
  updateAttendanceStatus,
  repSelfCheckIn
};
