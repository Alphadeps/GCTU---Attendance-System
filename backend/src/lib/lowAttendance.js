const prisma = require('./prisma');
const { countPresentByStudent } = require('./attendanceStats');

const DEFAULT_MIN_ATTENDANCE = 75;
const WARNING_TITLE = '⚠️ Low Attendance Alert';
// Don't send the same student more than one warning per course within this window
const WARNING_REPEAT_HOURS = 24;

async function getMinAttendance() {
  const settings = await prisma.systemSettings.findFirst({ select: { minAttendancePercent: true } }).catch(() => null);
  return settings?.minAttendancePercent ?? DEFAULT_MIN_ATTENDANCE;
}

// SAFE at or above the minimum, WARNING within 15 points below it, AT RISK under that
function attendanceStatus(rate, min) {
  if (rate >= min) return 'SAFE';
  if (rate >= min - 15) return 'WARNING';
  return 'AT RISK';
}

/**
 * Attendance of every student in one class for one course, counting only that class's
 * concluded (closed or approved) sessions.
 */
async function classCourseAttendance(classId, courseId) {
  const [sessions, classStudents] = await Promise.all([
    prisma.attendanceSession.findMany({
      where: { classId, courseId, status: { in: ['CLOSED', 'APPROVED'] } },
      select: { id: true }
    }),
    prisma.classStudent.findMany({
      where: { classId },
      include: { student: { select: { id: true, name: true, indexNumber: true, email: true } } }
    })
  ]);
  const totalSessions = sessions.length;
  const presentCounts = await countPresentByStudent(sessions.map(s => s.id));
  const students = classStudents.map(({ student }) => {
    const presentCount = presentCounts.get(student.id) || 0;
    const attendanceRate = totalSessions > 0 ? Math.round((presentCount / totalSessions) * 100) : 100;
    return { ...student, presentCount, totalConcluded: totalSessions, attendanceRate };
  });
  return { totalSessions, students };
}

/**
 * Notify the students of a class whose attendance in a course is below the minimum.
 * Skips students already warned for this course in the last WARNING_REPEAT_HOURS.
 * Returns how many warnings were sent.
 */
async function warnLowAttendance(classId, courseId, { min, course } = {}) {
  min = min ?? await getMinAttendance();
  course = course ?? await prisma.course.findUnique({ where: { id: courseId }, select: { name: true, code: true } });
  if (!course) return 0;

  const { totalSessions, students } = await classCourseAttendance(classId, courseId);
  if (totalSessions === 0) return 0;
  const low = students.filter(s => s.attendanceRate < min);
  if (low.length === 0) return 0;

  const courseTag = `(${course.code})`;
  const recent = await prisma.notification.findMany({
    where: {
      studentIndex: { in: low.map(s => s.indexNumber) },
      title: WARNING_TITLE,
      message: { contains: courseTag },
      createdAt: { gte: new Date(Date.now() - WARNING_REPEAT_HOURS * 3600e3) }
    },
    select: { studentIndex: true }
  });
  const alreadyWarned = new Set(recent.map(n => n.studentIndex));

  const warnings = low
    .filter(s => !alreadyWarned.has(s.indexNumber))
    .map(s => ({
      studentIndex: s.indexNumber,
      title: WARNING_TITLE,
      message: `Your attendance in ${course.name} ${courseTag} is ${s.attendanceRate}% (${s.presentCount} of ${totalSessions} classes). The minimum is ${min}%. Please attend upcoming lectures.`,
      type: 'WARNING'
    }));
  if (warnings.length > 0) await prisma.notification.createMany({ data: warnings });
  return warnings.length;
}

/**
 * Students below the minimum in any course of the given classes (all classes when omitted).
 */
async function lowAttendanceList({ classIds } = {}) {
  const min = await getMinAttendance();
  const links = await prisma.classCourse.findMany({
    where: classIds ? { classId: { in: classIds } } : {},
    include: {
      class: { select: { id: true, displayName: true } },
      course: { select: { id: true, name: true, code: true } }
    }
  });
  const rows = [];
  for (const link of links) {
    const { totalSessions, students } = await classCourseAttendance(link.classId, link.courseId);
    if (totalSessions === 0) continue;
    for (const s of students) {
      if (s.attendanceRate >= min) continue;
      rows.push({
        classId: link.class.id,
        className: link.class.displayName,
        courseId: link.course.id,
        courseCode: link.course.code,
        courseName: link.course.name,
        indexNumber: s.indexNumber,
        name: s.name,
        presentCount: s.presentCount,
        totalConcluded: totalSessions,
        attendanceRate: s.attendanceRate,
        status: attendanceStatus(s.attendanceRate, min)
      });
    }
  }
  rows.sort((a, b) => a.attendanceRate - b.attendanceRate || a.className.localeCompare(b.className));
  return { minAttendancePercent: min, students: rows };
}

module.exports = {
  DEFAULT_MIN_ATTENDANCE,
  getMinAttendance,
  attendanceStatus,
  classCourseAttendance,
  warnLowAttendance,
  lowAttendanceList
};
