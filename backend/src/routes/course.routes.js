const express = require('express');
const prisma = require('../lib/prisma');
const { getMinAttendance, attendanceStatus, classCourseAttendance, warnLowAttendance } = require('../lib/lowAttendance');
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

// Classes whose attendance in a course the user may see: a rep's own class, otherwise every class taking it
async function analyticsClassIds(req, courseId) {
  if (req.user.role === 'REP') {
    const repClass = await prisma.class.findFirst({ where: { repId: req.user.id }, select: { id: true } });
    return repClass ? [repClass.id] : [];
  }
  const links = await prisma.classCourse.findMany({ where: { courseId }, select: { classId: true } });
  return links.map(l => l.classId);
}

// Get course attendance analytics against the minimum attendance (REP, LECTURER, ADMIN, SUPERADMIN)
router.get('/:id/analytics', protect, authorizeRoles('REP', 'LECTURER', 'ADMIN', 'SUPERADMIN'), async (req, res) => {
  try {
    const { id } = req.params;

    const course = await prisma.course.findUnique({
      where: { id }
    });

    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }

    const [min, classIds] = await Promise.all([getMinAttendance(), analyticsClassIds(req, id)]);
    const classes = await prisma.class.findMany({ where: { id: { in: classIds } }, select: { id: true, displayName: true } });

    let totalSessionsCount = 0;
    const analytics = [];
    for (const cls of classes) {
      const { totalSessions, students } = await classCourseAttendance(cls.id, id);
      totalSessionsCount += totalSessions;
      for (const s of students) {
        analytics.push({
          ...s,
          className: cls.displayName,
          status: attendanceStatus(s.attendanceRate, min),
          isAtRisk: s.attendanceRate < min
        });
      }
    }
    analytics.sort((a, b) => a.name.localeCompare(b.name));

    res.json({
      course,
      analytics,
      totalSessionsCount,
      minAttendancePercent: min
    });
  } catch (err) {
    console.error('Course analytics error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Send warning notifications to students below the minimum attendance (REP, ADMIN, SUPERADMIN)
router.post('/:id/warn-at-risk', protect, authorizeRoles('REP', 'ADMIN', 'SUPERADMIN'), async (req, res) => {
  try {
    const { id } = req.params;

    const course = await prisma.course.findUnique({
      where: { id }
    });

    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }

    const classIds = await analyticsClassIds(req, id);
    const concluded = await prisma.attendanceSession.count({
      where: { courseId: id, classId: { in: classIds }, status: { in: ['CLOSED', 'APPROVED'] } }
    });
    if (concluded === 0) {
      return res.status(400).json({ error: 'No sessions have concluded yet' });
    }

    const min = await getMinAttendance();
    let warningsSent = 0;
    for (const classId of classIds) {
      warningsSent += await warnLowAttendance(classId, id, { min, course });
    }

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
