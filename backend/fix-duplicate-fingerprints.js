/**
 * Fix Duplicate Device Fingerprints
 *
 * Run this script to clear deviceFingerprint values that are shared by more
 * than one student record.  These duplicates cause the "Security Block: This
 * device is registered to another student" error at check-in time.
 *
 * Affected students will be prompted to re-register their device on their next
 * successful check-in — this is safe and expected behaviour.
 *
 * Usage:
 *   node fix-duplicate-fingerprints.js          # dry-run (no writes)
 *   node fix-duplicate-fingerprints.js --fix    # apply the fix
 */

const fs = require('fs');
const path = require('path');

// Use DIRECT_URL when available (bypasses connection pooler for write ops)
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    if (line.startsWith('DIRECT_URL=')) {
      const url = line.substring('DIRECT_URL='.length).trim().replace(/^["']|["']$/g, '');
      process.env.DATABASE_URL = url;
      console.log('Using DIRECT_URL for database connection\n');
      break;
    }
  }
}

const prisma = require('./src/lib/prisma');

const DRY_RUN = !process.argv.includes('--fix');

async function main() {
  console.log('='.repeat(60));
  console.log('Device Fingerprint Duplicate Checker');
  console.log(DRY_RUN ? '  MODE: Dry run (pass --fix to apply changes)' : '  MODE: APPLYING FIX');
  console.log('='.repeat(60) + '\n');

  // Find all fingerprints shared by more than one student
  const rows = await prisma.$queryRaw`
    SELECT "deviceFingerprint", COUNT(*) AS cnt, ARRAY_AGG("indexNumber") AS students
    FROM "Student"
    WHERE "deviceFingerprint" IS NOT NULL
    GROUP BY "deviceFingerprint"
    HAVING COUNT(*) > 1
  `;

  if (rows.length === 0) {
    console.log('No duplicate device fingerprints found. Database is clean.\n');
    return;
  }

  console.log(`Found ${rows.length} duplicate fingerprint(s):\n`);
  for (const row of rows) {
    console.log(`  Fingerprint: ${row.deviceFingerprint.substring(0, 20)}...`);
    console.log(`  Shared by ${row.cnt} students: ${row.students.join(', ')}\n`);
  }

  if (DRY_RUN) {
    console.log('Dry run complete. Run with --fix to clear these duplicates.\n');
    return;
  }

  // Null out all duplicates
  const duplicateFingerprints = rows.map(r => r.deviceFingerprint);

  const result = await prisma.student.updateMany({
    where: { deviceFingerprint: { in: duplicateFingerprints } },
    data: { deviceFingerprint: null }
  });

  console.log(`Fixed: cleared deviceFingerprint for ${result.count} student record(s).`);
  console.log('Affected students will re-register their device on next check-in.\n');
}

main()
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
