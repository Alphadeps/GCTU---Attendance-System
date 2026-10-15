const prisma = require('../lib/prisma');
const { createNotificationHelper } = require('./notification.controller');
const { cacheSession, removeCachedSession } = require('../lib/securityCache');
const { logAudit } = require('../lib/logger');
const { warnLowAttendance } = require('../lib/lowAttendance');

// Shared helper: resolve which students are eligible for absent-marking on a session.
// Exported so sessionExpiry.js can use the same logic without duplication.
async function resolveEligibleStudents(classId, courseId) {
  if (classId) {
    const classStudents = await prisma.classStudent.findMany({
      where: { classId },
      select: { student: { select: { id: true, indexNumber: true, name: true } } }
    });
    return classStudents.map(cs => cs.student);
  }

  if (!courseId) {
    console.warn('[AbsentMarking] Session has no classId and no courseId — skipping absent marking');
    return [];
  }

  const classesWithCourse = await prisma.classCourse.findMany({
    where: { courseId },
    select: { classId: true }
  });
  const classIds = classesWithCourse.map(cc => cc.classId);

  if (classIds.length === 0) {
    console.warn(`[AbsentMarking] No classes linked to courseId ${courseId} — skipping absent marking`);
    return [];
  }

  const classStudents = await prisma.classStudent.findMany({
    where: { classId: { in: classIds } },
    select: { student: { select: { id: true, indexNumber: true, name: true } } }
  });
  const seen = new Set();
  return classStudents
    .map(cs => cs.student)
    .filter(s => { if (seen.has(s.id)) return false; seen.add(s.id); return true; });
}

// 1. Create a session
const createSession = async (req, res) => {
  try {
    const { courseId, courseCode, sessionType, endTime, latitude, longitude, networkSSID } = req.body;

    if (!sessionType || !endTime) {
      return res.status(400).json({ error: 'Session type and end time are required' });
    }

    // Resolve course
    let course;
    if (courseId) {
      course = await prisma.course.findUnique({ where: { id: courseId } });
    } else if (courseCode) {
      course = await prisma.course.findUnique({ where: { code: courseCode } });
    }

    if (!course) {
      return res.status(400).json({ error: 'Valid Course ID or Course Code is required' });
    }

    // Resolve classId if rep — also validate the course belongs to their class
    let classId = null;
    if (req.user && req.user.role === 'REP') {
      const repClass = await prisma.class.findFirst({
        where: { repId: req.user.id }
      });

      if (!repClass) {
        return res.status(400).json({ error: 'You must be assigned to a class before you can open sessions. Contact your administrator.' });
      }

      classId = repClass.id;

      // Verify the requested course is linked to their class
      const courseLink = await prisma.classCourse.findUnique({
        where: {
          classId_courseId: { classId: repClass.id, courseId: course.id }
        }
      });

      if (!courseLink) {
        return res.status(400).json({ error: `The course "${course.name}" is not linked to your class. Contact your administrator to add it.` });
      }
    }

    // Each class can have at most one OPEN session at a time; different classes are independent.
    const conflictWhere = classId
      ? { status: 'OPEN', classId }
      : { status: 'OPEN', classId: null };

    const scope = classId ? 'your class' : 'the system (no class assigned)';

    const startTime = new Date();

    // Serialize the conflict check + create per class with a transaction-scoped advisory lock.
    // A SERIALIZABLE transaction was used here before, but Postgres' predicate locking on the
    // shared `status = 'OPEN'` index (or a whole-table seq scan) made concurrent requests from
    // reps in *different* classes abort each other with a serialization failure — so when one
    // rep opened a session, other reps opening at the same time were rejected.
    // The advisory lock only blocks requests for the same class key.
    let session;
    try {
      session = await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`session-open:${classId || 'none'}`}))`;

        const conflict = await tx.attendanceSession.findFirst({ where: conflictWhere, select: { id: true } });
        if (conflict) {
          const err = new Error('SESSION_CONFLICT');
          err.isConflict = true;
          throw err;
        }

        // 6-digit manual check-in code (fallback for GPS failures). Check-in resolves sessions by
        // code across all OPEN sessions, so avoid handing out a code another open session uses.
        let manualCode;
        for (let attempt = 0; attempt < 5; attempt++) {
          manualCode = Math.floor(100000 + Math.random() * 900000).toString();
          const clash = await tx.attendanceSession.findFirst({
            where: { manualCode, status: 'OPEN' },
            select: { id: true }
          });
          if (!clash) break;
        }

        return tx.attendanceSession.create({
          data: {
            courseId: course.id,
            repId: req.user.id,
            classId,
            sessionType,
            startTime,
            endTime: new Date(endTime),
            status: 'OPEN',
            latitude: latitude ? parseFloat(latitude) : null,
            longitude: longitude ? parseFloat(longitude) : null,
            networkSSID: networkSSID || null,
            manualCode
          },
          include: { course: true }
        });
      });
    } catch (txErr) {
      if (txErr.isConflict) {
        return res.status(400).json({ error: `There is already an active open session for ${scope}. Close it first.` });
      }
      if (txErr.code === 'P2034' || txErr.code === 'P2028') {
        return res.status(503).json({ error: 'The server is busy. Please try opening the session again.' });
      }
      throw txErr;
    }

    // Register active session in security cache
    cacheSession(session);

    // Send response immediately
    res.status(201).json(session);

    // Trigger Notifications in background (after response sent)
    setImmediate(async () => {
      try {
        // Representative notification
        await createNotificationHelper({
          userId: req.user.id,
          title: 'Session Opened Successfully',
          message: `Attendance session for ${course.name} (${course.code}) is now active.`,
          type: 'SUCCESS'
        });

        // Only notify students in the class (if classId exists)
        if (classId) {
          // Get students in this specific class only (limit to 100 to prevent timeout)
          const classStudents = await prisma.classStudent.findMany({
            where: { classId },
            include: { student: { select: { indexNumber: true } } },
            take: 100 // Reduced limit to prevent timeout
          });

          // Batch create notifications for better performance
          const notifications = classStudents.map(cs => ({
            studentIndex: cs.student.indexNumber,
            title: 'New Class Session Open',
            message: `${course.name} (${course.code}) has started. Click to mark attendance.`,
            type: 'INFO',
            isRead: false
          }));

          // Create notifications in batches of 50
          for (let i = 0; i < notifications.length; i += 50) {
            const batch = notifications.slice(i, i + 50);
            await prisma.notification.createMany({ data: batch }).catch(err => {
              console.error('Batch notification error:', err);
            });
          }
        }
      } catch (notifyErr) {
        console.error('Failed to trigger session open notifications:', notifyErr);
      }
    });
  } catch (err) {
    console.error('Create session error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// 2. Get active (OPEN) sessions
const getActiveSessions = async (req, res) => {
  try {
    // Public endpoint (student portal): never expose manualCode or geofence coordinates.
    const sessions = await prisma.attendanceSession.findMany({
      where: { status: 'OPEN' },
      select: {
        id: true,
        courseId: true,
        classId: true,
        sessionType: true,
        startTime: true,
        endTime: true,
        status: true,
        course: { select: { id: true, name: true, code: true } },
        rep: { select: { username: true } }
      },
      orderBy: { startTime: 'desc' }
    });
    res.json(sessions.map(s => ({
      ...s,
      courseName: s.course?.name,
      courseCode: s.course?.code
    })));
  } catch (err) {
    console.error('Get active sessions error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// 3. Close session & mark absent students
const closeSession = async (req, res) => {
  try {
    const { id } = req.params;

    const session = await prisma.attendanceSession.findUnique({
      where: { id },
      include: { course: true }
    });
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Reps may only close sessions they opened
    if (req.user.role === 'REP' && session.repId !== req.user.id) {
      return res.status(403).json({ error: 'You can only close sessions you opened.' });
    }

    if (session.status !== 'OPEN') {
      return res.status(400).json({ error: 'Session is already closed or approved' });
    }

    // 1. Update session status to CLOSED — guarded so a concurrent auto-expiry/close can't double-process
    const updated = await prisma.attendanceSession.updateMany({
      where: { id, status: 'OPEN' },
      data: {
        status: 'CLOSED',
        endTime: new Date()
      }
    });
    if (updated.count === 0) {
      return res.status(400).json({ error: 'Session is already closed or approved' });
    }
    const closedSession = await prisma.attendanceSession.findUnique({ where: { id } });

    // Remove closed session from security cache
    removeCachedSession(id);

    // 2. Find eligible students for absent marking
    const eligibleStudents = await resolveEligibleStudents(session.classId, session.courseId);

    // 3. Find students who checked in (use Set for O(1) lookup)
    const checkIns = await prisma.attendance.findMany({
      where: { sessionId: id },
      select: { studentId: true }
    });
    const checkedInStudentIds = new Set(checkIns.map(c => c.studentId));

    // 4. Determine absent students
    const absentStudents = eligibleStudents.filter(student => !checkedInStudentIds.has(student.id));

    // 5. Create ABSENT attendance records in batch
    if (absentStudents.length > 0) {
      await prisma.attendance.createMany({
        data: absentStudents.map(student => ({
          sessionId: id,
          studentId: student.id,
          status: 'ABSENT',
          ipAddress: '0.0.0.0',
          deviceInfo: 'Auto-marked Absent',
          locationData: null
        })),
        skipDuplicates: true // Prevent errors if record already exists
      });
    }

    // Trigger Notifications in background
    (async () => {
      try {
        // Students who have fallen below the minimum attendance get a warning
        if (session.classId && session.courseId) {
          await warnLowAttendance(session.classId, session.courseId, { course: session.course })
            .catch(err => console.error('Low attendance warnings failed:', err));
        }

        const courseName = session.course?.name || 'Class';
        const courseCode = session.course?.code || '';

        // Notify representative
        await createNotificationHelper({
          userId: session.repId,
          title: 'Session Closed & Processed',
          message: `The attendance session for ${courseName} (${courseCode}) has been closed. ${absentStudents.length} students marked absent.`,
          type: 'WARNING'
        });

        // Notify lecturers assigned to this course/class (not all lecturers)
        if (session.classId && session.courseId) {
          const assignedLecturers = await prisma.lecturerAssignment.findMany({
            where: {
              classId: session.classId,
              courseId: session.courseId
            },
            select: { lecturerId: true }
          });

          // Batch create notifications for lecturers
          if (assignedLecturers.length > 0) {
            await prisma.notification.createMany({
              data: assignedLecturers.map(la => ({
                userId: la.lecturerId,
                title: 'Attendance Pending Approval',
                message: `The session for ${courseName} (${courseCode}) is ready for review and signature.`,
                type: 'INFO',
                isRead: false
              }))
            });
          }
        } else {
          // Fallback: notify all lecturers if no specific assignment
          const lecturers = await prisma.user.findMany({
            where: { role: 'LECTURER' },
            select: { id: true },
            take: 50 // Limit to prevent overwhelming
          });

          if (lecturers.length > 0) {
            await prisma.notification.createMany({
              data: lecturers.map(lecturer => ({
                userId: lecturer.id,
                title: 'Attendance Pending Approval',
                message: `The session for ${courseName} (${courseCode}) is ready for review and signature.`,
                type: 'INFO',
                isRead: false
              }))
            });
          }
        }
      } catch (notifyErr) {
        console.error('Failed to trigger session close notifications:', notifyErr);
      }
    })();

    res.json({
      message: 'Session closed successfully. Absent students marked.',
      session: closedSession,
      absentCount: absentStudents.length
    });
  } catch (err) {
    console.error('Close session error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// 4. Approve session (Lecturer only)
const approveSession = async (req, res) => {
  try {
    const { id } = req.params;
    const { lecturerSignature } = req.body; // Expect base64 signature
    // The lecturer signs on the rep's phone at the end of class and types their name
    const lecturerName = typeof req.body.lecturerName === 'string' ? req.body.lecturerName.trim() : '';

    if (!lecturerSignature) {
      return res.status(400).json({ error: 'Lecturer signature (base64 image) is required' });
    }
    if (lecturerName.length < 2 || lecturerName.length > 100) {
      return res.status(400).json({ error: "Enter the lecturer's full name (2–100 characters)" });
    }

    const session = await prisma.attendanceSession.findUnique({
      where: { id },
      include: { course: true }
    });
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Reps may only get sign-off on sessions they opened
    if (req.user.role === 'REP' && session.repId !== req.user.id) {
      return res.status(403).json({ error: 'You can only get sign-off for sessions you opened.' });
    }

    if (session.status === 'OPEN') {
      return res.status(400).json({ error: 'Session must be closed before approval' });
    }
    if (session.status === 'APPROVED') {
      return res.status(400).json({ error: 'This session has already been signed off.' });
    }

    const approvedSession = await prisma.attendanceSession.update({
      where: { id },
      data: {
        status: 'APPROVED',
        lecturerSignature,
        lecturerName,
        approvedByLecturerId: req.user.id,
        approvedAt: new Date()
      }
    });

    // Log session approval
    logAudit('SESSION_APPROVED', {
      user: req.user?.username || 'system',
      userId: req.user?.id,
      ip: req.ip,
      sessionId: id,
      courseName: session.course?.name,
      repId: session.repId,
      lecturerName,
      approvedAt: new Date().toISOString()
    });

    // Trigger Notifications in background
    (async () => {
      try {
        const courseName = session.course?.name || 'Class';
        await createNotificationHelper({
          userId: session.repId,
          title: 'Session Approved & Signed',
          message: `The attendance session for ${courseName} has been signed off by ${lecturerName}.`,
          type: 'SUCCESS'
        });
      } catch (notifyErr) {
        console.error('Failed to trigger session approval notifications:', notifyErr);
      }
    })();

    res.json({
      message: 'Session approved successfully by lecturer',
      session: approvedSession
    });
  } catch (err) {
    console.error('Approve session error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// 5. Get Session by ID (paginated attendances)
const getSessionById = async (req, res) => {
  try {
    const { id } = req.params;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit) || 50));
    const skip = (page - 1) * limit;

    const session = await prisma.attendanceSession.findUnique({
      where: { id },
      include: {
        course: true,
        rep: { select: { username: true } },
        approvedByLecturer: { select: { username: true } },
        attendances: {
          include: {
            student: { select: { name: true, indexNumber: true, email: true } }
          },
          orderBy: { checkInTime: 'asc' },
          take: limit,
          skip
        }
      }
    });

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const totalAttendances = await prisma.attendance.count({ where: { sessionId: id } });

    res.json({
      ...session,
      pagination: {
        page,
        limit,
        total: totalAttendances,
        pages: Math.ceil(totalAttendances / limit)
      }
    });
  } catch (err) {
    console.error('Get session by ID error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  createSession,
  getActiveSessions,
  closeSession,
  approveSession,
  getSessionById,
  resolveEligibleStudents
};
