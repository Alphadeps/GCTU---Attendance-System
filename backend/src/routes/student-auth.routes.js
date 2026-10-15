const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { studentAuthLimiter } = require('../middleware/rateLimiter');
const {
  studentLogin,
  studentSetPassword,
  repResetStudentPassword
} = require('../controllers/student-auth.controller');
const { lookupJoinCode, joinClass } = require('../controllers/classJoin.controller');
const { requireHuman, TURNSTILE_ACTIONS } = require('../middleware/turnstile');

// Student authentication routes (with rate limiting)
router.post('/login', studentAuthLimiter, requireHuman(TURNSTILE_ACTIONS.studentLogin), studentLogin);
router.post('/set-password', studentAuthLimiter, requireHuman(TURNSTILE_ACTIONS.setPassword), studentSetPassword);

// Students add themselves to a class with the join code their rep shares
router.get('/join/:code', lookupJoinCode);
router.post('/join', studentAuthLimiter, requireHuman(TURNSTILE_ACTIONS.joinClass), joinClass);

// Rep can reset student password (protected route)
router.post('/reset-password', protect, repResetStudentPassword);

module.exports = router;
