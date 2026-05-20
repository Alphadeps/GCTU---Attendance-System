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
const markAttendance = async (req, res) => {
  try {
    const { indexNumber, name, qrCode, sessionId, deviceFingerprint, latitude, longitude, networkSSID, deviceInfo } = req.body;

    // Fetch system settings
    const settings = await prisma.systemSettings.findFirst();
    const geofenceRadius = settings ? settings.geofenceRadiusMeters : 100;
    const lateWindow = settings ? settings.lateWindowMinutes : 15;

    if (!indexNumber || !name || !deviceFingerprint || (!qrCode && !sessionId)) {
      return res.status(400).json({ error: 'Index number, name, device fingerprint, and either QR code or Session ID are required' });
    }

    // A. Verify student exists by index number
    const student = await prisma.student.findUnique({
      where: { indexNumber }
    });

    if (!student) {
      return res.status(400).json({ error: 'Student record not found. Please verify your Index Number.' });
    }

    // B. Check device fingerprint security
    // Check if this fingerprint is registered to ANY OTHER student
    const otherStudentWithOwner = await prisma.student.findFirst({
      where: {
        deviceFingerprint,
        NOT: { id: student.id }
      }
    });

    if (otherStudentWithOwner) {
      return res.status(400).json({
        error: 'Security Block: This device is already registered to another student. Multiple check-ins from the same device are not permitted.'
      });
    }

    // Verify or bind fingerprint to current student
    if (!student.deviceFingerprint) {
      await prisma.student.update({
        where: { id: student.id },
        data: { deviceFingerprint }
      });
    } else if (student.deviceFingerprint !== deviceFingerprint) {
      return res.status(400).json({
        error: 'Security Block: Device fingerprint mismatch. Your account is locked to a different device. Contact an admin to reset.'
      });
    }

    // C. Resolve and validate the attendance session
    let targetSessionId = sessionId;
    let isQrCheckIn = !!qrCode;

    let session;
    if (isQrCheckIn) {
      let decoded;
      try {
        decoded = jwt.verify(qrCode, JWT_SECRET);
        targetSessionId = decoded.sessionId;
      } catch (err) {
        return res.status(400).json({ error: 'Invalid or expired QR code token. Please scan the current live QR code.' });
      }

      session = await prisma.attendanceSession.findUnique({
        where: { id: targetSessionId },
        include: { course: true }
      });

      if (!session) {
        return res.status(404).json({ error: 'Session not found' });
      }

      if (session.status !== 'OPEN') {
        return res.status(400).json({ error: 'This attendance session has been closed' });
      }

      // Validate QR code matches active session QR
      if (session.qrCode !== qrCode) {
        return res.status(400).json({ error: 'Outdated QR code. Please scan the live QR code.' });
      }

      // Validate QR code expiry timestamp
      if (new Date() > new Date(session.qrCodeExpiry)) {
        return res.status(400).json({ error: 'QR code has expired. Please scan the live QR code.' });
      }
    } else {
      // Location-Only Check-in
      session = await prisma.attendanceSession.findUnique({
        where: { id: targetSessionId },
        include: { course: true }
      });

      if (!session) {
        return res.status(404).json({ error: 'Session not found' });
      }

      if (session.status !== 'OPEN') {
        return res.status(400).json({ error: 'This attendance session has been closed' });
      }

      // Enforce physical coordinate verification for location-only check-in
      if (session.latitude === null || session.longitude === null) {
        return res.status(400).json({
          error: 'Location-only check-in is not allowed for this session because classroom coordinates are not defined. Please scan the QR code instead.'
        });
      }
    }

    // D. Validate Physical features (Geofencing & SSID)
    // Enforce geofencing if class is PHYSICAL or student is doing Location-Only Check-in
    if (session.sessionType === 'PHYSICAL' || !isQrCheckIn) {
      if (session.latitude !== null && session.longitude !== null) {
        if (!latitude || !longitude) {
          return res.status(400).json({ error: 'Location services (GPS) are required to verify your check-in.' });
        }

        const distance = getDistance(
          session.latitude,
          session.longitude,
          parseFloat(latitude),
          parseFloat(longitude)
        );

        if (distance > geofenceRadius) {
          return res.status(400).json({
            error: `Out of range. You are ${Math.round(distance)} meters away. You must be within ${geofenceRadius} meters of the classroom to check in.`
          });
        }
      }

      if (session.networkSSID && session.networkSSID.trim() !== '') {
        if (!networkSSID || networkSSID.toLowerCase().trim() !== session.networkSSID.toLowerCase().trim()) {
          return res.status(400).json({
            error: `Network SSID mismatch. Please connect to the Wi-Fi network: ${session.networkSSID}`
          });
        }
      }
    }

    // E. If session is class-scoped, verify student belongs to that class
    if (session.classId) {
      const isMember = await prisma.classStudent.findUnique({
        where: {
          classId_studentId: { classId: session.classId, studentId: student.id }
        }
      });

      if (!isMember) {
        return res.status(403).json({
          error: 'You are not enrolled in the class for this session. Only registered class members can mark attendance.'
        });
      }
    }

    // F. Check duplicate check-in
    const existingAttendance = await prisma.attendance.findFirst({
      where: {
        sessionId: session.id,
        studentId: student.id
      }
    });

    if (existingAttendance) {
      return res.status(400).json({ error: 'You have already checked in for this session.' });
    }

    // G. Determine status based on grace period
    const minutesElapsed = (new Date() - new Date(session.startTime)) / 60000;
    const attendanceStatus = minutesElapsed > lateWindow ? 'LATE' : 'PRESENT';

    // H. Save record
    const ipAddress = req.ip || req.headers['x-forwarded-for'] || '127.0.0.1';
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

    // Trigger Notifications in background
    (async () => {
      try {
        const courseName = session.course?.name || 'Class';
        const courseCode = session.course?.code || '';

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
