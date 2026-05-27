require('dotenv').config();
const prisma = require('../src/lib/prisma');
const bcrypt = require('bcryptjs');

async function clearDataKeepAdmin() {
  console.log('🧹 Starting to clear all data (keeping superadmin)...\n');

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

    console.log('📋 Deleting Users (except SUPERADMIN)...');
    const deletedUsers = await prisma.user.deleteMany({
      where: {
        role: {
          not: 'SUPERADMIN'
        }
      }
    });
    console.log(`   ✅ Deleted ${deletedUsers.count} users (kept superadmin accounts)`);

    console.log('📋 Resetting System Settings...');
    const deletedSettings = await prisma.systemSettings.deleteMany({});
    console.log(`   ✅ Deleted ${deletedSettings.count} system settings`);

    // Create default system settings
    console.log('📋 Creating default system settings...');
    await prisma.systemSettings.create({
      data: {
        deptName: 'Class Attendance System',
        lateWindowMinutes: 15,
        qrExpirySeconds: 30,
        geofenceRadiusMeters: 100
      }
    });
    console.log('   ✅ Default system settings created');

    // Check if superadmin exists, if not create one
    const superadminCount = await prisma.user.count({
      where: { role: 'SUPERADMIN' }
    });

    if (superadminCount === 0) {
      console.log('\n📋 No superadmin found. Creating default superadmin...');
      const hashedPassword = await bcrypt.hash('admin123', 10);
      await prisma.user.create({
        data: {
          username: 'superadmin',
          password: hashedPassword,
          role: 'SUPERADMIN',
          isActive: true
        }
      });
      console.log('   ✅ Superadmin created');
      console.log('   📝 Username: superadmin');
      console.log('   📝 Password: admin123');
      console.log('   ⚠️  IMPORTANT: Change this password after first login!');
    } else {
      console.log(`\n✅ Kept ${superadminCount} existing superadmin account(s)`);
    }

    console.log('\n✨ All data has been successfully cleared from the system!');
    console.log('💡 The database is now clean and ready for fresh data.');
    console.log('🔐 You can log in with your superadmin account to set up the system.');

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
clearDataKeepAdmin();
