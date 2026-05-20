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

module.exports = {
  markAttendance,
  getSessionAttendance,
  getStudentHistory,
  updateAttendanceStatus
};
