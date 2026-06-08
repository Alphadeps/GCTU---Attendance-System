const prisma = require('../lib/prisma');
const { createNotificationHelper } = require('./notification.controller');
const { cacheSession, removeCachedSession } = require('../lib/securityCache');
const { logAudit } = require('../lib/logger');

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

    // Check for an existing open session scoped to this class only.
    // Each class can have at most one OPEN session at a time; different classes are independent.
    const conflictWhere = classId
      ? { status: 'OPEN', classId }
      : { status: 'OPEN', classId: null };

    const scope = classId ? 'your class' : 'the system (no class assigned)';

    // Generate a 6-digit manual check-in code (fallback for GPS failures)
    const manualCode = Math.floor(100000 + Math.random() * 900000).toString();

    const startTime = new Date();

    // Wrap the conflict check + create in a serializable transaction to prevent
    // two concurrent requests from both passing the check and creating duplicate sessions.
    let session;
    try {
      session = await prisma.$transaction(async (tx) => {
        const conflict = await tx.attendanceSession.findFirst({ where: conflictWhere });
        if (conflict) {
          const err = new Error('SESSION_CONFLICT');
          err.isConflict = true;
          throw err;
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
      }, { isolationLevel: 'Serializable' });
    } catch (txErr) {
      if (txErr.isConflict || txErr.code === 'P2034') {
        return res.status(400).json({ error: `There is already an active open session for ${scope}. Close it first.` });
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
    const sessions = await prisma.attendanceSession.findMany({
      where: { status: 'OPEN' },
      include: {
        course: true,
        rep: { select: { username: true } }
      },
      orderBy: { startTime: 'desc' }
    });
    res.json(sessions);
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

    if (session.status !== 'OPEN') {
      return res.status(400).json({ error: 'Session is already closed or approved' });
    }

    // 1. Update session status to CLOSED
    const closedSession = await prisma.attendanceSession.update({
      where: { id },
      data: {
        status: 'CLOSED',
        endTime: new Date()
      }
    });

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

    if (!lecturerSignature) {
      return res.status(400).json({ error: 'Lecturer signature (base64 image) is required' });
    }

    const session = await prisma.attendanceSession.findUnique({
      where: { id },
      include: { course: true }
    });
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (session.status === 'OPEN') {
      return res.status(400).json({ error: 'Session must be closed before approval' });
    }

    const approvedSession = await prisma.attendanceSession.update({
      where: { id },
      data: {
        status: 'APPROVED',
        lecturerSignature,
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
      approvedAt: new Date().toISOString()
    });

    // Trigger Notifications in background
    (async () => {
      try {
        const courseName = session.course?.name || 'Class';
        await createNotificationHelper({
          userId: session.repId,
          title: 'Session Approved & Signed',
          message: `The attendance session for ${courseName} has been signed and approved by ${req.user.username}.`,
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
