const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { z } = require('zod');
const prisma = require('../lib/prisma');
const { cache, cacheKeys } = require('../lib/redis');
const { logAudit } = require('../lib/logger');

// No 0/O/1/I/L so codes are easy to read out and type on a phone
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 6;

function randomCode() {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_ALPHABET[crypto.randomInt(CODE_ALPHABET.length)];
  }
  return code;
}

function normalizeCode(code) {
  return String(code || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

async function invalidateClassCache(classId) {
  await cache.del(cacheKeys.classStudents(classId));
  await cache.del(cacheKeys.class(classId));
  await cache.del(cacheKeys.classes());
}

// Give the class a fresh unique join code (retries on the rare collision)
async function assignNewJoinCode(classId) {
  for (let attempt = 0; attempt < 10; attempt++) {
    try {
      const updated = await prisma.class.update({
        where: { id: classId },
        data: { joinCode: randomCode() },
        select: { joinCode: true }
      });
      return updated.joinCode;
    } catch (err) {
      if (err.code !== 'P2002') throw err; // unique violation → try another code
    }
  }
  throw new Error('Could not generate a unique join code');
}

/**
 * Middleware: resolve the rep's own class and expose it as req.params.id, so the existing
 * admin class handlers (add/remove students) can be reused safely scoped to that class.
 */
const repClassScope = async (req, res, next) => {
  try {
    const repClass = await prisma.class.findFirst({ where: { repId: req.user.id }, select: { id: true } });
    if (!repClass) {
      return res.status(404).json({ error: 'You are not assigned to any class' });
    }
    req.params.id = repClass.id;
    req.repClassId = repClass.id;
    next();
  } catch (err) {
    console.error('Rep class scope error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// REP: get (creating on first use) the class join code
const getJoinCode = async (req, res) => {
  try {
    const repClass = await prisma.class.findUnique({
      where: { id: req.repClassId },
      select: { id: true, joinCode: true, displayName: true }
    });
    const joinCode = repClass.joinCode || await assignNewJoinCode(repClass.id);
    res.json({ joinCode, className: repClass.displayName });
  } catch (err) {
    console.error('Get join code error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// REP: replace the join code (old code stops working immediately)
const regenerateJoinCode = async (req, res) => {
  try {
    const joinCode = await assignNewJoinCode(req.repClassId);
    logAudit('CLASS_JOIN_CODE_REGENERATED', { user: req.user.username, userId: req.user.id, classId: req.repClassId });
    res.json({ joinCode });
  } catch (err) {
    console.error('Regenerate join code error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// PUBLIC: look up which class a join code belongs to (shown before the student registers)
const lookupJoinCode = async (req, res) => {
  try {
    const code = normalizeCode(req.params.code);
    if (code.length !== CODE_LENGTH) {
      return res.status(404).json({ error: 'Invalid join code' });
    }
    const cls = await prisma.class.findUnique({
      where: { joinCode: code },
      select: { displayName: true }
    });
    if (!cls) {
      return res.status(404).json({ error: 'Invalid join code. Ask your class rep for the current code.' });
    }
    res.json({ className: cls.displayName });
  } catch (err) {
    console.error('Lookup join code error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const joinSchema = z.object({
  code: z.string().min(1, 'Join code is required'),
  indexNumber: z.string().trim().regex(/^[A-Za-z0-9/-]{5,15}$/, 'Enter a valid index number (5–15 characters)'),
  name: z.string().trim().min(2, 'Enter your full name').max(100, 'Name is too long'),
  email: z.string().trim().toLowerCase().email('Enter a valid email address').max(254),
  password: z.string().min(6, 'Password must be at least 6 characters long').max(100)
});

/**
 * PUBLIC: a student joins a class with the rep's code.
 * - New index number → creates the student with the given password and adds them to the class.
 * - Index number already uploaded by the rep but never logged in → sets the password and adds them.
 * - Index number with an existing password → must enter that password; never changes their details.
 */
const joinClass = async (req, res) => {
  try {
    const validation = joinSchema.safeParse(req.body);
    if (!validation.success) {
      const errorMsg = validation.error.issues.map(err => err.message).join(', ');
      return res.status(400).json({ error: errorMsg });
    }
    const { indexNumber, name, email, password } = validation.data;
    const code = normalizeCode(validation.data.code);

    const cls = await prisma.class.findUnique({
      where: { joinCode: code },
      select: { id: true, displayName: true }
    });
    if (!cls) {
      return res.status(404).json({ error: 'Invalid join code. Ask your class rep for the current code.' });
    }

    let student = await prisma.student.findUnique({ where: { indexNumber } });

    if (student && student.password && !student.isFirstLogin) {
      const ok = await bcrypt.compare(password, student.password);
      if (!ok) {
        return res.status(401).json({ error: 'This index number already has an account. Enter your existing password to join.' });
      }
    } else {
      const emailOwner = await prisma.student.findUnique({ where: { email }, select: { indexNumber: true } });
      if (emailOwner && emailOwner.indexNumber !== indexNumber) {
        return res.status(409).json({ error: 'That email is already used by another student.' });
      }
      const hashed = await bcrypt.hash(password, 10);
      student = student
        ? await prisma.student.update({
            where: { id: student.id },
            data: { name, email, password: hashed, isFirstLogin: false }
          })
        : await prisma.student.create({
            data: { indexNumber, name, email, password: hashed, isFirstLogin: false }
          });
    }

    const linkKey = { classId_studentId: { classId: cls.id, studentId: student.id } };
    const alreadyMember = !!(await prisma.classStudent.findUnique({ where: linkKey, select: { id: true } }));
    if (!alreadyMember) {
      await prisma.classStudent.upsert({
        where: linkKey,
        update: {},
        create: { classId: cls.id, studentId: student.id }
      });
      await invalidateClassCache(cls.id);
    }
    logAudit('STUDENT_JOINED_CLASS', { indexNumber, classId: cls.id, ip: req.ip });

    res.status(alreadyMember ? 200 : 201).json({
      message: alreadyMember
        ? `You are already in ${cls.displayName}. You can log in now.`
        : `You have joined ${cls.displayName}. You can log in now.`,
      className: cls.displayName
    });
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'That index number or email is already registered.' });
    }
    console.error('Join class error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  repClassScope,
  getJoinCode,
  regenerateJoinCode,
  lookupJoinCode,
  joinClass,
  normalizeCode
};
