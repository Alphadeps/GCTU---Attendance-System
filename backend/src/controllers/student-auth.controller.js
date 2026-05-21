const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { z } = require('zod');
const prisma = require('../lib/prisma');
const { JWT_SECRET } = require('../middleware/auth');

// Validation schemas
const studentLoginSchema = z.object({
  indexNumber: z.string().min(1, 'Index number is required'),
  password: z.string().min(1, 'Password is required')
});

const studentSetPasswordSchema = z.object({
  indexNumber: z.string().min(1, 'Index number is required'),
  password: z.string().min(6, 'Password must be at least 6 characters long'),
  confirmPassword: z.string().min(1, 'Please confirm your password')
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"]
});

const repResetStudentPasswordSchema = z.object({
  studentIndexNumber: z.string().min(1, 'Student index number is required'),
  newPassword: z.string().min(6, 'Password must be at least 6 characters long')
});

/**
 * Student Login
 */
const studentLogin = async (req, res) => {
  try {
    const validation = studentLoginSchema.safeParse(req.body);
    if (!validation.success) {
      const errorMsg = validation.error.errors.map(err => err.message).join(', ');
      return res.status(400).json({ error: errorMsg });
    }

    const { indexNumber, password } = validation.data;

    const student = await prisma.student.findUnique({
      where: { indexNumber },
      include: {
        classes: {
          include: {
            class: {
              include: {
                programme: true
              }
            }
          }
        }
      }
    });

    if (!student) {
      return res.status(401).json({ error: 'Invalid index number or password' });
    }

    // Check if first login (no password set yet)
    if (!student.password || student.isFirstLogin) {
      return res.status(403).json({ 
        error: 'First time login detected. Please set your password first.',
        requiresPasswordSetup: true
      });
    }

    const isMatch = await bcrypt.compare(password, student.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid index number or password' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { 
        id: student.id, 
        indexNumber: student.indexNumber, 
        role: 'STUDENT',
        name: student.name
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      student: {
        id: student.id,
        indexNumber: student.indexNumber,
        name: student.name,
        email: student.email,
        classes: student.classes.map(cs => ({
          id: cs.class.id,
          displayName: cs.class.displayName,
          programme: cs.class.programme.name
        }))
      }
    });
  } catch (err) {
    console.error('Student login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Student First-Time Password Setup
 */
const studentSetPassword = async (req, res) => {
  try {
    const validation = studentSetPasswordSchema.safeParse(req.body);
    if (!validation.success) {
      const errorMsg = validation.error.errors.map(err => err.message).join(', ');
      return res.status(400).json({ error: errorMsg });
    }

    const { indexNumber, password } = validation.data;

    const student = await prisma.student.findUnique({
      where: { indexNumber }
    });

    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Update student with password
    await prisma.student.update({
      where: { indexNumber },
      data: {
        password: hashedPassword,
        isFirstLogin: false
      }
    });

    res.json({ message: 'Password set successfully. You can now login.' });
  } catch (err) {
    console.error('Student set password error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Rep Reset Student Password
 */
const repResetStudentPassword = async (req, res) => {
  try {
    // Verify rep is authenticated
    if (!req.user || req.user.role !== 'REP') {
      return res.status(403).json({ error: 'Only class reps can reset student passwords' });
    }

    const validation = repResetStudentPasswordSchema.safeParse(req.body);
    if (!validation.success) {
      const errorMsg = validation.error.errors.map(err => err.message).join(', ');
      return res.status(400).json({ error: errorMsg });
    }

    const { studentIndexNumber, newPassword } = validation.data;

    // Get rep's assigned class
    const repClass = await prisma.class.findFirst({
      where: { repId: req.user.id },
      include: {
        students: {
          include: {
            student: true
          }
        }
      }
    });

    if (!repClass) {
      return res.status(403).json({ error: 'You are not assigned to any class' });
    }

    // Check if student is in rep's class
    const studentInClass = repClass.students.find(
      cs => cs.student.indexNumber === studentIndexNumber
    );

    if (!studentInClass) {
      return res.status(403).json({ 
        error: 'You can only reset passwords for students in your class' 
      });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update student password
    await prisma.student.update({
      where: { indexNumber: studentIndexNumber },
      data: {
        password: hashedPassword,
        isFirstLogin: false
      }
    });

    // Create notification for student
    await prisma.notification.create({
      data: {
        studentIndex: studentIndexNumber,
        title: 'Password Reset',
        message: `Your password has been reset by your class rep. Please login with your new password.`,
        type: 'INFO'
      }
    });

    res.json({ 
      message: `Password reset successfully for ${studentInClass.student.name}` 
    });
  } catch (err) {
    console.error('Rep reset student password error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  studentLogin,
  studentSetPassword,
  repResetStudentPassword
};
