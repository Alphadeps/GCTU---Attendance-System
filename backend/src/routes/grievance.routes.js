const express = require('express');
const multer = require('multer');
const path = require('path');

const { protect, protectStudent, protectAny, ownStudentRecordOr, authorizeRoles } = require('../middleware/auth');
const grievanceController = require('../controllers/grievance.controller');

const router = express.Router();

// Evidence is kept in memory and saved to the database (the server disk is wiped on restart)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|pdf/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname && mimetype) {
      return cb(null, true);
    }
    cb(Object.assign(new Error('Only images (JPEG/PNG) and PDFs are supported.'), { isUploadError: true }));
  }
});

// Student Grievance Submission (Multer middleware single('evidence'))
// Note: Anyone can submit a grievance (auth not strictly required to allow anonymous reports without logging in, but they can provide their index number)
router.post('/submit', protectStudent, upload.single('evidence'), grievanceController.submitGrievance);

// Student fetch their own history
router.get('/student/:studentIndex', protectAny, ownStudentRecordOr('studentIndex'), grievanceController.getStudentGrievances);

// Public/Student list grievances (with query filters) - no auth required for students to see their relevant grievances
router.get('/', protect, authorizeRoles('SUPERADMIN', 'ADMIN', 'LECTURER', 'REP'), grievanceController.listGrievances);

// Admin-only operations
router.get('/list', protect, authorizeRoles('SUPERADMIN', 'ADMIN', 'LECTURER'), grievanceController.listGrievances);
router.post('/:id/resolve', protect, authorizeRoles('SUPERADMIN', 'ADMIN', 'LECTURER'), grievanceController.resolveGrievance);

module.exports = router;
