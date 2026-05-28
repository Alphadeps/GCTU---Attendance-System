const prisma = require('../lib/prisma');
const fs = require('fs');
const path = require('path');
const PizZip = require('pizzip');
const Docxtemplater = require('docxtemplater');
const { createNotificationHelper } = require('./notification.controller');
const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');

// Helper function to generate default HTML report
function generateDefaultReportHTML(data) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Attendance Report - ${data.courseCode}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 40px; }
    .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 20px; }
    .header h1 { margin: 5px 0; color: #333; }
    .header h2 { margin: 5px 0; color: #666; font-weight: normal; }
    .info-section { margin: 20px 0; }
    .info-row { display: flex; margin: 8px 0; }
    .info-label { font-weight: bold; width: 200px; }
    .info-value { flex: 1; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
    th { background-color: #f2f2f2; font-weight: bold; }
    tr:nth-child(even) { background-color: #f9f9f9; }
    .signature-section { margin-top: 50px; display: flex; justify-content: space-between; }
    .signature-box { width: 45%; }
    .signature-box h3 { border-bottom: 1px solid #333; padding-bottom: 5px; }
    .signature-content { margin-top: 20px; min-height: 80px; }
    .signature-line { border-top: 1px solid #333; margin-top: 60px; padding-top: 5px; }
    .status-safe { color: green; font-weight: bold; }
    .status-warning { color: orange; font-weight: bold; }
    .status-risk { color: red; font-weight: bold; }
    .footer { margin-top: 40px; text-align: center; font-size: 12px; color: #666; border-top: 1px solid #ddd; padding-top: 20px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>OFFICIAL ATTENDANCE REPORT</h1>
    <h2>${data.programmeName} - ${data.className}</h2>
  </div>

  <div class="info-section">
    <h3>Course Information</h3>
    <div class="info-row">
      <div class="info-label">Course Name:</div>
      <div class="info-value">${data.courseName}</div>
    </div>
    <div class="info-row">
      <div class="info-label">Course Code:</div>
      <div class="info-value">${data.courseCode}</div>
    </div>
    <div class="info-row">
      <div class="info-label">Lecturer:</div>
      <div class="info-value">${data.lecturerName}</div>
    </div>
  </div>

  <div class="info-section">
    <h3>Class Information</h3>
    <div class="info-row">
      <div class="info-label">Programme:</div>
      <div class="info-value">${data.programmeName}</div>
    </div>
    <div class="info-row">
      <div class="info-label">Level:</div>
      <div class="info-value">${data.level}</div>
    </div>
    <div class="info-row">
      <div class="info-label">Group:</div>
      <div class="info-value">${data.group}</div>
    </div>
    <div class="info-row">
      <div class="info-label">Session:</div>
      <div class="info-value">${data.session}</div>
    </div>
  </div>

  <div class="info-section">
    <h3>Session Details</h3>
    <div class="info-row">
      <div class="info-label">Total Sessions:</div>
      <div class="info-value">${data.totalSessions}</div>
    </div>
    <div class="info-row">
      <div class="info-label">First Session:</div>
      <div class="info-value">${data.firstSessionDate} at ${data.firstSessionTime}</div>
    </div>
    <div class="info-row">
      <div class="info-label">Last Session:</div>
      <div class="info-value">${data.lastSessionDate} at ${data.lastSessionTime}</div>
    </div>
  </div>

  <h3>Student Attendance Summary</h3>
  <table>
    <thead>
      <tr>
        <th>No.</th>
        <th>Index Number</th>
        <th>Student Name</th>
        <th>Attended</th>
        <th>Total</th>
        <th>Rate (%)</th>
        <th>Status</th>
      </tr>
    </thead>
    <tbody>
      ${data.students.map((student, index) => `
      <tr>
        <td>${index + 1}</td>
        <td>${student.indexNumber}</td>
        <td>${student.name}</td>
        <td>${student.attended}</td>
        <td>${student.total}</td>
        <td>${student.rate}%</td>
        <td class="status-${student.status.toLowerCase().replace(' ', '-')}">${student.status}</td>
      </tr>
      `).join('')}
    </tbody>
  </table>

  <div class="signature-section">
    <div class="signature-box">
      <h3>Class Representative</h3>
      <div class="signature-content">
        <div><strong>Name:</strong> ${data.repName}</div>
        <div><strong>Signature:</strong> ${data.repSignature}</div>
        <div><strong>Date:</strong> ${data.generatedDate}</div>
        <div><strong>Time:</strong> ${data.generatedTime}</div>
      </div>
    </div>

    <div class="signature-box">
      <h3>Course Lecturer</h3>
      <div class="signature-content">
        <div><strong>Name:</strong> ${data.lecturerName}</div>
        <div><strong>Signature:</strong> ${data.lecturerSignature || '_____________________'}</div>
        <div><strong>Date:</strong> ${data.lecturerSignedDate || '_____________________'}</div>
        <div><strong>Time:</strong> ${data.lecturerSignedTime || '_____________________'}</div>
      </div>
    </div>
  </div>

  <div class="footer">
    <p>This is an official attendance report generated by the Class Attendance System</p>
    <p>Generated on ${data.generatedDate} at ${data.generatedTime}</p>
  </div>
</body>
</html>
  `;
}

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

    // Notify all reps about the new template
    const reps = await prisma.user.findMany({
      where: { role: 'REP', isActive: true },
      select: { id: true }
    });

    for (const rep of reps) {
      await createNotificationHelper({
        userId: rep.id,
        title: 'New Report Template Available',
        message: 'The department has uploaded a new report template. Your future reports will use this template.',
        type: 'INFO'
      });
    }

    res.json({ 
      message: 'Template uploaded successfully. This template will be used for all future reports.',
      template 
    });
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
    
    if (!template) {
      return res.json({ 
        message: 'No custom template uploaded. System will use default template.',
        template: null,
        usingDefault: true
      });
    }
    
    res.json({ 
      template,
      usingDefault: false
    });
  } catch (err) {
    console.error('Get template error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Admin: Delete/deactivate template (revert to default)
const deleteTemplate = async (req, res) => {
  try {
    const { id } = req.params;

    const template = await prisma.reportTemplate.findUnique({
      where: { id }
    });

    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    // Delete the file
    const filePath = path.join(__dirname, '..', '..', 'public', template.fileUrl);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    // Delete from database
    await prisma.reportTemplate.delete({
      where: { id }
    });

    res.json({ 
      message: 'Template deleted successfully. System will now use the default template for reports.' 
    });
  } catch (err) {
    console.error('Delete template error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Admin: Get all templates (history)
const getAllTemplates = async (req, res) => {
  try {
    const templates = await prisma.reportTemplate.findMany({
      orderBy: { createdAt: 'desc' }
    });

    res.json({
      templates,
      message: templates.length === 0 ? 'No templates uploaded. System uses default template.' : null
    });
  } catch (err) {
    console.error('Get all templates error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Rep: Generate Report
const generateReport = async (req, res) => {
  try {
    const { courseId, repSignature } = req.body;
    
    // Make signature optional for now (can be added later from frontend)
    const signature = repSignature || 'Digital Signature - ' + req.user.username;
    
    // Check if report already exists for this course/class
    const existing = await prisma.officialReport.findFirst({
      where: {
        courseId,
        generatedById: req.user.id,
        status: 'PENDING_SIGNATURE'
      }
    });

    if (existing) {
      return res.status(400).json({ error: 'A report is already pending signature for this course.' });
    }

    // 1. Get the active template (optional now)
    const templateRecord = await prisma.reportTemplate.findFirst({
      where: { isActive: true }
    });

    // 2. Gather Data
    const repClass = await prisma.class.findFirst({
      where: { repId: req.user.id },
      include: { programme: true }
    });

    if (!repClass) {
      return res.status(400).json({ error: 'You are not assigned to any class.' });
    }

    const course = await prisma.course.findUnique({
      where: { id: courseId }
    });

    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }

    // Get lecturer assigned to this course/class
    const lecturerAssignment = await prisma.lecturerAssignment.findFirst({
      where: {
        classId: repClass.id,
        courseId: courseId
      },
      include: {
        lecturer: {
          select: { id: true, username: true }
        }
      }
    });

    // Get analytics data for this course
    const sessions = await prisma.attendanceSession.findMany({
      where: { 
        courseId, 
        classId: repClass.id,
        status: { in: ['CLOSED', 'APPROVED'] } 
      },
      select: { 
        id: true, 
        startTime: true, 
        endTime: true,
        sessionType: true 
      },
      orderBy: { startTime: 'asc' }
    });

    const totalSessionsCount = sessions.length;
    const firstSessionTime = sessions.length > 0 ? sessions[0].startTime : null;
    const lastSessionTime = sessions.length > 0 ? sessions[sessions.length - 1].endTime : null;

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
        total: totalSessionsCount,
        rate: rate,
        status: rate >= 75 ? 'SAFE' : rate >= 60 ? 'WARNING' : 'AT RISK'
      };
    }));

    // 3. Generate report content
    const reportData = {
      courseName: course.name,
      courseCode: course.code,
      className: repClass.displayName,
      programmeName: repClass.programme.name,
      level: repClass.level,
      group: repClass.group,
      session: repClass.session,
      totalSessions: totalSessionsCount,
      firstSessionDate: firstSessionTime ? new Date(firstSessionTime).toLocaleDateString() : 'N/A',
      firstSessionTime: firstSessionTime ? new Date(firstSessionTime).toLocaleTimeString() : 'N/A',
      lastSessionDate: lastSessionTime ? new Date(lastSessionTime).toLocaleDateString() : 'N/A',
      lastSessionTime: lastSessionTime ? new Date(lastSessionTime).toLocaleTimeString() : 'N/A',
      generatedDate: new Date().toLocaleDateString(),
      generatedTime: new Date().toLocaleTimeString(),
      repName: req.user.username,
      repSignature: signature,
      lecturerName: lecturerAssignment ? lecturerAssignment.lecturer.username : 'Not Assigned',
      students: studentsData
    };

    let fileUrl;
    let buf;

    // 4. Process template or generate default
    if (templateRecord) {
      // Use uploaded template
      const templatePath = path.join(__dirname, '..', '..', 'public', templateRecord.fileUrl);
      const content = fs.readFileSync(templatePath, 'binary');
      const zip = new PizZip(content);
      
      const doc = new Docxtemplater(zip, {
        paragraphLoop: true,
        linebreaks: true,
      });

      doc.render(reportData);

      buf = doc.getZip().generate({
        type: 'nodebuffer',
        compression: 'DEFLATE',
      });
    } else {
      // Generate default HTML-based report
      const htmlContent = generateDefaultReportHTML(reportData);
      buf = Buffer.from(htmlContent, 'utf-8');
    }

    // 5. Save generated file
    const reportsDir = path.join(__dirname, '..', '..', 'public', 'uploads', 'reports');
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }

    const fileExtension = templateRecord ? 'docx' : 'html';
    const filename = `Report_${course.code}_${repClass.level}${repClass.group}_${Date.now()}.${fileExtension}`;
    const outputPath = path.join(reportsDir, filename);
    fs.writeFileSync(outputPath, buf);

    fileUrl = `/uploads/reports/${filename}`;

    // 6. Save to database
    const officialReport = await prisma.officialReport.create({
      data: {
        classId: repClass.id,
        courseId,
        generatedById: req.user.id,
        fileUrl,
        status: 'PENDING_SIGNATURE',
        repSignature: signature,
        repSignedAt: new Date()
      }
    });

    // 7. Notify lecturer
    if (lecturerAssignment) {
      await createNotificationHelper({
        userId: lecturerAssignment.lecturer.id,
        title: 'New Report Pending Your Signature',
        message: `${req.user.username} has generated an attendance report for ${course.name} (${course.code}). Please review and sign.`,
        type: 'INFO'
      });
    }

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

      // If lecturer has no assignments, return empty array
      if (assignments.length === 0) {
        return res.json([]);
      }

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
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
};

// Lecturer: Sign and Approve a report (automatically submits to department)
const signReport = async (req, res) => {
  try {
    const { id } = req.params;
    const { lecturerSignature } = req.body;

    if (!lecturerSignature) {
      return res.status(400).json({ error: 'Lecturer signature is required' });
    }

    const existingReport = await prisma.officialReport.findUnique({
      where: { id },
      include: { 
        class: { include: { programme: true } }, 
        course: true,
        generatedBy: { select: { username: true } }
      }
    });

    if (!existingReport) {
      return res.status(404).json({ error: 'Report not found' });
    }

    if (existingReport.status !== 'PENDING_SIGNATURE') {
      return res.status(400).json({ error: 'Report has already been processed' });
    }

    const now = new Date();

    // Update report with lecturer signature and approve it
    const report = await prisma.officialReport.update({
      where: { id },
      data: {
        status: 'APPROVED', // Approved by lecturer
        signedById: req.user.id,
        lecturerSignature,
        signedAt: now,
        submittedToDeptAt: now // Automatically submitted to department
      },
      include: { 
        class: { include: { programme: true } }, 
        course: true, 
        generatedBy: { select: { username: true } },
        signedBy: { select: { username: true } }
      }
    });

    // If report is HTML, regenerate it with lecturer signature
    if (existingReport.fileUrl.endsWith('.html')) {
      try {
        // Read existing report to get data
        const reportPath = path.join(__dirname, '..', '..', 'public', existingReport.fileUrl);
        
        // Regenerate with lecturer signature
        const sessions = await prisma.attendanceSession.findMany({
          where: { 
            courseId: report.courseId,
            classId: report.classId,
            status: { in: ['CLOSED', 'APPROVED'] } 
          },
          select: { 
            id: true, 
            startTime: true, 
            endTime: true,
            sessionType: true 
          },
          orderBy: { startTime: 'asc' }
        });

        const classStudents = await prisma.classStudent.findMany({
          where: { classId: report.classId },
          include: {
            student: {
              select: { id: true, name: true, indexNumber: true }
            }
          }
        });

        const studentSessionIds = sessions.map(s => s.id);
        const totalSessionsCount = sessions.length;

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
            total: totalSessionsCount,
            rate: rate,
            status: rate >= 75 ? 'SAFE' : rate >= 60 ? 'WARNING' : 'AT RISK'
          };
        }));

        const reportData = {
          courseName: report.course.name,
          courseCode: report.course.code,
          className: report.class.displayName,
          programmeName: report.class.programme.name,
          level: report.class.level,
          group: report.class.group,
          session: report.class.session,
          totalSessions: totalSessionsCount,
          firstSessionDate: sessions.length > 0 ? new Date(sessions[0].startTime).toLocaleDateString() : 'N/A',
          firstSessionTime: sessions.length > 0 ? new Date(sessions[0].startTime).toLocaleTimeString() : 'N/A',
          lastSessionDate: sessions.length > 0 ? new Date(sessions[sessions.length - 1].endTime).toLocaleDateString() : 'N/A',
          lastSessionTime: sessions.length > 0 ? new Date(sessions[sessions.length - 1].endTime).toLocaleTimeString() : 'N/A',
          generatedDate: new Date(existingReport.repSignedAt).toLocaleDateString(),
          generatedTime: new Date(existingReport.repSignedAt).toLocaleTimeString(),
          repName: existingReport.generatedBy.username,
          repSignature: existingReport.repSignature,
          lecturerName: req.user.username,
          lecturerSignature: lecturerSignature,
          lecturerSignedDate: now.toLocaleDateString(),
          lecturerSignedTime: now.toLocaleTimeString(),
          students: studentsData
        };

        const htmlContent = generateDefaultReportHTML(reportData);
        fs.writeFileSync(reportPath, htmlContent);
      } catch (regenerateError) {
        console.error('Error regenerating report with signature:', regenerateError);
        // Continue anyway - signature is saved in database
      }
    }

    // Notify SuperAdmins (Department) that report is ready
    const superAdmins = await prisma.user.findMany({
      where: { role: 'SUPERADMIN', isActive: true },
      select: { id: true }
    });

    for (const admin of superAdmins) {
      await createNotificationHelper({
        userId: admin.id,
        title: '📋 New Report Submitted to Department',
        message: `APPROVED REPORT: ${report.course.name} (${report.course.code}) - ${report.class.displayName}. Signed by ${req.user.username}. Ready for department review.`,
        type: 'SUCCESS'
      });
    }

    // Notify the rep that their report was approved
    await createNotificationHelper({
      userId: report.generatedById,
      title: '✅ Report Approved & Submitted',
      message: `Your attendance report for ${report.course.name} (${report.course.code}) has been approved by ${req.user.username} and submitted to the department.`,
      type: 'SUCCESS'
    });

    res.json({ 
      message: 'Report approved and automatically submitted to department', 
      report,
      submittedToDepartment: true
    });
  } catch (err) {
    console.error('Sign report error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// SuperAdmin: Get all approved reports (submitted to department) grouped by level & group
const getArchivedReports = async (req, res) => {
  try {
    const reports = await prisma.officialReport.findMany({
      where: { status: 'APPROVED' }, // Changed from 'SIGNED' to 'APPROVED'
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
      orderBy: { submittedToDeptAt: 'desc' } // Order by submission date
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

    // Return just the grouped object (frontend expects this format)
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

// Serve report file (HTML or DOCX) with proper headers
const serveReportFile = async (req, res) => {
  try {
    const { id } = req.params;

    const report = await prisma.officialReport.findUnique({
      where: { id },
      include: {
        course: true,
        class: { include: { programme: true } }
      }
    });

    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    const filePath = path.join(__dirname, '..', '..', 'public', report.fileUrl);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Report file not found on server' });
    }

    // Determine file type and set appropriate headers
    const isHTML = report.fileUrl.endsWith('.html');
    const isDOCX = report.fileUrl.endsWith('.docx');

    if (isHTML) {
      // Serve HTML with proper content type
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Content-Disposition', `inline; filename="Report_${report.course.code}_${report.class.level}${report.class.group}.html"`);
      
      const htmlContent = fs.readFileSync(filePath, 'utf-8');
      res.send(htmlContent);
    } else if (isDOCX) {
      // Serve DOCX as download
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', `attachment; filename="Report_${report.course.code}_${report.class.level}${report.class.group}.docx"`);
      
      const fileStream = fs.createReadStream(filePath);
      fileStream.pipe(res);
    } else {
      res.status(400).json({ error: 'Unsupported file type' });
    }
  } catch (err) {
    console.error('Serve report file error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Convert HTML report to PDF and download
const downloadReportAsPDF = async (req, res) => {
  try {
    const { id } = req.params;

    const report = await prisma.officialReport.findUnique({
      where: { id },
      include: {
        course: true,
        class: { include: { programme: true } }
      }
    });

    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    const filePath = path.join(__dirname, '..', '..', 'public', report.fileUrl);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Report file not found on server' });
    }

    // Only convert HTML files to PDF
    if (!report.fileUrl.endsWith('.html')) {
      return res.status(400).json({ error: 'Only HTML reports can be converted to PDF' });
    }

    // Read HTML content
    const htmlContent = fs.readFileSync(filePath, 'utf-8');

    // Launch puppeteer with chromium
    const browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    });

    const page = await browser.newPage();
    
    // Set content and wait for it to load
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

    // Generate PDF
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20mm',
        right: '15mm',
        bottom: '20mm',
        left: '15mm'
      }
    });

    await browser.close();

    // Send PDF as download
    const filename = `Report_${report.course.code}_${report.class.level}${report.class.group}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(pdfBuffer);

  } catch (err) {
    console.error('Download report as PDF error:', err);
    res.status(500).json({ error: 'Failed to generate PDF', details: err.message });
  }
};

module.exports = {
  uploadTemplate,
  getActiveTemplate,
  deleteTemplate,
  getAllTemplates,
  generateReport,
  getPendingReports,
  signReport,
  getArchivedReports,
  getRepReports,
  serveReportFile,
  downloadReportAsPDF
};
