'use strict';
/**
 * Seed script for load tests
 *
 * Creates 500 test students enrolled in a test class with an open session.
 * Outputs a STUDENTS JSON array and SESSION_ID suitable for k6 -e flags.
 *
 * Usage:
 *   node tests/seed/seed-test-data.js
 *
 * Output files:
 *   tests/seed/students.json    - array of { indexNumber, name, password, deviceFingerprint }
 *   tests/seed/session.json     - { sessionId }
 *
 * Then run k6:
 *   k6 run -e BASE_URL=http://localhost:10000 \
 *           -e SESSION_ID=$(node -e "console.log(require('./tests/seed/session.json').sessionId)") \
 *           -e STUDENTS="$(cat tests/seed/students.json)" \
 *           tests/load/single-class-rush.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../../.env.test') });

const { PrismaClient } = require('../../generated/prisma');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

const STUDENT_COUNT = 500;
const PLAIN_PASSWORD = 'LoadTest@123';
const SEED_TAG = 'LOADTEST';

async function main() {
  console.log(`Seeding ${STUDENT_COUNT} test students...`);

  const hashedPassword = await bcrypt.hash(PLAIN_PASSWORD, 10);

  // 1. Programme
  const programme = await prisma.programme.upsert({
    where: { name: `${SEED_TAG} Programme` },
    create: { name: `${SEED_TAG} Programme` },
    update: {}
  });

  // 2. Rep User
  const rep = await prisma.user.upsert({
    where: { username: `${SEED_TAG.toLowerCase()}_rep` },
    create: {
      username: `${SEED_TAG.toLowerCase()}_rep`,
      password: await bcrypt.hash('RepPass@123', 8),
      role: 'REP',
      isActive: true
    },
    update: {}
  });

  // 3. Class
  const cls = await prisma.class.upsert({
    where: {
      programmeId_level_type_group_session: {
        programmeId: programme.id,
        level: '300',
        type: 'REGULAR',
        group: 'Z',
        session: 'MORNING'
      }
    },
    create: {
      programmeId: programme.id,
      level: '300',
      type: 'REGULAR',
      group: 'Z',
      session: 'MORNING',
      displayName: `${SEED_TAG} Load Test Class`,
      repId: rep.id
    },
    update: { repId: rep.id }
  });

  // 4. Course
  const course = await prisma.course.upsert({
    where: { code: `${SEED_TAG}101` },
    create: { name: `${SEED_TAG} Load Test Course`, code: `${SEED_TAG}101` },
    update: {}
  });

  // 5. Create students in batches of 50
  const studentsData = [];
  for (let i = 1; i <= STUDENT_COUNT; i++) {
    const indexNumber = `${SEED_TAG}${String(i).padStart(5, '0')}`;
    studentsData.push({
      indexNumber,
      name: `Load Student ${i}`,
      email: `${indexNumber.toLowerCase()}@loadtest.gctu.edu.gh`,
      password: hashedPassword,
      isFirstLogin: false,
      deviceFingerprint: `device_fp_${indexNumber}`
    });
  }

  // Upsert students in batches
  const BATCH = 50;
  for (let i = 0; i < studentsData.length; i += BATCH) {
    const batch = studentsData.slice(i, i + BATCH);
    await Promise.all(
      batch.map(s =>
        prisma.student.upsert({
          where: { indexNumber: s.indexNumber },
          create: s,
          update: { deviceFingerprint: s.deviceFingerprint }
        })
      )
    );
    process.stdout.write(`\r  Created ${Math.min(i + BATCH, STUDENT_COUNT)}/${STUDENT_COUNT} students`);
  }
  console.log('\n  Students seeded.');

  // 6. Fetch student IDs and enroll in class
  const students = await prisma.student.findMany({
    where: { indexNumber: { startsWith: SEED_TAG } },
    select: { id: true, indexNumber: true }
  });

  await prisma.classStudent.createMany({
    data: students.map(s => ({ classId: cls.id, studentId: s.id })),
    skipDuplicates: true
  });
  console.log(`  Enrolled ${students.length} students in class.`);

  // 7. Create an open session (or reuse existing)
  const now = new Date();
  const existingSession = await prisma.attendanceSession.findFirst({
    where: { classId: cls.id, status: 'OPEN' }
  });

  let session;
  if (existingSession) {
    // Refresh the QR expiry so it's valid for the next hour
    session = await prisma.attendanceSession.update({
      where: { id: existingSession.id },
      data: {
        qrCodeExpiry: new Date(now.getTime() + 3600000),
        startTime: new Date(now.getTime() - 2 * 60000)
      }
    });
    console.log(`  Reusing existing open session: ${session.id}`);
  } else {
    session = await prisma.attendanceSession.create({
      data: {
        courseId: course.id,
        repId: rep.id,
        classId: cls.id,
        sessionType: 'PHYSICAL',
        startTime: new Date(now.getTime() - 2 * 60000),
        endTime: new Date(now.getTime() + 58 * 60000),
        status: 'OPEN',
        latitude: 5.5913,
        longitude: -0.2359,
        qrCode: `loadtest_qr_${Date.now()}`,
        qrCodeExpiry: new Date(now.getTime() + 3600000),
        manualCode: '999000'
      }
    });
    console.log(`  Created new open session: ${session.id}`);
  }

  // 8. Write output files
  const k6Students = studentsData.map(s => ({
    indexNumber: s.indexNumber,
    name: s.name,
    password: PLAIN_PASSWORD,
    deviceFingerprint: s.deviceFingerprint
  }));

  const outDir = path.join(__dirname);
  fs.writeFileSync(path.join(outDir, 'students.json'), JSON.stringify(k6Students, null, 2));
  fs.writeFileSync(path.join(outDir, 'session.json'), JSON.stringify({ sessionId: session.id }, null, 2));

  console.log(`\nDone!`);
  console.log(`  students.json → ${k6Students.length} students`);
  console.log(`  session.json  → sessionId: ${session.id}`);
  console.log(`\nRun load test:`);
  console.log(`  k6 run -e BASE_URL=http://localhost:10000 \\`);
  console.log(`         -e SESSION_ID=${session.id} \\`);
  console.log(`         -e STUDENTS="$(cat tests/seed/students.json)" \\`);
  console.log(`         tests/load/single-class-rush.js`);
}

main()
  .catch(err => { console.error(err); process.exit(1); })
  .finally(() => prisma.$disconnect());
