'use strict';
/**
 * DB helpers for integration tests — create and clean up test fixtures.
 */
require('dotenv').config({ path: require('path').join(__dirname, '../../.env.test') });

const { PrismaClient } = require('../../generated/prisma');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const prisma = new PrismaClient();

/**
 * Creates a minimal test fixture: programme → class → student → course → session → rep user
 * Returns all created IDs so tests can use and clean up afterwards.
 */
async function createTestFixture(overrides = {}) {
  const suffix = uuidv4().slice(0, 8);

  const programme = await prisma.programme.create({
    data: { name: `Test Programme ${suffix}` }
  });

  const repUser = await prisma.user.create({
    data: {
      username: `rep_${suffix}`,
      password: await bcrypt.hash('testpass123', 8),
      role: 'REP',
      isActive: true
    }
  });

  const cls = await prisma.class.create({
    data: {
      programmeId: programme.id,
      level: '300',
      type: 'REGULAR',
      group: 'A',
      session: 'MORNING',
      displayName: `Test Class ${suffix}`,
      repId: repUser.id
    }
  });

  const course = await prisma.course.create({
    data: {
      name: `Test Course ${suffix}`,
      code: `TC${suffix.slice(0, 4).toUpperCase()}`
    }
  });

  const student = await prisma.student.create({
    data: {
      indexNumber: `STU${suffix}`,
      name: `Test Student ${suffix}`,
      email: `student_${suffix}@test.gctu.edu.gh`,
      password: await bcrypt.hash('Student@123', 10),
      isFirstLogin: false,
      deviceFingerprint: `fp_${suffix}`
    }
  });

  // Enroll student in class
  await prisma.classStudent.create({
    data: { classId: cls.id, studentId: student.id }
  });

  // Link course to class (required so real session-creation paths can validate it)
  await prisma.classCourse.create({
    data: { classId: cls.id, courseId: course.id }
  });

  const now = new Date();
  const session = await prisma.attendanceSession.create({
    data: {
      courseId: course.id,
      repId: repUser.id,
      classId: cls.id,
      sessionType: 'PHYSICAL',
      startTime: new Date(now.getTime() - 5 * 60000), // started 5 min ago
      endTime: new Date(now.getTime() + 55 * 60000),
      status: 'OPEN',
      latitude: overrides.latitude ?? 5.5913,
      longitude: overrides.longitude ?? -0.2359,
      qrCode: `qr_token_${suffix}`,
      qrCodeExpiry: new Date(now.getTime() + 30000),
      manualCode: `${Math.floor(100000 + Math.random() * 900000)}`
    }
  });

  return { programme, repUser, cls, course, student, session, suffix };
}

/**
 * Removes all records created by createTestFixture
 */
async function cleanupTestFixture({ programme, repUser, cls, course, student, session }) {
  // Cascade deletes handle most relations; explicit order for safety
  // Cascade order: attendance → session → classCourse/classStudent → class/student → course/user → programme
  if (session) await prisma.attendanceSession.deleteMany({ where: { id: session.id } }); // cascades Attendance
  if (student) {
    await prisma.classStudent.deleteMany({ where: { studentId: student.id } });
    await prisma.student.deleteMany({ where: { id: student.id } });
  }
  if (cls && course) await prisma.classCourse.deleteMany({ where: { classId: cls.id, courseId: course.id } });
  if (cls) await prisma.class.deleteMany({ where: { id: cls.id } });
  if (course) await prisma.course.deleteMany({ where: { id: course.id } });
  if (repUser) await prisma.user.deleteMany({ where: { id: repUser.id } }); // cascades Notification
  if (programme) await prisma.programme.deleteMany({ where: { id: programme.id } });
}

async function disconnectPrisma() {
  await prisma.$disconnect();
}

module.exports = { createTestFixture, cleanupTestFixture, disconnectPrisma, prisma };
