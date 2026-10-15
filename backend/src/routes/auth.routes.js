const express = require('express');
const { register, login, refresh, logout, changePassword } = require('../controllers/auth.controller');
const { protect } = require('../middleware/auth');

const router = express.Router();

// Optional protect middleware for register (required if database already has users)
router.post('/register', (req, res, next) => {
  if (req.headers.authorization) {
    protect(req, res, next);
  } else {
    next();
  }
}, register);

const { loginLimiter } = require('../middleware/rateLimiter');
const { requireHuman, TURNSTILE_ACTIONS } = require('../middleware/turnstile');
const repSignup = require('../controllers/repSignup.controller');

router.post('/login', loginLimiter, requireHuman(TURNSTILE_ACTIONS.staffLogin), login);

// Class reps create their own account + class (stays pending until a super admin approves)
router.get('/programmes', repSignup.listProgrammesPublic);
router.post('/rep-signup', loginLimiter, requireHuman(TURNSTILE_ACTIONS.repSignup), repSignup.repSignup);
router.post('/refresh', refresh);
router.post('/logout', logout);
router.patch('/change-password', protect, changePassword);

module.exports = router;
