/**
 * Security Hardening Middleware
 * 
 * Implements:
 * - XSS Protection
 * - CSRF Protection
 * - Content Security Policy (CSP)
 * - SQL Injection Prevention
 * - HTTP Parameter Pollution Protection
 * - Security Headers
 */

const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const hpp = require('hpp');

/**
 * Input Sanitization Middleware
 * Prevents XSS attacks by sanitizing user input
 */
const sanitizeInput = (req, res, next) => {
  // Sanitize request body
  if (req.body) {
    req.body = sanitizeObject(req.body);
  }
  
  // Sanitize query parameters
  if (req.query) {
    req.query = sanitizeObject(req.query);
  }
  
  // Sanitize URL parameters
  if (req.params) {
    req.params = sanitizeObject(req.params);
  }
  
  next();
};

/**
 * Recursively sanitize an object
 */
function sanitizeObject(obj) {
  if (typeof obj !== 'object' || obj === null) {
    return sanitizeValue(obj);
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item));
  }
  
  const sanitized = {};
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      // Sanitize key (prevent prototype pollution)
      const sanitizedKey = sanitizeKey(key);
      if (sanitizedKey) {
        sanitized[sanitizedKey] = sanitizeObject(obj[key]);
      }
    }
  }
  
  return sanitized;
}

/**
 * Sanitize a single value
 */
function sanitizeValue(value) {
  if (typeof value !== 'string') {
    return value;
  }
  
  // Remove potentially dangerous characters
  return value
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+\s*=/gi, '') // Remove event handlers (onclick, onerror, etc.)
    .replace(/<iframe/gi, '') // Remove iframe tags
    .replace(/<object/gi, '') // Remove object tags
    .replace(/<embed/gi, ''); // Remove embed tags
}

/**
 * Sanitize object keys (prevent prototype pollution)
 */
function sanitizeKey(key) {
  // Block dangerous keys
  const dangerousKeys = ['__proto__', 'constructor', 'prototype'];
  if (dangerousKeys.includes(key)) {
    return null;
  }
  
  return key;
}

/**
 * CSRF Token Generation and Validation
 */
const csrfTokens = new Map(); // In-memory token storage (use Redis in production)

/**
 * Generate CSRF token
 */
function generateCsrfToken(userId) {
  const token = require('crypto').randomBytes(32).toString('hex');
  const expiresAt = Date.now() + (60 * 60 * 1000); // 1 hour
  
  csrfTokens.set(token, { userId, expiresAt });
  
  // Clean up expired tokens
  cleanupExpiredTokens();
  
  return token;
}

/**
 * Validate CSRF token
 */
function validateCsrfToken(token, userId) {
  const tokenData = csrfTokens.get(token);
  
  if (!tokenData) {
    return false;
  }
  
  if (tokenData.expiresAt < Date.now()) {
    csrfTokens.delete(token);
    return false;
  }
  
  if (tokenData.userId !== userId) {
    return false;
  }
  
  return true;
}

/**
 * Clean up expired CSRF tokens
 */
function cleanupExpiredTokens() {
  const now = Date.now();
  for (const [token, data] of csrfTokens.entries()) {
    if (data.expiresAt < now) {
      csrfTokens.delete(token);
    }
  }
}

/**
 * CSRF Protection Middleware
 * Validates CSRF tokens for state-changing operations
 */
const csrfProtection = (req, res, next) => {
  // Skip CSRF for safe methods
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }
  
  // Skip CSRF for public endpoints (attendance marking, student login)
  const publicEndpoints = [
    '/api/attendance/mark',
    '/api/student-auth/login',
    '/api/student-auth/set-password',
    '/api/auth/login',
    '/api/auth/register'
  ];
  
  if (publicEndpoints.some(endpoint => req.path.startsWith(endpoint))) {
    return next();
  }
  
  // Get CSRF token from header
  const token = req.headers['x-csrf-token'];
  
  if (!token) {
    return res.status(403).json({
      error: 'CSRF token missing',
      message: 'CSRF token is required for this operation'
    });
  }
  
  // Validate token
  const userId = req.user?.id;
  if (!userId || !validateCsrfToken(token, userId)) {
    return res.status(403).json({
      error: 'Invalid CSRF token',
      message: 'CSRF token is invalid or expired'
    });
  }
  
  next();
};

/**
 * Endpoint to get CSRF token
 */
const getCsrfToken = (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  const token = generateCsrfToken(req.user.id);
  res.json({ csrfToken: token });
};

/**
 * Security Headers Configuration
 */
const securityHeaders = helmet({
  // Content Security Policy
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"], // Allow inline scripts for development
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'", 'https://accelerate.prisma-data.net'],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null
    }
  },
  
  // X-Frame-Options: Prevent clickjacking
  frameguard: {
    action: 'deny'
  },
  
  // X-Content-Type-Options: Prevent MIME sniffing
  noSniff: true,
  
  // X-XSS-Protection: Enable XSS filter
  xssFilter: true,
  
  // Strict-Transport-Security: Enforce HTTPS
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true
  },
  
  // Referrer-Policy: Control referrer information
  referrerPolicy: {
    policy: 'strict-origin-when-cross-origin'
  },
  
  // Permissions-Policy: Control browser features
  permittedCrossDomainPolicies: {
    permittedPolicies: 'none'
  }
});

/**
 * HTTPS Enforcement Middleware
 */
const enforceHttps = (req, res, next) => {
  // Skip in development
  if (process.env.NODE_ENV !== 'production') {
    return next();
  }
  
  // Check if request is secure
  if (req.secure || req.headers['x-forwarded-proto'] === 'https') {
    return next();
  }
  
  // Redirect to HTTPS
  return res.redirect(301, `https://${req.headers.host}${req.url}`);
};

/**
 * SQL Injection Prevention
 * Note: Prisma already prevents SQL injection by using parameterized queries
 * This is an additional layer of validation
 */
const preventSqlInjection = (req, res, next) => {
  const sqlPatterns = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE)\b)/gi,
    /(UNION\s+SELECT)/gi,
    /(--|\#|\/\*|\*\/)/g,
    /(\bOR\b\s+\d+\s*=\s*\d+)/gi,
    /(\bAND\b\s+\d+\s*=\s*\d+)/gi
  ];
  
  const checkForSqlInjection = (obj) => {
    if (typeof obj === 'string') {
      for (const pattern of sqlPatterns) {
        if (pattern.test(obj)) {
          return true;
        }
      }
    } else if (typeof obj === 'object' && obj !== null) {
      for (const key in obj) {
        if (checkForSqlInjection(obj[key])) {
          return true;
        }
      }
    }
    return false;
  };
  
  // Check body, query, and params
  if (checkForSqlInjection(req.body) || 
      checkForSqlInjection(req.query) || 
      checkForSqlInjection(req.params)) {
    console.warn('⚠️  Potential SQL injection attempt detected:', {
      ip: req.ip,
      path: req.path,
      method: req.method
    });
    
    return res.status(400).json({
      error: 'Invalid input detected',
      message: 'Your request contains potentially malicious content'
    });
  }
  
  next();
};

/**
 * Rate limit bypass prevention
 * Prevents users from bypassing rate limits using different headers
 */
const preventRateLimitBypass = (req, res, next) => {
  // Remove headers that could be used to bypass rate limiting
  delete req.headers['x-forwarded-for'];
  delete req.headers['x-real-ip'];
  delete req.headers['x-client-ip'];
  
  // Only trust proxy headers in production with proper configuration
  if (process.env.NODE_ENV === 'production' && process.env.TRUST_PROXY === 'true') {
    // Restore trusted proxy headers
    // This should be configured based on your deployment environment
  }
  
  next();
};

/**
 * File Upload Security
 */
const secureFileUpload = (req, res, next) => {
  if (!req.file && !req.files) {
    return next();
  }
  
  const allowedMimeTypes = [
    'text/csv',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/gif'
  ];
  
  const files = req.files ? Object.values(req.files).flat() : [req.file];
  
  for (const file of files) {
    if (!file) continue;
    
    // Check MIME type
    if (!allowedMimeTypes.includes(file.mimetype)) {
      return res.status(400).json({
        error: 'Invalid file type',
        message: `File type ${file.mimetype} is not allowed`
      });
    }
    
    // Check file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      return res.status(400).json({
        error: 'File too large',
        message: 'File size must be less than 10MB'
      });
    }
    
    // Sanitize filename
    file.originalname = file.originalname
      .replace(/[^a-zA-Z0-9.-]/g, '_')
      .substring(0, 255);
  }
  
  next();
};

/**
 * Security audit logging
 */
const securityAuditLog = (req, res, next) => {
  // Log security-sensitive operations
  const sensitiveOperations = [
    '/api/auth/login',
    '/api/admin/reps',
    '/api/admin/programmes',
    '/api/admin/classes',
    '/api/settings'
  ];
  
  if (sensitiveOperations.some(op => req.path.startsWith(op))) {
    console.log('🔒 Security Audit:', {
      timestamp: new Date().toISOString(),
      ip: req.ip,
      user: req.user?.username || 'anonymous',
      method: req.method,
      path: req.path,
      userAgent: req.headers['user-agent']
    });
  }
  
  next();
};

module.exports = {
  // Middleware
  securityHeaders,
  sanitizeInput,
  csrfProtection,
  enforceHttps,
  preventSqlInjection,
  preventRateLimitBypass,
  secureFileUpload,
  securityAuditLog,
  
  // MongoDB sanitization (prevents NoSQL injection)
  mongoSanitize: mongoSanitize(),
  
  // HTTP Parameter Pollution protection
  hpp: hpp(),
  
  // CSRF token management
  getCsrfToken,
  generateCsrfToken,
  validateCsrfToken
};
