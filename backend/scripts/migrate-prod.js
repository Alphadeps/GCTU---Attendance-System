/**
 * Production migration script with baseline support.
 *
 * Problem: The production database was created outside of Prisma migrations,
 * so there is no _prisma_migrations table. Running `prisma migrate deploy`
 * fails with P3005 ("database schema is not empty").
 *
 * Solution:
 * 1. Create the _prisma_migrations table if it doesn't exist.
 * 2. Insert the already-applied migrations as baseline records (rolled_back_at = NULL,
 *    finished_at = NOW()) so Prisma knows they are done.
 * 3. Run `prisma migrate deploy` — it will skip the baselined migrations and only
 *    apply any new ones (e.g. manualCode).
 */

const { execSync } = require('child_process');
const { Client } = require('pg');

const BASELINE_MIGRATIONS = [
  '20260519140836_init',
  '20260522212135_init',
];

async function run() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    console.error('❌ DATABASE_URL is not set');
    process.exit(1);
  }

  // Prisma Accelerate URLs (prisma://...) can't be used with pg directly.
  // Fall back to DIRECT_URL for the baseline step.
  const directUrl = process.env.DIRECT_URL || connectionString;

  // Strip the prisma:// protocol if present — we need a raw postgres URL
  const pgUrl = directUrl.startsWith('prisma://')
    ? directUrl.replace('prisma://', 'postgresql://')
    : directUrl;

  const client = new Client({ connectionString: pgUrl });

  try {
    await client.connect();
    console.log('✅ Connected to database for baseline check');

    // 1. Create _prisma_migrations table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
        "id"                    VARCHAR(36)  NOT NULL PRIMARY KEY,
        "checksum"              VARCHAR(64)  NOT NULL,
        "finished_at"           TIMESTAMPTZ,
        "migration_name"        VARCHAR(255) NOT NULL,
        "logs"                  TEXT,
        "rolled_back_at"        TIMESTAMPTZ,
        "started_at"            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "applied_steps_count"   INTEGER      NOT NULL DEFAULT 0
      );
    `);
    console.log('✅ _prisma_migrations table ready');

    // 2. Insert baseline records for migrations already applied manually
    for (const migrationName of BASELINE_MIGRATIONS) {
      const existing = await client.query(
        `SELECT id FROM "_prisma_migrations" WHERE migration_name = $1`,
        [migrationName]
      );

      if (existing.rows.length === 0) {
        await client.query(
          `INSERT INTO "_prisma_migrations"
             (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
           VALUES
             (gen_random_uuid()::text, 'baselined', NOW(), $1, NULL, NULL, NOW(), 1)`,
          [migrationName]
        );
        console.log(`✅ Baselined migration: ${migrationName}`);
      } else {
        console.log(`⏭️  Already recorded: ${migrationName}`);
      }
    }

    await client.end();
  } catch (err) {
    console.error('❌ Baseline step failed:', err.message);
    await client.end().catch(() => {});
    process.exit(1);
  }

  // 3. Now run prisma migrate deploy — only new migrations will be applied
  console.log('\n🚀 Running prisma migrate deploy...');
  try {
    execSync('npx prisma migrate deploy', { stdio: 'inherit' });
    console.log('✅ Migrations applied successfully');
  } catch (err) {
    console.error('❌ prisma migrate deploy failed');
    process.exit(1);
  }
}

run();
