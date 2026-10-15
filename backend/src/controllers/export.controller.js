const xlsx = require('xlsx');
const prisma = require('../lib/prisma');

const STATUS_CODE = { PRESENT: 'P', LATE: 'L', ABSENT: 'A' };

function sessionLabel(s) {
  const d = new Date(s.startTime);
  const date = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit', timeZone: 'Africa/Accra' });
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Accra' });
  return `${date} ${time}`;
}

function safeFilePart(value) {
  return String(value || '').replace(/[^A-Za-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 60) || 'class';
}

/**
 * GET /api/reports/export?courseId=...&classId=...
 * Excel workbook of a class's attendance for one course:
 *  - "Attendance": one row per student, one column per concluded session (P / L / A), totals and %.
 *  - "Sessions": one row per session with type, lecturer sign-off and counts.
 * Reps can only export their own class; admins pass classId.
 */
const exportCourseAttendance = async (req, res) => {
  try {
    const { courseId } = req.query;
    let { classId } = req.query;

    if (!courseId) {
      return res.status(400).json({ error: 'courseId is required' });
    }

    if (req.user.role === 'REP') {
      const repClass = await prisma.class.findFirst({ where: { repId: req.user.id }, select: { id: true } });
      if (!repClass) return res.status(404).json({ error: 'You are not assigned to any class' });
      classId = repClass.id; // reps can only export their own class
    } else if (!classId) {
      return res.status(400).json({ error: 'classId is required' });
    }

    const [cls, course, link] = await Promise.all([
      prisma.class.findUnique({ where: { id: classId }, include: { programme: true } }),
      prisma.course.findUnique({ where: { id: courseId } }),
      prisma.classCourse.findUnique({ where: { classId_courseId: { classId, courseId } } })
    ]);
    if (!cls || !course) return res.status(404).json({ error: 'Class or course not found' });
    if (!link) return res.status(400).json({ error: 'That course is not linked to this class' });

    const [sessions, classStudents] = await Promise.all([
      prisma.attendanceSession.findMany({
        where: { classId, courseId, status: { in: ['CLOSED', 'APPROVED'] } },
        select: { id: true, startTime: true, sessionType: true, status: true, lecturerName: true, approvedAt: true },
        orderBy: { startTime: 'asc' }
      }),
      prisma.classStudent.findMany({
        where: { classId },
        select: { student: { select: { id: true, name: true, indexNumber: true } } },
        orderBy: { student: { indexNumber: 'asc' } }
      })
    ]);

    // One query for every attendance record in these sessions
    const records = sessions.length
      ? await prisma.attendance.findMany({
          where: { sessionId: { in: sessions.map(s => s.id) } },
          select: { sessionId: true, studentId: true, status: true }
        })
      : [];
    const statusOf = new Map(records.map(r => [`${r.studentId}:${r.sessionId}`, r.status]));

    // ── Sheet 1: attendance grid
    const total = sessions.length;
    const header = ['No.', 'Index Number', 'Student Name', ...sessions.map(sessionLabel), 'Present', 'Late', 'Absent', 'Attendance %', 'Status'];
    const rows = classStudents.map(({ student }, i) => {
      let present = 0, late = 0, absent = 0;
      const cells = sessions.map(s => {
        const status = statusOf.get(`${student.id}:${s.id}`);
        if (status === 'PRESENT') present++;
        else if (status === 'LATE') late++;
        else absent++; // no record = did not check in
        return STATUS_CODE[status] || 'A';
      });
      const rate = total > 0 ? Math.round(((present + late) / total) * 100) : 100;
      const flag = rate >= 75 ? 'SAFE' : rate >= 60 ? 'WARNING' : 'AT RISK';
      return [i + 1, student.indexNumber, student.name, ...cells, present, late, absent, rate, flag];
    });

    const generated = new Date().toLocaleString('en-GB', { timeZone: 'Africa/Accra' });
    const aoa = [
      [`${course.name} (${course.code}) — Attendance Register`],
      [`Class: ${cls.displayName}`],
      [`Sessions held: ${total}    Students: ${rows.length}    Generated: ${generated}`],
      ['Key: P = Present, L = Late, A = Absent. Attendance % counts Present + Late. 75% and above = SAFE.'],
      [],
      header,
      ...rows
    ];
    const sheet = xlsx.utils.aoa_to_sheet(aoa);
    sheet['!cols'] = [
      { wch: 5 }, { wch: 16 }, { wch: 28 },
      ...sessions.map(() => ({ wch: 16 })),
      { wch: 9 }, { wch: 7 }, { wch: 8 }, { wch: 13 }, { wch: 10 }
    ];
    sheet['!freeze'] = { xSplit: 3, ySplit: 6 };

    // ── Sheet 2: session list
    const sessionRows = sessions.map((s, i) => {
      const counts = { PRESENT: 0, LATE: 0, ABSENT: 0 };
      for (const r of records) if (r.sessionId === s.id && counts[r.status] !== undefined) counts[r.status]++;
      return [
        i + 1,
        sessionLabel(s),
        s.sessionType === 'PHYSICAL' ? 'Physical' : 'Online',
        s.lecturerName || (s.status === 'APPROVED' ? 'Signed' : 'Not signed'),
        s.approvedAt ? new Date(s.approvedAt).toLocaleString('en-GB', { timeZone: 'Africa/Accra' }) : '',
        counts.PRESENT,
        counts.LATE,
        rows.length - counts.PRESENT - counts.LATE
      ];
    });
    const sessionsSheet = xlsx.utils.aoa_to_sheet([
      ['No.', 'Date & Time', 'Type', 'Lecturer Sign-off', 'Signed At', 'Present', 'Late', 'Absent'],
      ...sessionRows
    ]);
    sessionsSheet['!cols'] = [{ wch: 5 }, { wch: 18 }, { wch: 10 }, { wch: 26 }, { wch: 20 }, { wch: 9 }, { wch: 7 }, { wch: 8 }];

    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, sheet, 'Attendance');
    xlsx.utils.book_append_sheet(workbook, sessionsSheet, 'Sessions');
    const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    const filename = `Attendance_${safeFilePart(course.code)}_${safeFilePart(cls.displayName)}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
    res.send(buffer);
  } catch (err) {
    console.error('Export attendance error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = { exportCourseAttendance };
