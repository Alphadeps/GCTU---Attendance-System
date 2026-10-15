const express = require('express');
const {
  markAttendance,
  getSessionAttendance,
  getStudentHistory,
  updateAttendanceStatus,
  repSelfCheckIn,
  markProxyAttendance,
  searchClassmates
} = require('../controllers/attendance.controller');
const bodyguard = require('../middleware/bodyguard');
const { protect, protectStudent, protectAny, ownStudentRecordOr, authorizeRoles, flagIntrusion } = require('../middleware/auth');

const { checkInLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

// The signed-in student is who they are: whatever index number or name the request claims is
// replaced with the ones from their login. Claiming to be someone else is logged as an attack.
const asSignedInStudent = (field, nameField) => (req, res, next) => {
  const source = req.method === 'GET' ? req.query : req.body;
  const claimed = source?.[field];
  if (claimed && String(claimed).trim().toLowerCase() !== req.student.indexNumber.toLowerCase()) {
    flagIntrusion(req, 'IMPERSONATION', { claimed, student: req.student.indexNumber });
  }
  source[field] = req.student.indexNumber;
  if (nameField) source[nameField] = req.student.name;
  next();
};

// Student check-in (student login required)
router.post('/mark', checkInLimiter, protectStudent, asSignedInStudent('indexNumber', 'name'), bodyguard, markAttendance);

// Proxy check-in: a present student marks for an absent classmate
router.post('/mark-proxy', checkInLimiter, protectStudent, asSignedInStudent('submitterIndexNumber'), markProxyAttendance);

// Search classmates by name within a session's class (for proxy attendance)
router.get('/session/:sessionId/classmates', protectStudent, asSignedInStudent('submitterIndex'), searchClassmates);

// Rep self check-in endpoint (Protected - REP only)
router.post('/rep-self-checkin', protect, authorizeRoles('REP'), repSelfCheckIn);

// View attendance for a session (REP, LECTURER, ADMIN)
router.get('/session/:sessionId', protect, authorizeRoles('REP', 'LECTURER', 'ADMIN'), getSessionAttendance);

// Attendance history: a student sees only their own; staff can see anyone's
router.get('/student/:indexNumber', protectAny, ownStudentRecordOr('indexNumber'), getStudentHistory);

// Override attendance record status (REP, LECTURER, ADMIN)
router.patch('/:id/status', protect, authorizeRoles('REP', 'LECTURER', 'ADMIN'), updateAttendanceStatus);

module.exports = router;
