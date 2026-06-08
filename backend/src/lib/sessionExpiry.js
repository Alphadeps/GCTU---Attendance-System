const prisma = require('./prisma');
const { removeCachedSession } = require('./securityCache');
const { createNotificationHelper } = require('../controllers/notification.controller');

const INACTIVITY_THRESHOLD_MS = 60 * 60 * 1000; // 1 hour
const CHECK_INTERVAL_MS = 5 * 60 * 1000;        // Check every 5 minutes

async function expireInactiveSessions() {
  try {
    const now = new Date();
    const inactivityCutoff = new Date(now.getTime() - INACTIVITY_THRESHOLD_MS);

    const openSessions = await prisma.attendanceSession.findMany({
      where: { status: 'OPEN' },
      include: {
        course: true,
        attendances: {
          orderBy: { checkInTime: 'desc' },
          take: 1,
          select: { checkInTime: true }
        }
      }
    });

    for (const session of openSessions) {
      const lastActivity = session.attendances[0]?.checkInTime || session.startTime;
      const isPastEndTime = session.endTime < now;
      const isInactive = new Date(lastActivity) < inactivityCutoff;

      if (!isPastEndTime && !isInactive) continue;

      const reason = isPastEndTime ? 'scheduled end time reached' : '1 hour of inactivity';
      console.log(`[SessionExpiry] Auto-closing session ${session.id} (${session.course?.name}): ${reason}`);

      await autoCloseSession(session, reason);
    }
  } catch (err) {
    console.error('[SessionExpiry] Error during expiry check:', err);
  }
}

async function autoCloseSession(session, reason) {
  // 1. Mark session closed
  await prisma.attendanceSession.update({
    where: { id: session.id },
    data: { status: 'CLOSED', endTime: new Date() }
  });

  removeCachedSession(session.id);

  // 2. Determine eligible students for absent marking
  let eligibleStudents = [];

  if (session.classId) {
    const classStudents = await prisma.classStudent.findMany({
      where: { classId: session.classId },
      select: { student: { select: { id: true, indexNumber: true, name: true } } }
    });
    eligibleStudents = classStudents.map(cs => cs.student);
  } else {
    // Scope to students enrolled in any class that takes this course
    const classesWithCourse = await prisma.classCourse.findMany({
      where: { courseId: session.courseId },
      select: { classId: true }
    });
    const classIds = classesWithCourse.map(cc => cc.classId);
    if (classIds.length > 0) {
      const classStudents = await prisma.classStudent.findMany({
        where: { classId: { in: classIds } },
        select: { student: { select: { id: true, indexNumber: true, name: true } } }
      });
      const seen = new Set();
      eligibleStudents = classStudents
        .map(cs => cs.student)
        .filter(s => { if (seen.has(s.id)) return false; seen.add(s.id); return true; });
    }
  }

  // 3. Find who already checked in
  const checkIns = await prisma.attendance.findMany({
    where: { sessionId: session.id },
    select: { studentId: true }
  });
  const checkedInIds = new Set(checkIns.map(c => c.studentId));
  const absentStudents = eligibleStudents.filter(s => !checkedInIds.has(s.id));

  // 4. Batch-create ABSENT records
  if (absentStudents.length > 0) {
    await prisma.attendance.createMany({
      data: absentStudents.map(student => ({
        sessionId: session.id,
        studentId: student.id,
        status: 'ABSENT',
        ipAddress: '0.0.0.0',
        deviceInfo: `Auto-expired: ${reason}`,
        locationData: null
      })),
      skipDuplicates: true
    });
  }

  // 5. Notify the rep
  try {
    await createNotificationHelper({
      userId: session.repId,
      title: 'Session Auto-Closed',
      message: `The attendance session for ${session.course?.name || 'class'} (${session.course?.code || ''}) was automatically closed due to ${reason}. ${absentStudents.length} students marked absent.`,
      type: 'WARNING'
    });
  } catch (err) {
    console.error('[SessionExpiry] Failed to notify rep:', err.message);
  }
}

function startSessionExpiryScheduler() {
  console.log('[SessionExpiry] Scheduler started — checking every 5 minutes');
  expireInactiveSessions(); // run immediately on startup
  return setInterval(expireInactiveSessions, CHECK_INTERVAL_MS);
}

module.exports = { startSessionExpiryScheduler };
