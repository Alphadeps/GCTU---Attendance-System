const { rateLimit, ipKeyGenerator } = require('express-rate-limit');

// Normalise the client IP for rate-limit keys. ipKeyGenerator groups IPv6 addresses by
// /56 subnet so one IPv6 client can't dodge limits by rotating addresses
// (express-rate-limit v8 rejects custom keyGenerators that use req.ip directly).
const ipKey = (req) => ipKeyGenerator(req.ip || '0.0.0.0');
const { cache } = require('../lib/redis');

/**
 * Rate-limit counter store. Uses Redis when it is connected, so limits survive restarts and
 * are shared between server instances; otherwise counts in memory. (The old store returned
 * "1 hit" whenever Redis was missing, which silently switched every rate limit off.)
 */
const RedisStore = class {
  constructor(options = {}) {
    this.prefix = options.prefix || 'rl:';
    this.windowMs = 60 * 1000;
    this.memory = new Map(); // key -> { hits, resetAt }
  }

  init(options) {
    if (options?.windowMs) this.windowMs = options.windowMs;
  }

  memoryHit(key, delta) {
    const now = Date.now();
    let entry = this.memory.get(key);
    if (!entry || entry.resetAt <= now) {
      entry = { hits: 0, resetAt: now + this.windowMs };
      this.memory.set(key, entry);
    }
    entry.hits = Math.max(0, entry.hits + delta);
    if (this.memory.size > 50000) {
      for (const [k, v] of this.memory) if (v.resetAt <= now) this.memory.delete(k);
    }
    return entry;
  }

  async increment(key) {
    const client = cache.client();
    const fullKey = this.prefix + key;
    if (client) {
      try {
        const [[, hits], [, ttl]] = await client.multi().incr(fullKey).pttl(fullKey).exec();
        if (ttl < 0) await client.pexpire(fullKey, this.windowMs);
        return { totalHits: hits, resetTime: new Date(Date.now() + (ttl > 0 ? ttl : this.windowMs)) };
      } catch (error) {
        console.error('Rate limit store error (falling back to memory):', error.message);
      }
    }
    const entry = this.memoryHit(fullKey, 1);
    return { totalHits: entry.hits, resetTime: new Date(entry.resetAt) };
  }

  async decrement(key) {
    const client = cache.client();
    const fullKey = this.prefix + key;
    if (client) {
      try { await client.decr(fullKey); return; } catch (_) {}
    }
    this.memoryHit(fullKey, -1);
  }

  async resetKey(key) {
    const client = cache.client();
    const fullKey = this.prefix + key;
    this.memory.delete(fullKey);
    if (client) {
      try { await client.del(fullKey); } catch (_) {}
    }
  }
};

// ==========================================
// IP BLOCKING (check-in only, not login)
// ==========================================

const blockedIPs = new Map();
const suspiciousIPs = new Map();

function isIPBlocked(ip) {
  const blockInfo = blockedIPs.get(ip);
  if (!blockInfo) return false;
  if (Date.now() > blockInfo.expiresAt) {
    blockedIPs.delete(ip);
    return false;
  }
  return true;
}

function blockIP(ip, durationMs = 15 * 60 * 1000) {
  const expiresAt = Date.now() + durationMs;
  blockedIPs.set(ip, { expiresAt, blockedAt: Date.now() });
  console.warn(`IP blocked: ${ip} until ${new Date(expiresAt).toISOString()}`);
}

function trackSuspiciousActivity(ip) {
  const current = suspiciousIPs.get(ip) || { count: 0, firstSeen: Date.now() };
  current.count++;
  current.lastSeen = Date.now();
  suspiciousIPs.set(ip, current);
  if (current.count >= 20 && (current.lastSeen - current.firstSeen) < 15 * 60 * 1000) {
    blockIP(ip, 15 * 60 * 1000);
    suspiciousIPs.delete(ip);
  }
}

const checkIPBlock = (req, res, next) => {
  const ip = req.ip || req.connection.remoteAddress;
  if (isIPBlocked(ip)) {
    const blockInfo = blockedIPs.get(ip);
    const remainingSeconds = Math.ceil((blockInfo.expiresAt - Date.now()) / 1000);
    return res.status(429).json({
      error: `Too many failed attempts. Please wait ${Math.ceil(remainingSeconds / 60)} minute(s).`,
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
 * Staff login limiter — keyed by username to avoid campus NAT cross-contamination
 */
const loginLimiter = rateLimit({
  windowMs: 2 * 60 * 1000,  // 2-minute window
  max: 10,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  store: new RedisStore({ prefix: 'rl:login:' }),

  keyGenerator: (req) => {
    if (req.method === 'OPTIONS') return `options:${ipKey(req)}`;
    const username = req.body?.username;
    if (username) return `user:${String(username).toLowerCase().trim()}`;
    return `ip:${ipKey(req)}`;
  },

  handler: (req, res) => {
    res.status(429).json({
      error: 'Too many login attempts. Please wait before trying again.',
      retryAfter: 30,
      lockoutSeconds: 30
    });
  }
});

/**
 * Student login limiter — keyed by index number, never by shared campus IP
 * Each student gets their own independent counter.
 */
const studentAuthLimiter = rateLimit({
  windowMs: 2 * 60 * 1000,  // 2-minute window
  max: 10,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  store: new RedisStore({ prefix: 'rl:student-auth:' }),

  skip: (req) => req.method === 'OPTIONS',

  keyGenerator: (req) => {
    const indexNumber = req.body?.indexNumber;
    if (indexNumber) return `idx:${String(indexNumber).toLowerCase().trim()}`;
    // If no index number in body, use a unique key that can't pool with other students
    return `ip:${ipKey(req)}:${Date.now()}:${Math.random()}`;
  },

  handler: (req, res) => {
    res.status(429).json({
      error: 'Too many login attempts. Please wait 30 seconds before trying again.',
      retryAfter: 30,
      lockoutSeconds: 30
    });
  }
});

/**
 * Check-in limiter — keyed by index number
 */
const checkInLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  store: new RedisStore({ prefix: 'rl:checkin:' }),

  skip: (req) => req.method === 'OPTIONS',

  keyGenerator: (req) => {
    const indexNumber = req.student?.indexNumber || req.body?.indexNumber;
    if (indexNumber) return `idx:${String(indexNumber).toLowerCase().trim()}`;
    return `ip:${ipKey(req)}`;
  },

  handler: (req, res) => {
    res.status(429).json({
      error: 'Too many check-in attempts. Please wait before trying again.',
      retryAfter: 30
    });
  }
});

const unauthenticatedLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5000,
  standardHeaders: true,
  legacyHeaders: false,
  store: new RedisStore({ prefix: 'rl:unauth:' }),
  skip: (req) => !!req.user,
  handler: (req, res) => {
    res.status(429).json({ error: 'Rate limit exceeded. Please slow down.', retryAfter: 300 });
  }
});

const authenticatedLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  store: new RedisStore({ prefix: 'rl:auth:' }),
  skip: (req) => !req.user,
  keyGenerator: (req) => req.user?.id ? `user:${req.user.id}` : undefined,
  handler: (req, res) => {
    res.status(429).json({ error: 'Too many requests. Please slow down.', retryAfter: 900 });
  }
});

const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  store: new RedisStore({ prefix: 'rl:admin:' }),
  keyGenerator: (req) => req.user?.id ? `user:${req.user.id}` : undefined,
  message: { error: 'Too many admin requests. Please slow down.' }
});

const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  store: new RedisStore({ prefix: 'rl:upload:' }),
  keyGenerator: (req) => req.user?.id ? `user:${req.user.id}` : undefined,
  handler: (req, res) => {
    res.status(429).json({ error: 'Too many uploads. Please wait before uploading more.', retryAfter: 3600 });
  }
});

const reportLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  store: new RedisStore({ prefix: 'rl:report:' }),
  keyGenerator: (req) => req.user?.id ? `user:${req.user.id}` : undefined,
  message: { error: 'Too many report requests. Please wait.' }
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20000,
  standardHeaders: true,
  legacyHeaders: false,
  store: new RedisStore({ prefix: 'rl:api:' }),
  keyGenerator: (req) => {
    if (req.user?.id) return `user:${req.user.id}`;
    return ipKey(req);
  },
  message: { error: 'Too many requests. Please slow down.' }
});

// Cleanup every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [ip, info] of blockedIPs.entries()) {
    if (now > info.expiresAt) blockedIPs.delete(ip);
  }
  for (const [ip, info] of suspiciousIPs.entries()) {
    if (now - info.lastSeen > 60 * 60 * 1000) suspiciousIPs.delete(ip);
  }
}, 5 * 60 * 1000);

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

function unblockIP(ip) {
  blockedIPs.delete(ip);
  suspiciousIPs.delete(ip);
}

function getSuspiciousIPs() {
  const suspicious = [];
  for (const [ip, info] of suspiciousIPs.entries()) {
    suspicious.push({ ip, violations: info.count, firstSeen: new Date(info.firstSeen), lastSeen: new Date(info.lastSeen) });
  }
  return suspicious;
}

module.exports = {
  loginLimiter,
  studentAuthLimiter,
  checkInLimiter,
  unauthenticatedLimiter,
  authenticatedLimiter,
  adminLimiter,
  uploadLimiter,
  reportLimiter,
  apiLimiter,
  checkIPBlock,
  blockIP,
  unblockIP,
  isIPBlocked,
  getBlockedIPs,
  getSuspiciousIPs
};
