const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const { protect, authorizeRoles } = require('../middleware/auth');
const adminController = require('../controllers/admin.controller');

const router = express.Router();

// Ensure public/uploads exists
const uploadDir = path.join(__dirname, '../../public/uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer configurations
const logoStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `logo_${Date.now()}${ext}`);
  }
});
const uploadLogo = multer({ storage: logoStorage });

const csvStorage = multer.memoryStorage();
const uploadCSV = multer({ storage: csvStorage });

// Superadmin guard middleware helper
const superadminGuard = [protect, authorizeRoles('SUPERADMIN')];

// Settings Routes
router.get('/settings', protect, adminController.getSettings);
router.patch('/settings', superadminGuard, adminController.updateSettings);
router.post('/settings/logo', [...superadminGuard, uploadLogo.single('logo')], adminController.uploadLogo);

// Stats Route
router.get('/stats', superadminGuard, adminController.getAdminStats);

// Programme Routes
router.post('/programmes', superadminGuard, adminController.createProgramme);
router.get('/programmes', superadminGuard, adminController.getAllProgrammes);
router.delete('/programmes/:id', superadminGuard, adminController.deleteProgramme);

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
router.post('/classes/:id/students/bulk-import', [...superadminGuard, uploadCSV.single('file')], adminController.bulkImportClassStudents);
router.post('/classes/parse-file', [...superadminGuard, uploadCSV.single('file')], adminController.parseImportFile);

// Course Management Per Class
router.get('/classes/:id/courses', superadminGuard, adminController.getClassCourses);
router.post('/classes/:id/courses', superadminGuard, adminController.addCourseToClass);
router.delete('/classes/:id/courses/:courseId', superadminGuard, adminController.removeCourseFromClass);

// Rep Account Management
router.post('/reps', superadminGuard, adminController.createRepAccount);
router.get('/reps', superadminGuard, adminController.getAllReps);
router.patch('/reps/:id/reset-password', superadminGuard, adminController.resetRepPassword);
router.patch('/reps/:id/deactivate', superadminGuard, adminController.deactivateRep);
router.patch('/reps/:id/status', superadminGuard, adminController.deactivateRep); // alias used by frontend
router.delete('/reps/:id', superadminGuard, adminController.deleteRepAccount);

module.exports = router;
