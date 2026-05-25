const bcrypt = require('bcryptjs');
const prisma = require('../lib/prisma');
const xlsx = require('xlsx');
const { PDFParse } = require('pdf-parse');
const { normalizeProgrammeName, isValidProgramme, getSuggestions } = require('../lib/programmeMapper');
const { cache, cacheKeys } = require('../lib/redis');
const { logAudit } = require('../lib/logger');

// ==========================================
// PROGRAMME MANAGEMENT
// ==========================================

const createProgramme = async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Programme name is required' });
    }

    const existing = await prisma.programme.findUnique({ where: { name } });
    if (existing) {
      return res.status(400).json({ error: 'Programme name already exists' });
    }

    const programme = await prisma.programme.create({
      data: { name }
    });

    // Invalidate programmes cache
    await cache.del(cacheKeys.programmes());

    res.status(201).json(programme);
  } catch (err) {
    console.error('Create programme error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getAllProgrammes = async (req, res) => {
  try {
    // Try cache first
    const cacheKey = cacheKeys.programmes();
    const cached = await cache.get(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    // Cache miss - fetch from database
    const programmes = await prisma.programme.findMany({
      include: {
        _count: { select: { classes: true } }
      },
      orderBy: { name: 'asc' }
    });

    // Cache for 10 minutes
    await cache.set(cacheKey, programmes, 600);

    res.json(programmes);
  } catch (err) {
    console.error('Get programmes error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const deleteProgramme = async (req, res) => {
  try {
    const { id } = req.params;

    const classCount = await prisma.class.count({ where: { programmeId: id } });
    if (classCount > 0) {
      return res.status(400).json({ error: 'Cannot delete programme with classes linked to it' });
    }

    await prisma.programme.delete({ where: { id } });
    
    // Invalidate programmes cache and stats
    await cache.del(cacheKeys.programmes());
    await cache.del(cacheKeys.stats());
    
    res.json({ message: 'Programme deleted successfully' });
  } catch (err) {
    console.error('Delete programme error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const updateProgramme = async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Programme name is required' });
    }

    // Check if name already exists (excluding current programme)
    const existing = await prisma.programme.findFirst({
      where: {
        name: name.trim(),
        NOT: { id }
      }
    });

    if (existing) {
      return res.status(400).json({ error: 'Programme name already exists' });
    }

    const updated = await prisma.programme.update({
      where: { id },
      data: { name: name.trim() }
    });

    // Invalidate programmes cache
    await cache.del(cacheKeys.programmes());

    res.json(updated);
  } catch (err) {
    console.error('Update programme error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ==========================================
// CLASS MANAGEMENT
// ==========================================

const createClass = async (req, res) => {
  try {
    // Accept either 'groups' (array from multi-step creator) or 'group' (single string)
    const { programmeId, level, type, session } = req.body;
    const group = req.body.groups || req.body.group;

    if (!programmeId || !level || !type || !group || !session) {
      return res.status(400).json({ error: 'Programme, level, type, group, and session are required' });
    }

    const programme = await prisma.programme.findUnique({ where: { id: programmeId } });
    if (!programme) {
      return res.status(404).json({ error: 'Programme not found' });
    }

    // group can be a string (e.g. "A") or an array of strings (e.g. ["A", "B", "C"])
    const groups = Array.isArray(group) ? group : [group];
    const createdClasses = [];
    const skippedClasses = [];

    for (const g of groups) {
      const groupLetter = g.toUpperCase();
      const displayName = `${programme.name} LEVEL ${level} ${type} GROUP ${groupLetter} (${session})`;

      // Check duplicate
      const existing = await prisma.class.findFirst({
        where: {
          programmeId,
          level,
          type,
          group: groupLetter,
          session
        }
      });

      if (existing) {
        skippedClasses.push(displayName);
        continue;
      }

      const newClass = await prisma.class.create({
        data: {
          programmeId,
          level,
          type,
          group: groupLetter,
          session,
          displayName
        }
      });
      createdClasses.push(newClass);
      
      // Log class creation
      logAudit('CLASS_CREATED', {
        user: req.user?.username || 'system',
        userId: req.user?.id,
        ip: req.ip,
        classId: newClass.id,
        className: displayName,
        programme: programme.name,
        level,
        type,
        group: groupLetter,
        session
      });
    }

    res.status(201).json({
      message: `Created ${createdClasses.length} classes. Skipped ${skippedClasses.length} duplicates.`,
      created: createdClasses,
      skipped: skippedClasses
    });

    // Invalidate classes cache and stats
    await cache.del(cacheKeys.classes());
    await cache.del(cacheKeys.stats());
  } catch (err) {
    console.error('Create class error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getAllClasses = async (req, res) => {
  try {
    // Check for pagination
    const usePagination = req.query.page || req.query.limit;
    
    if (usePagination) {
      // Paginated response
      const [classes, total] = await Promise.all([
        prisma.class.findMany({
          skip: req.pagination.skip,
          take: req.pagination.limit,
          include: {
            programme: true,
            rep: { select: { id: true, username: true } },
            _count: { select: { students: true, courses: true } }
          },
          orderBy: { displayName: 'asc' }
        }),
        prisma.class.count()
      ]);
      
      return res.json(req.pagination.createResponse(classes, total));
    }
    
    // Try cache first (non-paginated)
    const cacheKey = cacheKeys.classes();
    const cached = await cache.get(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    // Cache miss - fetch from database
    const classes = await prisma.class.findMany({
      include: {
        programme: true,
        rep: { select: { id: true, username: true } },
        _count: { select: { students: true, courses: true } }
      },
      orderBy: { displayName: 'asc' }
    });

    // Cache for 5 minutes
    await cache.set(cacheKey, classes, 300);

    res.json(classes);
  } catch (err) {
    console.error('Get all classes error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getClassById = async (req, res) => {
  try {
    const { id } = req.params;

    // Try cache first
    const cacheKey = cacheKeys.class(id);
    const cached = await cache.get(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    // Cache miss - fetch from database
    const classRecord = await prisma.class.findUnique({
      where: { id },
      include: {
        programme: true,
        rep: { select: { id: true, username: true } },
        students: { include: { student: true } },
        courses: { include: { course: true } }
      }
    });

    if (!classRecord) {
      return res.status(404).json({ error: 'Class not found' });
    }

    // Cache for 5 minutes
    await cache.set(cacheKey, classRecord, 300);

    res.json(classRecord);
  } catch (err) {
    console.error('Get class by ID error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const updateClass = async (req, res) => {
  try {
    const { id } = req.params;
    const { level, type, group, session } = req.body;

    const existingClass = await prisma.class.findUnique({
      where: { id },
      include: { programme: true }
    });

    if (!existingClass) {
      return res.status(404).json({ error: 'Class not found' });
    }

    const nextLevel = level || existingClass.level;
    const nextType = type || existingClass.type;
    const nextGroup = (group || existingClass.group).toUpperCase();
    const nextSession = session || existingClass.session;
    const displayName = `${existingClass.programme.name} LEVEL ${nextLevel} ${nextType} GROUP ${nextGroup} (${nextSession})`;

    // Check duplicate if values changed
    if (
      nextLevel !== existingClass.level ||
      nextType !== existingClass.type ||
      nextGroup !== existingClass.group ||
      nextSession !== existingClass.session
    ) {
      const duplicate = await prisma.class.findFirst({
        where: {
          id: { not: id },
          programmeId: existingClass.programmeId,
          level: nextLevel,
          type: nextType,
          group: nextGroup,
          session: nextSession
        }
      });
      if (duplicate) {
        return res.status(400).json({ error: 'A class with these specifications already exists' });
      }
    }

    const updated = await prisma.class.update({
      where: { id },
      data: {
        level: nextLevel,
        type: nextType,
        group: nextGroup,
        session: nextSession,
        displayName
      }
    });

    // Invalidate class caches
    await cache.del(cacheKeys.class(id));
    await cache.del(cacheKeys.classes());

    res.json(updated);
  } catch (err) {
    console.error('Update class error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const deleteClass = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get class details before deletion for logging
    const classToDelete = await prisma.class.findUnique({
      where: { id },
      include: { programme: true }
    });
    
    if (!classToDelete) {
      return res.status(404).json({ error: 'Class not found' });
    }
    
    await prisma.class.delete({ where: { id } });
    
    // Log class deletion
    logAudit('CLASS_DELETED', {
      user: req.user?.username || 'system',
      userId: req.user?.id,
      ip: req.ip,
      classId: id,
      className: classToDelete.displayName,
      programme: classToDelete.programme?.name
    });
    
    // Invalidate class caches and stats
    await cache.del(cacheKeys.class(id));
    await cache.del(cacheKeys.classes());
    await cache.del(cacheKeys.stats());
    
    res.json({ message: 'Class deleted successfully' });
  } catch (err) {
    console.error('Delete class error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const assignRep = async (req, res) => {
  try {
    const { id } = req.params; // class ID
    const { repId } = req.body;

    if (!repId) {
      return res.status(400).json({ error: 'Representative User ID is required' });
    }

    // Verify rep exists and is role REP
    const repUser = await prisma.user.findUnique({ where: { id: repId } });
    if (!repUser || repUser.role !== 'REP') {
      return res.status(400).json({ error: 'User is not a valid Class Representative' });
    }

    // Verify rep is not already assigned to another class
    const alreadyAssigned = await prisma.class.findFirst({
      where: { repId, id: { not: id } }
    });

    if (alreadyAssigned) {
      return res.status(400).json({ error: `This representative is already assigned to: ${alreadyAssigned.displayName}` });
    }

    // If rep has an index number, create/update student record and link to class
    if (repUser.indexNumber) {
      // Create or update student record for the rep
      const repStudent = await prisma.student.upsert({
        where: { indexNumber: repUser.indexNumber },
        update: {
          name: repUser.username,
          email: `${repUser.indexNumber}@rep.gctu.edu.gh`
        },
        create: {
          indexNumber: repUser.indexNumber,
          name: repUser.username,
          email: `${repUser.indexNumber}@rep.gctu.edu.gh`
        }
      });

      // Link rep as student to the class
      await prisma.classStudent.upsert({
        where: {
          classId_studentId: {
            classId: id,
            studentId: repStudent.id
          }
        },
        update: {},
        create: {
          classId: id,
          studentId: repStudent.id
        }
      });
    }

    // Update the class with repId
    const updated = await prisma.class.update({
      where: { id },
      data: { repId },
      include: { rep: { select: { id: true, username: true, indexNumber: true } } }
    });

    // Invalidate class and reps caches
    await cache.del(cacheKeys.class(id));
    await cache.del(cacheKeys.classes());
    await cache.del(cacheKeys.reps());

    res.json(updated);
  } catch (err) {
    console.error('Assign rep error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const removeRep = async (req, res) => {
  try {
    const { id } = req.params; // class ID

    const updated = await prisma.class.update({
      where: { id },
      data: { repId: null }
    });

    // Invalidate class and reps caches
    await cache.del(cacheKeys.class(id));
    await cache.del(cacheKeys.classes());
    await cache.del(cacheKeys.reps());

    res.json(updated);
  } catch (err) {
    console.error('Remove rep error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ==========================================
// STUDENT MANAGEMENT PER CLASS
// ==========================================

const addStudentsToClass = async (req, res) => {
  try {
    const { id } = req.params; // class ID
    const { students } = req.body; // Array: [{indexNumber, name, email}]

    if (!Array.isArray(students)) {
      return res.status(400).json({ error: 'Students must be a JSON array' });
    }

    const classRecord = await prisma.class.findUnique({ where: { id } });
    if (!classRecord) {
      return res.status(404).json({ error: 'Class not found' });
    }

    let addedCount = 0;
    let skippedCount = 0;
    const errors = [];

    for (const item of students) {
      try {
        const { indexNumber, name, email } = item;
        if (!indexNumber || !name) {
          skippedCount++;
          errors.push(`Missing indexNumber or name for: ${JSON.stringify(item)}`);
          continue;
        }

        const studentEmail = email || `${indexNumber}@student.gctu.edu.gh`;

        // Upsert student
        const student = await prisma.student.upsert({
          where: { indexNumber },
          update: { name, email: studentEmail },
          create: { indexNumber, name, email: studentEmail }
        });

        // Link student via ClassStudent - use upsert to handle race conditions
        try {
          await prisma.classStudent.upsert({
            where: {
              classId_studentId: {
                classId: id,
                studentId: student.id
              }
            },
            update: {}, // No update needed, just ensure it exists
            create: {
              classId: id,
              studentId: student.id
            }
          });
          addedCount++;
        } catch (upsertError) {
          // If upsert fails due to race condition, count as skipped
          if (upsertError.code === 'P2002') {
            skippedCount++;
          } else {
            throw upsertError; // Re-throw other errors
          }
        }
      } catch (e) {
        skippedCount++;
        errors.push(e.message);
      }
    }

    res.json({ addedCount, skippedCount, errors });

    // Log student upload
    logAudit('STUDENTS_UPLOADED', {
      user: req.user?.username || 'system',
      userId: req.user?.id,
      ip: req.ip,
      classId: id,
      className: classRecord.displayName,
      studentsAdded: addedCount,
      studentsSkipped: skippedCount,
      totalAttempted: students.length
    });

    // Invalidate cache for this class
    await cache.del(cacheKeys.classStudents(id));
    await cache.del(cacheKeys.class(id));
    await cache.del(cacheKeys.classes());
  } catch (err) {
    console.error('Add students to class error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const removeStudentFromClass = async (req, res) => {
  try {
    const { id, studentId } = req.params;

    await prisma.classStudent.deleteMany({
      where: { classId: id, studentId }
    });

    // Invalidate cache for this class
    await cache.del(cacheKeys.classStudents(id));
    await cache.del(cacheKeys.class(id));
    await cache.del(cacheKeys.classes());

    res.json({ message: 'Student removed from class successfully' });
  } catch (err) {
    console.error('Remove student from class error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const bulkDeleteStudentsFromClass = async (req, res) => {
  try {
    const { id } = req.params; // Class ID
    const { studentIds } = req.body;

    if (!studentIds || !Array.isArray(studentIds) || studentIds.length === 0) {
      return res.status(400).json({ error: 'studentIds array is required' });
    }

    const result = await prisma.classStudent.deleteMany({
      where: {
        classId: id,
        studentId: { in: studentIds }
      }
    });

    // Invalidate cache for this class
    await cache.del(cacheKeys.classStudents(id));
    await cache.del(cacheKeys.class(id));
    await cache.del(cacheKeys.classes());

    res.json({
      message: `${result.count} student(s) removed from class successfully`,
      count: result.count
    });
  } catch (err) {
    console.error('Bulk delete students error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getClassStudents = async (req, res) => {
  try {
    const { id } = req.params; // Class ID
    
    // Check for pagination
    const usePagination = req.query.page || req.query.limit;

    // Try cache first (shorter TTL since attendance changes frequently)
    if (!usePagination) {
      const cacheKey = cacheKeys.classStudents(id);
      const cached = await cache.get(cacheKey);
      if (cached) {
        return res.json(cached);
      }
    }

    const classRecord = await prisma.class.findUnique({
      where: { id },
      include: {
        courses: { select: { courseId: true } }
      }
    });

    if (!classRecord) {
      return res.status(404).json({ error: 'Class not found' });
    }

    // Get all students linked to this class
    const classStudentsQuery = {
      where: { classId: id },
      include: { student: true }
    };
    
    if (usePagination) {
      classStudentsQuery.skip = req.pagination.skip;
      classStudentsQuery.take = req.pagination.limit;
    }
    
    const classStudents = await prisma.classStudent.findMany(classStudentsQuery);

    // Find all closed or approved attendance sessions for this class
    const sessions = await prisma.attendanceSession.findMany({
      where: {
        classId: id,
        status: { in: ['CLOSED', 'APPROVED'] }
      },
      select: { id: true }
    });

    const totalSessions = sessions.length;
    const sessionIds = sessions.map(s => s.id);

    const studentsData = await Promise.all(classStudents.map(async (cs) => {
      const student = cs.student;

      const presentOrLateCount = totalSessions > 0 ? await prisma.attendance.count({
        where: {
          studentId: student.id,
          sessionId: { in: sessionIds },
          status: { in: ['PRESENT', 'LATE'] }
        }
      }) : 0;

      const attendanceRate = totalSessions > 0
        ? Math.round((presentOrLateCount / totalSessions) * 100)
        : 100;

      return {
        id: student.id,
        name: student.name,
        indexNumber: student.indexNumber,
        email: student.email,
        attendanceRate
      };
    }));

    if (usePagination) {
      const total = await prisma.classStudent.count({ where: { classId: id } });
      return res.json(req.pagination.createResponse(studentsData, total));
    }

    // Cache for 2 minutes (shorter since attendance changes)
    await cache.set(cacheKeys.classStudents(id), studentsData, 120);

    res.json(studentsData);
  } catch (err) {
    console.error('Get class students error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Rep-specific endpoint to get their own class students
const getRepClassStudents = async (req, res) => {
  try {
    // Find the class assigned to this rep
    const repClass = await prisma.class.findFirst({
      where: { repId: req.user.id }
    });

    if (!repClass) {
      return res.status(404).json({ error: 'You are not assigned to any class' });
    }

    // Get all students linked to this class
    const classStudents = await prisma.classStudent.findMany({
      where: { classId: repClass.id },
      include: { 
        student: {
          select: {
            id: true,
            name: true,
            indexNumber: true,
            email: true
          }
        }
      },
      orderBy: {
        student: {
          indexNumber: 'asc'
        }
      }
    });

    // Return simplified student data
    const studentsData = classStudents.map(cs => cs.student);

    res.json(studentsData);
  } catch (err) {
    console.error('Get rep class students error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const bulkImportClassStudents = async (req, res) => {
  try {
    const { id } = req.params;

    if (!req.file) {
      return res.status(400).json({ error: 'No CSV file uploaded' });
    }

    const csvText = req.file.buffer.toString('utf-8');
    const lines = csvText.split(/\r?\n/);
    const parsedStudents = [];
    
    let startIdx = 0;
    if (lines.length > 0) {
      const firstLine = lines[0].toLowerCase();
      if (firstLine.includes('index') || firstLine.includes('name') || firstLine.includes('email')) {
        startIdx = 1;
      }
    }

    for (let i = startIdx; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const cols = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(c => c.replace(/^"|"$/g, '').trim());
      if (cols.length >= 2) {
        parsedStudents.push({
          indexNumber: cols[0],
          name: cols[1],
          email: cols[2] || `${cols[0]}@student.gctu.edu.gh`
        });
      }
    }

    let addedCount = 0;
    let skippedCount = 0;
    const errors = [];

    for (const std of parsedStudents) {
      try {
        const student = await prisma.student.upsert({
          where: { indexNumber: std.indexNumber },
          update: { name: std.name, email: std.email },
          create: { indexNumber: std.indexNumber, name: std.name, email: std.email }
        });

        // Use upsert to handle race conditions
        try {
          await prisma.classStudent.upsert({
            where: {
              classId_studentId: { classId: id, studentId: student.id }
            },
            update: {}, // No update needed
            create: {
              classId: id,
              studentId: student.id
            }
          });
          addedCount++;
        } catch (upsertError) {
          // Handle race condition
          if (upsertError.code === 'P2002') {
            skippedCount++;
          } else {
            throw upsertError;
          }
        }
      } catch (e) {
        skippedCount++;
        errors.push(`Error with student ${std.indexNumber}: ${e.message}`);
      }
    }

    res.json({
      message: `Successfully processed CSV file.`,
      addedCount,
      skippedCount,
      errors
    });
  } catch (err) {
    console.error('CSV import error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ==========================================
// COURSE MANAGEMENT PER CLASS
// ==========================================

const addCourseToClass = async (req, res) => {
  try {
    const { id } = req.params; // class ID
    const { courseId } = req.body;

    if (!courseId) {
      return res.status(400).json({ error: 'Course ID is required' });
    }

    const existingLink = await prisma.classCourse.findUnique({
      where: {
        classId_courseId: { classId: id, courseId }
      }
    });

    if (existingLink) {
      return res.status(400).json({ error: 'Course is already linked to this class' });
    }

    const newLink = await prisma.classCourse.create({
      data: { classId: id, courseId }
    });

    res.status(201).json(newLink);
  } catch (err) {
    console.error('Add course to class error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const removeCourseFromClass = async (req, res) => {
  try {
    const { id, courseId } = req.params;

    await prisma.classCourse.deleteMany({
      where: { classId: id, courseId }
    });

    res.json({ message: 'Course unlinked from class successfully' });
  } catch (err) {
    console.error('Remove course from class error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getClassCourses = async (req, res) => {
  try {
    const { id } = req.params;

    const classCourses = await prisma.classCourse.findMany({
      where: { classId: id },
      include: { course: true }
    });

    res.json(classCourses.map(cc => cc.course));
  } catch (err) {
    console.error('Get class courses error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ==========================================
// REPRESENTATIVE ACCOUNT MANAGEMENT
// ==========================================

const createRepAccount = async (req, res) => {
  try {
    const { username, password, indexNumber } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    if (!indexNumber) {
      return res.status(400).json({ error: 'Index number is required for rep accounts' });
    }

    const existing = await prisma.user.findUnique({ where: { username } });
    if (existing) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    // Check if index number is already taken
    const existingIndex = await prisma.user.findUnique({ where: { indexNumber } });
    if (existingIndex) {
      return res.status(400).json({ error: 'Index number already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await prisma.user.create({
      data: {
        username,
        indexNumber,
        password: hashedPassword,
        role: 'REP',
        isActive: true
      }
    });

    // Also create a student record for the rep so they can check in
    try {
      await prisma.student.create({
        data: {
          indexNumber: indexNumber,
          name: username, // Use username as name initially
          email: `${indexNumber}@student.edu`, // Generate a default email
          password: hashedPassword, // Same password as user account
          isFirstLogin: false // Rep already has password
        }
      });
    } catch (studentErr) {
      // If student already exists, that's okay - they might have been added to a class already
      console.log('Student record already exists for rep:', indexNumber);
    }

    res.status(201).json({
      id: newUser.id,
      username: newUser.username,
      indexNumber: newUser.indexNumber,
      role: newUser.role,
      isActive: newUser.isActive
    });

    // Invalidate reps cache and stats
    await cache.del(cacheKeys.reps());
    await cache.del(cacheKeys.stats());
  } catch (err) {
    console.error('Create rep account error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getAllReps = async (req, res) => {
  try {
    // Try cache first
    const cacheKey = cacheKeys.reps();
    const cached = await cache.get(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    // Cache miss - fetch from database
    const reps = await prisma.user.findMany({
      where: { role: 'REP' },
      include: { assignedClass: true },
      orderBy: { username: 'asc' }
    });

    const formatted = reps.map(r => ({
      id: r.id,
      username: r.username,
      isActive: r.isActive,
      assignedClass: r.assignedClass ? {
        id: r.assignedClass.id,
        displayName: r.assignedClass.displayName
      } : null
    }));

    // Cache for 5 minutes
    await cache.set(cacheKey, formatted, 300);

    res.json(formatted);
  } catch (err) {
    console.error('Get all reps error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const resetRepPassword = async (req, res) => {
  try {
    const { id } = req.params;
    // Accept either 'password' (sent by frontend) or 'newPassword'
    const newPassword = req.body.password || req.body.newPassword;

    if (!newPassword) {
      return res.status(400).json({ error: 'New password is required' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id },
      data: { password: hashedPassword }
    });

    res.json({ message: 'Password reset successfully' });
  } catch (err) {
    console.error('Reset rep password error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const updateRep = async (req, res) => {
  try {
    const { id } = req.params;
    const { username, indexNumber } = req.body;

    if (!username && !indexNumber) {
      return res.status(400).json({ error: 'At least one field (username or indexNumber) is required' });
    }

    const rep = await prisma.user.findUnique({ where: { id } });
    if (!rep || rep.role !== 'REP') {
      return res.status(404).json({ error: 'Representative account not found' });
    }

    // Check for duplicate username (excluding current rep)
    if (username && username !== rep.username) {
      const existingUsername = await prisma.user.findUnique({ where: { username } });
      if (existingUsername) {
        return res.status(400).json({ error: 'Username already exists' });
      }
    }

    // Check for duplicate index number (excluding current rep)
    if (indexNumber && indexNumber !== rep.indexNumber) {
      const existingIndex = await prisma.user.findUnique({ where: { indexNumber } });
      if (existingIndex) {
        return res.status(400).json({ error: 'Index number already exists' });
      }
    }

    // Update user record
    const updateData = {};
    if (username) updateData.username = username;
    if (indexNumber) updateData.indexNumber = indexNumber;

    const updated = await prisma.user.update({
      where: { id },
      data: updateData
    });

    // If index number is being added/updated, ensure student record exists
    if (indexNumber) {
      try {
        const existingStudent = await prisma.student.findUnique({
          where: { indexNumber }
        });

        if (!existingStudent) {
          // Create student record for the rep
          await prisma.student.create({
            data: {
              indexNumber: indexNumber,
              name: username || rep.username,
              email: `${indexNumber}@student.edu`,
              password: rep.password, // Use same password hash
              isFirstLogin: false
            }
          });
        } else {
          // Update existing student record name if username changed
          if (username) {
            await prisma.student.update({
              where: { indexNumber },
              data: { name: username }
            });
          }
        }
      } catch (studentErr) {
        console.log('Student record handling:', studentErr.message);
      }
    }

    res.json({
      id: updated.id,
      username: updated.username,
      indexNumber: updated.indexNumber,
      role: updated.role,
      isActive: updated.isActive
    });

    // Invalidate reps cache
    await cache.del(cacheKeys.reps());
  } catch (err) {
    console.error('Update rep error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const deactivateRep = async (req, res) => {
  try {
    const { id } = req.params;
    
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user || user.role !== 'REP') {
      return res.status(404).json({ error: 'Representative account not found' });
    }

    const updated = await prisma.user.update({
      where: { id },
      data: { isActive: !user.isActive }
    });

    res.json({
      message: `Account ${updated.isActive ? 'activated' : 'deactivated'} successfully`,
      isActive: updated.isActive
    });

    // Invalidate reps cache
    await cache.del(cacheKeys.reps());
  } catch (err) {
    console.error('Deactivate rep error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const deleteRepAccount = async (req, res) => {
  try {
    const { id } = req.params;

    // Unlink the class before deletion
    await prisma.class.updateMany({
      where: { repId: id },
      data: { repId: null }
    });

    await prisma.user.delete({ where: { id } });
    
    // Invalidate reps cache and stats
    await cache.del(cacheKeys.reps());
    await cache.del(cacheKeys.stats());
    
    res.json({ message: 'Representative account deleted successfully' });
  } catch (err) {
    console.error('Delete rep account error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Bulk Upload Reps from Excel/CSV
 * Expected columns: indexNumber, name, email, programme, level, type, group, session
 */
const bulkUploadReps = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const filename = req.file.originalname.toLowerCase();
    if (!filename.endsWith('.xlsx') && !filename.endsWith('.xls') && !filename.endsWith('.csv')) {
      return res.status(400).json({ error: 'Only Excel (.xlsx, .xls) or CSV files are supported' });
    }

    // Parse Excel/CSV
    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      return res.status(400).json({ error: 'Uploaded spreadsheet is empty' });
    }

    const sheet = workbook.Sheets[sheetName];
    const rows = xlsx.utils.sheet_to_json(sheet, { header: 1 });

    if (rows.length === 0) {
      return res.status(400).json({ error: 'No data rows found in sheet' });
    }

    // Detect header row
    const headerRow = rows[0] || [];
    let indexColIdx = -1;
    let nameColIdx = -1;
    let emailColIdx = -1;
    let programmeColIdx = -1;
    let levelColIdx = -1;
    let typeColIdx = -1;
    let groupColIdx = -1;
    let sessionColIdx = -1;

    for (let i = 0; i < headerRow.length; i++) {
      const val = String(headerRow[i] || '').toLowerCase().trim();
      if (val.includes('index')) indexColIdx = i;
      else if (val.includes('name')) nameColIdx = i;
      else if (val.includes('email')) emailColIdx = i;
      else if (val.includes('programme') || val.includes('program')) programmeColIdx = i;
      else if (val.includes('level')) levelColIdx = i;
      else if (val.includes('type')) typeColIdx = i;
      else if (val.includes('group')) groupColIdx = i;
      else if (val.includes('session')) sessionColIdx = i;
    }

    // Fallback defaults
    if (indexColIdx === -1) indexColIdx = 0;
    if (nameColIdx === -1) nameColIdx = 1;
    if (emailColIdx === -1) emailColIdx = 2;
    if (programmeColIdx === -1) programmeColIdx = 3;
    if (levelColIdx === -1) levelColIdx = 4;
    if (typeColIdx === -1) typeColIdx = 5;
    if (groupColIdx === -1) groupColIdx = 6;
    if (sessionColIdx === -1) sessionColIdx = 7;

    let createdCount = 0;
    let skippedCount = 0;
    const errors = [];

    // Process rows (skip header)
    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      if (!row || row.length === 0) continue;

      try {
        const indexNumber = String(row[indexColIdx] || '').trim();
        const name = String(row[nameColIdx] || '').trim();
        const email = String(row[emailColIdx] || '').trim() || `${indexNumber}@rep.gctu.edu.gh`;
        const programmeName = String(row[programmeColIdx] || '').trim();
        const level = String(row[levelColIdx] || '').trim();
        const type = String(row[typeColIdx] || '').trim().toUpperCase();
        const group = String(row[groupColIdx] || '').trim().toUpperCase();
        const session = String(row[sessionColIdx] || '').trim().toUpperCase();

        if (!indexNumber || !name) {
          skippedCount++;
          errors.push(`Row ${r + 1}: Missing index number or name`);
          continue;
        }

        // Check if rep already exists
        const existingUser = await prisma.user.findFirst({
          where: {
            OR: [
              { username: indexNumber },
              { indexNumber: indexNumber }
            ]
          }
        });

        if (existingUser) {
          skippedCount++;
          errors.push(`Row ${r + 1}: Rep with index ${indexNumber} already exists`);
          continue;
        }

        // Normalize and validate programme name
        const normalizedProgrammeName = normalizeProgrammeName(programmeName);
        
        if (!normalizedProgrammeName) {
          skippedCount++;
          const suggestions = getSuggestions(programmeName);
          const suggestionText = suggestions.length > 0 
            ? ` Did you mean: ${suggestions.join(', ')}?` 
            : '';
          errors.push(`Row ${r + 1}: Invalid programme "${programmeName}".${suggestionText}`);
          continue;
        }

        // Find or create programme using normalized name
        let programme = await prisma.programme.findUnique({ where: { name: normalizedProgrammeName } });
        if (!programme) {
          programme = await prisma.programme.create({ data: { name: normalizedProgrammeName } });
        }

        // Find or create class
        let classRecord = null;
        if (programme && level && type && group && session) {
          const displayName = `${normalizedProgrammeName} LEVEL ${level} ${type} GROUP ${group} (${session})`;
          
          classRecord = await prisma.class.findFirst({
            where: {
              programmeId: programme.id,
              level,
              type,
              group,
              session
            }
          });

          if (!classRecord) {
            classRecord = await prisma.class.create({
              data: {
                programmeId: programme.id,
                level,
                type,
                group,
                session,
                displayName
              }
            });
          }
        }

        // Create rep user with default password "rep123"
        const hashedPassword = await bcrypt.hash('rep123', 10);
        
        const newRep = await prisma.user.create({
          data: {
            username: indexNumber, // Use index number as username
            indexNumber: indexNumber,
            password: hashedPassword,
            role: 'REP',
            isActive: true
          }
        });

        // Create student record for the rep (so they can mark attendance)
        const repStudent = await prisma.student.upsert({
          where: { indexNumber: indexNumber },
          update: {
            name: name,
            email: email
          },
          create: {
            indexNumber: indexNumber,
            name: name,
            email: email
          }
        });

        // Assign rep to class if class exists and doesn't have a rep
        if (classRecord && !classRecord.repId) {
          await prisma.class.update({
            where: { id: classRecord.id },
            data: { repId: newRep.id }
          });

          // Link rep as student to the class
          await prisma.classStudent.upsert({
            where: {
              classId_studentId: {
                classId: classRecord.id,
                studentId: repStudent.id
              }
            },
            update: {},
            create: {
              classId: classRecord.id,
              studentId: repStudent.id
            }
          });
        }

        createdCount++;
      } catch (e) {
        skippedCount++;
        errors.push(`Row ${r + 1}: ${e.message}`);
      }
    }

    res.json({
      message: `Bulk upload completed. Created ${createdCount} reps, skipped ${skippedCount}.`,
      createdCount,
      skippedCount,
      errors: errors.slice(0, 20) // Limit error messages
    });

    // Invalidate reps cache, classes cache, and stats
    await cache.del(cacheKeys.reps());
    await cache.del(cacheKeys.classes());
    await cache.del(cacheKeys.stats());
  } catch (err) {
    console.error('Bulk upload reps error:', err);
    res.status(500).json({ error: 'Internal server error: ' + err.message });
  }
};

// ==========================================
// SYSTEM SETTINGS
// ==========================================

const getSettings = async (req, res) => {
  try {
    let settings = await prisma.systemSettings.findFirst();
    if (!settings) {
      settings = await prisma.systemSettings.create({
        data: {
          deptName: 'Ghana Communication Technology University',
          deptLogoUrl: '/logo.jfif',
          lateWindowMinutes: 15,
          qrExpirySeconds: 25,
          geofenceRadiusMeters: 100
        }
      });
    }
    res.json(settings);
  } catch (err) {
    console.error('Get settings error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const updateSettings = async (req, res) => {
  try {
    const { deptName, deptLogoUrl, lateWindowMinutes, qrExpirySeconds, geofenceRadiusMeters } = req.body;

    let settings = await prisma.systemSettings.findFirst();

    if (!settings) {
      settings = await prisma.systemSettings.create({
        data: {
          deptName: deptName || 'Ghana Communication Technology University',
          deptLogoUrl: deptLogoUrl || '/logo.jfif',
          lateWindowMinutes: lateWindowMinutes ? parseInt(lateWindowMinutes) : 15,
          qrExpirySeconds: qrExpirySeconds ? parseInt(qrExpirySeconds) : 25,
          geofenceRadiusMeters: geofenceRadiusMeters ? parseInt(geofenceRadiusMeters) : 100
        }
      });
    } else {
      settings = await prisma.systemSettings.update({
        where: { id: settings.id },
        data: {
          deptName: deptName !== undefined ? deptName : settings.deptName,
          deptLogoUrl: deptLogoUrl !== undefined ? deptLogoUrl : settings.deptLogoUrl,
          lateWindowMinutes: lateWindowMinutes !== undefined ? parseInt(lateWindowMinutes) : settings.lateWindowMinutes,
          qrExpirySeconds: qrExpirySeconds !== undefined ? parseInt(qrExpirySeconds) : settings.qrExpirySeconds,
          geofenceRadiusMeters: geofenceRadiusMeters !== undefined ? parseInt(geofenceRadiusMeters) : settings.geofenceRadiusMeters
        }
      });
    }

    res.json(settings);
  } catch (err) {
    console.error('Update settings error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const uploadLogo = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    // Return local access URL
    const logoUrl = `/uploads/${req.file.filename}`;
    
    // Save to settings
    let settings = await prisma.systemSettings.findFirst();
    if (settings) {
      await prisma.systemSettings.update({
        where: { id: settings.id },
        data: { deptLogoUrl: logoUrl }
      });
    }

    res.json({ logoUrl });
  } catch (err) {
    console.error('Upload logo error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ==========================================
const parseImportFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const filename = req.file.originalname.toLowerCase();
    const parsedStudents = [];

    if (filename.endsWith('.pdf')) {
      // PDF text extraction
      const parser = new PDFParse({ data: req.file.buffer });
      const data = await parser.getText();
      const text = data.text;
      const lines = text.split(/\r?\n/);

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        // Regex for Email and Index Number (7 to 12 digits)
        const emailMatch = trimmed.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
        const indexMatch = trimmed.match(/\b\d{7,12}\b/);

        if (indexMatch) {
          const indexNumber = indexMatch[0];
          const email = emailMatch ? emailMatch[0] : `${indexNumber}@student.gctu.edu.gh`;

          // Extract name: clean line from index number and email
          let namePart = trimmed
            .replace(emailMatch ? emailMatch[0] : '', '')
            .replace(indexNumber, '')
            .trim();

          // Remove prefixes like "1.", "12.", "03 -", etc.
          namePart = namePart.replace(/^\s*\d+[\s.)-]*|^\s*[-•]\s*/g, '').trim();

          // Remove redundant multiple spaces
          namePart = namePart.replace(/\s+/g, ' ');

          // Validate name length to avoid junk matches
          if (namePart && namePart.length >= 2) {
            parsedStudents.push({
              indexNumber,
              name: namePart,
              email
            });
          }
        }
      }
    } else if (filename.endsWith('.xlsx') || filename.endsWith('.xls') || filename.endsWith('.csv')) {
      // Excel/CSV parsing via sheetJS
      const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      if (!sheetName) {
        return res.status(400).json({ error: 'Uploaded spreadsheet is empty' });
      }

      const sheet = workbook.Sheets[sheetName];
      const rows = xlsx.utils.sheet_to_json(sheet, { header: 1 }); // read as array of arrays

      if (rows.length === 0) {
        return res.status(400).json({ error: 'No data rows found in sheet' });
      }

      // Check header row for index, name, and email column positions
      let headerRow = rows[0] || [];
      let indexColIdx = -1;
      let nameColIdx = -1;
      let emailColIdx = -1;

      for (let i = 0; i < headerRow.length; i++) {
        const val = String(headerRow[i] || '').toLowerCase().trim();
        if (val.includes('index')) indexColIdx = i;
        else if (val.includes('name')) nameColIdx = i;
        else if (val.includes('email')) emailColIdx = i;
      }

      // Fallback default mapping: 1st col = index, 2nd col = name, 3rd col = email
      if (indexColIdx === -1) indexColIdx = 0;
      if (nameColIdx === -1) nameColIdx = 1;
      if (emailColIdx === -1) emailColIdx = 2;

      // Extract rows starting from index 1 (skip headers if matched)
      let startIdx = 1;
      const firstRowVal = String(headerRow[indexColIdx] || '').toLowerCase();
      if (!firstRowVal.includes('index') && !firstRowVal.includes('id') && !firstRowVal.includes('number')) {
        startIdx = 0;
      }

      for (let r = startIdx; r < rows.length; r++) {
        const row = rows[r];
        if (!row || row.length === 0) continue;

        const indexNumber = String(row[indexColIdx] || '').trim();
        const name = String(row[nameColIdx] || '').trim();
        const email = String(row[emailColIdx] || '').trim();

        if (indexNumber && name) {
          parsedStudents.push({
            indexNumber,
            name,
            email: email || `${indexNumber}@student.gctu.edu.gh`
          });
        }
      }
    } else {
      return res.status(400).json({ error: 'Unsupported file format. Use CSV, Excel, or PDF.' });
    }

    res.json({
      message: `Parsed file successfully. Found ${parsedStudents.length} student records.`,
      students: parsedStudents
    });
  } catch (err) {
    console.error('File parsing error:', err);
    res.status(500).json({ error: 'Failed to parse file: ' + err.message });
  }
};

// ==========================================
// SUPERADMIN STATS
// ==========================================

const getAdminStats = async (req, res) => {
  try {
    // Try cache first (shorter TTL since stats change frequently)
    const cacheKey = cacheKeys.stats();
    const cached = await cache.get(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    // Cache miss - fetch from database
    const [programmesCount, classesCount, studentsCount, repsCount, coursesCount, activeSessionsCount] = await Promise.all([
      prisma.programme.count(),
      prisma.class.count(),
      prisma.student.count(),
      prisma.user.count({ where: { role: 'REP' } }),
      prisma.course.count(),
      prisma.attendanceSession.count({ where: { status: 'OPEN' } }),
    ]);

    const getGroupStats = async (whereClause) => {
      try {
        const total = await prisma.attendance.count({
          where: whereClause
        });
        if (total === 0) return 0;
        const attended = await prisma.attendance.count({
          where: {
            ...whereClause,
            status: { in: ['PRESENT', 'LATE'] }
          }
        });
        return Math.round((attended / total) * 100);
      } catch (err) {
        console.error('getGroupStats error:', err);
        return 0;
      }
    };

    const attendanceRates = {
      lvl100: await getGroupStats({ session: { class: { level: '100' } } }),
      lvl200: await getGroupStats({ session: { class: { level: '200' } } }),
      lvl300: await getGroupStats({ session: { class: { level: '300' } } }),
      lvl400: await getGroupStats({ session: { class: { level: '400' } } }),
      topUp: await getGroupStats({ session: { class: { type: 'TOP-UP' } } }),
      evening: await getGroupStats({ session: { class: { session: 'EVENING' } } }),
    };

    const stats = {
      programmesCount,
      classesCount,
      studentsCount,
      repsCount,
      coursesCount,
      activeSessionsCount,
      attendanceRates,
    };

    // Cache for 2 minutes (stats change frequently)
    await cache.set(cacheKey, stats, 120);

    res.json(stats);
  } catch (err) {
    console.error('Get admin stats error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Diagnose programme names - shows what will happen during cleanup
 */
const diagnoseProgrammes = async (req, res) => {
  try {
    const { normalizeProgrammeName, getOfficialProgrammes, getSuggestions } = require('../lib/programmeMapper');
    
    const allProgrammes = await prisma.programme.findMany({
      include: {
        _count: { select: { classes: true } }
      },
      orderBy: { name: 'asc' }
    });

    const diagnosis = allProgrammes.map(prog => {
      const normalized = normalizeProgrammeName(prog.name);
      const suggestions = getSuggestions(prog.name);
      const isOfficial = getOfficialProgrammes().includes(prog.name);
      
      return {
        id: prog.id,
        currentName: prog.name,
        classCount: prog._count.classes,
        isOfficial,
        canNormalize: !!normalized,
        normalizedTo: normalized,
        suggestions: suggestions.length > 0 ? suggestions : ['No suggestions - manual mapping needed'],
        action: isOfficial ? 'KEEP' : (normalized ? `MERGE into "${normalized}"` : 'ERROR - Cannot normalize')
      };
    });

    res.json({
      totalProgrammes: allProgrammes.length,
      officialProgrammes: getOfficialProgrammes(),
      diagnosis
    });
  } catch (err) {
    console.error('Diagnose programmes error:', err);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
};

/**
 * Clean up duplicate programmes by merging them into official names
 * This will:
 * 1. Find all programmes that can be normalized to official names
 * 2. Merge duplicate programmes (reassign classes and update references)
 * 3. Delete the duplicate programme records
 */
const cleanupDuplicateProgrammes = async (req, res) => {
  try {
    const { normalizeProgrammeName, getOfficialProgrammes } = require('../lib/programmeMapper');
    
    // Get all programmes
    const allProgrammes = await prisma.programme.findMany({
      include: {
        classes: true,
        _count: { select: { classes: true } }
      }
    });

    const officialProgrammes = getOfficialProgrammes();
    const mergeMap = {}; // Maps duplicate programme IDs to official programme IDs
    const toDelete = []; // Programme IDs to delete after merging
    const report = {
      totalProgrammes: allProgrammes.length,
      officialProgrammes: [],
      duplicates: [],
      merged: [],
      errors: []
    };

    // Step 1: Identify official programmes and duplicates
    for (const prog of allProgrammes) {
      const normalized = normalizeProgrammeName(prog.name);
      
      if (!normalized) {
        report.errors.push(`Programme "${prog.name}" cannot be normalized - manual review needed`);
        continue;
      }

      // Check if this is an official programme
      if (officialProgrammes.includes(prog.name)) {
        report.officialProgrammes.push({
          id: prog.id,
          name: prog.name,
          classCount: prog._count.classes
        });
      } else {
        // This is a duplicate/variation
        report.duplicates.push({
          id: prog.id,
          name: prog.name,
          normalizedTo: normalized,
          classCount: prog._count.classes
        });
      }
    }

    // Step 2: Create official programmes if they don't exist
    for (const officialName of officialProgrammes) {
      let official = await prisma.programme.findUnique({ where: { name: officialName } });
      if (!official) {
        official = await prisma.programme.create({ data: { name: officialName } });
        report.officialProgrammes.push({
          id: official.id,
          name: official.name,
          classCount: 0,
          created: true
        });
      }
    }

    // Step 3: Build merge map (duplicate ID -> official ID)
    for (const dup of report.duplicates) {
      const officialProg = await prisma.programme.findUnique({ 
        where: { name: dup.normalizedTo } 
      });
      
      if (officialProg) {
        mergeMap[dup.id] = officialProg.id;
        toDelete.push(dup.id);
      }
    }

    // Step 4: Merge classes from duplicates to official programmes
    for (const [dupId, officialId] of Object.entries(mergeMap)) {
      try {
        const dupProg = allProgrammes.find(p => p.id === dupId);
        const officialProg = await prisma.programme.findUnique({ where: { id: officialId } });
        
        // Get classes from duplicate programme
        const dupClasses = await prisma.class.findMany({
          where: { programmeId: dupId }
        });

        let movedCount = 0;
        let skippedCount = 0;

        for (const dupClass of dupClasses) {
          // Check if a class with same level/type/group/session already exists in official programme
          const existingClass = await prisma.class.findFirst({
            where: {
              programmeId: officialId,
              level: dupClass.level,
              type: dupClass.type,
              group: dupClass.group,
              session: dupClass.session
            }
          });

          if (existingClass) {
            // Conflict! Merge students and courses from duplicate class into existing class
            try {
              // Move students
              await prisma.classStudent.updateMany({
                where: { classId: dupClass.id },
                data: { classId: existingClass.id }
              });

              // Move courses (check for duplicates first)
              const dupCourses = await prisma.classCourse.findMany({
                where: { classId: dupClass.id }
              });

              for (const dupCourse of dupCourses) {
                const existingCourse = await prisma.classCourse.findFirst({
                  where: {
                    classId: existingClass.id,
                    courseId: dupCourse.courseId
                  }
                });

                if (!existingCourse) {
                  await prisma.classCourse.update({
                    where: { id: dupCourse.id },
                    data: { classId: existingClass.id }
                  });
                } else {
                  // Course already linked, just delete the duplicate
                  await prisma.classCourse.delete({
                    where: { id: dupCourse.id }
                  });
                }
              }

              // Delete the duplicate class
              await prisma.class.delete({
                where: { id: dupClass.id }
              });

              skippedCount++;
            } catch (mergeErr) {
              report.errors.push(`Failed to merge class ${dupClass.displayName}: ${mergeErr.message}`);
            }
          } else {
            // No conflict, just move the class
            const newDisplayName = `${officialProg.name} LEVEL ${dupClass.level} ${dupClass.type} GROUP ${dupClass.group} (${dupClass.session})`;
            await prisma.class.update({
              where: { id: dupClass.id },
              data: {
                programmeId: officialId,
                displayName: newDisplayName
              }
            });
            movedCount++;
          }
        }

        report.merged.push({
          from: dupProg?.name,
          to: officialProg.name,
          classesMoved: movedCount,
          classesMerged: skippedCount
        });
      } catch (err) {
        report.errors.push(`Failed to merge programme ID ${dupId}: ${err.message}`);
      }
    }

    // Step 5: Delete duplicate programmes
    for (const dupId of toDelete) {
      try {
        await prisma.programme.delete({ where: { id: dupId } });
      } catch (err) {
        report.errors.push(`Failed to delete duplicate programme ID ${dupId}: ${err.message}`);
      }
    }

    // Final stats
    report.summary = {
      officialProgrammesCount: report.officialProgrammes.length,
      duplicatesFound: report.duplicates.length,
      duplicatesMerged: report.merged.length,
      duplicatesDeleted: toDelete.length,
      errorsCount: report.errors.length
    };

    res.json({
      success: true,
      message: `Cleanup complete: ${report.merged.length} duplicates merged, ${toDelete.length} deleted`,
      report
    });

  } catch (err) {
    console.error('Cleanup duplicate programmes error:', err);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
};

module.exports = {
  createProgramme,
  getAllProgrammes,
  updateProgramme,
  deleteProgramme,
  createClass,
  getAllClasses,
  getClassById,
  updateClass,
  deleteClass,
  assignRep,
  removeRep,
  addStudentsToClass,
  removeStudentFromClass,
  bulkDeleteStudentsFromClass,
  getClassStudents,
  getRepClassStudents,
  bulkImportClassStudents,
  addCourseToClass,
  removeCourseFromClass,
  getClassCourses,
  createRepAccount,
  getAllReps,
  updateRep,
  resetRepPassword,
  deactivateRep,
  deleteRepAccount,
  bulkUploadReps,
  getSettings,
  updateSettings,
  uploadLogo,
  getAdminStats,
  parseImportFile,
  diagnoseProgrammes,
  cleanupDuplicateProgrammes
};
