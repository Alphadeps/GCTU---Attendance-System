const { PrismaClient } = require('../../generated/prisma');
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const { withAccelerate } = require('@prisma/extension-accelerate');

let prisma;

if (process.env.DIRECT_URL) {
  console.log('Database Connection: Using direct PostgreSQL connection via pg driver adapter.');
  
  // Configure connection pool with limits
  const pool = new Pool({ 
    connectionString: process.env.DIRECT_URL,
    max: 20, // Maximum number of clients in the pool
    min: 5,  // Minimum number of clients in the pool
    idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
    connectionTimeoutMillis: 10000, // Return error after 10 seconds if connection cannot be established
    statement_timeout: 30000, // Query timeout: 30 seconds
    query_timeout: 30000, // Query timeout: 30 seconds
  });
  
  // Handle pool errors
  pool.on('error', (err) => {
    console.error('Unexpected error on idle client', err);
  });
  
  const adapter = new PrismaPg(pool);
  prisma = new PrismaClient({ 
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });
} else {
  console.log('Database Connection: Using Prisma Accelerate.');
  prisma = new PrismaClient({
    datasources: {
      db: {
        url: process.env.DATABASE_URL
      }
    },
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  }).$extends(withAccelerate());
}

// Graceful shutdown
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});

module.exports = prisma;
