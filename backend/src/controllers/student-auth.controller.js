const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { z } = require('zod');
const prisma = require('../lib/prisma');
const { JWT_SECRET } = require('../middleware/auth');
const { logAuthEvent } = require('../lib/logger');
const { rejectIntrusion } = require('../lib/intrusion');

// Validation schemas
const studentLoginSchema = z.object({
  indexNumber: z.string().min(1, 'Index number is required'),
  password: z.string().min(1, 'Password is required')
});

const studentSetPasswordSchema = z.object({
  indexNumber: z.string().trim().min(1, 'Index number is required'),
  code: z.string().trim().min(1, 'Enter your class join code (ask your class rep)'),
  password: z.string().min(6, 'Password must be at least 6 characters long'),
  confirmPassword: z.string().min(1, 'Please confirm your password')
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"]
});

const issueResetCodeSchema = z.object({
  indexNumber: z.string().trim().min(1, 'Student index number is required')
});

const resetWithCodeSchema = z.object({
  indexNumber: z.string().trim().min(1, 'Index number is required'),
  resetCode: z.string().trim().regex(/^\d{6}$/, 'Enter the 6-digit reset code from your class rep'),
  password: z.string().min(6, 'Password must be at least 6 characters long'),
  confirmPassword: z.string().min(1, 'Please confirm your password')
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword']
});

const RESET_CODE_MINUTES = 30;
const RESET_CODE_MAX_TRIES = 5;

/**
 * Student Login
 */
const studentLogin = async (req, res) => {
  try {
    const validation = studentLoginSchema.safeParse(req.body);
    if (!validation.success) {
      const errorMsg = validation.error.issues.map(err => err.message).join(', ');
      return res.status(400).json({ error: errorMsg });
    }

    const { indexNumber, password } = validation.data;

    const student = await prisma.student.findUnique({
      where: { indexNumber },
      include: {
        classes: {
          include: {
            class: {
              include: {
                programme: true
              }
            }
          }
        }
      }
    });

    if (!student) {
      // Log failed student login
      logAuthEvent('STUDENT_LOGIN_FAILED', {
        indexNumber,
        ip: req.ip,
        reason: 'Student not found',
        userAgent: req.headers['user-agent']
      });
      return res.status(401).json({ error: 'Invalid index number or password' });
    }

    // Check if first login (no password set yet)
    if (!student.password || student.isFirstLogin) {
      return res.status(403).json({ 
        error: 'First time login detected. Please set your password first.',
        requiresPasswordSetup: true
      });
    }

    const isMatch = await bcrypt.compare(password, student.password);
    if (!isMatch) {
      // Log failed student login
      logAuthEvent('STUDENT_LOGIN_FAILED', {
        indexNumber,
        studentId: student.id,
        studentName: student.name,
        ip: req.ip,
        reason: 'Invalid password',
        userAgent: req.headers['user-agent']
      });
      return res.status(401).json({ error: 'Invalid index number or password' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { 
        id: student.id, 
        indexNumber: student.indexNumber, 
        role: 'STUDENT',
        name: student.name
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Log successful student login
    logAuthEvent('STUDENT_LOGIN_SUCCESS', {
      indexNumber: student.indexNumber,
      studentId: student.id,
      studentName: student.name,
      ip: req.ip,
      userAgent: req.headers['user-agent']
    });

    res.json({
      token,
      student: {
        id: student.id,
        indexNumber: student.indexNumber,
        name: student.name,
        email: student.email,
        classes: student.classes.map(cs => ({
          id: cs.class.id,
          displayName: cs.class.displayName,
          programme: cs.class.programme.name
        }))
      }
    });
  } catch (err) {
    console.error('Student login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Student First-Time Password Setup
 */
const studentSetPassword = async (req, res) => {
  try {
    const validation = studentSetPasswordSchema.safeParse(req.body);
    if (!validation.success) {
      const errorMsg = validation.error.issues.map(err => err.message).join(', ');
      return res.status(400).json({ error: errorMsg });
    }

    const { indexNumber, code, password } = validation.data;

    const student = await prisma.student.findUnique({
      where: { indexNumber },
      select: { id: true, password: true, classes: { select: { class: { select: { joinCode: true } } } } }
    });

    // Same answer whether the student exists or not, so index numbers can't be probed
    const refuse = () => res.status(400).json({ error: 'Index number or class join code is not correct.' });
    if (!student) return refuse();

    // A password can only be set once here. Changing an existing one is an account takeover attempt.
    if (student.password) {
      return rejectIntrusion(req, res, 'PASSWORD_TAKEOVER', { details: { indexNumber } });
    }

    // Prove you belong to the class: the join code your rep shared
    const normalized = code.toUpperCase().replace(/[^A-Z0-9]/g, '');
    const inClass = student.classes.some(cs => cs.class.joinCode && cs.class.joinCode === normalized);
    if (!inClass) return refuse();

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Update student with password
    await prisma.student.update({
      where: { indexNumber },
      data: {
        password: hashedPassword,
        isFirstLogin: false
      }
    });
    logAuthEvent('STUDENT_PASSWORD_SET', { indexNumber, ip: req.ip });

    res.json({ message: 'Password set successfully. You can now login.' });
  } catch (err) {
    console.error('Student set password error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Forgot password, step 1: a rep (for their own class) or an admin gets a one-time 6-digit
 * code for the student. The rep never learns the new password; the student picks it.
 */
const issueResetCode = async (req, res) => {
  try {
    const validation = issueResetCodeSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: validation.error.issues.map(e => e.message).join(', ') });
    }
    const { indexNumber } = validation.data;

    const student = await prisma.student.findUnique({
      where: { indexNumber },
      select: { id: true, name: true, classes: { select: { class: { select: { repId: true } } } } }
    });
    if (!student) return res.status(404).json({ error: 'No student with that index number' });

    if (req.user.role === 'REP' && !student.classes.some(cs => cs.class.repId === req.user.id)) {
      return res.status(403).json({ error: 'You can only reset passwords for students in your class' });
    }

    const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
    const expiresAt = new Date(Date.now() + RESET_CODE_MINUTES * 60 * 1000);
    await prisma.student.update({
      where: { id: student.id },
      data: { resetCodeHash: await bcrypt.hash(code, 10), resetCodeExpires: expiresAt, resetCodeTries: 0 }
    });
    logAuthEvent('STUDENT_RESET_CODE_ISSUED', { indexNumber, byUserId: req.user.id, byRole: req.user.role, ip: req.ip });

    res.json({ code, expiresAt, minutes: RESET_CODE_MINUTES, name: student.name, indexNumber });
  } catch (err) {
    console.error('Issue reset code error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Forgot password, step 2: the student enters the code and chooses a new password.
 */
const resetWithCode = async (req, res) => {
  try {
    const validation = resetWithCodeSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: validation.error.issues.map(e => e.message).join(', ') });
    }
    const { indexNumber, resetCode, password } = validation.data;

    const student = await prisma.student.findUnique({
      where: { indexNumber },
      select: { id: true, resetCodeHash: true, resetCodeExpires: true, resetCodeTries: true }
    });

    // Same answer for an unknown index, no code, a used code or a wrong code
    const refuse = (message = 'That reset code is not correct. Check it, or ask your class rep for a new one.') =>
      res.status(400).json({ error: message });
    if (!student || !student.resetCodeHash) return refuse();

    if (!student.resetCodeExpires || student.resetCodeExpires < new Date()) {
      await prisma.student.update({ where: { id: student.id }, data: { resetCodeHash: null, resetCodeExpires: null, resetCodeTries: 0 } });
      return refuse('That reset code has expired. Ask your class rep for a new one.');
    }

    if (!(await bcrypt.compare(resetCode, student.resetCodeHash))) {
      const tries = student.resetCodeTries + 1;
      const usedUp = tries >= RESET_CODE_MAX_TRIES;
      await prisma.student.update({
        where: { id: student.id },
        data: usedUp ? { resetCodeHash: null, resetCodeExpires: null, resetCodeTries: 0 } : { resetCodeTries: tries }
      });
      logAuthEvent('STUDENT_RESET_CODE_FAILED', { indexNumber, tries, ip: req.ip });
      return refuse(usedUp
        ? 'Too many wrong codes, so this code has been cancelled. Ask your class rep for a new one.'
        : undefined);
    }

    await prisma.student.update({
      where: { id: student.id },
      data: {
        password: await bcrypt.hash(password, 10),
        isFirstLogin: false,
        resetCodeHash: null,
        resetCodeExpires: null,
        resetCodeTries: 0
      }
    });
    await prisma.notification.create({
      data: {
        studentIndex: indexNumber,
        title: 'Password changed',
        message: 'Your password was reset with a code from your class rep. If this was not you, tell your rep straight away.',
        type: 'INFO'
      }
    });
    logAuthEvent('STUDENT_PASSWORD_RESET', { indexNumber, ip: req.ip });

    res.json({ message: 'Password changed. You can now sign in with your new password.' });
  } catch (err) {
    console.error('Reset with code error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  studentLogin,
  studentSetPassword,
  issueResetCode,
  resetWithCode
};
