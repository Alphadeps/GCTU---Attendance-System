require('dotenv').config();
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('../generated/prisma');

async function main() {
  console.log("Starting DB connection tests from src using pg driver adapter...");
  console.log("DIRECT_URL length:", process.env.DIRECT_URL ? process.env.DIRECT_URL.length : 0);
  
  try {
    const pool = new Pool({ connectionString: process.env.DIRECT_URL });
    const adapter = new PrismaPg(pool);
    const prisma = new PrismaClient({ adapter });
    
    console.log("Attempting to connect directly via pg driver adapter...");
    const userCount = await prisma.user.count();
    console.log("SUCCESS: Connect directly via pg driver adapter. User count:", userCount);
    
    await prisma.$disconnect();
    await pool.end();
  } catch (err) {
    console.error("ERROR: pg driver adapter connection failed:", err.stack || err);
  }
}

main();
