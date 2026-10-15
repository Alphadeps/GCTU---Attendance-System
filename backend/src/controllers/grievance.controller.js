const prisma = require('../lib/prisma');
const { saveFile } = require('../lib/fileStore');
const { z } = require('zod');

// Schema for Grievance Submissions
const submitGrievanceSchema = z.object({
  type: z.enum(['ABSENCE_EXCUSE', 'SYSTEM_ISSUE', 'INTEGRITY_REPORT', 'GENERAL_COMPLAINT']),
  subject: z.string().min(3).max(100),
  message: z.string().min(5).max(1000),
  anonymous: z.preprocess((val) => val === 'true' || val === true, z.boolean()),
  studentIndex: z.string().optional().nullable(),
  studentName: z.string().optional().nullable(),
  courseCode: z.string().optional().nullable()
});

// Student Submission
exports.submitGrievance = async (req, res) => {
  try {
    const validatedData = submitGrievanceSchema.parse(req.body);

    // Who submitted comes from the student's login, not from the form
    let finalIndex = req.student?.indexNumber ?? null;
    let finalName = req.student?.name ?? null;

    // Redact identification metrics if submission is flagged anonymous
    if (validatedData.anonymous) {
      finalIndex = null;
      finalName = null;
    }

    let evidenceUrl = null;
    if (req.file) {
      // Stored in the database: the server disk is wiped on every restart/deploy
      ({ url: evidenceUrl } = await saveFile({
        buffer: req.file.buffer,
        filename: req.file.originalname,
        mimeType: req.file.mimetype
      }));
    }

    const grievance = await prisma.grievance.create({
      data: {
        type: validatedData.type,
        subject: validatedData.subject,
        message: validatedData.message,
        anonymous: validatedData.anonymous,
        studentIndex: finalIndex,
        studentName: finalName,
        courseCode: validatedData.courseCode,
        evidenceUrl
      }
    });

    res.status(201).json({
      message: 'Grievance submitted successfully.',
      grievance
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.issues[0].message });
    }
    console.error('Submit grievance error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Admin Fetch/List or Student filtered list
exports.listGrievances = async (req, res) => {
  try {
    const { status, type, studentIndex } = req.query;

    const filter = {};
    if (status) filter.status = String(status).toUpperCase();
    if (type) filter.type = String(type).toUpperCase();
    if (studentIndex) filter.studentIndex = String(studentIndex);

    // Reps only see their own class's students, and never anonymous reports
    if (req.user?.role === 'REP') {
      const repClass = await prisma.class.findFirst({
        where: { repId: req.user.id },
        select: { students: { select: { student: { select: { indexNumber: true } } } } }
      });
      const indexes = (repClass?.students || []).map(cs => cs.student.indexNumber);
      filter.anonymous = false;
      filter.studentIndex = studentIndex
        ? (indexes.includes(String(studentIndex)) ? String(studentIndex) : '__none__')
        : { in: indexes };
    }

    const grievances = await prisma.grievance.findMany({
      where: filter,
      include: {
        resolvedBy: {
          select: {
            username: true,
            role: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    res.status(200).json(grievances);
  } catch (err) {
    console.error('List grievances error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Admin Resolve
exports.resolveGrievance = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, adminResponse } = req.body;

    if (!['RESOLVED', 'REJECTED'].includes(status?.toUpperCase())) {
      return res.status(400).json({ error: 'Status must be RESOLVED or REJECTED.' });
    }

    const grievance = await prisma.grievance.findUnique({
      where: { id }
    });

    if (!grievance) {
      return res.status(404).json({ error: 'Grievance record not found.' });
    }

    const updatedGrievance = await prisma.grievance.update({
      where: { id },
      data: {
        status: status.toUpperCase(),
        adminResponse,
        resolvedById: req.user.id
      }
    });

    // Notify the student if the report was not anonymous and contains index number
    if (!grievance.anonymous && grievance.studentIndex) {
      await prisma.notification.create({
        data: {
          studentIndex: grievance.studentIndex,
          title: `Grievance Update: ${status.toUpperCase()}`,
          message: `Your grievance regarding "${grievance.subject}" was marked as ${status.toLowerCase()}. Feedback: "${adminResponse || 'No comments'}"`,
          type: status.toUpperCase() === 'RESOLVED' ? 'SUCCESS' : 'WARNING'
        }
      });
    }

    res.status(200).json({
      message: `Grievance status updated to ${status.toUpperCase()}.`,
      grievance: updatedGrievance
    });
  } catch (err) {
    console.error('Resolve grievance error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Fetch student personal history logs
exports.getStudentGrievances = async (req, res) => {
  try {
    const { studentIndex } = req.params;

    if (!studentIndex) {
      return res.status(400).json({ error: 'Student index number is required.' });
    }

    const grievances = await prisma.grievance.findMany({
      where: {
        studentIndex,
        anonymous: false // only show their non-anonymous ones
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    res.status(200).json(grievances);
  } catch (err) {
    console.error('Get student grievances error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};
