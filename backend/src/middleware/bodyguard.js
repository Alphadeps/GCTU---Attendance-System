const { z } = require('zod');
const prisma = require('../lib/prisma');
const { isLocked, getLockExpiration, recordFailure, getCachedSession, cacheSession } = require('../lib/securityCache');
const { createNotificationHelper } = require('../controllers/notification.controller');

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

let _settingsCache = null;
let _settingsCacheExpiry = 0;

async function getCachedSettings() {
  if (_settingsCache && Date.now() < _settingsCacheExpiry) return _settingsCache;
  _settingsCache = await prisma.systemSettings.findFirst();
  _settingsCacheExpiry = Date.now() + 60_000;
  return _settingsCache;
}

const checkInSchema = z.object({
  indexNumber: z.string().min(5, 'Index number must be at least 5 digits').max(15, 'Index number must be under 15 digits'),
  name: z.string().min(2, 'Name must be at least 2 characters'),
  sessionId: z.string().uuid('Invalid session reference format').optional(),
  manualCode: z.string().regex(/^\d{6}$/, 'Manual code must be exactly 6 digits').optional(),
  latitude: z.union([z.number(), z.string(), z.null()]).optional(),
  longitude: z.union([z.number(), z.string(), z.null()]).optional(),
  networkSSID: z.string().optional(),
  deviceInfo: z.string().optional()
}).refine(data => data.sessionId || data.manualCode, {
  message: 'A session ID or 6-digit manual code is required to mark attendance',
  path: ['sessionId', 'manualCode']
});

const bodyguard = async (req, res, next) => {
  const ipAddress = req.ip || req.headers['x-forwarded-for'] || '127.0.0.1';
  const indexNumber = req.body?.indexNumber;

  try {
    // 1. Lockout Check
    if (indexNumber && isLocked(indexNumber)) {
      const expiry = getLockExpiration(indexNumber);
      return res.status(423).json({
        error: `Account locked due to multiple failed attempts. Try again after ${new Date(expiry).toLocaleTimeString()}.`
      });
    }

    // 2. Input Validation
    const validation = checkInSchema.safeParse(req.body);
    if (!validation.success) {
      const errorMsg = validation.error.errors.map(err => err.message).join(', ');
      return handleCheckInFailure(indexNumber, ipAddress, res, errorMsg, null);
    }

    const { name, sessionId, manualCode, latitude, longitude, networkSSID } = validation.data;
    const isManualCode = !!manualCode;

    // 3. Resolve session — manual code queries DB directly; GPS path uses cache
    const sessionPromise = isManualCode
      ? prisma.attendanceSession.findFirst({
          where: { manualCode, status: 'OPEN' },
          include: { course: { select: { code: true, name: true } } }
        })
      : sessionId
        ? getCachedSession(sessionId)
        : Promise.resolve(null);

    const [settings, student, rawSession] = await Promise.all([
      getCachedSettings(),
      prisma.student.findUnique({ where: { indexNumber } }),
      sessionPromise
    ]);

    let session;
    if (isManualCode) {
      if (!rawSession) {
        return handleCheckInFailure(indexNumber, ipAddress, res, 'Invalid code. Check the 6-digit code shown on your rep\'s screen.', null);
      }
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
        manualCode: rawSession.manualCode,
        networkSSID: rawSession.networkSSID,
        courseCode: rawSession.course?.code,
        courseName: rawSession.course?.name
      };
      cacheSession(rawSession);
    } else {
      session = rawSession;
    }

    if (!student) {
      return handleCheckInFailure(indexNumber, ipAddress, res, 'Student record not found. Verify your Index Number.', null);
    }

    if (!session) {
      return handleCheckInFailure(indexNumber, ipAddress, res, 'Session not found.', null);
    }
    if (session.status !== 'OPEN') {
      return handleCheckInFailure(indexNumber, ipAddress, res, 'This attendance session has been closed.', session);
    }

    // 4. Geofencing & SSID check — applies to all check-ins, including manual code
    const geofenceRadius = settings ? settings.geofenceRadiusMeters : 100;

    if (session.latitude !== null && session.longitude !== null) {
      if (!latitude || !longitude) {
        return handleCheckInFailure(
          indexNumber, ipAddress, res,
          'Your GPS location is required for this session. Enable location services and try again.',
          session
        );
      }

      const latFloat = parseFloat(latitude);
      const lonFloat = parseFloat(longitude);
      if (isNaN(latFloat) || isNaN(lonFloat)) {
        return handleCheckInFailure(indexNumber, ipAddress, res, 'Invalid GPS coordinates received. Try again.', session);
      }

      const distance = getDistance(session.latitude, session.longitude, latFloat, lonFloat);
      if (distance > geofenceRadius) {
        return handleCheckInFailure(
          indexNumber, ipAddress, res,
          `You are ${Math.round(distance)}m away from the classroom (limit: ${geofenceRadius}m). Move closer and try again.`,
          session
        );
      }
    }

    if (session.networkSSID && session.networkSSID.trim() !== '') {
      if (!networkSSID || networkSSID.toLowerCase().trim() !== session.networkSSID.toLowerCase().trim()) {
        return handleCheckInFailure(
          indexNumber, ipAddress, res,
          `Connect to the class Wi-Fi network "${session.networkSSID}" and try again.`,
          session
        );
      }
    }

    // 5. Class enrollment + duplicate check in parallel
    const [isMember, existingAttendance] = await Promise.all([
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

    if (session.classId && !isMember) {
      return handleCheckInFailure(indexNumber, ipAddress, res, 'You are not enrolled in this class.', session);
    }

    if (existingAttendance) {
      return handleCheckInFailure(indexNumber, ipAddress, res, 'You have already checked in for this session.', session);
    }

    // 6. Determine attendance status
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

  if (indexNumber) indexLock = recordFailure(indexNumber);

  if (indexLock.locked) {
    if (session && session.repId) {
      setImmediate(async () => {
        try {
          await createNotificationHelper({
            userId: session.repId,
            title: 'Security Alert',
            message: `Multiple failed check-in attempts for Index Number: ${indexNumber}. Account locked until ${new Date(indexLock.lockUntil).toLocaleTimeString()}. Last reason: ${reason}`,
            type: 'WARNING'
          });
        } catch (err) {
          console.error('Failed to dispatch security alert notification:', err);
        }
      });
    }

    return res.status(423).json({
      error: `Account locked due to multiple failed attempts. Try again after ${new Date(indexLock.lockUntil).toLocaleTimeString()}.`
    });
  }

  return res.status(400).json({ error: reason });
}

module.exports = bodyguard;
