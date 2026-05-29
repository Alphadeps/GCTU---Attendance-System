const jwt = require('jsonwebtoken');
const { z } = require('zod');
const prisma = require('../lib/prisma');
const { JWT_SECRET } = require('../middleware/auth');
const { isLocked, getLockExpiration, recordFailure, getCachedSession, cacheSession } = require('../lib/securityCache');
const { createNotificationHelper } = require('../controllers/notification.controller');

// Haversine formula to compute distance in meters between two coordinates
function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3;
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

// Module-level settings cache (60s TTL) — avoids a DB hit on every check-in
let _settingsCache = null;
let _settingsCacheExpiry = 0;

async function getCachedSettings() {
  if (_settingsCache && Date.now() < _settingsCacheExpiry) return _settingsCache;
  _settingsCache = await prisma.systemSettings.findFirst();
  _settingsCacheExpiry = Date.now() + 60_000;
  return _settingsCache;
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

    const { name, deviceFingerprint, sessionId, qrCode, latitude, longitude, networkSSID } = validation.data;

    // 3. Parse QR code (sync) to derive targetSessionId early
    let targetSessionId = sessionId;
    const isQrCheckIn = !!qrCode;
    let decodedQr = null;
    let isManualCode = false;

    if (isQrCheckIn) {
      if (/^\d{6}$/.test(qrCode)) {
        isManualCode = true;
        // targetSessionId resolved via DB below
      } else {
        try {
          decodedQr = jwt.verify(qrCode, JWT_SECRET);
          targetSessionId = decodedQr.sessionId;
        } catch (err) {
          return handleCheckInFailure(indexNumber, ipAddress, res, 'Invalid or expired QR code token. Please scan the current live QR code.', null);
        }
      }
    }

    // 4. ROUND-TRIP 1: Fetch settings + student + session in parallel
    const sessionPromise = isManualCode
      ? prisma.attendanceSession.findFirst({
          where: { manualCode: qrCode, status: 'OPEN' },
          include: { course: { select: { code: true, name: true } } }
        })
      : targetSessionId
        ? getCachedSession(targetSessionId)
        : Promise.resolve(null);

    const [settings, student, rawSession] = await Promise.all([
      getCachedSettings(),
      prisma.student.findUnique({ where: { indexNumber } }),
      sessionPromise
    ]);

    // Resolve session object into the flat format used throughout
    let session;
    if (isManualCode) {
      if (!rawSession) {
        return handleCheckInFailure(indexNumber, ipAddress, res, 'Invalid manual code. Please check with your representative.', null);
      }
      targetSessionId = rawSession.id;
      // Build the flat session object matching the cache format
      session = {
        id: rawSession.id,
        courseId: rawSession.courseId,
        repId: rawSession.repId,
        classId: rawSession.classId,
        sessionType: rawSession.sessionType,
        startTime: rawSession.startTime,
        endTime: rawSession.endTime,
        status: rawSession.status,
        latitude: rawSession.latitude,
        longitude: rawSession.longitude,
        qrCode: rawSession.qrCode,
        qrCodeExpiry: rawSession.qrCodeExpiry,
        manualCode: rawSession.manualCode,
        networkSSID: rawSession.networkSSID,
        courseCode: rawSession.course?.code,
        courseName: rawSession.course?.name
      };
      // Populate session cache for subsequent check-ins on the same session
      cacheSession(rawSession);
    } else {
      session = rawSession;
    }

    // A. Validate student exists
    if (!student) {
      return handleCheckInFailure(indexNumber, ipAddress, res, 'Student record not found. Please verify your Index Number.', null);
    }

    // B. Validate session exists and is open
    if (!session) {
      return handleCheckInFailure(indexNumber, ipAddress, res, 'Session not found.', null);
    }
    if (session.status !== 'OPEN') {
      return handleCheckInFailure(indexNumber, ipAddress, res, 'This attendance session has been closed.', session);
    }

    // C. Validate QR code matches active session QR or manual code
    if (isQrCheckIn) {
      const isManualMatch = isManualCode && session.manualCode === qrCode;
      const isQrMatch = !isManualCode && session.qrCode === qrCode;

      if (!isManualMatch && !isQrMatch) {
        return handleCheckInFailure(indexNumber, ipAddress, res, 'Outdated or invalid code. Please use the current live code.', session);
      }

      if (isQrMatch && new Date() > new Date(session.qrCodeExpiry)) {
        return handleCheckInFailure(indexNumber, ipAddress, res, 'QR code has expired. Please scan the live QR code.', session);
      }
    } else {
      if (session.latitude === null || session.longitude === null) {
        return handleCheckInFailure(
          indexNumber, ipAddress, res,
          'Location-only check-in is not allowed for this session because classroom coordinates are not defined. Scan the QR code.',
          session
        );
      }
    }

    // D. Geofencing & SSID check (sync computation, no DB)
    const geofenceRadius = settings ? settings.geofenceRadiusMeters : 100;
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
            indexNumber, ipAddress, res,
            `Out of range. You are ${Math.round(distance)}m away. You must be within ${geofenceRadius}m of the classroom.`,
            session
          );
        }
      }

      if (session.networkSSID && session.networkSSID.trim() !== '') {
        if (!networkSSID || networkSSID.toLowerCase().trim() !== session.networkSSID.toLowerCase().trim()) {
          return handleCheckInFailure(
            indexNumber, ipAddress, res,
            `Network SSID mismatch. Please connect to the Wi-Fi network: ${session.networkSSID}`,
            session
          );
        }
      }
    }

    // 5. ROUND-TRIP 2: Device conflict + class enrollment + duplicate — all in parallel
    const [otherStudent, isMember, existingAttendance] = await Promise.all([
      prisma.student.findFirst({
        where: { deviceFingerprint, NOT: { id: student.id } },
        select: { id: true }
      }),
      session.classId
        ? prisma.classStudent.findUnique({
            where: { classId_studentId: { classId: session.classId, studentId: student.id } },
            select: { classId: true }
          })
        : Promise.resolve({ classId: 'ok' }),
      prisma.attendance.findFirst({
        where: { sessionId: session.id, studentId: student.id },
        select: { id: true }
      })
    ]);

    // E. Device fingerprint security checks
    if (otherStudent) {
      return handleCheckInFailure(
        indexNumber, ipAddress, res,
        'Security Block: This device is registered to another student. Multiple index check-ins from a single device are prohibited.',
        null
      );
    }

    if (student.deviceFingerprint && student.deviceFingerprint !== deviceFingerprint) {
      return handleCheckInFailure(
        indexNumber, ipAddress, res,
        'Security Block: Device mismatch. This account is locked to a different physical device.',
        null
      );
    }

    // F. Class enrollment check
    if (session.classId && !isMember) {
      return handleCheckInFailure(
        indexNumber, ipAddress, res,
        'You are not enrolled in the class for this session. Only class members can mark attendance.',
        session
      );
    }

    // G. Duplicate check-in (fast path — DB unique constraint is the ultimate guard in the controller)
    if (existingAttendance) {
      return handleCheckInFailure(indexNumber, ipAddress, res, 'You have already checked in for this session.', session);
    }

    // 6. ROUND-TRIP 3 (conditional): Bind device fingerprint on first check-in
    if (!student.deviceFingerprint) {
      await prisma.student.update({
        where: { id: student.id },
        data: { deviceFingerprint }
      });
    }

    // H. Determine attendance status
    const lateWindow = settings ? settings.lateWindowMinutes : 15;
    const minutesElapsed = (new Date() - new Date(session.startTime)) / 60000;
    const attendanceStatus = minutesElapsed > lateWindow ? 'LATE' : 'PRESENT';

    req.bodyguard = { student, session, attendanceStatus };
    next();
  } catch (err) {
    console.error('Bodyguard security error:', err);
    res.status(500).json({ error: 'Internal security checker error' });
  }
};

async function handleCheckInFailure(indexNumber, ip, res, reason, session) {
  let indexLock = { locked: false };
  let ipLock = { locked: false };

  if (indexNumber) indexLock = recordFailure(indexNumber);
  ipLock = recordFailure(ip);

  if (indexLock.locked || ipLock.locked) {
    const lockTarget = indexLock.locked ? `Index Number: ${indexNumber}` : `IP: ${ip}`;
    const expiry = indexLock.locked ? indexLock.lockUntil : ipLock.lockUntil;

    if (session && session.repId) {
      setImmediate(async () => {
        try {
          await createNotificationHelper({
            userId: session.repId,
            title: '🚨 GCTU Security Alert',
            message: `Security block triggered for ${lockTarget} after 10 failed check-in attempts. Account locked until ${new Date(expiry).toLocaleTimeString()}. Last failure reason: ${reason}`,
            type: 'WARNING'
          });
        } catch (err) {
          console.error('Failed to dispatch security alert notification to REP:', err);
        }
      });
    }

    return res.status(423).json({
      error: `Security Lock: Account temporarily locked due to multiple verification failures. Try again after ${new Date(expiry).toLocaleTimeString()}.`
    });
  }

  return res.status(400).json({ error: reason });
}

module.exports = bodyguard;
