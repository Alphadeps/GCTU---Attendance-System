const bcrypt = require('bcryptjs');
const { z } = require('zod');
const prisma = require('../lib/prisma');
const { cache, cacheKeys } = require('../lib/redis');
const { logAudit } = require('../lib/logger');
const { createNotificationHelper } = require('./notification.controller');

const LEVELS = ['100', '200', '300', '400'];
const TYPES = ['REGULAR', 'TOP-UP'];
const GROUPS = 'ABCDEFGHIJK'.split('');
const SESSIONS = ['MORNING', 'EVENING', 'WEEKEND'];
const COMMON_PASSWORDS = ['rep123', 'admin123', 'password123', 'password', '12345678'];

async function invalidateRepAndClassCaches(classId) {
  await cache.del(cacheKeys.reps());
  await cache.del(cacheKeys.classes());
  if (classId) await cache.del(cacheKeys.class(classId));
}

// PUBLIC: programme list for the sign-up form (names only)
const listProgrammesPublic = async (req, res) => {
  try {
    const programmes = await prisma.programme.findMany({
      select: { id: true, name: true },
      orderBy: { name: 'asc' }
    });
    res.json(programmes);
  } catch (err) {
    console.error('List programmes error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const signupSchema = z.object({
  fullName: z.string().trim().min(3, 'Enter your full name').max(100, 'Name is too long'),
  indexNumber: z.string().trim().regex(/^[A-Za-z0-9/-]{5,20}$/, 'Enter a valid index number'),
  password: z.string().min(8, 'Password must be at least 8 characters long').max(100),
  programmeId: z.string().min(1, 'Choose your programme'),
  level: z.enum(LEVELS, { message: 'Choose your level' }),
  type: z.enum(TYPES, { message: 'Choose Regular or Top-Up' }),
  group: z.string().trim().toUpperCase().refine(g => GROUPS.includes(g), 'Choose your group (A–K)'),
  session: z.enum(SESSIONS, { message: 'Choose your session' })
});

/**
 * PUBLIC: a class rep creates their own account and their class.
 * The account stays pending (cannot log in) until a super admin approves it.
 * The rep's index number is their username.
 */
const repSignup = async (req, res) => {
  try {
    const validation = signupSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: validation.error.issues.map(i => i.message).join(', ') });
    }
    const { fullName, indexNumber, password, programmeId, level, type, group, session } = validation.data;

    if (COMMON_PASSWORDS.includes(password.toLowerCase())) {
      return res.status(400).json({ error: 'That password is too common. Choose another one.' });
    }

    const programme = await prisma.programme.findUnique({ where: { id: programmeId } });
    if (!programme) {
      return res.status(400).json({ error: 'Choose your programme from the list' });
    }

    const existingUser = await prisma.user.findFirst({
      where: { OR: [{ username: indexNumber }, { indexNumber }] },
      select: { id: true }
    });
    if (existingUser) {
      return res.status(409).json({ error: 'An account with this index number already exists. Sign in instead, or contact the administrator.' });
    }

    const classKey = { programmeId_level_type_group_session: { programmeId, level, type, group, session } };
    const displayName = `${programme.name} LEVEL ${level} ${type} GROUP ${group} (${session})`;
    const hashed = await bcrypt.hash(password, 10);

    const result = await prisma.$transaction(async (tx) => {
      const existingClass = await tx.class.findUnique({ where: classKey, select: { id: true, repId: true } });
      if (existingClass?.repId) {
        const err = new Error('CLASS_TAKEN');
        err.classTaken = true;
        throw err;
      }

      const user = await tx.user.create({
        data: {
          username: indexNumber,
          indexNumber,
          fullName,
          password: hashed,
          role: 'REP',
          isActive: true,
          pendingApproval: true
        }
      });

      const cls = existingClass
        ? await tx.class.update({ where: { id: existingClass.id }, data: { repId: user.id } })
        : await tx.class.create({
            data: { programmeId, level, type, group, session, displayName, repId: user.id, createdViaSignup: true }
          });

      return { user, cls };
    });

    await invalidateRepAndClassCaches(result.cls.id);
    logAudit('REP_SIGNUP', { indexNumber, fullName, classId: result.cls.id, className: result.cls.displayName, ip: req.ip });

    const superAdmins = await prisma.user.findMany({ where: { role: 'SUPERADMIN', isActive: true }, select: { id: true } });
    for (const admin of superAdmins) {
      await createNotificationHelper({
        userId: admin.id,
        title: 'New class rep waiting for approval',
        message: `${fullName} (${indexNumber}) signed up as rep for ${result.cls.displayName}. Approve or reject them under Class Reps.`,
        type: 'INFO'
      });
    }

    res.status(201).json({
      message: `Account created for ${result.cls.displayName}. The administrator must approve it before you can sign in.`,
      className: result.cls.displayName
    });
  } catch (err) {
    if (err.classTaken) {
      return res.status(409).json({ error: 'That class already has a rep. If that is wrong, contact the administrator.' });
    }
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'An account with this index number already exists, or that class was just taken. Try again.' });
    }
    console.error('Rep signup error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// SUPERADMIN: reps waiting for approval
const listPendingReps = async (req, res) => {
  try {
    const reps = await prisma.user.findMany({
      where: { role: 'REP', pendingApproval: true },
      select: {
        id: true,
        username: true,
        fullName: true,
        createdAt: true,
        assignedClass: { select: { id: true, displayName: true } }
      },
      orderBy: { createdAt: 'asc' }
    });
    res.json(reps);
  } catch (err) {
    console.error('List pending reps error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// SUPERADMIN: approve a self-signed-up rep
const approveRep = async (req, res) => {
  try {
    const rep = await prisma.user.findFirst({
      where: { id: req.params.id, role: 'REP', pendingApproval: true },
      include: { assignedClass: { select: { id: true, displayName: true } } }
    });
    if (!rep) return res.status(404).json({ error: 'No pending rep with that id' });

    await prisma.$transaction([
      prisma.user.update({ where: { id: rep.id }, data: { pendingApproval: false } }),
      ...(rep.assignedClass
        ? [prisma.class.update({ where: { id: rep.assignedClass.id }, data: { createdViaSignup: false } })]
        : [])
    ]);
    await invalidateRepAndClassCaches(rep.assignedClass?.id);
    logAudit('REP_APPROVED', { user: req.user.username, repId: rep.id, indexNumber: rep.username });

    res.json({ message: `${rep.fullName || rep.username} can now sign in as rep for ${rep.assignedClass?.displayName || 'their class'}.` });
  } catch (err) {
    console.error('Approve rep error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// SUPERADMIN: reject a self-signed-up rep — deletes the account and frees the class
const rejectRep = async (req, res) => {
  try {
    const rep = await prisma.user.findFirst({
      where: { id: req.params.id, role: 'REP', pendingApproval: true },
      include: { assignedClass: { include: { _count: { select: { students: true, sessions: true, courses: true } } } } }
    });
    if (!rep) return res.status(404).json({ error: 'No pending rep with that id' });

    const cls = rep.assignedClass;
    const classIsEmptySignupClass = cls && cls.createdViaSignup &&
      cls._count.students === 0 && cls._count.sessions === 0 && cls._count.courses === 0;

    await prisma.$transaction(async (tx) => {
      if (cls) {
        if (classIsEmptySignupClass) await tx.class.delete({ where: { id: cls.id } });
        else await tx.class.update({ where: { id: cls.id }, data: { repId: null } });
      }
      await tx.notification.deleteMany({ where: { userId: rep.id } });
      await tx.user.delete({ where: { id: rep.id } });
    });
    await invalidateRepAndClassCaches(cls?.id);
    logAudit('REP_REJECTED', { user: req.user.username, indexNumber: rep.username, classRemoved: !!classIsEmptySignupClass });

    res.json({ message: `Sign-up from ${rep.fullName || rep.username} rejected.` });
  } catch (err) {
    console.error('Reject rep error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = { listProgrammesPublic, repSignup, listPendingReps, approveRep, rejectRep, LEVELS, TYPES, GROUPS, SESSIONS };
