const express = require('express');
const multer = require('multer');
const { protect, authorizeRoles } = require('../middleware/auth');
const { 
  uploadLecturerAssignments, 
  getMyClasses,
  getAllAssignments,
  deleteAssignment
} = require('../controllers/lecturer.controller');

const router = express.Router();

// Multer memory storage configuration for spreadsheet parsing
const upload = multer({ storage: multer.memoryStorage() });

// Admin route to upload lecturer assignments (Excel/CSV)
router.post('/upload', protect, authorizeRoles('SUPERADMIN', 'ADMIN'), upload.single('file'), uploadLecturerAssignments);

// Admin route to list all allocations
router.get('/assignments', protect, authorizeRoles('SUPERADMIN', 'ADMIN'), getAllAssignments);

// Admin route to delete a specific allocation
router.delete('/assignments/:id', protect, authorizeRoles('SUPERADMIN', 'ADMIN'), deleteAssignment);

// Lecturer route to get their assigned courses and classes
router.get('/my-classes', protect, authorizeRoles('LECTURER', 'ADMIN'), getMyClasses);

module.exports = router;

