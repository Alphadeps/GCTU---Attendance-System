require('dotenv').config();
const { Client } = require('pg');

async function createDatabase() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL not found in .env');
    return;
  }

  // Extract connection details to connect to the default 'postgres' database first
  const url = new URL(databaseUrl.replace('postgresql://', 'http://'));
  const targetDb = url.pathname.slice(1);
  
  // Create a connection string for the default 'postgres' database
  const connectionString = `postgresql://${url.username}${url.password ? ':' + url.password : ''}@${url.hostname}:${url.port || 5432}/postgres`;

  console.log(`Connecting to PostgreSQL to create database: ${targetDb}...`);
  const client = new Client({ connectionString });

  try {
    await client.connect();
    // Check if database exists
    const res = await client.query(`SELECT 1 FROM pg_database WHERE datname = $1`, [targetDb]);
    
    if (res.rowCount === 0) {
      // Must use quote_ident or just be very careful with the string for CREATE DATABASE
      await client.query(`CREATE DATABASE "${targetDb}"`);
      console.log(`✅ Database "${targetDb}" created successfully!`);
    } else {
      console.log(`ℹ️ Database "${targetDb}" already exists.`);
    }
  } catch (err) {
    console.error('❌ Error creating database:', err.message);
  } finally {
    await client.end();
  }
}

createDatabase();
