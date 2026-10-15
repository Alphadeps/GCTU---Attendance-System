const jwt = require('jsonwebtoken');
const prisma = require('../lib/prisma');

const crypto = require('crypto');
const { flagIntrusion, rejectIntrusion } = require('../lib/intrusion');

// The key that signs every login. With the old hard-coded fallback anyone could forge an admin
// login, so a missing or weak secret is never used: in production a random one is generated
// (everyone signs in again after a restart) until a proper JWT_SECRET is set.
const WEAK_SECRETS = ['attendance-secret-key', 'secret', 'changeme', 'your-secret-key', 'jwt-secret'];
function resolveJwtSecret() {
  const configured = process.env.JWT_SECRET;
  if (configured && configured.length >= 32 && !WEAK_SECRETS.includes(configured)) return configured;
  // Only local development and tests may run with a known key
  if (['development', 'test'].includes(process.env.NODE_ENV)) {
    return configured || 'dev-only-attendance-secret-change-me';
  }
  console.error('SECURITY: JWT_SECRET is missing or weak (needs 32+ random characters). Using a random secret for this run; set JWT_SECRET in the environment.');
  return crypto.randomBytes(48).toString('hex');
}
const JWT_SECRET = resolveJwtSecret();

const PASSWORD_CHANGE_ALLOWED = ['/api/auth/change-password', '/api/auth/logout'];

// Protect middleware to verify JWT
const protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Not authorized, no token provided' });
    }

    const token = authHeader.split(' ')[1];
    
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      // Provide more specific error messages for token issues
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ 
          error: 'Token expired',
          code: 'TOKEN_EXPIRED',
          expiredAt: err.expiredAt
        });
      } else if (err.name === 'JsonWebTokenError') {
        // A token with a bad signature was made or edited by hand
        if (/signature|algorithm/i.test(err.message)) {
          return rejectIntrusion(req, res, 'FORGED_TOKEN', { status: 401, details: { jwtError: err.message } });
        }
        return res.status(401).json({ 
          error: 'Invalid token',
          code: 'INVALID_TOKEN'
        });
      }
      return res.status(401).json({ error: 'Not authorized, invalid token' });
    }

    // Fetch user from DB
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { id: true, username: true, role: true, isActive: true, mustChangePassword: true }
    });

    if (!user) {
      return res.status(401).json({ error: 'User not found or token invalid' });
    }

    if (!user.isActive) {
      return res.status(403).json({ error: 'Account deactivated' });
    }

    // Until a temporary password is replaced, only allow changing it (or logging out)
    if (user.mustChangePassword && !PASSWORD_CHANGE_ALLOWED.some(p => req.originalUrl.startsWith(p))) {
      return res.status(403).json({
        error: 'You must change your password before continuing.',
        code: 'PASSWORD_CHANGE_REQUIRED'
      });
    }

    req.user = user;
    next();
  } catch (err) {
    console.error('Auth protect middleware error:', err);
    return res.status(401).json({ error: 'Not authorized, invalid token' });
  }
};

/**
 * Student routes: require a student login token. The student's identity comes from the token,
 * never from what the request body or URL claims.
 */
const protectStudent = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Please sign in to continue', code: 'STUDENT_LOGIN_REQUIRED' });
    }
    let decoded;
    try {
      decoded = jwt.verify(authHeader.split(' ')[1], JWT_SECRET);
    } catch (err) {
      if (err.name === 'JsonWebTokenError' && /signature|algorithm/i.test(err.message)) {
        return rejectIntrusion(req, res, 'FORGED_TOKEN', { status: 401, details: { jwtError: err.message } });
      }
      return res.status(401).json({ error: 'Your sign-in has expired. Please sign in again.', code: 'TOKEN_EXPIRED' });
    }
    if (decoded.role !== 'STUDENT') {
      return res.status(403).json({ error: 'This action is for students only' });
    }
    const student = await prisma.student.findUnique({
      where: { id: decoded.id },
      select: { id: true, indexNumber: true, name: true, email: true }
    });
    if (!student) {
      return res.status(401).json({ error: 'Please sign in again', code: 'STUDENT_LOGIN_REQUIRED' });
    }
    req.student = student;
    next();
  } catch (err) {
    console.error('Student auth error:', err);
    return res.status(401).json({ error: 'Not authorized' });
  }
};

/**
 * Either a staff login or a student login. Sets req.user or req.student.
 */
const protectAny = (req, res, next) => {
  const authHeader = req.headers.authorization || '';
  let role;
  try {
    role = jwt.decode(authHeader.split(' ')[1] || '')?.role;
  } catch {
    role = undefined;
  }
  return role === 'STUDENT' ? protectStudent(req, res, next) : protect(req, res, next);
};

/**
 * A student may only read their own records; staff may read anyone's.
 * Asking for another student's records with a student login is flagged as probing.
 */
const ownStudentRecordOr = (param) => (req, res, next) => {
  if (req.user) return next();
  const requested = String(req.params[param] || '').trim().toLowerCase();
  if (req.student && requested === req.student.indexNumber.toLowerCase()) return next();
  return rejectIntrusion(req, res, 'OTHER_STUDENT_RECORD', { details: { requested: req.params[param], student: req.student?.indexNumber } });
};

// Authorize roles middleware
const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authorized' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: `Forbidden: Role '${req.user.role}' is not authorized to access this resource` });
    }
    next();
  };
};

module.exports = {
  protect,
  protectStudent,
  protectAny,
  ownStudentRecordOr,
  authorizeRoles,
  JWT_SECRET,
  flagIntrusion
};
