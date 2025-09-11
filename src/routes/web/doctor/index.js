const express = require('express');
const router = express.Router();

// Import controllers
const dashboardController = require('../../../controllers/web/doctor/dashboardController');
const queueController = require('../../../controllers/web/doctor/queueController');
const consultationController = require('../../../controllers/web/doctor/consultationController');

// Import middlewares
const { authWebMiddleware, requireRole } = require('../../../middlewares/auth');
const { body, param } = require('express-validator');
const { validationResult } = require('express-validator');

// Validation middleware
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array(),
    });
  }
  next();
};

// ============================================================================
// PUBLIC ROUTES (No Authentication)
// ============================================================================

/**
 * @route   POST /api/web/doctor/login
 * @desc    Doctor login for web dashboard
 * @access  Public
 */
router.post('/login', 
  body('nik').optional().isLength({ min: 16, max: 16 }).withMessage('NIK must be 16 digits'),
  body('password').optional().isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('fingerprintData').optional().isString().withMessage('Invalid fingerprint data'),
  handleValidationErrors,
  dashboardController.loginDoctorWeb
);

/**
 * @route   POST /api/web/doctor/logout
 * @desc    Doctor logout for web dashboard
 * @access  Public
 */
router.post('/logout', dashboardController.logoutDoctorWeb);

/**
 * @route   GET /api/web/doctor/test
 * @desc    Test doctor web routes
 * @access  Public
 */
router.get('/test', (req, res) => {
  res.json({
    success: true,
    message: 'Doctor web routes working',
    timestamp: new Date().toISOString(),
  });
});

// ============================================================================
// PROTECTED ROUTES (Authentication Required)
// ============================================================================
router.use(authWebMiddleware); // All routes below require web authentication
router.use(requireRole(['DOCTOR'])); // Only doctors can access

/**
 * @route   GET /api/web/doctor/dashboard
 * @desc    Get doctor dashboard data
 * @access  Doctor only
 */
router.get('/dashboard', dashboardController.getDoctorDashboard);

// ============================================================================
// QUEUE MANAGEMENT ROUTES
// ============================================================================

/**
 * @route   GET /api/web/doctor/queue/today
 * @desc    Get today's queue for doctor
 * @access  Doctor only
 */
router.get('/queue/today', queueController.getTodayQueueWeb);

/**
 * @route   POST /api/web/doctor/queue/call-next
 * @desc    Call next patient in queue
 * @access  Doctor only
 */
router.post('/queue/call-next', queueController.callNextPatientWeb);

/**
 * @route   POST /api/web/doctor/queue/complete
 * @desc    Complete current consultation
 * @access  Doctor only
 */
router.post('/queue/complete', 
  body('queueId').isUUID().withMessage('Valid queue ID is required'),
  body('notes').optional().isString(),
  body('diagnosis').optional().isString(),
  body('treatment').optional().isString(),
  body('prescriptions').optional().isArray(),
  handleValidationErrors,
  queueController.completeConsultationWeb
);

/**
 * @route   POST /api/web/doctor/queue/skip
 * @desc    Skip current patient
 * @access  Doctor only
 */
router.post('/queue/skip', 
  body('queueId').isUUID().withMessage('Valid queue ID is required'),
  body('reason').optional().isString(),
  handleValidationErrors,
  queueController.skipPatientWeb
);

// ============================================================================
// ONLINE CONSULTATION ROUTES
// ============================================================================

/**
 * @route   GET /api/web/doctor/consultations/pending
 * @desc    Get pending online consultations
 * @access  Doctor only
 */
router.get('/consultations/pending', consultationController.getPendingConsultationsWeb);

/**
 * @route   POST /api/web/doctor/consultations/:consultationId/complete
 * @desc    Complete online consultation
 * @access  Doctor only
 */
router.post('/consultations/:consultationId/complete', 
  param('consultationId').isUUID().withMessage('Valid consultation ID is required'),
  body('doctorDecision').isIn(['PRESCRIPTION_ONLY', 'APPOINTMENT_NEEDED', 'EMERGENCY_REFERRAL', 'SELF_CARE']).withMessage('Valid doctor decision is required'),
  body('doctorNotes').optional().isString(),
  body('prescriptions').optional().isArray(),
  body('followUpInDays').optional().isInt({ min: 1, max: 90 }),
  handleValidationErrors,
  consultationController.completeOnlineConsultationWeb
);

module.exports = router;