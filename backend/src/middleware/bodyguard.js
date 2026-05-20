const jwt = require('jsonwebtoken');
const { z } = require('zod');
const prisma = require('../lib/prisma');
const { JWT_SECRET } = require('../middleware/auth');
const { isLocked, getLockExpiration, recordFailure, getCachedSession } = require('../lib/securityCache');
const { createNotificationHelper } = require('../controllers/notification.controller');

// Haversine formula to compute distance in meters between two coordinates
function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Earth's radius in meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // distance in meters
}

// Zod Schema to validate input
const checkInSchema = z.object({
  indexNumber: z.string().min(5, 'Index number must be at least 5 digits').max(15, 'Index number must be under 15 digits'),
  name: z.string().min(2, 'Name must be at least 2 characters'),
  deviceFingerprint: z.string().min(5, 'Invalid device fingerprint signature'),
  sessionId: z.string().uuid('Invalid session reference format').optional(),
  qrCode: z.string().optional(),
  latitude: z.union([z.number(), z.string(), z.null()]).optional(),
  longitude: z.union([z.number(), z.string(), z.null()]).optional(),
  networkSSID: z.string().optional(),
  deviceInfo: z.string().optional()
}).refine(data => data.sessionId || data.qrCode, {
  message: 'Either QR Code token or Session ID is required to mark attendance',
  path: ['sessionId', 'qrCode']
});

const bodyguard = async (req, res, next) => {
  const ipAddress = req.ip || req.headers['x-forwarded-for'] || '127.0.0.1';
  const indexNumber = req.body?.indexNumber;

  try {
    // 1. Lockout Checks
    if (indexNumber && isLocked(indexNumber)) {
      const expiry = getLockExpiration(indexNumber);
      return res.status(423).json({
        error: `Security Lock: This index number is locked due to multiple failed check-in attempts. Try again after ${new Date(expiry).toLocaleTimeString()}.`
      });
    }

    if (isLocked(ipAddress)) {
      const expiry = getLockExpiration(ipAddress);
      return res.status(423).json({
        error: `Security Lock: Your device IP is temporarily locked due to multiple security violations. Try again after ${new Date(expiry).toLocaleTimeString()}.`
      });
    }

    // 2. Input Validation (Zod)
    const validation = checkInSchema.safeParse(req.body);
    if (!validation.success) {
      const errorMsg = validation.error.errors.map(err => err.message).join(', ');
      return handleCheckInFailure(indexNumber, ipAddress, res, errorMsg, null);
    }

    const {
      name,
      deviceFingerprint,
      sessionId,
      qrCode,
      latitude,
      longitude,
      networkSSID
    } = validation.data;

    // Fetch system settings
    const settings = await prisma.systemSettings.findFirst();
    const geofenceRadius = settings ? settings.geofenceRadiusMeters : 100;
    const lateWindow = settings ? settings.lateWindowMinutes : 15;

    // A. Verify student exists
    const student = await prisma.student.findUnique({
      where: { indexNumber }
    });

    if (!student) {
      return handleCheckInFailure(indexNumber, ipAddress, res, 'Student record not found. Please verify your Index Number.', null);
    }

    // B. Check device fingerprint security
    // Verify fingerprint isn't used by another student
    const otherStudent = await prisma.student.findFirst({
      where: {
        deviceFingerprint,
        NOT: { id: student.id }
      }
    });

    if (otherStudent) {
      return handleCheckInFailure(
        indexNumber,
        ipAddress,
        res,
        'Security Block: This device is registered to another student. Multiple index check-ins from a single device are prohibited.',
        null
      );
    }

    // Bind fingerprint on first run, or verify it matches the bound one
    if (!student.deviceFingerprint) {
      await prisma.student.update({
        where: { id: student.id },
        data: { deviceFingerprint }
      });
    } else if (student.deviceFingerprint !== deviceFingerprint) {
      return handleCheckInFailure(
        indexNumber,
        ipAddress,
        res,
        'Security Block: Device mismatch. This account is locked to a different physical device.',
        null
      );
    }

    // C. Verify Session Integrity (using memory cache if possible)
    let targetSessionId = sessionId;
    let isQrCheckIn = !!qrCode;
    let decodedQr = null;

    if (isQrCheckIn) {
      try {
        decodedQr = jwt.verify(qrCode, JWT_SECRET);
        targetSessionId = decodedQr.sessionId;
      } catch (err) {
        return handleCheckInFailure(indexNumber, ipAddress, res, 'Invalid or expired QR code token. Please scan the current live QR code.', null);
      }
    }

    if (!targetSessionId) {
      return handleCheckInFailure(indexNumber, ipAddress, res, 'Invalid check-in details. Missing session context.', null);
    }

    // Retrieve cached session (falls back to DB and populates cache if OPEN)
    const session = await getCachedSession(targetSessionId);
    if (!session) {
      return handleCheckInFailure(indexNumber, ipAddress, res, 'Session not found.', null);
    }

    if (session.status !== 'OPEN') {
      return handleCheckInFailure(indexNumber, ipAddress, res, 'This attendance session has been closed.', session);
    }

    // Validate QR code matches active session QR
    if (isQrCheckIn) {
      if (session.qrCode !== qrCode) {
        return handleCheckInFailure(indexNumber, ipAddress, res, 'Outdated QR code. Please scan the live QR code.', session);
      }

      // Check expiry timestamp
      if (new Date() > new Date(session.qrCodeExpiry)) {
        return handleCheckInFailure(indexNumber, ipAddress, res, 'QR code has expired. Please scan the live QR code.', session);
      }
    } else {
      // Location-only check-in coordinate check
      if (session.latitude === null || session.longitude === null) {
        return handleCheckInFailure(
          indexNumber,
          ipAddress,
          res,
          'Location-only check-in is not allowed for this session because classroom coordinates are not defined. Scan the QR code.',
          session
        );
      }
    }

    // D. Validate Physical Features (Geofencing & SSID)
    if (session.sessionType === 'PHYSICAL' || !isQrCheckIn) {
      if (session.latitude !== null && session.longitude !== null) {
        if (!latitude || !longitude) {
          return handleCheckInFailure(indexNumber, ipAddress, res, 'Location services (GPS) are required to verify your classroom presence.', session);
        }

        const latFloat = parseFloat(latitude);
        const lonFloat = parseFloat(longitude);
        if (isNaN(latFloat) || isNaN(lonFloat)) {
          return handleCheckInFailure(indexNumber, ipAddress, res, 'Invalid GPS coordinates format.', session);
        }

        const distance = getDistance(session.latitude, session.longitude, latFloat, lonFloat);
        if (distance > geofenceRadius) {
          return handleCheckInFailure(
            indexNumber,
            ipAddress,
            res,
            `Out of range. You are ${Math.round(distance)}m away. You must be within ${geofenceRadius}m of the classroom.`,
            session
          );
        }
      }

      // Wi-Fi SSID Check
      if (session.networkSSID && session.networkSSID.trim() !== '') {
        if (!networkSSID || networkSSID.toLowerCase().trim() !== session.networkSSID.toLowerCase().trim()) {
          return handleCheckInFailure(
            indexNumber,
            ipAddress,
            res,
            `Network SSID mismatch. Please connect to the Wi-Fi network: ${session.networkSSID}`,
            session
          );
        }
      }
    }

    // E. Verify Class Enrollment
    if (session.classId) {
      const isMember = await prisma.classStudent.findUnique({
        where: {
          classId_studentId: { classId: session.classId, studentId: student.id }
        }
      });

      if (!isMember) {
        return handleCheckInFailure(
          indexNumber,
          ipAddress,
          res,
          'You are not enrolled in the class for this session. Only class members can mark attendance.',
          session
        );
      }
    }

    // F. Verify Duplicate Check-In
    const existingAttendance = await prisma.attendance.findFirst({
      where: {
        sessionId: session.id,
        studentId: student.id
      }
    });

    if (existingAttendance) {
      return handleCheckInFailure(indexNumber, ipAddress, res, 'You have already checked in for this session.', session);
    }

    // G. Determine Status based on grace period
    const minutesElapsed = (new Date() - new Date(session.startTime)) / 60000;
    const attendanceStatus = minutesElapsed > lateWindow ? 'LATE' : 'PRESENT';

    // Validation complete! Attach details to request for the controller to finalize persistence
    req.bodyguard = {
      student,
      session,
      attendanceStatus
    };

    next();
  } catch (err) {
    console.error('Bodyguard security error:', err);
    res.status(500).json({ error: 'Internal security checker error' });
  }
};

/**
 * Handle a check-in failure, increment failure counts, lock account if threshold is met,
 * and dispatch notifications.
 */
async function handleCheckInFailure(indexNumber, ip, res, reason, session) {
  // Record failures in cache
  let indexLock = { locked: false };
  let ipLock = { locked: false };

  if (indexNumber) {
    indexLock = recordFailure(indexNumber);
  }
  ipLock = recordFailure(ip);

  // If a lockout was just triggered, dispatch security notification
  if (indexLock.locked || ipLock.locked) {
    const lockTarget = indexLock.locked ? `Index Number: ${indexNumber}` : `IP: ${ip}`;
    const expiry = indexLock.locked ? indexLock.lockUntil : ipLock.lockUntil;

    // Send async alert to Rep
    if (session && session.repId) {
      (async () => {
        try {
          await createNotificationHelper({
            userId: session.repId,
            title: '🚨 GCTU Security Alert',
            message: `Security block triggered for ${lockTarget} after 10 failed check-in attempts. Account locked until ${new Date(
              expiry
            ).toLocaleTimeString()}. Last failure reason: ${reason}`,
            type: 'WARNING'
          });
        } catch (err) {
          console.error('Failed to dispatch security alert notification to REP:', err);
        }
      })();
    }

    return res.status(423).json({
      error: `Security Lock: Account temporarily locked due to multiple verification failures. Try again after ${new Date(
        expiry
      ).toLocaleTimeString()}.`
    });
  }

  return res.status(400).json({ error: reason });
}

module.exports = bodyguard;
