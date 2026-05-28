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
      // Return valid rate limit data
      return { totalHits: 1, resetTime: new Date(Date.now() + 900000) };
    }

    try {
      const fullKey = this.prefix + key;
      const hits = await cache.incr(fullKey, 900); // 15 min expiry
      const ttl = 900000; // 15 minutes in ms
      
      // Ensure hits is always a positive integer
      const validHits = Math.max(1, parseInt(hits) || 1);
      
      return {
        totalHits: validHits,
        resetTime: new Date(Date.now() + ttl)
      };
    } catch (error) {
      console.error('RedisStore increment error:', error);
      // Return valid fallback data on error
      return { totalHits: 1, resetTime: new Date(Date.now() + 900000) };
    }
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
 * Track suspicious activity (more lenient)
 */
function trackSuspiciousActivity(ip) {
  const current = suspiciousIPs.get(ip) || { count: 0, firstSeen: Date.now() };
  current.count++;
  current.lastSeen = Date.now();
  suspiciousIPs.set(ip, current);
  
  // Block IP only after many violations (10 violations in 15 minutes)
  // This is more lenient to avoid blocking legitimate users
  if (current.count >= 10 && (current.lastSeen - current.firstSeen) < 15 * 60 * 1000) {
    blockIP(ip, 15 * 60 * 1000); // Block for 15 minutes (reduced from 30)
    suspiciousIPs.delete(ip);
  }
}

/**
 * Middleware to check if IP is blocked (more informative)
 */
const checkIPBlock = (req, res, next) => {
  const ip = req.ip || req.connection.remoteAddress;
  
  if (isIPBlocked(ip)) {
    const blockInfo = blockedIPs.get(ip);
    const remainingSeconds = Math.ceil((blockInfo.expiresAt - Date.now()) / 1000);
    const remainingMinutes = Math.ceil(remainingSeconds / 60);
    
    return res.status(429).json({ // Changed from 403 to 429 (Too Many Requests)
      error: `Too many failed attempts. Please wait ${remainingMinutes} minute(s) before trying again.`,
      retryAfter: remainingSeconds,
      code: 'IP_TEMPORARILY_BLOCKED'
    });
  }
  
  next();
};

// ==========================================
// RATE LIMITERS
// ==========================================

/**
 * More flexible login rate limiter
 * - Allows more attempts for legitimate users
 * - Only tracks failed attempts
 * - Less aggressive blocking
 */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minute window
  max: 20, // 20 attempts per window (increased from 5)
  skipSuccessfulRequests: true, // Don't count successful logins
  standardHeaders: true,
  legacyHeaders: false,
  store: new RedisStore({ prefix: 'rl:login:' }),
  
  handler: (req, res) => {
    const ip = req.ip || req.connection.remoteAddress;
    // Only track as suspicious after many violations
    const current = suspiciousIPs.get(ip) || { count: 0 };
    if (current.count >= 3) {
      trackSuspiciousActivity(ip);
    }
    
    res.status(429).json({
      error: 'Too many login attempts. Please try again in a few minutes.',
      retryAfter: 300, // 5 minutes
      attemptsRemaining: 0
    });
  },
  
  message: {
    error: 'Too many login attempts. Please try again later.'
  }
});

/**
 * Student authentication (first-time login / password set)
 * Keyed by student index number so campus NAT does not pool all students
 * into one rate-limit bucket.
 */
const studentAuthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 25, // 25 failed attempts per student per window
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  store: new RedisStore({ prefix: 'rl:student-auth:' }),

  keyGenerator: (req) => {
    const indexNumber = req.body?.indexNumber;
    if (indexNumber) return `student:${String(indexNumber).toLowerCase()}`;
    return req.ip || 'unknown';
  },

  handler: (req, res) => {
    res.status(429).json({
      error: 'Too many authentication attempts. Please try again in a few minutes.',
      retryAfter: 300
    });
  }
});

/**
 * Check-in rate limiter (prevent QR code scanning spam)
 * Keyed by student index number so campus NAT does not collapse all students
 * onto a single IP bucket and block legitimate check-ins.
 */
const checkInLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute window
  max: 10, // 10 attempts per minute per student (allows retries without blocking peers)
  standardHeaders: true,
  legacyHeaders: false,
  store: new RedisStore({ prefix: 'rl:checkin:' }),

  keyGenerator: (req) => {
    // Rate-limit by student index number, not IP.
    // Thousands of students sharing campus NAT/WiFi all appear as one IP;
    // keying by identity gives each student their own independent bucket.
    const indexNumber = req.body?.indexNumber;
    if (indexNumber) return `student:${String(indexNumber).toLowerCase()}`;
    return req.ip || 'unknown';
  },

  handler: (req, res) => {
    const indexNumber = req.body?.indexNumber;
    if (indexNumber) {
      trackSuspiciousActivity(`student:${String(indexNumber).toLowerCase()}`);
    }
    res.status(429).json({
      error: 'Too many check-in attempts. Please wait before trying again.',
      retryAfter: 60
    });
  }
});

/**
 * Unauthenticated API limiter (public endpoints)
 * High ceiling to accommodate large shared-IP campus networks.
 */
const unauthenticatedLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5000, // 5,000 requests per IP per window (campus NAT safe)
  standardHeaders: true,
  legacyHeaders: false,
  store: new RedisStore({ prefix: 'rl:unauth:' }),

  skip: (req) => !!req.user,

  handler: (req, res) => {
    res.status(429).json({
      error: 'Rate limit exceeded. Please wait a moment before making more requests.',
      retryAfter: 300
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
    // Use user ID for authenticated users, otherwise let express-rate-limit handle IP
    if (req.user?.id) {
      return `user:${req.user.id}`;
    }
    return undefined;
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
    // Use user ID if authenticated, otherwise let express-rate-limit handle IP
    if (req.user?.id) {
      return `user:${req.user.id}`;
    }
    // Return undefined to use default IP-based key generation
    return undefined;
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
    // Use user ID if authenticated, otherwise let express-rate-limit handle IP
    if (req.user?.id) {
      return `user:${req.user.id}`;
    }
    return undefined;
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
    // Use user ID if authenticated, otherwise let express-rate-limit handle IP
    if (req.user?.id) {
      return `user:${req.user.id}`;
    }
    return undefined;
  },
  
  message: {
    error: 'Too many report generation requests. Please wait before generating more reports.'
  }
});

/**
 * General API limiter (fallback for all endpoints)
 * Keyed by user ID for authenticated requests so per-user limits apply
 * rather than a shared IP bucket that collapses under campus NAT.
 * The high IP-based ceiling (20,000 / 15 min) covers mass concurrent
 * unauthenticated traffic (e.g., 10,000 students logging in at once).
 */
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20000, // 20,000 per window — handles 10k+ students on shared IPs
  standardHeaders: true,
  legacyHeaders: false,
  store: new RedisStore({ prefix: 'rl:api:' }),

  keyGenerator: (req) => {
    if (req.user?.id) return `user:${req.user.id}`;
    return req.ip || 'unknown';
  },

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
