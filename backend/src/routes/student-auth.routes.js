const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  studentLogin,
  studentSetPassword,
  repResetStudentPassword
} = require('../controllers/student-auth.controller');

// Student authentication routes
router.post('/login', studentLogin);
router.post('/set-password', studentSetPassword);

// Rep can reset student password (protected route)
router.post('/reset-password', protect, repResetStudentPassword);

module.exports = router;
