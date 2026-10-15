const bcrypt = require('bcryptjs');
const prisma = require('./prisma');

const ROLES = ['SUPERADMIN', 'ADMIN'];

/**
 * Create an admin account if no user with that username exists yet.
 * Never overwrites an existing user's password or role.
 * Returns 'created' | 'exists'.
 */
async function createAdminIfMissing({ username, password, role = 'SUPERADMIN' }) {
  username = String(username || '').trim();
  if (username.length < 3 || username.length > 20) {
    throw new Error('Admin username must be 3–20 characters');
  }
  if (!password || String(password).length < 8) {
    throw new Error('Admin password must be at least 8 characters');
  }
  if (!ROLES.includes(role)) {
    throw new Error(`Admin role must be one of: ${ROLES.join(', ')}`);
  }

  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) return 'exists';

  await prisma.user.create({
    data: {
      username,
      password: await bcrypt.hash(String(password), 10),
      role,
      isActive: true
    }
  });
  return 'created';
}

/** Ensure the single SystemSettings row exists (logo upload and settings pages expect it). */
async function ensureSystemSettings() {
  const settings = await prisma.systemSettings.findFirst();
  if (settings) return;
  await prisma.systemSettings.create({
    data: {
      deptName: 'Ghana Communication Technology University',
      deptLogoUrl: '/logo.jfif',
      lateWindowMinutes: 15,
      geofenceRadiusMeters: 100
    }
  });
  console.log('[Bootstrap] Created default system settings');
}

/**
 * Startup hook: create the super admin from SUPERADMIN_USERNAME / SUPERADMIN_PASSWORD
 * when set. Does not wipe or seed any other data.
 */
async function bootstrapAdminFromEnv() {
  await ensureSystemSettings();

  const username = process.env.SUPERADMIN_USERNAME;
  const password = process.env.SUPERADMIN_PASSWORD;

  if (!username || !password) {
    const userCount = await prisma.user.count();
    if (userCount === 0) {
      console.warn('[Bootstrap] No users exist and SUPERADMIN_USERNAME / SUPERADMIN_PASSWORD are not set — nobody can log in. Set them and restart.');
    }
    return;
  }

  const result = await createAdminIfMissing({ username, password, role: 'SUPERADMIN' });
  if (result === 'created') {
    console.log(`[Bootstrap] Created super admin "${username.trim()}"`);
  } else {
    console.log(`[Bootstrap] Super admin "${username.trim()}" already exists — left unchanged`);
  }
}

module.exports = { createAdminIfMissing, ensureSystemSettings, bootstrapAdminFromEnv };
