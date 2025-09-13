const express = require('express');
const router = express.Router();

// Import controllers
const authController = require('../../../controllers/web/admin/authController');

// Import route modules
const patientRoutes = require('./patientRoute');

// Import middlewares
const { authWebMiddleware, requireRole } = require('../../../middlewares/auth');
const { body } = require('express-validator');
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
 * @route   POST /api/web/admin/login
 * @desc    Admin login for web dashboard
 * @access  Public
 */
router.post('/login', 
  body('email').optional().isEmail().withMessage('Valid email is required'),
  body('password').optional().isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('fingerprintData').optional().isString().withMessage('Invalid fingerprint data'),
  handleValidationErrors,
  authController.loginAdmin
);

/**
 * @route   POST /api/web/admin/logout
 * @desc    Admin logout for web dashboard
 * @access  Public
 */
router.post('/logout', authController.logoutAdmin);

/**
 * @route   GET /api/web/admin/test
 * @desc    Test admin web routes
 * @access  Public
 */
router.get('/test', (req, res) => {
  res.json({
    success: true,
    message: 'Admin web routes working',
    timestamp: new Date().toISOString(),
  });
});

// ============================================================================
// PROTECTED ROUTES (Authentication Required)
// ============================================================================
router.use(authWebMiddleware); // All routes below require web authentication
router.use(requireRole(['ADMIN'])); // Only admins can access

/**
 * @route   GET /api/web/admin/dashboard
 * @desc    Get admin dashboard data
 * @access  Admin only
 */
router.get('/dashboard', authController.getAdminDashboard);

/**
 * @route   POST /api/web/admin/change-password
 * @desc    Change admin password
 * @access  Admin only
 */
router.post('/change-password', 
  body('currentPassword').exists().withMessage('Current password is required'),
  body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters'),
  handleValidationErrors,
  authController.changePassword
);

/**
 * @route   POST /api/web/admin/update-profile
 * @desc    Update admin profile information
 * @access  Admin only
 */
router.post('/update-profile', 
  body('name').optional().isString().withMessage('Name must be a string'),
  body('email').optional().isEmail().withMessage('Valid email is required'),
  handleValidationErrors,
  authController.updateProfile
);

// ============================================================================
// SUB-ROUTE MODULES
// ============================================================================

/**
 * @route   /api/admin/patients/*
 * @desc    All patient management routes
 * @access  Admin only
 */
router.use('/patients', patientRoutes);

module.exports = router;