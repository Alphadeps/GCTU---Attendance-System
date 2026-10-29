const crypto = require('crypto');
const { logSecurity } = require('../lib/logger');

/**
 * Cloudflare Turnstile bot check for the doors bots attack: sign-in, sign-up, join class and
 * first-time password. Off until TURNSTILE_SECRET_KEY is set (so nothing breaks before the
 * keys exist); then every request must carry a fresh token from the widget on the page.
 *
 * Each form renders the widget with its own `action`; the server only accepts a token issued
 * for that same action, so a token solved on one page can't be replayed against another.
 * Set TURNSTILE_ALLOWED_HOSTNAMES (comma-separated) to also require the token to come from
 * your own site.
 */
const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

async function verifyToken(token, ip) {
  const body = new URLSearchParams({
    secret: process.env.TURNSTILE_SECRET_KEY,
    response: token,
    // Lets Cloudflare recognise a retry of the same check instead of treating it as a reuse
    idempotency_key: crypto.randomUUID()
  });
  if (ip) body.append('remoteip', ip);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const r = await fetch(VERIFY_URL, { method: 'POST', body, signal: controller.signal });
    return await r.json();
  } finally {
    clearTimeout(timer);
  }
}

function allowedHostnames() {
  return (process.env.TURNSTILE_ALLOWED_HOSTNAMES || '')
    .split(',')
    .map(h => h.trim().toLowerCase())
    .filter(Boolean);
}

const requireHuman = (expectedAction) => async (req, res, next) => {
  if (!process.env.TURNSTILE_SECRET_KEY || req.method === 'OPTIONS') return next();

  const token = req.body?.captchaToken || req.get('cf-turnstile-response');
  if (req.body) delete req.body.captchaToken;
  if (!token || typeof token !== 'string' || token.length > 2048) {
    return res.status(400).json({ error: 'Please complete the security check and try again.', code: 'CAPTCHA_REQUIRED' });
  }

  let result;
  try {
    result = await verifyToken(token, req.ip);
  } catch (err) {
    // Cloudflare unreachable: let people in rather than lock the whole school out; the rate
    // limits still apply. Logged so it can be noticed.
    logSecurity('CAPTCHA_UNAVAILABLE', { ip: req.ip, path: req.originalUrl, error: err.message });
    return next();
  }

  const fail = (reason) => {
    logSecurity('CAPTCHA_FAILED', {
      ip: req.ip, path: req.originalUrl, reason,
      codes: result['error-codes'], action: result.action, hostname: result.hostname
    });
    return res.status(400).json({ error: 'The security check failed. Please try again.', code: 'CAPTCHA_FAILED' });
  };

  if (!result.success) return fail('rejected');
  if (expectedAction && result.action !== expectedAction) return fail('wrong-action');
  const hosts = allowedHostnames();
  if (hosts.length && !hosts.includes(String(result.hostname || '').toLowerCase())) return fail('wrong-hostname');
  return next();
};

// The action names each form uses (kept in sync with the frontend)
const TURNSTILE_ACTIONS = {
  staffLogin: 'staff_login',
  studentLogin: 'student_login',
  repSignup: 'rep_signup',
  joinClass: 'join_class',
  setPassword: 'set_password',
  resetPassword: 'reset_password'
};

module.exports = { requireHuman, TURNSTILE_ACTIONS };
