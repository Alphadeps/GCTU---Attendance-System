/**
 * Fix lecturer assignment mismatch
 * Assign Godfred Fokuo to the correct course and class
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

async function fixLecturerAssignment() {
  console.log('🔧 Fixing Lecturer Assignment Mismatch\n');

  try {
    const lecturerId = 'ab2008fc-0bb0-430a-8f3f-2765ffcc1fa5'; // Godfred Fokuo
    const courseId = '0f2ee167-0082-443a-a77f-8ec8c8731e2f'; // Testing (T 235)
    const classId = '79b08492-c034-46bb-afcc-87c8d66f4398'; // BSc IT LEVEL 300 GROUP B EVENING

    console.log('Creating lecturer assignment:');
    console.log(`   Lecturer: Godfred Fokuo (${lecturerId})`);
    console.log(`   Course: Testing (T 235) (${courseId})`);
    console.log(`   Class: BSc IT LEVEL 300 GROUP B EVENING (${classId})\n`);

    // Check if assignment already exists
    const existing = await prisma.lecturerAssignment.findFirst({
      where: {
        lecturerId,
        courseId,
        classId
      }
    });

    if (existing) {
      console.log('✓ Assignment already exists!\n');
      console.log(`   Assignment ID: ${existing.id}`);
    } else {
      const assignment = await prisma.lecturerAssignment.create({
        data: {
          lecturerId,
          courseId,
          classId
        }
      });

      console.log('✅ Assignment created successfully!\n');
      console.log(`   Assignment ID: ${assignment.id}`);
    }

    // Verify the fix
    console.log('\n🔍 Verifying fix...\n');

    const pendingReport = await prisma.officialReport.findFirst({
      where: { status: 'PENDING_SIGNATURE' },
      include: {
        class: true,
        course: true
      }
    });

    if (pendingReport) {
      console.log('Pending Report:');
      console.log(`   Course ID: ${pendingReport.courseId}`);
      console.log(`   Class ID: ${pendingReport.classId}\n`);

      const matchingAssignment = await prisma.lecturerAssignment.findFirst({
        where: {
          courseId: pendingReport.courseId,
          classId: pendingReport.classId
        },
        include: {
          lecturer: { select: { username: true } }
        }
      });

      if (matchingAssignment) {
        console.log('✅ MATCH FOUND!');
        console.log(`   Lecturer: ${matchingAssignment.lecturer.username}`);
        console.log(`   The lecturer should now see this report in their portal.`);
      } else {
        console.log('❌ NO MATCH - Something went wrong!');
      }
    } else {
      console.log('No pending reports to verify.');
    }

    console.log('\n✅ Fix complete!');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    await prisma.$disconnect();
    process.exit(0);
  }
}

fixLecturerAssignment();
