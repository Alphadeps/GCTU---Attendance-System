const { PrismaClient } = require('../../generated/prisma');
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const { withAccelerate } = require('@prisma/extension-accelerate');

let prisma;

// Determine if we should use the driver adapter or Accelerate
const databaseUrl = process.env.DATABASE_URL || '';
const directUrl = process.env.DIRECT_URL;
const isAccelerate = databaseUrl.startsWith('prisma://');

if (directUrl || !isAccelerate) {
  console.log(`Database Connection: Using PostgreSQL connection via pg driver adapter.`);
  
  // Use directUrl if available, otherwise fall back to databaseUrl
  let connectionString = directUrl || databaseUrl;
  
  if (!connectionString) {
    throw new Error('DATABASE_URL or DIRECT_URL must be provided');
  }

  // Replace deprecated SSL modes with verify-full in connection string to avoid deprecation warning
  if (connectionString.includes('sslmode=require') || 
      connectionString.includes('sslmode=prefer') || 
      connectionString.includes('sslmode=verify-ca')) {
    connectionString = connectionString.replace(/sslmode=(require|prefer|verify-ca)/, 'sslmode=verify-full');
    console.log('✓ SSL mode updated to verify-full for enhanced security');
  }
  
  // Configure connection pool with limits
  const poolMax = parseInt(process.env.DB_POOL_MAX || '50', 10);
  const pool = new Pool({
    connectionString,
    max: poolMax,
    min: Math.min(5, poolMax),
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 30000, // raised from 10s to 30s for burst traffic
    statement_timeout: 30000,
    query_timeout: 30000,
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
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  }).$extends(withAccelerate());
}

module.exports = prisma;
