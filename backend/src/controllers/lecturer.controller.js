const bcrypt = require('bcryptjs');
const prisma = require('../lib/prisma');
const xlsx = require('xlsx');

/**
 * Upload lecturer assignment spreadsheet and create corresponding users, courses, classes and links.
 */
const uploadLecturerAssignments = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Please upload an Excel or CSV file.' });
    }

    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = xlsx.utils.sheet_to_json(sheet);

    if (rows.length === 0) {
      return res.status(400).json({ error: 'The uploaded sheet is empty.' });
    }

    const results = {
      successCount: 0,
      failedCount: 0,
      errors: [],
      createdLecturers: []
    };

    const tempPassword = 'gctuLecturer123!';
    const hashedPassword = await bcrypt.hash(tempPassword, 10);

    for (let index = 0; index < rows.length; index++) {
      const row = rows[index];
      const rowNum = index + 2; // Row number in sheet (1-indexed + header)

      // Normalize row keys to lower case for case-insensitivity
      const normalizedRow = {};
      Object.keys(row).forEach(key => {
        normalizedRow[key.toLowerCase().trim().replace(/[\s_-]+/g, '')] = row[key];
      });

      // Find values using flexible key matching
      const lecturerName = normalizedRow['lecturername'] || normalizedRow['lecturer'] || normalizedRow['name'];
      const courseCode = normalizedRow['coursecode'] || normalizedRow['code'];
      const courseName = normalizedRow['coursename'] || normalizedRow['course'] || normalizedRow['title'];
      const programmeName = normalizedRow['programme'] || normalizedRow['program'];
      const level = String(normalizedRow['level'] || '').trim();
      const type = String(normalizedRow['type'] || 'REGULAR').toUpperCase().trim();
      const group = String(normalizedRow['group'] || 'A').toUpperCase().trim();
      const session = String(normalizedRow['session'] || 'MORNING').toUpperCase().trim();

      if (!lecturerName || !courseCode || !courseName || !programmeName || !level) {
        results.failedCount++;
        results.errors.push(`Row ${rowNum}: Missing required fields (Lecturer Name, Course Code, Course Name, Programme, or Level)`);
        continue;
      }

      try {
        // 1. Find or create Lecturer User
        let lecturer = await prisma.user.findFirst({
          where: {
            username: { equals: lecturerName.trim(), mode: 'insensitive' },
            role: 'LECTURER'
          }
        });

        if (!lecturer) {
          lecturer = await prisma.user.create({
            data: {
              username: lecturerName.trim(),
              password: hashedPassword,
              role: 'LECTURER',
              isActive: true
            }
          });
          results.createdLecturers.push(lecturerName.trim());
        }

        // 2. Find or create Course
        let course = await prisma.course.findFirst({
          where: {
            OR: [
              { code: { equals: courseCode.trim(), mode: 'insensitive' } },
              { name: { equals: courseName.trim(), mode: 'insensitive' } }
            ]
          }
        });

        if (!course) {
          course = await prisma.course.create({
            data: {
              code: courseCode.trim().toUpperCase(),
              name: courseName.trim()
            }
          });
        }

        // 3. Find or create Programme
        let programme = await prisma.programme.findFirst({
          where: { name: { equals: programmeName.trim(), mode: 'insensitive' } }
        });

        if (!programme) {
          programme = await prisma.programme.create({
            data: { name: programmeName.trim().toUpperCase() }
          });
        }

        // 4. Find or Create Class
        const displayName = `${programme.name} LEVEL ${level} ${type} GROUP ${group} (${session})`;
        let cls = await prisma.class.findFirst({
          where: {
            programmeId: programme.id,
            level: level,
            type: type,
            group: group,
            session: session
          }
        });

        if (!cls) {
          cls = await prisma.class.create({
            data: {
              programmeId: programme.id,
              level: level,
              type: type,
              group: group,
              session: session,
              displayName: displayName
            }
          });
        }

        // 5. Ensure Class-Course link exists (ClassCourse table)
        const existingClassCourse = await prisma.classCourse.findUnique({
          where: {
            classId_courseId: {
              classId: cls.id,
              courseId: course.id
            }
          }
        });

        if (!existingClassCourse) {
          await prisma.classCourse.create({
            data: {
              classId: cls.id,
              courseId: course.id
            }
          });
        }

        // 6. Create LecturerAssignment
        await prisma.lecturerAssignment.upsert({
          where: {
            lecturerId_classId_courseId: {
              lecturerId: lecturer.id,
              classId: cls.id,
              courseId: course.id
            }
          },
          update: {},
          create: {
            lecturerId: lecturer.id,
            classId: cls.id,
            courseId: course.id
          }
        });

        results.successCount++;
      } catch (err) {
        console.error(`Error processing row ${rowNum}:`, err);
        results.failedCount++;
        results.errors.push(`Row ${rowNum}: ${err.message || 'Database error'}`);
      }
    }

    res.json({
      message: `File parsed successfully. ${results.successCount} assignments processed.`,
      results
    });
  } catch (err) {
    console.error('Upload lecturer assignments error:', err);
    res.status(500).json({ error: 'Internal server error while uploading spreadsheet.' });
  }
};

/**
 * Fetch classes assigned to the logged-in lecturer
 */
const getMyClasses = async (req, res) => {
  try {
    const assignments = await prisma.lecturerAssignment.findMany({
      where: { lecturerId: req.user.id },
      include: {
        class: {
          include: {
            programme: true
          }
        },
        course: true
      }
    });

    const formatted = assignments.map(a => ({
      assignmentId: a.id,
      classId: a.class.id,
      classDisplayName: a.class.displayName,
      level: a.class.level,
      group: a.class.group,
      session: a.class.session,
      courseId: a.course.id,
      courseName: a.course.name,
      courseCode: a.course.code
    }));

    res.json(formatted);
  } catch (err) {
    console.error('Get my classes error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Fetch all lecturer assignments (Admin view)
 */
const getAllAssignments = async (req, res) => {
  try {
    const assignments = await prisma.lecturerAssignment.findMany({
      include: {
        lecturer: {
          select: {
            id: true,
            username: true,
            isActive: true
          }
        },
        class: {
          include: {
            programme: true
          }
        },
        course: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    const formatted = assignments.map(a => ({
      id: a.id,
      lecturerId: a.lecturer.id,
      lecturerName: a.lecturer.username,
      lecturerActive: a.lecturer.isActive,
      classId: a.class.id,
      classDisplayName: a.class.displayName,
      courseId: a.course.id,
      courseName: a.course.name,
      courseCode: a.course.code,
      createdAt: a.createdAt
    }));

    res.json(formatted);
  } catch (err) {
    console.error('Get all assignments error:', err);
    res.status(500).json({ error: 'Internal server error while fetching assignments' });
  }
};

/**
 * Delete a specific lecturer assignment (Admin action)
 */
const deleteAssignment = async (req, res) => {
  try {
    const { id } = req.params;

    const assignment = await prisma.lecturerAssignment.findUnique({
      where: { id }
    });

    if (!assignment) {
      return res.status(404).json({ error: 'Lecturer assignment not found' });
    }

    await prisma.lecturerAssignment.delete({
      where: { id }
    });

    res.json({ message: 'Assignment deleted successfully' });
  } catch (err) {
    console.error('Delete assignment error:', err);
    res.status(500).json({ error: 'Internal server error while deleting assignment' });
  }
};

module.exports = {
  uploadLecturerAssignments,
  getMyClasses,
  getAllAssignments,
  deleteAssignment
};

