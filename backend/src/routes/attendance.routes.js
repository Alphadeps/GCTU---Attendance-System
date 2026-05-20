const express = require('express');
const {
  markAttendance,
  getSessionAttendance,
  getStudentHistory,
  updateAttendanceStatus
} = require('../controllers/attendance.controller');
const bodyguard = require('../middleware/bodyguard');
const { protect, authorizeRoles } = require('../middleware/auth');

const { checkInLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

// Student check-in endpoint (Public)
router.post('/mark', checkInLimiter, bodyguard, markAttendance);

// View attendance for a session (REP, LECTURER, ADMIN)
router.get('/session/:sessionId', protect, authorizeRoles('REP', 'LECTURER', 'ADMIN'), getSessionAttendance);

// View attendance history for a student (Public)
router.get('/student/:indexNumber', getStudentHistory);

// Override attendance record status (REP, LECTURER, ADMIN)
router.patch('/:id/status', protect, authorizeRoles('REP', 'LECTURER', 'ADMIN'), updateAttendanceStatus);

module.exports = router;
