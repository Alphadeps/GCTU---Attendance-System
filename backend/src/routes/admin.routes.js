const express = require('express');
const multer = require('multer');

const { protect, authorizeRoles } = require('../middleware/auth');
const { adminLimiter, uploadLimiter } = require('../middleware/rateLimiter');
const adminController = require('../controllers/admin.controller');
const classJoin = require('../controllers/classJoin.controller');

const router = express.Router();

// Logo is kept in memory and saved to the database (the server disk is wiped on restart)
const uploadLogo = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (/^image\/(png|jpe?g|gif|webp)$/.test(file.mimetype)) return cb(null, true);
    cb(Object.assign(new Error('Logo must be a PNG, JPEG, GIF or WebP image'), { isUploadError: true }));
  }
});

const csvStorage = multer.memoryStorage();
const uploadCSV = multer({ storage: csvStorage });

// Superadmin guard middleware helper
const superadminGuard = [protect, authorizeRoles('SUPERADMIN'), adminLimiter];

// Settings Routes
router.get('/settings', protect, adminController.getSettings);
router.patch('/settings', superadminGuard, adminController.updateSettings);
router.post('/settings/logo', [...superadminGuard, uploadLimiter, uploadLogo.single('logo')], adminController.uploadLogo);

// Stats Route
router.get('/stats', superadminGuard, adminController.getAdminStats);

// Programme Routes
router.post('/programmes', superadminGuard, adminController.createProgramme);
router.get('/programmes', superadminGuard, adminController.getAllProgrammes);
router.patch('/programmes/:id', superadminGuard, adminController.updateProgramme);
router.delete('/programmes/:id', superadminGuard, adminController.deleteProgramme);
router.get('/programmes/diagnose', superadminGuard, adminController.diagnoseProgrammes);
router.post('/programmes/cleanup-duplicates', superadminGuard, adminController.cleanupDuplicateProgrammes);

// Class Routes
router.post('/classes', superadminGuard, adminController.createClass);
router.get('/classes', superadminGuard, adminController.getAllClasses);
router.get('/classes/:id', superadminGuard, adminController.getClassById);
router.patch('/classes/:id', superadminGuard, adminController.updateClass);
router.delete('/classes/:id', superadminGuard, adminController.deleteClass);
router.post('/classes/:id/assign-rep', superadminGuard, adminController.assignRep);
router.post('/classes/:id/remove-rep', superadminGuard, adminController.removeRep);

// Student Management Per Class
router.get('/classes/:id/students', superadminGuard, adminController.getClassStudents);
router.post('/classes/:id/students', superadminGuard, adminController.addStudentsToClass);
router.delete('/classes/:id/students/:studentId', superadminGuard, adminController.removeStudentFromClass);
router.post('/classes/:id/students/bulk-delete', superadminGuard, adminController.bulkDeleteStudentsFromClass);
router.post('/classes/:id/students/bulk-import', [...superadminGuard, uploadLimiter, uploadCSV.single('file')], adminController.bulkImportClassStudents);
router.post('/classes/parse-file', [...superadminGuard, uploadLimiter, uploadCSV.single('file')], adminController.parseImportFile);

// Course Management Per Class
router.get('/classes/:id/courses', superadminGuard, adminController.getClassCourses);
router.post('/classes/:id/courses', superadminGuard, adminController.addCourseToClass);
router.delete('/classes/:id/courses/:courseId', superadminGuard, adminController.removeCourseFromClass);

// Rep Account Management
router.post('/reps', superadminGuard, adminController.createRepAccount);
router.get('/reps', superadminGuard, adminController.getAllReps);
router.post('/reps/bulk-upload', [...superadminGuard, uploadLimiter, uploadCSV.single('file')], adminController.bulkUploadReps);
router.patch('/reps/:id', superadminGuard, adminController.updateRep);
router.patch('/reps/:id/reset-password', superadminGuard, adminController.resetRepPassword);
router.patch('/reps/:id/deactivate', superadminGuard, adminController.deactivateRep);
router.patch('/reps/:id/status', superadminGuard, adminController.deactivateRep); // alias used by frontend
router.delete('/reps/:id', superadminGuard, adminController.deleteRepAccount);

// Rep-specific routes (accessible by REPs for their own class)
router.get('/rep/my-class-students', protect, authorizeRoles('REP'), adminController.getRepClassStudents);

// Rep class management — every route below is locked to the rep's own class by repClassScope
const repGuard = [protect, authorizeRoles('REP'), classJoin.repClassScope];
const uploadClassList = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });
router.get('/rep/join-code', repGuard, classJoin.getJoinCode);
router.post('/rep/join-code/regenerate', repGuard, classJoin.regenerateJoinCode);
router.post('/rep/parse-file', [...repGuard, uploadLimiter, uploadClassList.single('file')], adminController.parseImportFile);
router.post('/rep/students', repGuard, adminController.addStudentsToClass);
router.delete('/rep/students/:studentId', repGuard, adminController.removeStudentFromClass);

// Student Device Management
router.patch('/students/:indexNumber/reset-device', superadminGuard, adminController.resetStudentDevice);
router.post('/students/reset-duplicate-devices', superadminGuard, adminController.resetAllDuplicateDevices);
router.post('/students/reset-all-devices', superadminGuard, adminController.resetAllDevices);

module.exports = router;
