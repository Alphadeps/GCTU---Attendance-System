const express = require('express');
const {
  createSession,
  getActiveSessions,
  closeSession,
  approveSession,
  refreshQRCode,
  getSessionById
} = require('../controllers/session.controller');
const { protect, authorizeRoles } = require('../middleware/auth');

const router = express.Router();

// Route mappings
router.post('/', protect, authorizeRoles('REP', 'ADMIN'), createSession);
router.get('/active', getActiveSessions); // Publicly accessible to allow students to find active classes
router.get('/:id', protect, authorizeRoles('REP', 'LECTURER', 'ADMIN'), getSessionById);
router.patch('/:id/close', protect, authorizeRoles('REP', 'ADMIN'), closeSession);
router.patch('/:id/approve', protect, authorizeRoles('REP', 'LECTURER', 'ADMIN'), approveSession);
router.post('/:id/refresh-qr', protect, authorizeRoles('REP', 'ADMIN'), refreshQRCode);

module.exports = router;
