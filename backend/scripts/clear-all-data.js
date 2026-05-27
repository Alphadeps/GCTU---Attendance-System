require('dotenv').config();
const prisma = require('../src/lib/prisma');

async function clearAllData() {
  console.log('🧹 Starting to clear all data from the system...\n');

  try {
    // Delete data in the correct order to respect foreign key constraints
    
    console.log('📋 Deleting Official Reports...');
    const deletedReports = await prisma.officialReport.deleteMany({});
    console.log(`   ✅ Deleted ${deletedReports.count} official reports`);

    console.log('📋 Deleting Report Templates...');
    const deletedTemplates = await prisma.reportTemplate.deleteMany({});
    console.log(`   ✅ Deleted ${deletedTemplates.count} report templates`);

    console.log('📋 Deleting Grievances...');
    const deletedGrievances = await prisma.grievance.deleteMany({});
    console.log(`   ✅ Deleted ${deletedGrievances.count} grievances`);

    console.log('📋 Deleting Lecturer Assignments...');
    const deletedAssignments = await prisma.lecturerAssignment.deleteMany({});
    console.log(`   ✅ Deleted ${deletedAssignments.count} lecturer assignments`);

    console.log('📋 Deleting Notifications...');
    const deletedNotifications = await prisma.notification.deleteMany({});
    console.log(`   ✅ Deleted ${deletedNotifications.count} notifications`);

    console.log('📋 Deleting Attendances...');
    const deletedAttendances = await prisma.attendance.deleteMany({});
    console.log(`   ✅ Deleted ${deletedAttendances.count} attendance records`);

    console.log('📋 Deleting Attendance Sessions...');
    const deletedSessions = await prisma.attendanceSession.deleteMany({});
    console.log(`   ✅ Deleted ${deletedSessions.count} attendance sessions`);

    console.log('📋 Deleting Class-Course Relationships...');
    const deletedClassCourses = await prisma.classCourse.deleteMany({});
    console.log(`   ✅ Deleted ${deletedClassCourses.count} class-course relationships`);

    console.log('📋 Deleting Class-Student Relationships...');
    const deletedClassStudents = await prisma.classStudent.deleteMany({});
    console.log(`   ✅ Deleted ${deletedClassStudents.count} class-student relationships`);

    console.log('📋 Deleting Classes...');
    const deletedClasses = await prisma.class.deleteMany({});
    console.log(`   ✅ Deleted ${deletedClasses.count} classes`);

    console.log('📋 Deleting Programmes...');
    const deletedProgrammes = await prisma.programme.deleteMany({});
    console.log(`   ✅ Deleted ${deletedProgrammes.count} programmes`);

    console.log('📋 Deleting Courses...');
    const deletedCourses = await prisma.course.deleteMany({});
    console.log(`   ✅ Deleted ${deletedCourses.count} courses`);

    console.log('📋 Deleting Students...');
    const deletedStudents = await prisma.student.deleteMany({});
    console.log(`   ✅ Deleted ${deletedStudents.count} students`);

    console.log('📋 Deleting Users (Admins, Lecturers, Reps)...');
    const deletedUsers = await prisma.user.deleteMany({});
    console.log(`   ✅ Deleted ${deletedUsers.count} users`);

    console.log('📋 Resetting System Settings...');
    const deletedSettings = await prisma.systemSettings.deleteMany({});
    console.log(`   ✅ Deleted ${deletedSettings.count} system settings`);

    console.log('\n✨ All data has been successfully cleared from the system!');
    console.log('💡 The database is now empty and ready for fresh data.');
    console.log('⚠️  Remember to create a new superadmin account to access the system.');

  } catch (error) {
    console.error('\n❌ Error clearing data:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    process.exit(0);
  }
}

// Run the script
clearAllData();
