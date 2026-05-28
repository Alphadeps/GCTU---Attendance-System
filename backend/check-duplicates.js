/**
 * Check for duplicate courses and classes
 */

// Override DATABASE_URL with DIRECT_URL
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '.env');
const envContent = fs.readFileSync(envPath, 'utf8');

const lines = envContent.split('\n');
for (const line of lines) {
  if (line.startsWith('DIRECT_URL=')) {
    const directUrl = line.substring('DIRECT_URL='.length).trim().replace(/^["']|["']$/g, '');
    process.env.DATABASE_URL = directUrl;
    console.log('✓ Using DIRECT_URL for faster connection\n');
    break;
  }
}

const prisma = require('./src/lib/prisma');

async function checkDuplicates() {
  console.log('🔍 Checking for Duplicate Courses and Classes\n');

  try {
    // 1. Get all courses
    console.log('📚 ALL COURSES:');
    const courses = await prisma.course.findMany({
      orderBy: { code: 'asc' }
    });

    courses.forEach((c, i) => {
      console.log(`   ${i + 1}. ${c.name} (${c.code})`);
      console.log(`      ID: ${c.id}`);
      console.log(`      Programme ID: ${c.programmeId}\n`);
    });

    // 2. Get all classes
    console.log('\n🏫 ALL CLASSES:');
    const classes = await prisma.class.findMany({
      include: { 
        programme: true,
        rep: { select: { username: true } }
      },
      orderBy: { displayName: 'asc' }
    });

    classes.forEach((c, i) => {
      console.log(`   ${i + 1}. ${c.displayName}`);
      console.log(`      ID: ${c.id}`);
      console.log(`      Programme: ${c.programme.name}`);
      console.log(`      REP: ${c.rep?.username || 'Not assigned'}`);
      console.log(`      Level: ${c.level}, Group: ${c.group}, Session: ${c.session}\n`);
    });

    // 3. Get all users
    console.log('\n👥 ALL USERS:');
    const users = await prisma.user.findMany({
      orderBy: { role: 'asc' }
    });

    users.forEach((u, i) => {
      console.log(`   ${i + 1}. ${u.username} (${u.role})`);
      console.log(`      ID: ${u.id}`);
      console.log(`      Active: ${u.isActive}\n`);
    });

    console.log('\n✅ Check complete!');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    await prisma.$disconnect();
    process.exit(0);
  }
}

checkDuplicates();
