const prisma = require('../lib/prisma');
const fs = require('fs');
const path = require('path');
const PizZip = require('pizzip');
const Docxtemplater = require('docxtemplater');
const { createNotificationHelper } = require('./notification.controller');

// Admin: Upload master template
const uploadTemplate = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Please upload a .docx template' });
    }

    const fileUrl = `/uploads/templates/${req.file.filename}`;

    // Deactivate previous active templates
    await prisma.reportTemplate.updateMany({
      where: { isActive: true },
      data: { isActive: false }
    });

    const template = await prisma.reportTemplate.create({
      data: {
        name: req.file.originalname,
        fileUrl,
        isActive: true
      }
    });

    res.json(template);
  } catch (err) {
    console.error('Upload template error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getActiveTemplate = async (req, res) => {
  try {
    const template = await prisma.reportTemplate.findFirst({
      where: { isActive: true }
    });
    res.json(template);
  } catch (err) {
    console.error('Get template error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Rep: Generate Report
const generateReport = async (req, res) => {
  try {
    const { courseId } = req.body;
    
    // Check if report already exists for this course/class
    const existing = await prisma.officialReport.findFirst({
      where: {
        courseId,
        generatedById: req.user.id
      }
    });

    if (existing && existing.status === 'PENDING_SIGNATURE') {
      return res.status(400).json({ error: 'A report is already pending signature for this course.' });
    }

    // 1. Get the active template
    const templateRecord = await prisma.reportTemplate.findFirst({
      where: { isActive: true }
    });

    if (!templateRecord) {
      return res.status(400).json({ error: 'No report template has been uploaded by the department yet.' });
    }

    // 2. Gather Data
    const repClass = await prisma.class.findFirst({
      where: { repId: req.user.id }
    });

    if (!repClass) {
      return res.status(400).json({ error: 'You are not assigned to any class.' });
    }

    const course = await prisma.course.findUnique({
      where: { id: courseId }
    });

    // Get analytics data for this course
    const sessions = await prisma.attendanceSession.findMany({
      where: { courseId, status: { in: ['CLOSED', 'APPROVED'] } },
      select: { id: true, startTime: true, sessionType: true }
    });

    const totalSessionsCount = sessions.length;

    const classStudents = await prisma.classStudent.findMany({
      where: { classId: repClass.id },
      include: {
        student: {
          select: { id: true, name: true, indexNumber: true }
        }
      }
    });

    const studentSessionIds = sessions.map(s => s.id);

    const studentsData = await Promise.all(classStudents.map(async (cs) => {
      const presentOrLateCount = totalSessionsCount > 0 ? await prisma.attendance.count({
        where: {
          studentId: cs.student.id,
          sessionId: { in: studentSessionIds },
          status: { in: ['PRESENT', 'LATE'] }
        }
      }) : 0;

      const rate = totalSessionsCount > 0
        ? Math.round((presentOrLateCount / totalSessionsCount) * 100)
        : 100;

      return {
        name: cs.student.name,
        indexNumber: cs.student.indexNumber,
        attended: presentOrLateCount,
        rate: rate,
        status: rate >= 75 ? 'SAFE' : rate >= 60 ? 'WARNING' : 'AT RISK'
      };
    }));

    // 3. Process the docx template
    // The fileUrl is /uploads/templates/... so we append it to public folder
    const templatePath = path.join(__dirname, '..', '..', 'public', templateRecord.fileUrl);
    const content = fs.readFileSync(templatePath, 'binary');
    const zip = new PizZip(content);
    
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
    });

    // Render the document (replace tags)
    doc.render({
      courseName: course.name,
      courseCode: course.code,
      className: repClass.displayName,
      level: repClass.level,
      group: repClass.group,
      totalSessions: totalSessionsCount,
      generatedDate: new Date().toLocaleDateString(),
      repName: req.user.username,
      students: studentsData
    });

    const buf = doc.getZip().generate({
      type: 'nodebuffer',
      compression: 'DEFLATE',
    });

    // 4. Save generated file
    const reportsDir = path.join(__dirname, '..', '..', 'public', 'uploads', 'reports');
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }

    const filename = `Report_${course.code}_${repClass.level}${repClass.group}_${Date.now()}.docx`;
    const outputPath = path.join(reportsDir, filename);
    fs.writeFileSync(outputPath, buf);

    // 5. Save to database
    const officialReport = await prisma.officialReport.create({
      data: {
        classId: repClass.id,
        courseId,
        generatedById: req.user.id,
        fileUrl: `/uploads/reports/${filename}`,
        status: 'PENDING_SIGNATURE'
      }
    });

    res.status(201).json({ message: 'Report generated successfully', officialReport });
  } catch (err) {
    console.error('Generate report error:', err);
    let errorDetails = err.message;
    if (err.properties && err.properties.errors) {
      errorDetails = err.properties.errors.map(e => e.message).join(', ');
    }
    res.status(500).json({ error: `Generation failed: ${errorDetails}` });
  }
};

// Lecturer: Get pending reports for their courses
const getPendingReports = async (req, res) => {
  try {
    let whereClause = { status: 'PENDING_SIGNATURE' };

    if (req.user.role === 'LECTURER') {
      const assignments = await prisma.lecturerAssignment.findMany({
        where: { lecturerId: req.user.id }
      });
      const classIds = assignments.map(a => a.classId);
      const courseIds = assignments.map(a => a.courseId);

      whereClause = {
        status: 'PENDING_SIGNATURE',
        classId: { in: classIds },
        courseId: { in: courseIds }
      };
    }

    const reports = await prisma.officialReport.findMany({
      where: whereClause,
      include: {
        class: true,
        course: true,
        generatedBy: { select: { username: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(reports);
  } catch (err) {
    console.error('Get pending reports error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Lecturer: Sign a report
const signReport = async (req, res) => {
  try {
    const { id } = req.params;

    const report = await prisma.officialReport.update({
      where: { id },
      data: {
        status: 'SIGNED',
        signedById: req.user.id,
        signedAt: new Date()
      },
      include: { class: true, course: true }
    });

    // Notify SuperAdmins that a new report was archived
    await createNotificationHelper({
      userId: null, // broadcast or we could find superadmins
      title: 'New Official Report Archived',
      message: `The official attendance report for ${report.course.code} (${report.class.displayName}) has been signed and archived.`,
      type: 'SUCCESS'
    });

    res.json({ message: 'Report signed successfully', report });
  } catch (err) {
    console.error('Sign report error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// SuperAdmin: Get all archived reports grouped by level & group
const getArchivedReports = async (req, res) => {
  try {
    const reports = await prisma.officialReport.findMany({
      where: { status: 'SIGNED' },
      include: {
        class: {
          include: {
            programme: true
          }
        },
        course: true,
        signedBy: { select: { username: true } },
        generatedBy: { select: { username: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Grouping by programme -> level -> group
    const grouped = {};
    for (const r of reports) {
      const programmeName = r.class.programme.name;
      const level = r.class.level;
      const groupKey = `${r.class.group} - ${r.class.session}`; // e.g., "A - MORNING"

      if (!grouped[programmeName]) grouped[programmeName] = {};
      if (!grouped[programmeName][level]) grouped[programmeName][level] = {};
      if (!grouped[programmeName][level][groupKey]) grouped[programmeName][level][groupKey] = [];
      grouped[programmeName][level][groupKey].push(r);
    }

    res.json(grouped);
  } catch (err) {
    console.error('Get archived reports error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Also let rep fetch their generated reports to see status
const getRepReports = async (req, res) => {
  try {
    const reports = await prisma.officialReport.findMany({
      where: { generatedById: req.user.id },
      include: { course: true },
      orderBy: { createdAt: 'desc' }
    });
    res.json(reports);
  } catch (err) {
    console.error('Get rep reports error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  uploadTemplate,
  getActiveTemplate,
  generateReport,
  getPendingReports,
  signReport,
  getArchivedReports,
  getRepReports
};
