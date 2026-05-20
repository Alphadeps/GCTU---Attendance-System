const prisma = require('../lib/prisma');
const { createNotificationHelper } = require('./notification.controller');

// Bulk import students (upsert)
const bulkImport = async (req, res) => {
  try {
    const { students } = req.body; // Expects array of { indexNumber, name, email }

    if (!students || !Array.isArray(students)) {
      return res.status(400).json({ error: 'Payload must contain a "students" array' });
    }

    const results = [];
    for (const student of students) {
      const { indexNumber, name, email } = student;
      if (!indexNumber || !name || !email) {
        continue; // Skip invalid rows
      }

      // Upsert student by indexNumber
      const upserted = await prisma.student.upsert({
        where: { indexNumber },
        update: {
          name,
          email
        },
        create: {
          indexNumber,
          name,
          email
        }
      });
      results.push(upserted);
    }

    // Trigger Notifications in background
    (async () => {
      try {
        await createNotificationHelper({
          userId: req.user.id,
          title: 'Bulk Import Success',
          message: `Successfully uploaded and processed ${results.length} student records into database.`,
          type: 'SUCCESS'
        });
      } catch (notifyErr) {
        console.error('Failed to trigger bulk import notification:', notifyErr);
      }
    })();

    res.json({
      message: `Bulk import completed. Successfully processed ${results.length} student records.`,
      importedCount: results.length,
      students: results
    });
  } catch (err) {
    console.error('Bulk import error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get all students
const getAllStudents = async (req, res) => {
  try {
    const students = await prisma.student.findMany({
      orderBy: { indexNumber: 'asc' }
    });
    res.json(students);
  } catch (err) {
    console.error('Get all students error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  bulkImport,
  getAllStudents
};
