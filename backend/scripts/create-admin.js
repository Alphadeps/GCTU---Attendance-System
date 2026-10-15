/**
 * Create an admin account directly in the database.
 *
 * Usage (from the backend folder, with DATABASE_URL set):
 *   npm run create-admin -- <username> <password> [SUPERADMIN|ADMIN]
 *
 * Never overwrites an existing user. Role defaults to SUPERADMIN.
 */
require('dotenv').config();
const { createAdminIfMissing, ensureSystemSettings } = require('../src/lib/bootstrapAdmin');

async function main() {
  const [username, password, role = 'SUPERADMIN'] = process.argv.slice(2);
  if (!username || !password) {
    console.error('Usage: npm run create-admin -- <username> <password> [SUPERADMIN|ADMIN]');
    process.exit(1);
  }

  await ensureSystemSettings();
  const result = await createAdminIfMissing({ username, password, role: role.toUpperCase() });
  if (result === 'created') {
    console.log(`✅ Created ${role.toUpperCase()} "${username}"`);
  } else {
    console.log(`⏭️  User "${username}" already exists — nothing changed`);
  }
}

// Exit explicitly: the shared pg pool in src/lib/prisma.js keeps the process alive otherwise.
main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('❌', err.message);
    process.exit(1);
  });
