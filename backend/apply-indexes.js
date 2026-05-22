/**
 * Script to safely apply performance indexes to production database
 * Run with: node apply-indexes.js
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Read the SQL file
const sqlFilePath = path.join(__dirname, 'prisma', 'migrations', 'add_performance_indexes.sql');
const sql = fs.readFileSync(sqlFilePath, 'utf8');

// Get database URL from environment
require('dotenv').config();
const databaseUrl = process.env.DIRECT_URL;

if (!databaseUrl) {
  console.error('❌ ERROR: DIRECT_URL not found in .env file');
  process.exit(1);
}

console.log('🔧 Database Index Application Tool');
console.log('==================================\n');

async function applyIndexes() {
  const pool = new Pool({ connectionString: databaseUrl });
  
  try {
    console.log('📡 Connecting to database...');
    const client = await pool.connect();
    console.log('✅ Connected successfully!\n');

    console.log('📊 Applying performance indexes...');
    console.log('This may take 1-2 minutes depending on data size.\n');

    // Split SQL into individual statements
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      
      // Extract index name for better logging
      const indexMatch = statement.match(/CREATE INDEX IF NOT EXISTS "([^"]+)"/);
      const indexName = indexMatch ? indexMatch[1] : `Statement ${i + 1}`;
      
      try {
        await client.query(statement);
        
        if (statement.includes('CREATE INDEX')) {
          console.log(`  ✅ Created: ${indexName}`);
          successCount++;
        } else if (statement.includes('ANALYZE')) {
          console.log(`  📊 Analyzed: ${indexName.replace('ANALYZE ', '')}`);
          successCount++;
        }
      } catch (error) {
        if (error.message.includes('already exists')) {
          console.log(`  ⏭️  Skipped: ${indexName} (already exists)`);
          skipCount++;
        } else {
          console.log(`  ❌ Error: ${indexName}`);
          console.log(`     ${error.message}`);
          errorCount++;
        }
      }
    }

    console.log('\n==================================');
    console.log('📈 Summary:');
    console.log(`  ✅ Successfully applied: ${successCount}`);
    console.log(`  ⏭️  Skipped (existing): ${skipCount}`);
    console.log(`  ❌ Errors: ${errorCount}`);
    console.log('==================================\n');

    if (errorCount === 0) {
      console.log('🎉 All indexes applied successfully!');
      console.log('💡 Your database is now optimized for better performance.\n');
    } else {
      console.log('⚠️  Some indexes failed to apply. Check errors above.');
      console.log('💡 The system will still work, but may be slower.\n');
    }

    client.release();
  } catch (error) {
    console.error('\n❌ Fatal Error:', error.message);
    console.error('\nPlease check:');
    console.error('  1. Database connection string is correct');
    console.error('  2. Database is accessible');
    console.error('  3. You have permission to create indexes\n');
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run the script
console.log('⚠️  WARNING: This will modify your production database.');
console.log('📝 Action: Adding performance indexes (safe operation)');
console.log('💾 Data: No data will be modified or deleted');
console.log('⏱️  Time: This will take 1-2 minutes\n');

console.log('Starting in 3 seconds...\n');

setTimeout(() => {
  applyIndexes()
    .then(() => {
      console.log('✅ Script completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Script failed:', error);
      process.exit(1);
    });
}, 3000);
