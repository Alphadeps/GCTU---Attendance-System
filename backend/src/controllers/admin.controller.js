const bcrypt = require('bcryptjs');
const prisma = require('../lib/prisma');

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

    res.status(201).json(programme);
  } catch (err) {
    console.error('Create programme error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getAllProgrammes = async (req, res) => {
  try {
    const programmes = await prisma.programme.findMany({
      include: {
        _count: { select: { classes: true } }
      },
      orderBy: { name: 'asc' }
    });
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
    res.json({ message: 'Programme deleted successfully' });
  } catch (err) {
    console.error('Delete programme error:', err);
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
    }

    res.status(201).json({
      message: `Created ${createdClasses.length} classes. Skipped ${skippedClasses.length} duplicates.`,
      created: createdClasses,
      skipped: skippedClasses
    });
  } catch (err) {
    console.error('Create class error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getAllClasses = async (req, res) => {
  try {
    const classes = await prisma.class.findMany({
      include: {
        programme: true,
        rep: { select: { id: true, username: true } },
        _count: { select: { students: true, courses: true } }
      },
      orderBy: { displayName: 'asc' }
    });
    res.json(classes);
  } catch (err) {
    console.error('Get all classes error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getClassById = async (req, res) => {
  try {
    const { id } = req.params;
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

    res.json(updated);
  } catch (err) {
    console.error('Update class error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const deleteClass = async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.class.delete({ where: { id } });
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

    // Update the class with repId
    const updated = await prisma.class.update({
      where: { id },
      data: { repId },
      include: { rep: { select: { id: true, username: true } } }
    });

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

        // Link student via ClassStudent
        const linkExists = await prisma.classStudent.findUnique({
          where: {
            classId_studentId: {
              classId: id,
              studentId: student.id
            }
          }
        });

        if (!linkExists) {
          await prisma.classStudent.create({
            data: {
              classId: id,
              studentId: student.id
            }
          });
          addedCount++;
        } else {
          skippedCount++;
        }
      } catch (e) {
        skippedCount++;
        errors.push(e.message);
      }
    }

    res.json({ addedCount, skippedCount, errors });
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

    res.json({ message: 'Student removed from class successfully' });
  } catch (err) {
    console.error('Remove student from class error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getClassStudents = async (req, res) => {
  try {
    const { id } = req.params; // Class ID

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
    const classStudents = await prisma.classStudent.findMany({
      where: { classId: id },
      include: { student: true }
    });

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

    res.json(studentsData);
  } catch (err) {
    console.error('Get class students error:', err);
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

        const linkExists = await prisma.classStudent.findUnique({
          where: {
            classId_studentId: { classId: id, studentId: student.id }
          }
        });

        if (!linkExists) {
          await prisma.classStudent.create({
            data: { classId: id, studentId: student.id }
          });
          addedCount++;
        } else {
          skippedCount++;
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
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const existing = await prisma.user.findUnique({ where: { username } });
    if (existing) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await prisma.user.create({
      data: {
        username,
        password: hashedPassword,
        role: 'REP',
        isActive: true
      }
    });

    res.status(201).json({
      id: newUser.id,
      username: newUser.username,
      role: newUser.role,
      isActive: newUser.isActive
    });
  } catch (err) {
    console.error('Create rep account error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getAllReps = async (req, res) => {
  try {
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
    res.json({ message: 'Representative account deleted successfully' });
  } catch (err) {
    console.error('Delete rep account error:', err);
    res.status(500).json({ error: 'Internal server error' });
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
// SUPERADMIN STATS
// ==========================================

const getAdminStats = async (req, res) => {
  try {
    const [programmesCount, classesCount, studentsCount, repsCount, coursesCount, activeSessionsCount] = await Promise.all([
      prisma.programme.count(),
      prisma.class.count(),
      prisma.student.count(),
      prisma.user.count({ where: { role: 'REP' } }),
      prisma.course.count(),
      prisma.attendanceSession.count({ where: { status: 'OPEN' } }),
    ]);

    res.json({
      programmesCount,
      classesCount,
      studentsCount,
      repsCount,
      coursesCount,
      activeSessionsCount,
    });
  } catch (err) {
    console.error('Get admin stats error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  createProgramme,
  getAllProgrammes,
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
  getClassStudents,
  bulkImportClassStudents,
  addCourseToClass,
  removeCourseFromClass,
  getClassCourses,
  createRepAccount,
  getAllReps,
  resetRepPassword,
  deactivateRep,
  deleteRepAccount,
  getSettings,
  updateSettings,
  uploadLogo,
  getAdminStats
};
