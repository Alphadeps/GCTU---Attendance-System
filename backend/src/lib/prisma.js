const { PrismaClient } = require('../../generated/prisma');
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const { withAccelerate } = require('@prisma/extension-accelerate');

let prisma;

if (process.env.DIRECT_URL) {
  console.log('Database Connection: Using direct PostgreSQL connection via pg driver adapter.');
  const pool = new Pool({ connectionString: process.env.DIRECT_URL });
  const adapter = new PrismaPg(pool);
  prisma = new PrismaClient({ adapter });
} else {
  console.log('Database Connection: Using Prisma Accelerate.');
  prisma = new PrismaClient({
    accelerateUrl: process.env.DATABASE_URL
  }).$extends(withAccelerate());
}

module.exports = prisma;
