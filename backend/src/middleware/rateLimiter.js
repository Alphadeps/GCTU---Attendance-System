const rateLimit = require('express-rate-limit');

// Strict rate limiter for authentication routes (prevent brute force)
const loginLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 5, // Limit each IP to 5 login requests per window
  message: {
    error: 'Too many login attempts. Please try again after a minute.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiter for student check-ins (prevent automation/scanning spam)
const checkInLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 10, // Limit each IP to 10 check-in submissions per window
  message: {
    error: 'Too many check-in attempts from this network. Please wait a minute before trying again.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// General application rate limiter
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per window
  message: {
    error: 'Too many requests. Please slow down.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = {
  loginLimiter,
  checkInLimiter,
  apiLimiter
};
