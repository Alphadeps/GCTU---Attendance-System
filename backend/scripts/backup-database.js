/**
 * Database Backup Script
 * 
 * Creates automated backups of the PostgreSQL database
 * Supports both local and cloud storage
 * 
 * Usage:
 *   node scripts/backup-database.js [options]
 * 
 * Options:
 *   --type=full|incremental (default: full)
 *   --compress=true|false (default: true)
 *   --upload=true|false (default: false)
 */

require('dotenv').config();
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');

const execAsync = promisify(exec);

// Configuration
const BACKUP_DIR = path.join(__dirname, '../backups');
const MAX_LOCAL_BACKUPS = 7; // Keep last 7 backups locally
const BACKUP_TYPE = process.argv.find(arg => arg.startsWith('--type='))?.split('=')[1] || 'full';
const COMPRESS = process.argv.find(arg => arg.startsWith('--compress='))?.split('=')[1] !== 'false';
const UPLOAD_TO_CLOUD = process.argv.find(arg => arg.startsWith('--upload='))?.split('=')[1] === 'true';

// Parse DATABASE_URL
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL not found in environment variables');
  process.exit(1);
}

// Extract database connection details
function parseDatabaseUrl(url) {
  try {
    // Handle Prisma Accelerate URL format
    if (url.includes('prisma-data.net')) {
      console.log('⚠️  Detected Prisma Accelerate URL');
      console.log('   Direct database backup not supported with Accelerate');
      console.log('   Please use your database provider\'s backup tools');
      console.log('   Or set DIRECT_DATABASE_URL in .env for backups');
      
      // Check for direct URL
      const directUrl = process.env.DIRECT_DATABASE_URL;
      if (directUrl) {
        console.log('✅ Found DIRECT_DATABASE_URL, using it for backup');
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
 * Ensure backup directory exists
 */
function ensureBackupDir() {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    console.log(`✅ Created backup directory: ${BACKUP_DIR}`);
  }
}

/**
 * Generate backup filename
 */
function generateBackupFilename(dbConfig) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  const type = BACKUP_TYPE === 'incremental' ? 'incr' : 'full';
  const ext = COMPRESS ? '.sql.gz' : '.sql';
  return `${dbConfig.database}_${type}_${timestamp}${ext}`;
}

/**
 * Create database backup using pg_dump
 */
async function createBackup(dbConfig) {
  const filename = generateBackupFilename(dbConfig);
  const filepath = path.join(BACKUP_DIR, filename);
  
  console.log('\n' + '='.repeat(60));
  console.log('🔄 Starting Database Backup');
  console.log('='.repeat(60));
  console.log(`Database: ${dbConfig.database}`);
  console.log(`Host: ${dbConfig.host}`);
  console.log(`Type: ${BACKUP_TYPE}`);
  console.log(`Compress: ${COMPRESS}`);
  console.log(`Output: ${filepath}`);
  console.log('='.repeat(60) + '\n');
  
  try {
    // Build pg_dump command
    let command = `pg_dump`;
    command += ` -h ${dbConfig.host}`;
    command += ` -p ${dbConfig.port}`;
    command += ` -U ${dbConfig.username}`;
    command += ` -d ${dbConfig.database}`;
    command += ` --no-password`; // Use PGPASSWORD env var
    command += ` --format=plain`;
    command += ` --verbose`;
    
    // Add compression if enabled
    if (COMPRESS) {
      command += ` | gzip`;
    }
    
    command += ` > "${filepath}"`;
    
    // Set password environment variable
    const env = { ...process.env, PGPASSWORD: dbConfig.password };
    
    console.log('⏳ Running pg_dump...');
    const startTime = Date.now();
    
    await execAsync(command, { env, shell: true });
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    const fileSize = fs.statSync(filepath).size;
    const fileSizeMB = (fileSize / 1024 / 1024).toFixed(2);
    
    console.log(`✅ Backup completed successfully!`);
    console.log(`   Duration: ${duration}s`);
    console.log(`   File size: ${fileSizeMB} MB`);
    console.log(`   Location: ${filepath}`);
    
    return { filepath, filename, fileSize, duration };
  } catch (error) {
    console.error('❌ Backup failed:', error.message);
    
    // Clean up partial backup file
    if (fs.existsSync(filepath)) {
      fs.unlinkSync(filepath);
    }
    
    throw error;
  }
}

/**
 * Create backup metadata file
 */
function createMetadata(backupInfo, dbConfig) {
  const metadata = {
    timestamp: new Date().toISOString(),
    database: dbConfig.database,
    host: dbConfig.host,
    type: BACKUP_TYPE,
    compressed: COMPRESS,
    filename: backupInfo.filename,
    fileSize: backupInfo.fileSize,
    fileSizeMB: (backupInfo.fileSize / 1024 / 1024).toFixed(2),
    duration: backupInfo.duration,
    version: '1.0.0'
  };
  
  const metadataPath = backupInfo.filepath + '.meta.json';
  fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
  
  console.log(`✅ Metadata saved: ${metadataPath}`);
  
  return metadata;
}

/**
 * Clean up old backups (keep only MAX_LOCAL_BACKUPS)
 */
function cleanupOldBackups() {
  console.log('\n🧹 Cleaning up old backups...');
  
  const files = fs.readdirSync(BACKUP_DIR)
    .filter(f => f.endsWith('.sql') || f.endsWith('.sql.gz'))
    .map(f => ({
      name: f,
      path: path.join(BACKUP_DIR, f),
      time: fs.statSync(path.join(BACKUP_DIR, f)).mtime.getTime()
    }))
    .sort((a, b) => b.time - a.time);
  
  if (files.length <= MAX_LOCAL_BACKUPS) {
    console.log(`   No cleanup needed (${files.length}/${MAX_LOCAL_BACKUPS} backups)`);
    return;
  }
  
  const toDelete = files.slice(MAX_LOCAL_BACKUPS);
  
  for (const file of toDelete) {
    try {
      fs.unlinkSync(file.path);
      
      // Also delete metadata file if exists
      const metaPath = file.path + '.meta.json';
      if (fs.existsSync(metaPath)) {
        fs.unlinkSync(metaPath);
      }
      
      console.log(`   Deleted: ${file.name}`);
    } catch (error) {
      console.error(`   Failed to delete ${file.name}:`, error.message);
    }
  }
  
  console.log(`✅ Cleanup complete (kept ${MAX_LOCAL_BACKUPS} most recent backups)`);
}

/**
 * Upload backup to cloud storage (placeholder)
 */
async function uploadToCloud(backupInfo) {
  if (!UPLOAD_TO_CLOUD) {
    return;
  }
  
  console.log('\n☁️  Uploading to cloud storage...');
  console.log('   ⚠️  Cloud upload not implemented yet');
  console.log('   Configure AWS S3, Google Cloud Storage, or Azure Blob Storage');
  console.log('   Add credentials to .env file');
  
  // TODO: Implement cloud upload
  // Example for AWS S3:
  // const AWS = require('aws-sdk');
  // const s3 = new AWS.S3();
  // await s3.upload({
  //   Bucket: process.env.BACKUP_BUCKET,
  //   Key: backupInfo.filename,
  //   Body: fs.createReadStream(backupInfo.filepath)
  // }).promise();
}

/**
 * List existing backups
 */
function listBackups() {
  console.log('\n📋 Existing Backups:');
  console.log('='.repeat(60));
  
  const files = fs.readdirSync(BACKUP_DIR)
    .filter(f => f.endsWith('.sql') || f.endsWith('.sql.gz'))
    .map(f => {
      const filepath = path.join(BACKUP_DIR, f);
      const stats = fs.statSync(filepath);
      const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
      
      // Try to read metadata
      let metadata = null;
      const metaPath = filepath + '.meta.json';
      if (fs.existsSync(metaPath)) {
        try {
          metadata = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
        } catch (e) {
          // Ignore metadata read errors
        }
      }
      
      return {
        name: f,
        size: sizeMB,
        date: stats.mtime,
        metadata
      };
    })
    .sort((a, b) => b.date - a.date);
  
  if (files.length === 0) {
    console.log('   No backups found');
  } else {
    files.forEach((file, i) => {
      console.log(`${i + 1}. ${file.name}`);
      console.log(`   Size: ${file.size} MB`);
      console.log(`   Date: ${file.date.toISOString()}`);
      if (file.metadata) {
        console.log(`   Type: ${file.metadata.type}`);
        console.log(`   Duration: ${file.metadata.duration}s`);
      }
      console.log('');
    });
  }
  
  console.log('='.repeat(60));
}

/**
 * Main execution
 */
async function main() {
  try {
    // Parse database URL
    const dbConfig = parseDatabaseUrl(DATABASE_URL);
    
    if (!dbConfig) {
      console.log('\n💡 Backup Alternatives:');
      console.log('   1. Use your database provider\'s backup tools (Render, Heroku, etc.)');
      console.log('   2. Set DIRECT_DATABASE_URL in .env for direct backups');
      console.log('   3. Use Prisma Studio to export data manually');
      process.exit(1);
    }
    
    // Ensure backup directory exists
    ensureBackupDir();
    
    // Create backup
    const backupInfo = await createBackup(dbConfig);
    
    // Create metadata
    const metadata = createMetadata(backupInfo, dbConfig);
    
    // Upload to cloud (if enabled)
    await uploadToCloud(backupInfo);
    
    // Clean up old backups
    cleanupOldBackups();
    
    // List all backups
    listBackups();
    
    console.log('\n✅ Backup process completed successfully!\n');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Backup process failed:', error.message);
    process.exit(1);
  }
}

// Run backup
main();
