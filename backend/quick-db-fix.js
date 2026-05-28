require('dotenv').config();
const { Pool } = require('pg');

const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
console.log('Using connection:', connectionString.substring(0, 30) + '...');
const pool = new Pool({ 
  connectionString,
  connectionTimeoutMillis: 5000
});

async function fix() {
  try {
    console.log('Adding column...');
    await pool.query('ALTER TABLE "OfficialReport" ADD COLUMN IF NOT EXISTS "submittedToDeptAt" TIMESTAMP(3)');
    console.log('✅ Done!');
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

fix();
