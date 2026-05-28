/**
 * Emergency Production Database Fix
 * Adds missing submittedToDeptAt column to OfficialReport table
 * 
 * Usage: node fix-production-db.js
 */

require('dotenv').config();
const prisma = require('./src/lib/prisma');

if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL not found in environment variables');
  console.error('Make sure you have a .env file with DATABASE_URL set');
  process.exit(1);
}

async function fixDatabase() {
  console.log('🔧 Starting database fix...\n');

  try {
    // Step 1: Add the missing column
    console.log('Step 1: Adding submittedToDeptAt column...');
    await prisma.$executeRaw`
      ALTER TABLE "OfficialReport" 
      ADD COLUMN IF NOT EXISTS "submittedToDeptAt" TIMESTAMP(3)
    `;
    console.log('✅ Column added successfully\n');

    // Step 2: Update existing SIGNED reports
    console.log('Step 2: Updating existing SIGNED reports...');
    const result = await prisma.$executeRaw`
      UPDATE "OfficialReport" 
      SET 
        status = 'APPROVED',
        "submittedToDeptAt" = "signedAt"
      WHERE status = 'SIGNED' AND "signedAt" IS NOT NULL
    `;
    console.log(`✅ Updated ${result} reports\n`);

    console.log('\n🎉 Database fix completed successfully!');
    console.log('⚠️  You need to regenerate Prisma client and restart your app:');
    console.log('   1. Run: npx prisma generate');
    console.log('   2. Restart your Render service');
    console.log('   3. Test: /api/reports/pending endpoint\n');

  } catch (error) {
    console.error('❌ Error fixing database:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

fixDatabase();
