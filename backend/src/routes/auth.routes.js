const express = require('express');
const { register, login, changePassword } = require('../controllers/auth.controller');
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

router.post('/login', login);
router.patch('/change-password', protect, changePassword);

module.exports = router;
