const express = require('express');
const { bulkImport, getAllStudents } = require('../controllers/student.controller');
const { protect, authorizeRoles } = require('../middleware/auth');
const prisma = require('../lib/prisma');

const router = express.Router();

// Bulk import student list (REP and ADMIN)
router.post('/bulk-import', protect, authorizeRoles('REP', 'ADMIN'), bulkImport);

// List all students (REP, LECTURER, ADMIN)
router.get('/', protect, authorizeRoles('REP', 'LECTURER', 'ADMIN'), getAllStudents);

// Update student information (ADMIN and SUPERADMIN)
router.patch('/:id', protect, authorizeRoles('ADMIN', 'SUPERADMIN'), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, indexNumber } = req.body;

    if (!name || !indexNumber) {
      return res.status(400).json({ error: 'Name and index number are required' });
    }

    // Check if index number already exists (excluding current student)
    if (indexNumber) {
      const existingIndex = await prisma.student.findFirst({
        where: {
          indexNumber: indexNumber.trim(),
          NOT: { id }
        }
      });

      if (existingIndex) {
        return res.status(400).json({ error: 'Index number already exists' });
      }
    }

    // Check if email already exists (excluding current student)
    if (email) {
      const existingEmail = await prisma.student.findFirst({
        where: {
          email: email.trim(),
          NOT: { id }
        }
      });

      if (existingEmail) {
        return res.status(400).json({ error: 'Email already exists' });
      }
    }

    const updateData = {
      name: name.trim(),
      indexNumber: indexNumber.trim()
    };

    if (email) {
      updateData.email = email.trim();
    }

    const updated = await prisma.student.update({
      where: { id },
      data: updateData
    });

    res.json(updated);
  } catch (err) {
    console.error('Update student error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
