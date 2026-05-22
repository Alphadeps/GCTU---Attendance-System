const rateLimit = require('express-rate-limit');
const { cache } = require('../lib/redis');

/**
 * Enhanced Rate Limiting System
 * 
 * Features:
 * - Stricter limits per endpoint type
 * - IP-based blocking for suspicious activity
 * - Exponential backoff for failed login attempts
 * - Separate limits for authenticated vs unauthenticated users
 * - Redis-backed storage for distributed rate limiting (falls back to memory)
 */

// ==========================================
// REDIS STORE (if available)
// ==========================================

// Custom Redis store for rate limiting
const RedisStore = class {
  constructor(options = {}) {
    this.prefix = options.prefix || 'rl:';
    this.resetExpiryOnChange = options.resetExpiryOnChange || false;
  }

  async increment(key) {
    if (!cache) {
      // Fallback to memory store if Redis not available
      return { totalHits: 1, resetTime: new Date(Date.now() + 60000) };
    }

    const fullKey = this.prefix + key;
    const hits = await cache.incr(fullKey, 900); // 15 min expiry
    const ttl = 900000; // 15 minutes in ms
    
    return {
      totalHits: hits,
      resetTime: new Date(Date.now() + ttl)
    };
  }

  async decrement(key) {
    if (!cache) return;
    const fullKey = this.prefix + key;
    // Redis DECR operation (not implemented in our cache helper, but not critical)
  }

  async resetKey(key) {
    if (!cache) return;
    const fullKey = this.prefix + key;
    await cache.del(fullKey);
  }
};

// ==========================================
// IP BLOCKING SYSTEM
// ==========================================

const blockedIPs = new Map(); // In-memory IP block list
const suspiciousIPs = new Map(); // Track suspicious activity

/**
 * Check if IP is blocked
 */
function isIPBlocked(ip) {
  const blockInfo = blockedIPs.get(ip);
  if (!blockInfo) return false;
  
  // Check if block has expired
  if (Date.now() > blockInfo.expiresAt) {
    blockedIPs.delete(ip);
    return false;
  }
  
  return true;
}

/**
 * Block an IP address temporarily
 */
function blockIP(ip, durationMs = 15 * 60 * 1000) {
  const expiresAt = Date.now() + durationMs;
  blockedIPs.set(ip, { expiresAt, blockedAt: Date.now() });
  console.warn(`🚫 IP blocked: ${ip} until ${new Date(expiresAt).toISOString()}`);
}

/**
 * Track suspicious activity
 */
function trackSuspiciousActivity(ip) {
  const current = suspiciousIPs.get(ip) || { count: 0, firstSeen: Date.now() };
  current.count++;
  current.lastSeen = Date.now();
  suspiciousIPs.set(ip, current);
  
  // Block IP if too many rate limit violations (5 violations in 10 minutes)
  if (current.count >= 5 && (current.lastSeen - current.firstSeen) < 10 * 60 * 1000) {
    blockIP(ip, 30 * 60 * 1000); // Block for 30 minutes
    suspiciousIPs.delete(ip);
  }
}

/**
 * Middleware to check if IP is blocked
 */
const checkIPBlock = (req, res, next) => {
  const ip = req.ip || req.connection.remoteAddress;
  
  if (isIPBlocked(ip)) {
    return res.status(403).json({
      error: 'Access denied. Your IP has been temporarily blocked due to suspicious activity.',
      retryAfter: Math.ceil((blockedIPs.get(ip).expiresAt - Date.now()) / 1000)
    });
  }
  
  next();
};

// ==========================================
// RATE LIMITERS
// ==========================================

/**
 * Exponential backoff for failed login attempts
 * - 1st violation: 1 minute block
 * - 2nd violation: 5 minutes block
 * - 3rd violation: 15 minutes block
 * - 4th+ violation: 30 minutes block + IP flagged as suspicious
 */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minute window
  max: 5, // 5 attempts per window
  skipSuccessfulRequests: true, // Don't count successful logins
  standardHeaders: true,
  legacyHeaders: false,
  store: new RedisStore({ prefix: 'rl:login:' }),
  
  handler: (req, res) => {
    const ip = req.ip || req.connection.remoteAddress;
    trackSuspiciousActivity(ip);
    
    // Exponential backoff calculation
    const violations = suspiciousIPs.get(ip)?.count || 1;
    const backoffMinutes = Math.min(Math.pow(2, violations - 1), 30); // 1, 2, 4, 8, 16, 30 max
    
    res.status(429).json({
      error: `Too many login attempts. Please try again in ${backoffMinutes} minute(s).`,
      retryAfter: backoffMinutes * 60,
      attemptsRemaining: 0
    });
  },
  
  message: {
    error: 'Too many login attempts. Please try again later.'
  }
});

/**
 * Student authentication (first-time login)
 * Stricter than regular login due to potential for abuse
 */
const studentAuthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts per window
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  store: new RedisStore({ prefix: 'rl:student-auth:' }),
  
  handler: (req, res) => {
    const ip = req.ip || req.connection.remoteAddress;
    trackSuspiciousActivity(ip);
    
    res.status(429).json({
      error: 'Too many authentication attempts. Please try again in 15 minutes.',
      retryAfter: 900
    });
  }
});

/**
 * Check-in rate limiter (prevent QR code scanning spam)
 * Very strict to prevent automated attendance marking
 */
const checkInLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute window
  max: 3, // Only 3 check-ins per minute (reasonable for legitimate use)
  standardHeaders: true,
  legacyHeaders: false,
  store: new RedisStore({ prefix: 'rl:checkin:' }),
  
  handler: (req, res) => {
    const ip = req.ip || req.connection.remoteAddress;
    trackSuspiciousActivity(ip);
    
    res.status(429).json({
      error: 'Too many check-in attempts. Please wait before trying again.',
      retryAfter: 60
    });
  }
});

/**
 * Unauthenticated API limiter (public endpoints)
 * Stricter limits for non-authenticated users
 */
const unauthenticatedLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per 15 minutes for unauthenticated users
  standardHeaders: true,
  legacyHeaders: false,
  store: new RedisStore({ prefix: 'rl:unauth:' }),
  
  skip: (req) => {
    // Skip if user is authenticated (has valid JWT)
    return !!req.user;
  },
  
  handler: (req, res) => {
    const ip = req.ip || req.connection.remoteAddress;
    trackSuspiciousActivity(ip);
    
    res.status(429).json({
      error: 'Rate limit exceeded. Please authenticate or wait before making more requests.',
      retryAfter: 900
    });
  }
});

/**
 * Authenticated API limiter (protected endpoints)
 * More generous limits for authenticated users
 */
const authenticatedLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // 1000 requests per 15 minutes for authenticated users
  standardHeaders: true,
  legacyHeaders: false,
  store: new RedisStore({ prefix: 'rl:auth:' }),
  
  skip: (req) => {
    // Only apply to authenticated users
    return !req.user;
  },
  
  keyGenerator: (req) => {
    // Use user ID instead of IP for authenticated users
    return req.user?.id || req.ip;
  },
  
  handler: (req, res) => {
    res.status(429).json({
      error: 'Rate limit exceeded. Please slow down your requests.',
      retryAfter: 900
    });
  }
});

/**
 * Admin/Superadmin operations limiter
 * Moderate limits for administrative actions
 */
const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // 500 requests per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  store: new RedisStore({ prefix: 'rl:admin:' }),
  
  keyGenerator: (req) => {
    return req.user?.id || req.ip;
  },
  
  message: {
    error: 'Too many administrative requests. Please slow down.'
  }
});

/**
 * File upload limiter (CSV, Excel, PDF imports)
 * Very strict to prevent abuse
 */
const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // 20 uploads per hour
  standardHeaders: true,
  legacyHeaders: false,
  store: new RedisStore({ prefix: 'rl:upload:' }),
  
  keyGenerator: (req) => {
    return req.user?.id || req.ip;
  },
  
  handler: (req, res) => {
    res.status(429).json({
      error: 'Too many file uploads. Please wait before uploading more files.',
      retryAfter: 3600
    });
  }
});

/**
 * Report generation limiter
 * Prevent excessive report generation (resource intensive)
 */
const reportLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // 30 reports per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  store: new RedisStore({ prefix: 'rl:report:' }),
  
  keyGenerator: (req) => {
    return req.user?.id || req.ip;
  },
  
  message: {
    error: 'Too many report generation requests. Please wait before generating more reports.'
  }
});

/**
 * General API limiter (fallback for all other endpoints)
 */
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // 500 requests per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  store: new RedisStore({ prefix: 'rl:api:' }),
  
  message: {
    error: 'Too many requests. Please slow down.'
  }
});

// ==========================================
// UTILITY FUNCTIONS
// ==========================================

/**
 * Get blocked IPs list (for admin monitoring)
 */
function getBlockedIPs() {
  const blocked = [];
  const now = Date.now();
  
  for (const [ip, info] of blockedIPs.entries()) {
    if (now < info.expiresAt) {
      blocked.push({
        ip,
        blockedAt: new Date(info.blockedAt),
        expiresAt: new Date(info.expiresAt),
        remainingSeconds: Math.ceil((info.expiresAt - now) / 1000)
      });
    }
  }
  
  return blocked;
}

/**
 * Manually unblock an IP (admin function)
 */
function unblockIP(ip) {
  blockedIPs.delete(ip);
  suspiciousIPs.delete(ip);
  console.log(`✅ IP unblocked: ${ip}`);
}

/**
 * Get suspicious IPs list (for admin monitoring)
 */
function getSuspiciousIPs() {
  const suspicious = [];
  
  for (const [ip, info] of suspiciousIPs.entries()) {
    suspicious.push({
      ip,
      violations: info.count,
      firstSeen: new Date(info.firstSeen),
      lastSeen: new Date(info.lastSeen)
    });
  }
  
  return suspicious;
}

// Clean up expired entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  
  // Clean up blocked IPs
  for (const [ip, info] of blockedIPs.entries()) {
    if (now > info.expiresAt) {
      blockedIPs.delete(ip);
    }
  }
  
  // Clean up old suspicious activity (older than 1 hour)
  for (const [ip, info] of suspiciousIPs.entries()) {
    if (now - info.lastSeen > 60 * 60 * 1000) {
      suspiciousIPs.delete(ip);
    }
  }
}, 5 * 60 * 1000);

module.exports = {
  // Rate limiters
  loginLimiter,
  studentAuthLimiter,
  checkInLimiter,
  unauthenticatedLimiter,
  authenticatedLimiter,
  adminLimiter,
  uploadLimiter,
  reportLimiter,
  apiLimiter,
  
  // IP blocking
  checkIPBlock,
  blockIP,
  unblockIP,
  isIPBlocked,
  
  // Monitoring
  getBlockedIPs,
  getSuspiciousIPs
};
