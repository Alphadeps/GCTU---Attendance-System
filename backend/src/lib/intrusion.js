const crypto = require('crypto');
const { logSecurity } = require('./logger');

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

const strikes = new Map(); // ip -> { count, firstSeen }
const blocked = new Map(); // ip -> { until, reason }

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

/**
 * Record an attack signal (forged token, injection payload, probing another person's data…).
 * Returns a reference id the attacker sees and admins can find in the security log.
 */
function flagIntrusion(req, reason, details = {}) {
  const ip = clientIp(req);
  const reference = crypto.randomBytes(6).toString('hex');
  const now = Date.now();

  const s = strikes.get(ip);
  const current = s && now - s.firstSeen < STRIKE_WINDOW_MS ? { ...s, count: s.count + 1 } : { count: 1, firstSeen: now };
  strikes.set(ip, current);
  if (current.count >= STRIKES_TO_BLOCK) {
    blocked.set(ip, { until: now + BLOCK_MS, reason });
    strikes.delete(ip);
  }

  logSecurity('INTRUSION_ATTEMPT', {
    reference,
    reason,
    ip,
    method: req.method,
    path: req.originalUrl,
    userAgent: req.get?.('user-agent'),
    strikes: current.count,
    blocked: isBlocked(ip),
    ...details
  });
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
function blockIntruders(req, res, next) {
  const ip = clientIp(req);
  if (isBlocked(ip)) {
    return sendWarning(res, 403, `blocked-${blocked.get(ip).until}`);
  }
  next();
}

function getBlockedIntruders() {
  return [...blocked.entries()]
    .filter(([ip]) => isBlocked(ip))
    .map(([ip, e]) => ({ ip, reason: e.reason, until: new Date(e.until).toISOString() }));
}

module.exports = { WARNING, flagIntrusion, rejectIntrusion, blockIntruders, getBlockedIntruders, isBlocked };
