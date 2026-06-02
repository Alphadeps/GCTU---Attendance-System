const jwt = require('jsonwebtoken');
const QRCode = require('qrcode');
const prisma = require('../lib/prisma');
const { JWT_SECRET } = require('../middleware/auth');
const { createNotificationHelper } = require('./notification.controller');
const { cacheSession, removeCachedSession, updateCachedSession } = require('../lib/securityCache');
const { logAudit } = require('../lib/logger');

// 1. Create a session
const createSession = async (req, res) => {
  try {
    const { courseId, courseCode, sessionType, endTime, latitude, longitude, networkSSID } = req.body;

    if (!sessionType || !endTime) {
      return res.status(400).json({ error: 'Session type and end time are required' });
    }

    // Check if there is already an active open session
    const activeOpen = await prisma.attendanceSession.findFirst({
      where: { status: 'OPEN' }
    });
    if (activeOpen) {
      return res.status(400).json({ error: 'There is already an active open attendance session. Close it first.' });
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

    // Fetch system settings for QR expiry
    const settings = await prisma.systemSettings.findFirst();
    const qrExpirySeconds = settings ? settings.qrExpirySeconds : 30;

    // Initialize session with temporary QR values
    const startTime = new Date();
    const session = await prisma.attendanceSession.create({
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
        qrCode: '',
        qrCodeExpiry: new Date()
      }
    });

    // Generate first QR code (valid for qrExpirySeconds)
    const qrExpiry = new Date(Date.now() + (qrExpirySeconds * 1000));
    const qrCodeToken = jwt.sign(
      { sessionId: session.id, expiry: qrExpiry.getTime() },
      JWT_SECRET,
      { expiresIn: `${qrExpirySeconds}s` }
    );

    // Generate a short 6-digit manual code for fallback
    const manualCode = Math.floor(100000 + Math.random() * 900000).toString();

    // Update session with QR code and manual code
    const updatedSession = await prisma.attendanceSession.update({
      where: { id: session.id },
      data: {
        qrCode: qrCodeToken,
        qrCodeExpiry: qrExpiry,
        manualCode
      },
      include: { course: true }
    });

    // Register active session in security cache
    cacheSession(updatedSession);

    // Generate base64 QR code image
    const qrCodeImage = await QRCode.toDataURL(qrCodeToken);

    // Send response immediately
    res.status(201).json({
      ...updatedSession,
      qrCodeImage
    });

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

    // 2. Find eligible students (if classId is present, only class students; otherwise, all)
    let eligibleStudents = [];
    if (session.classId) {
      const classStudents = await prisma.classStudent.findMany({
        where: { classId: session.classId },
        select: { student: { select: { id: true, indexNumber: true, name: true } } }
      });
      eligibleStudents = classStudents.map(cs => cs.student);
    } else {
      eligibleStudents = await prisma.student.findMany({
        select: { id: true, indexNumber: true, name: true }
      });
    }

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

// 5. Refresh QR Code
const refreshQRCode = async (req, res) => {
  try {
    const { id } = req.params;

    const session = await prisma.attendanceSession.findUnique({ where: { id } });
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (session.status !== 'OPEN') {
      return res.status(400).json({ error: 'Cannot refresh QR code for closed or approved sessions' });
    }

    // Fetch system settings for QR expiry
    const settings = await prisma.systemSettings.findFirst();
    const qrExpirySeconds = settings ? settings.qrExpirySeconds : 30;

    // Generate new QR code (valid for qrExpirySeconds)
    const qrExpiry = new Date(Date.now() + (qrExpirySeconds * 1000));
    const qrCodeToken = jwt.sign(
      { sessionId: session.id, expiry: qrExpiry.getTime() },
      JWT_SECRET,
      { expiresIn: `${qrExpirySeconds}s` }
    );

    // Generate a short 6-digit manual code for fallback
    const manualCode = Math.floor(100000 + Math.random() * 900000).toString();

    const updated = await prisma.attendanceSession.update({
      where: { id },
      data: {
        qrCode: qrCodeToken,
        qrCodeExpiry: qrExpiry,
        manualCode
      }
    });

    // Update refreshed QR parameters in security cache
    updateCachedSession(id, {
      qrCode: qrCodeToken,
      qrCodeExpiry: qrExpiry,
      manualCode
    });

    // Generate base64 QR code image
    const qrCodeImage = await QRCode.toDataURL(qrCodeToken);

    res.json({
      message: 'QR code refreshed successfully',
      qrCode: updated.qrCode,
      qrCodeExpiry: updated.qrCodeExpiry,
      qrCodeImage
    });
  } catch (err) {
    console.error('Refresh QR code error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// 6. Get Session by ID
const getSessionById = async (req, res) => {
  try {
    const { id } = req.params;
    const session = await prisma.attendanceSession.findUnique({
      where: { id },
      include: {
        course: true,
        rep: { select: { username: true } },
        approvedByLecturer: { select: { username: true } },
        attendances: {
          include: {
            student: {
              select: { name: true, indexNumber: true, email: true }
            }
          },
          orderBy: { checkInTime: 'asc' }
        }
      }
    });

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    res.json(session);
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
  refreshQRCode,
  getSessionById
};
