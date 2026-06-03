const prisma = require('./prisma');

// In-Memory cache map instances
const activeSessions = new Map();
const failedAttempts = new Map();
const lockedKeys = new Map();

// Configuration parameters
const LOCK_TIME_MS = 15 * 60 * 1000; // 15 minutes lockout
const FAILURE_THRESHOLD = 10;        // 10 failed attempts

/**
 * Cache an active open session
 */
function cacheSession(session) {
  if (!session) return;
  activeSessions.set(session.id, {
    id: session.id,
    courseId: session.courseId,
    repId: session.repId,
    classId: session.classId,
    sessionType: session.sessionType,
    startTime: session.startTime,
    endTime: session.endTime,
    status: session.status,
    latitude: session.latitude,
    longitude: session.longitude,
    manualCode: session.manualCode,
    networkSSID: session.networkSSID,
    courseCode: session.course?.code,
    courseName: session.course?.name
  });
  console.log(`[SecurityCache] Cached session ${session.id}`);
}

/**
 * Retrieve a cached session, falling back to database query if not cached
 */
async function getCachedSession(sessionId) {
  if (activeSessions.has(sessionId)) {
    return activeSessions.get(sessionId);
  }

  // Fallback to database
  const session = await prisma.attendanceSession.findUnique({
    where: { id: sessionId },
    include: { course: true }
  });

  if (session && session.status === 'OPEN') {
    cacheSession(session);
    return activeSessions.get(sessionId);
  }

  return session; // returns null or DB session (closed/approved)
}

/**
 * Remove session from cache when closed
 */
function removeCachedSession(sessionId) {
  const deleted = activeSessions.delete(sessionId);
  if (deleted) {
    console.log(`[SecurityCache] Evicted session ${sessionId}`);
  }
}

/**
 * Update cached session attributes (e.g. refreshed QR codes)
 */
function updateCachedSession(sessionId, updates) {
  if (activeSessions.has(sessionId)) {
    const current = activeSessions.get(sessionId);
    activeSessions.set(sessionId, { ...current, ...updates });
    console.log(`[SecurityCache] Updated cached session ${sessionId}`);
  }
}

/**
 * Check if an Index Number or IP address is currently locked out
 */
function isLocked(key) {
  if (!lockedKeys.has(key)) return false;

  const lockData = lockedKeys.get(key);
  if (new Date() > new Date(lockData.lockUntil)) {
    // Lock has expired, clean it up
    lockedKeys.delete(key);
    failedAttempts.delete(key);
    console.log(`[SecurityCache] Unlocked expired lockout for ${key}`);
    return false;
  }

  return true;
}

/**
 * Fetch the lockout expiration date
 */
function getLockExpiration(key) {
  const lockData = lockedKeys.get(key);
  return lockData ? lockData.lockUntil : null;
}

/**
 * Record a check-in failure. Locks key if threshold is reached.
 */
function recordFailure(key) {
  if (isLocked(key)) {
    return { locked: true, lockUntil: getLockExpiration(key) };
  }

  const now = new Date();
  const current = failedAttempts.get(key) || { count: 0, lastAttempt: now };

  // Increment failure count
  const newCount = current.count + 1;
  failedAttempts.set(key, { count: newCount, lastAttempt: now });

  console.log(`[SecurityCache] Failure recorded for ${key}. Count: ${newCount}/${FAILURE_THRESHOLD}`);

  if (newCount >= FAILURE_THRESHOLD) {
    const lockUntil = new Date(Date.now() + LOCK_TIME_MS);
    lockedKeys.set(key, { lockUntil });
    failedAttempts.delete(key); // Reset counter while locked
    console.log(`[SecurityCache] LOCKOUT TRIGGERED for ${key} until ${lockUntil.toISOString()}`);
    return { locked: true, lockUntil };
  }

  return { locked: false, count: newCount };
}

/**
 * Reset failed attempts and remove any lockouts for a successful check-in
 */
function resetFailures(key) {
  failedAttempts.delete(key);
  lockedKeys.delete(key);
  console.log(`[SecurityCache] Reset security counters for ${key}`);
}

module.exports = {
  cacheSession,
  getCachedSession,
  removeCachedSession,
  updateCachedSession,
  isLocked,
  getLockExpiration,
  recordFailure,
  resetFailures
};
