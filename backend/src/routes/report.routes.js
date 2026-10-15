const express = require('express');
const multer = require('multer');
const path = require('path');
const { protect, authorizeRoles } = require('../middleware/auth');
const { reportLimiter, uploadLimiter } = require('../middleware/rateLimiter');
const reportController = require('../controllers/report.controller');
const { exportCourseAttendance } = require('../controllers/export.controller');

const router = express.Router();

// Multer setup for .docx templates — kept in memory and saved to the database
// (the server disk is wiped on every restart/deploy)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      cb(null, true);
    } else {
      cb(Object.assign(new Error('Only .docx files are allowed'), { isUploadError: true }));
    }
  }
});

// Admin: Template Management
router.post('/template', protect, authorizeRoles('ADMIN', 'SUPERADMIN'), uploadLimiter, upload.single('template'), reportController.uploadTemplate);
router.get('/template', protect, reportController.getActiveTemplate);
router.get('/templates', protect, authorizeRoles('ADMIN', 'SUPERADMIN'), reportController.getAllTemplates);
router.delete('/template/:id', protect, authorizeRoles('ADMIN', 'SUPERADMIN'), reportController.deleteTemplate);

// Rep: Generate Report
router.post('/generate', protect, authorizeRoles('REP'), reportLimiter, reportController.generateReport);

// Excel attendance register for one class + course (reps: own class only)
router.get('/export', protect, authorizeRoles('REP', 'ADMIN', 'SUPERADMIN'), reportLimiter, exportCourseAttendance);
router.get('/my-generated', protect, authorizeRoles('REP'), reportController.getRepReports);

// Lecturer: View and sign pending reports
router.get('/pending', protect, authorizeRoles('LECTURER'), reportController.getPendingReports);
router.patch('/:id/sign', protect, authorizeRoles('LECTURER'), reportController.signReport);

// SuperAdmin: View archived reports
router.get('/archived', protect, authorizeRoles('ADMIN', 'SUPERADMIN'), reportController.getArchivedReports);

// Serve report file (HTML or DOCX) - accessible to all authenticated users
// Accepts token from query param for opening in new window
router.get('/:id/file', (req, res, next) => {
  // Check for token in query params (for new window opens)
  const tokenFromQuery = req.query.token;
  if (tokenFromQuery && !req.headers.authorization) {
    req.headers.authorization = `Bearer ${tokenFromQuery}`;
  }
  next();
}, protect, reportController.serveReportFile);

// Download report as PDF - accessible to all authenticated users
router.get('/:id/pdf', (req, res, next) => {
  const tokenFromQuery = req.query.token;
  if (tokenFromQuery && !req.headers.authorization) {
    req.headers.authorization = `Bearer ${tokenFromQuery}`;
  }
  next();
}, protect, reportController.downloadReportAsPDF);

module.exports = router;
