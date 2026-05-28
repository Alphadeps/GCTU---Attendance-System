/**
 * Check what data exists in production database
 */

require('dotenv').config();
const prisma = require('./src/lib/prisma');

async function checkData() {
  console.log('🔍 Checking production database...\n');

  try {
    const programmes = await prisma.programme.count();
    const classes = await prisma.class.count();
    const courses = await prisma.course.count();
    const students = await prisma.student.count();
    const users = await prisma.user.count();
    const sessions = await prisma.attendanceSession.count();
    const reports = await prisma.officialReport.count();

    console.log('📊 Data counts:');
    console.log(`   Programmes: ${programmes}`);
    console.log(`   Classes: ${classes}`);
    console.log(`   Courses: ${courses}`);
    console.log(`   Students: ${students}`);
    console.log(`   Users: ${users}`);
    console.log(`   Sessions: ${sessions}`);
    console.log(`   Reports: ${reports}`);

    if (programmes === 0 && classes === 0 && courses === 0) {
      console.log('\n✅ Database is clean!');
    } else {
      console.log('\n⚠️  Database still has data');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
    process.exit(0);
  }
}

checkData();
