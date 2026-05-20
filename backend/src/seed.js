require('dotenv').config();
const bcrypt = require('bcryptjs');
const prisma = require('./lib/prisma');

async function seed() {
  console.log('Starting seeding database...');

  try {
    // 1. Clean existing records
    await prisma.classStudent.deleteMany({});
    await prisma.classCourse.deleteMany({});
    await prisma.attendance.deleteMany({});
    await prisma.attendanceSession.deleteMany({});
    await prisma.class.deleteMany({});
    await prisma.programme.deleteMany({});
    await prisma.student.deleteMany({});
    await prisma.course.deleteMany({});
    await prisma.notification.deleteMany({});
    await prisma.user.deleteMany({});
    await prisma.systemSettings.deleteMany({});

    // 2. Seed System Settings
    await prisma.systemSettings.create({
      data: {
        deptName: 'Ghana Communication Technology University',
        deptLogoUrl: '/logo.jfif',
        lateWindowMinutes: 15,
        qrExpirySeconds: 25,
        geofenceRadiusMeters: 100
      }
    });
    console.log('Created default system settings.');

    // 3. Create Users
    const superAdminPw = await bcrypt.hash('admin123', 10);
    const defaultPw = await bcrypt.hash('password123', 10);

    await prisma.user.create({
      data: {
        username: 'superadmin',
        password: superAdminPw,
        role: 'SUPERADMIN',
        isActive: true
      }
    });
    console.log('Created Super Admin: superadmin / admin123');

    const repUser = await prisma.user.create({
      data: {
        username: 'rep1',
        password: defaultPw,
        role: 'REP',
        isActive: true
      }
    });
    console.log('Created Rep User: rep1 / password123');

    await prisma.user.create({
      data: {
        username: 'lecturer1',
        password: defaultPw,
        role: 'LECTURER',
        isActive: true
      }
    });
    console.log('Created Lecturer: lecturer1 / password123');

    await prisma.user.create({
      data: {
        username: 'admin1',
        password: defaultPw,
        role: 'ADMIN',
        isActive: true
      }
    });
    console.log('Created Admin: admin1 / password123');

    // 4. Create Programmes
    const bitProgramme = await prisma.programme.create({ data: { name: 'BIT' } });
    const bscCSProgramme = await prisma.programme.create({ data: { name: 'BSc CS' } });
    console.log('Created Programmes: BIT, BSc CS');

    // 5. Create Courses
    const course1 = await prisma.course.create({ data: { name: 'Software Engineering', code: 'CS-402' } });
    const course2 = await prisma.course.create({ data: { name: 'Database Management Systems', code: 'CS-304' } });
    const course3 = await prisma.course.create({ data: { name: 'Mobile Application Development', code: 'BIT-310' } });
    console.log('Created Courses: CS-402, CS-304, BIT-310');

    // 6. Create Classes
    const classB = await prisma.class.create({
      data: {
        programmeId: bitProgramme.id,
        level: '300',
        type: 'TOP-UP',
        group: 'B',
        session: 'EVENING',
        displayName: 'BIT LEVEL 300 TOP-UP GROUP B (EVENING)',
        repId: repUser.id
      }
    });

    const classA = await prisma.class.create({
      data: {
        programmeId: bitProgramme.id,
        level: '300',
        type: 'TOP-UP',
        group: 'A',
        session: 'MORNING',
        displayName: 'BIT LEVEL 300 TOP-UP GROUP A (MORNING)'
      }
    });

    console.log('Created Classes: BIT 300 TOP-UP Groups A & B');

    // 7. Link courses to class
    await prisma.classCourse.create({ data: { classId: classB.id, courseId: course1.id } });
    await prisma.classCourse.create({ data: { classId: classB.id, courseId: course3.id } });
    console.log('Linked courses to BIT Group B class.');

    // 8. Create Students and link to class
    const studentsList = [
      { indexNumber: '10912345', name: 'Alex Mercer', email: 'alex@mercer.com' },
      { indexNumber: '10923456', name: 'Jane Doe', email: 'jane@doe.com' },
      { indexNumber: '10934567', name: 'John Smith', email: 'john@smith.com' },
      { indexNumber: '10945678', name: 'Sarah Connor', email: 'sarah@connor.com' },
      { indexNumber: '10956789', name: 'Bruce Wayne', email: 'bruce@wayne.com' },
      { indexNumber: '2526430213', name: 'Demo Student', email: 'demo@student.gctu.edu.gh' }
    ];

    for (const student of studentsList) {
      const created = await prisma.student.create({ data: student });
      await prisma.classStudent.create({
        data: { classId: classB.id, studentId: created.id }
      });
    }
    console.log(`Created ${studentsList.length} students and linked to BIT Group B.`);

    // Create Lecturer Assignments for lecturer1
    const lecturer = await prisma.user.findFirst({ where: { username: 'lecturer1' } });
    if (lecturer) {
      await prisma.lecturerAssignment.create({
        data: {
          lecturerId: lecturer.id,
          classId: classB.id,
          courseId: course1.id
        }
      });
      await prisma.lecturerAssignment.create({
        data: {
          lecturerId: lecturer.id,
          classId: classB.id,
          courseId: course3.id
        }
      });
      console.log('Linked lecturer1 to Software Engineering and Mobile App Dev courses for BIT Group B.');
    }

    console.log('\n=== SEEDING COMPLETE ===');
    console.log('Super Admin Login: superadmin / admin123');
    console.log('Rep Login: rep1 / password123');
    console.log('Lecturer Login: lecturer1 / password123');
  } catch (err) {
    console.error('Error seeding database:', err);
  } finally {
    if (require.main === module) {
      process.exit(0);
    }
  }
}

if (require.main === module) {
  seed();
}

module.exports = seed;

