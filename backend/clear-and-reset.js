/**
 * Clear all sessions and reports to start fresh
 */

require('dotenv').config();
const prisma = require('./src/lib/prisma');

async function clearData() {
  console.log('🧹 Clearing sessions and reports...\n');

  try {
    // Delete all official reports
    const deletedReports = await prisma.officialReport.deleteMany({});
    console.log(`✅ Deleted ${deletedReports.count} official reports`);

    // Delete all attendances
    const deletedAttendances = await prisma.attendance.deleteMany({});
    console.log(`✅ Deleted ${deletedAttendances.count} attendance records`);

    // Delete all sessions
    const deletedSessions = await prisma.attendanceSession.deleteMany({});
    console.log(`✅ Deleted ${deletedSessions.count} attendance sessions`);

    console.log('\n✅ All sessions and reports cleared!');
    console.log('You can now start fresh by creating new sessions and generating reports.\n');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

clearData();
