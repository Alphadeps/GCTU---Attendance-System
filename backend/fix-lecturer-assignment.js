/**
 * Fix missing lecturer assignments for pending reports
 */

require('dotenv').config();
const prisma = require('./src/lib/prisma');

async function fixAssignments() {
  console.log('🔧 Fixing Lecturer Assignments\n');

  try {
    // Get the pending reports
    const pendingReports = await prisma.officialReport.findMany({
      where: { status: 'PENDING_SIGNATURE' },
      include: {
        class: { include: { programme: true } },
        course: true
      }
    });

    console.log(`Found ${pendingReports.length} pending reports\n`);

    // Get all lecturers
    const lecturers = await prisma.user.findMany({
      where: { role: 'LECTURER', isActive: true }
    });

    console.log(`Found ${lecturers.length} active lecturers\n`);

    if (lecturers.length === 0) {
      console.log('❌ No active lecturers found!');
      return;
    }

    // For each pending report without a lecturer assignment, create one
    for (const report of pendingReports) {
      console.log(`\nChecking Report ID: ${report.id}`);
      console.log(`  Class: ${report.class.displayName}`);
      console.log(`  Course: ${report.course.name} (${report.course.code})`);

      // Check if assignment exists
      const existingAssignment = await prisma.lecturerAssignment.findFirst({
        where: {
          classId: report.classId,
          courseId: report.courseId
        }
      });

      if (existingAssignment) {
        console.log(`  ✅ Assignment already exists`);
        continue;
      }

      // Ask which lecturer to assign (for now, assign to first lecturer)
      const lecturer = lecturers[0];
      
      console.log(`  ⚠️  No assignment found. Creating assignment for: ${lecturer.username}`);

      await prisma.lecturerAssignment.create({
        data: {
          lecturerId: lecturer.id,
          classId: report.classId,
          courseId: report.courseId
        }
      });

      console.log(`  ✅ Created assignment!`);
    }

    console.log('\n✅ Fix complete!\n');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixAssignments();
