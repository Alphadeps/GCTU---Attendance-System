const express = require('express');
const { bulkImport, getAllStudents } = require('../controllers/student.controller');
const { protect, authorizeRoles } = require('../middleware/auth');

const router = express.Router();

// Bulk import student list (REP and ADMIN)
router.post('/bulk-import', protect, authorizeRoles('REP', 'ADMIN'), bulkImport);

// List all students (REP, LECTURER, ADMIN)
router.get('/', protect, authorizeRoles('REP', 'LECTURER', 'ADMIN'), getAllStudents);

module.exports = router;
