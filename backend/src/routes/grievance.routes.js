const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const { protect, authorizeRoles } = require('../middleware/auth');
const grievanceController = require('../controllers/grievance.controller');

const router = express.Router();

// Ensure public/uploads/evidence exists
const uploadDir = path.join(__dirname, '../../public/uploads/evidence');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `evidence_${Date.now()}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|pdf/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname && mimetype) {
      return cb(null, true);
    }
    cb(new Error('Only images (JPEG/PNG) and PDFs are supported.'));
  }
});

// Student Grievance Submission (Multer middleware single('evidence'))
// Note: Anyone can submit a grievance (auth not strictly required to allow anonymous reports without logging in, but they can provide their index number)
router.post('/submit', upload.single('evidence'), grievanceController.submitGrievance);

// Student fetch their own history
router.get('/student/:studentIndex', grievanceController.getStudentGrievances);

// Public/Student list grievances (with query filters) - no auth required for students to see their relevant grievances
router.get('/', grievanceController.listGrievances);

// Admin-only operations
router.get('/list', protect, authorizeRoles('SUPERADMIN', 'ADMIN', 'LECTURER'), grievanceController.listGrievances);
router.post('/:id/resolve', protect, authorizeRoles('SUPERADMIN', 'ADMIN', 'LECTURER'), grievanceController.resolveGrievance);

module.exports = router;
