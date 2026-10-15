const crypto = require('crypto');
const { logSecurity } = require('./logger');
const { cache } = require('./redis');

// What an attacker sees. Firm, not abusive: it is shown under the school's name.
const WARNING =
  'GCTU Attendance Security: this request looked like an attack and was blocked. ' +
  'Your IP address, device and the time have been recorded and reported to the system administrators. ' +
  'This system was built with intention: every door is locked and every attempt is logged. ' +
  'Found a real weakness? Report it to the department instead and get the credit.';

// Repeat offenders are shut out for an hour after this many attack signals in 15 minutes
const STRIKES_TO_BLOCK = 5;
const STRIKE_WINDOW_MS = 15 * 60 * 1000;
const BLOCK_MS = 60 * 60 * 1000;
const REDIS_LOOKUP_CACHE_MS = 30 * 1000;

// In-memory copies. With Redis connected the strikes and blocks are also kept there, so they
// survive restarts and apply on every server instance.
const strikes = new Map(); // ip -> { count, firstSeen }
const blocked = new Map(); // ip -> { until, reason }
const redisChecked = new Map(); // ip -> time of last Redis lookup that found no block

const blockKey = ip => `intrusion:block:${ip}`;
const strikeKey = ip => `intrusion:strikes:${ip}`;
const clientIp = (req) => req.ip || req.socket?.remoteAddress || 'unknown';

function isBlocked(ip) {
  const entry = blocked.get(ip);
  if (!entry) return false;
  if (Date.now() > entry.until) {
    blocked.delete(ip);
    return false;
  }
  return true;
}

async function countStrike(ip, now) {
  const client = cache.client();
  if (client) {
    try {
      const count = await client.incr(strikeKey(ip));
      if (count === 1) await client.pexpire(strikeKey(ip), STRIKE_WINDOW_MS);
      return count;
    } catch (err) {
      console.error('Intrusion strike store error:', err.message);
    }
  }
  const s = strikes.get(ip);
  const current = s && now - s.firstSeen < STRIKE_WINDOW_MS ? { ...s, count: s.count + 1 } : { count: 1, firstSeen: now };
  strikes.set(ip, current);
  return current.count;
}

async function blockIp(ip, reason, now) {
  const entry = { until: now + BLOCK_MS, reason };
  blocked.set(ip, entry);
  strikes.delete(ip);
  const client = cache.client();
  if (client) {
    try {
      await client.multi().set(blockKey(ip), JSON.stringify(entry), 'PX', BLOCK_MS).del(strikeKey(ip)).exec();
    } catch (err) {
      console.error('Intrusion block store error:', err.message);
    }
  }
}

// Tell every active super admin in the app that an address was blocked
async function alertAdmins(ip, reason, reference) {
  try {
    const prisma = require('./prisma');
    const admins = await prisma.user.findMany({ where: { role: 'SUPERADMIN', isActive: true }, select: { id: true } });
    if (admins.length === 0) return;
    await prisma.notification.createMany({
      data: admins.map(a => ({
        userId: a.id,
        title: 'Security alert: attacker blocked',
        message: `${ip} was blocked for 1 hour after ${STRIKES_TO_BLOCK} attack attempts in 15 minutes (last: ${reason}, ref ${reference}). Details are in the security log.`,
        type: 'DANGER'
      }))
    });
  } catch (err) {
    console.error('Failed to alert admins about blocked IP:', err.message);
  }
}

/**
 * Record an attack signal (forged token, injection payload, probing another person's data…).
 * Returns a reference id the attacker sees and admins can find in the security log.
 */
function flagIntrusion(req, reason, details = {}) {
  const ip = clientIp(req);
  const reference = crypto.randomBytes(6).toString('hex');
  const now = Date.now();
  const base = {
    reference,
    reason,
    ip,
    method: req.method,
    path: req.originalUrl,
    userAgent: req.get?.('user-agent'),
    ...details
  };

  // Counting and blocking happen in the background; the attacker is answered right away
  countStrike(ip, now)
    .then(async (count) => {
      const willBlock = count >= STRIKES_TO_BLOCK && !isBlocked(ip);
      logSecurity('INTRUSION_ATTEMPT', { ...base, strikes: count, blocked: willBlock || isBlocked(ip) });
      if (willBlock) {
        await blockIp(ip, reason, now);
        logSecurity('INTRUDER_BLOCKED', { ip, reason, reference, minutes: BLOCK_MS / 60000 });
        await alertAdmins(ip, reason, reference);
      }
    })
    .catch(err => console.error('Intrusion tracking error:', err.message));

  return reference;
}

function sendWarning(res, status, reference) {
  return res.status(status).json({ error: 'Request blocked', code: 'SECURITY_VIOLATION', message: WARNING, reference });
}

// Flag and answer in one go
function rejectIntrusion(req, res, reason, { status = 403, details } = {}) {
  return sendWarning(res, status, flagIntrusion(req, reason, details));
}

// Early in the stack: IPs that kept attacking are refused everywhere for an hour
async function blockIntruders(req, res, next) {
  const ip = clientIp(req);
  if (isBlocked(ip)) return sendWarning(res, 403, `blocked-${blocked.get(ip).until}`);

  // Blocked by another instance or before a restart? Ask Redis, at most every 30 s per IP
  const client = cache.client();
  const last = redisChecked.get(ip);
  if (client && (!last || Date.now() - last > REDIS_LOOKUP_CACHE_MS)) {
    try {
      const stored = await client.get(blockKey(ip));
      if (stored) {
        const entry = JSON.parse(stored);
        blocked.set(ip, entry);
        return sendWarning(res, 403, `blocked-${entry.until}`);
      }
      redisChecked.set(ip, Date.now());
      if (redisChecked.size > 50000) redisChecked.clear();
    } catch (err) {
      console.error('Intrusion block lookup error:', err.message);
    }
  }
  next();
}

function getBlockedIntruders() {
  return [...blocked.entries()]
    .filter(([ip]) => isBlocked(ip))
    .map(([ip, e]) => ({ ip, reason: e.reason, until: new Date(e.until).toISOString() }));
}

module.exports = { WARNING, flagIntrusion, rejectIntrusion, blockIntruders, getBlockedIntruders, isBlocked };
