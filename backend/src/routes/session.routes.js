const express = require('express');
const {
  createSession,
  getActiveSessions,
  closeSession,
  approveSession,
  getSessionById
} = require('../controllers/session.controller');
const { protect, authorizeRoles } = require('../middleware/auth');

const router = express.Router();

router.post('/', protect, authorizeRoles('REP', 'ADMIN'), createSession);
router.get('/active', getActiveSessions);
router.get('/:id', protect, authorizeRoles('REP', 'LECTURER', 'ADMIN'), getSessionById);
router.patch('/:id/close', protect, authorizeRoles('REP', 'ADMIN'), closeSession);
router.patch('/:id/approve', protect, authorizeRoles('REP', 'LECTURER', 'ADMIN'), approveSession);

module.exports = router;
