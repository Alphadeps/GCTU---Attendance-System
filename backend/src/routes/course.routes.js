const express = require('express');
const prisma = require('../lib/prisma');
const { protect, authorizeRoles } = require('../middleware/auth');

const router = express.Router();

// Create course (REP, ADMIN and SUPERADMIN)
router.post('/', protect, authorizeRoles('REP', 'ADMIN', 'SUPERADMIN'), async (req, res) => {
  try {
    const { name, code } = req.body;

    if (!name || !code) {
      return res.status(400).json({ error: 'Course name and code are required' });
    }

    const existingName = await prisma.course.findUnique({ where: { name } });
    if (existingName) {
      return res.status(400).json({ error: 'Course name already exists' });
    }

    const existingCode = await prisma.course.findUnique({ where: { code } });
    if (existingCode) {
      return res.status(400).json({ error: 'Course code already exists' });
    }

    const course = await prisma.course.create({
      data: { name, code }
    });

    res.status(201).json(course);
  } catch (err) {
    console.error('Create course error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all courses (REP, LECTURER, ADMIN, SUPERADMIN)
router.get('/', protect, authorizeRoles('REP', 'LECTURER', 'ADMIN', 'SUPERADMIN'), async (req, res) => {
  try {
    let courses;
    if (req.user.role === 'REP') {
      const repClass = await prisma.class.findFirst({
        where: { repId: req.user.id }
      });
      if (repClass) {
        const linkedCourses = await prisma.classCourse.findMany({
          where: { classId: repClass.id },
          include: { course: true }
        });
        courses = linkedCourses.map(lc => lc.course);
      } else {
        courses = [];
      }
    } else {
      courses = await prisma.course.findMany({
        orderBy: { name: 'asc' }
      });
    }
    res.json(courses);
  } catch (err) {
    console.error('Get courses error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get course analytics for 75% rule (REP, LECTURER, ADMIN, SUPERADMIN)
router.get('/:id/analytics', protect, authorizeRoles('REP', 'LECTURER', 'ADMIN', 'SUPERADMIN'), async (req, res) => {
  try {
    const { id } = req.params;

    const course = await prisma.course.findUnique({
      where: { id }
    });

    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }

    const sessions = await prisma.attendanceSession.findMany({
      where: { courseId: id, status: { in: ['CLOSED', 'APPROVED'] } },
      select: { id: true }
    });

    const totalSessionsCount = sessions.length;

    let students;
    if (req.user.role === 'REP') {
      const repClass = await prisma.class.findFirst({
        where: { repId: req.user.id }
      });
      if (repClass) {
        const classStudents = await prisma.classStudent.findMany({
          where: { classId: repClass.id },
          include: {
            student: {
              select: {
                id: true,
                name: true,
                indexNumber: true,
                email: true
              }
            }
          }
        });
        students = classStudents.map(cs => cs.student);
      } else {
        students = [];
      }
    } else {
      students = await prisma.student.findMany({
        select: {
          id: true,
          name: true,
          indexNumber: true,
          email: true
        },
        orderBy: { name: 'asc' }
      });
    }

    const studentSessionIds = sessions.map(s => s.id);

    const analytics = await Promise.all(students.map(async (student) => {
      const presentOrLateCount = totalSessionsCount > 0 ? await prisma.attendance.count({
        where: {
          studentId: student.id,
          sessionId: { in: studentSessionIds },
          status: { in: ['PRESENT', 'LATE'] }
        }
      }) : 0;

      const attendanceRate = totalSessionsCount > 0
        ? Math.round((presentOrLateCount / totalSessionsCount) * 100)
        : 100;

      return {
        id: student.id,
        name: student.name,
        indexNumber: student.indexNumber,
        email: student.email,
        presentCount: presentOrLateCount,
        totalConcluded: totalSessionsCount,
        attendanceRate,
        isAtRisk: attendanceRate < 75
      };
    }));

    res.json({
      course,
      analytics,
      totalSessionsCount
    });
  } catch (err) {
    console.error('Course analytics error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Trigger warning notifications to at-risk students (REP, ADMIN, SUPERADMIN)
const { createNotificationHelper } = require('../controllers/notification.controller');
router.post('/:id/warn-at-risk', protect, authorizeRoles('REP', 'ADMIN', 'SUPERADMIN'), async (req, res) => {
  try {
    const { id } = req.params;

    const course = await prisma.course.findUnique({
      where: { id }
    });

    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }

    const sessions = await prisma.attendanceSession.findMany({
      where: { courseId: id, status: { in: ['CLOSED', 'APPROVED'] } },
      select: { id: true }
    });

    const totalSessionsCount = sessions.length;
    if (totalSessionsCount === 0) {
      return res.status(400).json({ error: 'No sessions have concluded yet' });
    }

    let students;
    if (req.user.role === 'REP') {
      const repClass = await prisma.class.findFirst({
        where: { repId: req.user.id }
      });
      if (repClass) {
        const classStudents = await prisma.classStudent.findMany({
          where: { classId: repClass.id },
          include: {
            student: {
              select: {
                id: true,
                name: true,
                indexNumber: true,
                email: true
              }
            }
          }
        });
        students = classStudents.map(cs => cs.student);
      } else {
        students = [];
      }
    } else {
      students = await prisma.student.findMany({
        select: { id: true, name: true, indexNumber: true, email: true }
      });
    }

    const studentSessionIds = sessions.map(s => s.id);
    let warningsSent = 0;

    await Promise.all(students.map(async (student) => {
      const presentOrLateCount = await prisma.attendance.count({
        where: {
          studentId: student.id,
          sessionId: { in: studentSessionIds },
          status: { in: ['PRESENT', 'LATE'] }
        }
      });

      const attendanceRate = Math.round((presentOrLateCount / totalSessionsCount) * 100);

      if (attendanceRate < 75) {
        await createNotificationHelper({
          studentIndex: student.indexNumber,
          title: '⚠️ GCTU Low Attendance Alert',
          message: `Your attendance in ${course.name} (${course.code}) is currently at ${attendanceRate}%, which is below the required 75% examination threshold. Please attend upcoming lectures.`,
          type: 'WARNING'
        });
        warningsSent++;
      }
    }));

    res.json({ message: 'Warning notifications sent successfully', warningsSent });
  } catch (err) {
    console.error('Warn at risk error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete course (ADMIN and SUPERADMIN)
router.delete('/:id', protect, authorizeRoles('ADMIN', 'SUPERADMIN'), async (req, res) => {
  try {
    const { id } = req.params;

    // Check if course is linked to any sessions
    const linkedSessions = await prisma.attendanceSession.count({
      where: { courseId: id }
    });

    if (linkedSessions > 0) {
      return res.status(400).json({ error: 'Cannot delete course with active/past attendance sessions' });
    }

    await prisma.course.delete({ where: { id } });
    res.json({ message: 'Course deleted successfully' });
  } catch (err) {
    console.error('Delete course error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update course (ADMIN and SUPERADMIN)
router.patch('/:id', protect, authorizeRoles('ADMIN', 'SUPERADMIN'), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, code } = req.body;

    if (!name || !code) {
      return res.status(400).json({ error: 'Course name and code are required' });
    }

    // Check if name already exists (excluding current course)
    const existingName = await prisma.course.findFirst({
      where: {
        name: name.trim(),
        NOT: { id }
      }
    });

    if (existingName) {
      return res.status(400).json({ error: 'Course name already exists' });
    }

    // Check if code already exists (excluding current course)
    const existingCode = await prisma.course.findFirst({
      where: {
        code: code.trim().toUpperCase(),
        NOT: { id }
      }
    });

    if (existingCode) {
      return res.status(400).json({ error: 'Course code already exists' });
    }

    const updated = await prisma.course.update({
      where: { id },
      data: {
        name: name.trim(),
        code: code.trim().toUpperCase()
      }
    });

    res.json(updated);
  } catch (err) {
    console.error('Update course error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
