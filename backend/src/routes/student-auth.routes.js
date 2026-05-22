const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { studentAuthLimiter } = require('../middleware/rateLimiter');
const {
  studentLogin,
  studentSetPassword,
  repResetStudentPassword
} = require('../controllers/student-auth.controller');

// Student authentication routes (with rate limiting)
router.post('/login', studentAuthLimiter, studentLogin);
router.post('/set-password', studentAuthLimiter, studentSetPassword);

// Rep can reset student password (protected route)
router.post('/reset-password', protect, repResetStudentPassword);

module.exports = router;
