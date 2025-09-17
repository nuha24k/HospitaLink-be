const express = require('express');
const router = express.Router();
const { body } = require('express-validator');

const { authWebMiddleware, requireRole } = require('../../../middlewares/auth');
const { handleValidationErrors } = require('../../../middlewares/validation');

// Import controllers
const dashboardController = require('../../../controllers/web/doctor/dashboardController');
const patientController = require('../../../controllers/web/doctor/patientController');
const consultationController = require('../../../controllers/web/doctor/consultationController');
const chatController = require('../../../controllers/web/doctor/chatController');
// Import sub-routes
const queueRoutes = require('./queue');
const prescriptionRoutes = require('./prescription');
const consultationRoutes = require('./consultation');
const chatRoutes = require('./chat');
const scheduleRoutes = require('./schedule');

// ===== PUBLIC ROUTES (NO AUTH) =====

// Test route
router.get('/test', (req, res) => {
  res.json({
    success: true,
    message: 'Doctor web routes working',
    timestamp: new Date().toISOString(),
  });
});

// Login route - MUST BE PUBLIC
router.post('/login', 
  [
    body('nik').optional().isLength({ min: 16, max: 16 }).withMessage('NIK must be 16 digits'),
    body('email').optional().isEmail().withMessage('Invalid email format'),
    body('password').optional().isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('fingerprintData').optional().isString()
  ],
  handleValidationErrors,
  dashboardController.loginDoctorWeb
);

// Logout route
router.post('/logout', dashboardController.logoutDoctorWeb);

// Dashboard public routes
router.get('/dashboard/test', (req, res) => {
  res.json({
    success: true,
    message: 'Dashboard test route working'
  });
});

// ===== PROTECTED ROUTES (REQUIRE AUTH) =====
router.use(authWebMiddleware);
router.use(requireRole(['DOCTOR']));

// Dashboard protected routes
router.get('/dashboard', dashboardController.getDoctorDashboard);

// Patient routes
router.get('/patients', patientController.getPatients);
router.get('/patients/search', patientController.searchPatients);
router.get('/patients/all', patientController.getAllPatients);

// Protected sub-routes
router.use('/queue', queueRoutes);
router.use('/prescriptions', prescriptionRoutes);
router.use('/consultations', consultationRoutes);
router.use('/chat', chatRoutes);
router.use('/schedule', scheduleRoutes);

module.exports = router;