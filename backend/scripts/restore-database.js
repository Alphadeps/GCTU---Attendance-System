/**
 * Database Restore Script
 * 
 * Restores database from backup file
 * 
 * Usage:
 *   node scripts/restore-database.js <backup-file>
 * 
 * Example:
 *   node scripts/restore-database.js backups/mydb_full_2026-05-22T10-30-00.sql.gz
 * 
 * WARNING: This will overwrite the current database!
 */

require('dotenv').config();
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const readline = require('readline');

const execAsync = promisify(exec);

// Get backup file from command line
const backupFile = process.argv[2];

if (!backupFile) {
  console.error('❌ Usage: node scripts/restore-database.js <backup-file>');
  console.log('\nExample:');
  console.log('  node scripts/restore-database.js backups/mydb_full_2026-05-22T10-30-00.sql.gz');
  process.exit(1);
}

// Parse DATABASE_URL
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL not found in environment variables');
  process.exit(1);
}

/**
 * Parse database URL
 */
function parseDatabaseUrl(url) {
  try {
    if (url.includes('prisma-data.net')) {
      console.log('⚠️  Detected Prisma Accelerate URL');
      const directUrl = process.env.DIRECT_DATABASE_URL;
      if (directUrl) {
        console.log('✅ Found DIRECT_DATABASE_URL, using it for restore');
        return parseDatabaseUrl(directUrl);
      }
      return null;
    }
    
    const urlObj = new URL(url);
    return {
      host: urlObj.hostname,
      port: urlObj.port || '5432',
      database: urlObj.pathname.slice(1),
      username: urlObj.username,
      password: urlObj.password
    };
  } catch (error) {
    console.error('❌ Failed to parse DATABASE_URL:', error.message);
    return null;
  }
}

/**
 * Ask for user confirmation
 */
function askConfirmation(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  return new Promise(resolve => {
    rl.question(question, answer => {
      rl.close();
      resolve(answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y');
    });
  });
}

/**
 * Restore database from backup
 */
async function restoreDatabase(dbConfig, backupFilePath) {
  console.log('\n' + '='.repeat(60));
  console.log('🔄 Starting Database Restore');
  console.log('='.repeat(60));
  console.log(`Database: ${dbConfig.database}`);
  console.log(`Host: ${dbConfig.host}`);
  console.log(`Backup file: ${backupFilePath}`);
  console.log('='.repeat(60) + '\n');
  
  // Check if backup file exists
  if (!fs.existsSync(backupFilePath)) {
    throw new Error(`Backup file not found: ${backupFilePath}`);
  }
  
  const fileSize = fs.statSync(backupFilePath).size;
  const fileSizeMB = (fileSize / 1024 / 1024).toFixed(2);
  console.log(`Backup file size: ${fileSizeMB} MB`);
  
  // Check if file is compressed
  const isCompressed = backupFilePath.endsWith('.gz');
  
  // Warning
  console.log('\n⚠️  WARNING: This will OVERWRITE the current database!');
  console.log('   All existing data will be LOST!');
  console.log('   Make sure you have a backup of the current database.\n');
  
  const confirmed = await askConfirmation('Are you sure you want to continue? (yes/no): ');
  
  if (!confirmed) {
    console.log('❌ Restore cancelled by user');
    process.exit(0);
  }
  
  try {
    console.log('\n⏳ Restoring database...');
    const startTime = Date.now();
    
    // Build psql command
    let command;
    
    if (isCompressed) {
      // Decompress and pipe to psql
      command = `gunzip -c "${backupFilePath}" | psql`;
    } else {
      // Direct restore
      command = `psql -f "${backupFilePath}"`;
    }
    
    command += ` -h ${dbConfig.host}`;
    command += ` -p ${dbConfig.port}`;
    command += ` -U ${dbConfig.username}`;
    command += ` -d ${dbConfig.database}`;
    command += ` --no-password`;
    
    // Set password environment variable
    const env = { ...process.env, PGPASSWORD: dbConfig.password };
    
    await execAsync(command, { env, shell: true });
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    
    console.log(`✅ Database restored successfully!`);
    console.log(`   Duration: ${duration}s`);
    
    return { duration };
  } catch (error) {
    console.error('❌ Restore failed:', error.message);
    throw error;
  }
}

/**
 * Verify restore
 */
async function verifyRestore(dbConfig) {
  console.log('\n🔍 Verifying restore...');
  
  try {
    // Simple connection test
    const command = `psql -h ${dbConfig.host} -p ${dbConfig.port} -U ${dbConfig.username} -d ${dbConfig.database} --no-password -c "SELECT COUNT(*) FROM \\"User\\""`;
    const env = { ...process.env, PGPASSWORD: dbConfig.password };
    
    const { stdout } = await execAsync(command, { env, shell: true });
    
    console.log('✅ Database connection verified');
    console.log('   Sample query executed successfully');
    
    return true;
  } catch (error) {
    console.error('⚠️  Verification failed:', error.message);
    return false;
  }
}

/**
 * Main execution
 */
async function main() {
  try {
    // Parse database URL
    const dbConfig = parseDatabaseUrl(DATABASE_URL);
    
    if (!dbConfig) {
      console.log('\n💡 Restore Alternatives:');
      console.log('   1. Use your database provider\'s restore tools');
      console.log('   2. Set DIRECT_DATABASE_URL in .env for direct restore');
      process.exit(1);
    }
    
    // Resolve backup file path
    const backupFilePath = path.resolve(backupFile);
    
    // Restore database
    await restoreDatabase(dbConfig, backupFilePath);
    
    // Verify restore
    await verifyRestore(dbConfig);
    
    console.log('\n✅ Restore process completed successfully!\n');
    console.log('💡 Next steps:');
    console.log('   1. Restart your application');
    console.log('   2. Run Prisma migrations if needed: npx prisma migrate deploy');
    console.log('   3. Verify data integrity');
    console.log('   4. Test critical functionality\n');
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Restore process failed:', error.message);
    process.exit(1);
  }
}

// Run restore
main();
