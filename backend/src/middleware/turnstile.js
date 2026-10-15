const { logSecurity } = require('../lib/logger');

/**
 * Cloudflare Turnstile bot check for the doors bots attack: sign-in, sign-up, join class and
 * first-time password. Off until TURNSTILE_SECRET_KEY is set (so nothing breaks before the
 * keys exist); then every request must carry a fresh token from the widget on the page.
 */
const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

async function verifyToken(token, ip) {
  const body = new URLSearchParams({ secret: process.env.TURNSTILE_SECRET_KEY, response: token });
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

const requireHuman = async (req, res, next) => {
  if (!process.env.TURNSTILE_SECRET_KEY || req.method === 'OPTIONS') return next();

  const token = req.body?.captchaToken || req.get('cf-turnstile-response');
  if (req.body) delete req.body.captchaToken;
  if (!token || typeof token !== 'string' || token.length > 2048) {
    return res.status(400).json({ error: 'Please complete the security check and try again.', code: 'CAPTCHA_REQUIRED' });
  }

  try {
    const result = await verifyToken(token, req.ip);
    if (result.success) return next();
    logSecurity('CAPTCHA_FAILED', { ip: req.ip, path: req.originalUrl, codes: result['error-codes'] });
    return res.status(400).json({ error: 'The security check failed. Please try again.', code: 'CAPTCHA_FAILED' });
  } catch (err) {
    // Cloudflare unreachable: let people in rather than lock the whole school out; the rate
    // limits still apply. Logged so it can be noticed.
    logSecurity('CAPTCHA_UNAVAILABLE', { ip: req.ip, path: req.originalUrl, error: err.message });
    return next();
  }
};

module.exports = { requireHuman };
