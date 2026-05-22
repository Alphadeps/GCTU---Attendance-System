const express = require('express');
const multer = require('multer');
const path = require('path');
const { protect, authorizeRoles } = require('../middleware/auth');
const { reportLimiter, uploadLimiter } = require('../middleware/rateLimiter');
const reportController = require('../controllers/report.controller');

const router = express.Router();

// Multer setup for .docx templates
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = path.join(__dirname, '..', '..', 'public', 'uploads', 'templates');
    require('fs').mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    cb(null, `template-${Date.now()}${ext}`);
  }
});
const upload = multer({ 
  storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      cb(null, true);
    } else {
      cb(new Error('Only .docx files are allowed'));
    }
  }
});

// Admin: Template Management
router.post('/template', protect, authorizeRoles('ADMIN', 'SUPERADMIN'), uploadLimiter, upload.single('template'), reportController.uploadTemplate);
router.get('/template', protect, reportController.getActiveTemplate);

// Rep: Generate Report
router.post('/generate', protect, authorizeRoles('REP'), reportLimiter, reportController.generateReport);
router.get('/my-generated', protect, authorizeRoles('REP'), reportController.getRepReports);

// Lecturer: View and sign pending reports
router.get('/pending', protect, authorizeRoles('LECTURER'), reportController.getPendingReports);
router.patch('/:id/sign', protect, authorizeRoles('LECTURER'), reportController.signReport);

// SuperAdmin: View archived reports
router.get('/archived', protect, authorizeRoles('ADMIN', 'SUPERADMIN'), reportController.getArchivedReports);

module.exports = router;
