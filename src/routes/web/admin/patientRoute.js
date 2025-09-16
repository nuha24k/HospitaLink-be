const express = require('express');
const router = express.Router();

// Import controllers
const patientController = require('../../../controllers/web/admin/patientController');

// Import middlewares
const { authWebMiddleware, requireRole } = require('../../../middlewares/auth');
const { body, param, query } = require('express-validator');
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
// ALL ROUTES REQUIRE AUTHENTICATION (Admin Only)
// ============================================================================
router.use(authWebMiddleware); // All routes below require web authentication
router.use(requireRole(['ADMIN'])); // Only admins can access

// ============================================================================
// SPECIFIC ROUTES FIRST (before parameterized routes)
// ============================================================================

/**
 * @route   GET /api/web/admin/patients/next-number
 * @desc    Get next patient number for QR code
 * @access  Admin only
 */
router.get('/next-number', patientController.getNextPatientNumber);

/**
 * @route   GET /api/web/admin/patients/stats
 * @desc    Get patient statistics
 * @access  Admin only
 */
router.get('/stats', patientController.getPatientStats);

/**
 * @route   GET /api/web/admin/patients/test
 * @desc    Test patient routes
 * @access  Admin only
 */
router.get('/test', (req, res) => {
  res.json({
    success: true,
    message: 'Patient web routes working',
    timestamp: new Date().toISOString(),
    user: {
      id: req.user?.id,
      role: req.user?.role
    }
  });
});

// ============================================================================
// GENERAL ROUTES
// ============================================================================

/**
 * @route   GET /api/web/admin/patients
 * @desc    Get all patients with pagination and filtering
 * @access  Admin only
 */
router.get('/',
  // Query parameter validation
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('search').optional().isString().isLength({ max: 100 }).withMessage('Search query too long'),
  query('gender').optional().isIn(['MALE', 'FEMALE']).withMessage('Gender must be MALE or FEMALE'),
  query('isActive').optional().isBoolean().withMessage('isActive must be a boolean'),
  query('sortBy').optional().isIn(['fullName', 'email', 'createdAt', 'updatedAt', 'nik']).withMessage('Invalid sort field'),
  query('sortOrder').optional().isIn(['asc', 'desc']).withMessage('Sort order must be asc or desc'),
  handleValidationErrors,
  patientController.getPatients
);

// ============================================================================
// PARAMETERIZED ROUTES (should be after specific routes)
// ============================================================================

/**
 * @route   GET /api/web/admin/patients/:id
 * @desc    Get patient by ID with detailed information
 * @access  Admin only
 */
router.get('/:id',
  param('id').isUUID().withMessage('Patient ID must be a valid UUID'),
  handleValidationErrors,
  patientController.getPatientById
);

/**
 * @route   PUT /api/web/admin/patients/:id
 * @desc    Update patient information
 * @access  Admin only
 */
router.put('/:id',
  // Path parameter validation
  param('id').isUUID().withMessage('Patient ID must be a valid UUID'),
  
  // Optional field validation (for updates)
  body('fullName')
    .optional()
    .isString()
    .isLength({ min: 2, max: 100 })
    .withMessage('Full name must be between 2 and 100 characters')
    .matches(/^[a-zA-Z\s.-]+$/)
    .withMessage('Full name can only contain letters, spaces, dots, and hyphens'),
  body('phone')
    .optional()
    .matches(/^(08|8)[0-9]{8,11}$/)
    .withMessage('Invalid Indonesian phone number format (example: 08123456789)'),
  body('nik')
    .optional()
    .isLength({ min: 16, max: 16 })
    .isNumeric()
    .withMessage('NIK must be exactly 16 digits'),
  body('gender')
    .optional()
    .isIn(['MALE', 'FEMALE'])
    .withMessage('Gender must be MALE or FEMALE'),
  body('dateOfBirth')
    .optional()
    .isISO8601()
    .withMessage('Date of birth must be a valid date')
    .custom((value) => {
      const birthDate = new Date(value);
      const today = new Date();
      const age = today.getFullYear() - birthDate.getFullYear();
      if (age > 150 || birthDate > today) {
        throw new Error('Invalid date of birth');
      }
      return true;
    }),
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean'),
  
  // Address field validation
  body('street').optional().isString().isLength({ max: 200 }).withMessage('Street address too long'),
  body('village').optional().isString().isLength({ max: 100 }).withMessage('Village name too long'),
  body('district').optional().isString().isLength({ max: 100 }).withMessage('District name too long'),
  body('regency').optional().isString().isLength({ max: 100 }).withMessage('Regency name too long'),
  body('province').optional().isString().isLength({ max: 100 }).withMessage('Province name too long'),
  
  handleValidationErrors,
  patientController.updatePatient
);

/**
 * @route   DELETE /api/web/admin/patients/:id
 * @desc    Delete patient (soft delete)
 * @access  Admin only
 */
router.delete('/:id',
  param('id').isUUID().withMessage('Patient ID must be a valid UUID'),
  handleValidationErrors,
  patientController.deletePatient
);

/**
 * @route   POST /api/web/admin/patients
 * @desc    Create a new patient
 * @access  Admin only
 */
router.post('/',
  // Required field validation
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email is required'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters')
    .matches(/^(?=.*[a-zA-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one letter and one digit'),
  body('fullName')
    .isString()
    .isLength({ min: 2, max: 100 })
    .withMessage('Full name must be between 2 and 100 characters')
    .matches(/^[a-zA-Z\s.-]+$/)
    .withMessage('Full name can only contain letters, spaces, dots, and hyphens'),
  
  // Optional field validation
  body('phone')
    .optional()
    .matches(/^(08|8)[0-9]{8,11}$/)
    .withMessage('Invalid Indonesian phone number format (example: 08123456789)'),
  body('nik')
    .optional()
    .isLength({ min: 16, max: 16 })
    .isNumeric()
    .withMessage('NIK must be exactly 16 digits'),
  body('gender')
    .optional()
    .isIn(['MALE', 'FEMALE'])
    .withMessage('Gender must be MALE or FEMALE'),
  body('dateOfBirth')
    .optional()
    .isISO8601()
    .withMessage('Date of birth must be a valid date')
    .custom((value) => {
      const birthDate = new Date(value);
      const today = new Date();
      const age = today.getFullYear() - birthDate.getFullYear();
      if (age > 150 || birthDate > today) {
        throw new Error('Invalid date of birth');
      }
      return true;
    }),
  
  // QR Code validation
  body('qrCode')
    .optional()
    .isString()
    .matches(/^USER_\d{3}$/)
    .withMessage('QR Code must follow format USER_XXX (e.g., USER_001)'),
  
  // Address field validation
  body('street').optional().isString().isLength({ max: 200 }).withMessage('Street address too long'),
  body('village').optional().isString().isLength({ max: 100 }).withMessage('Village name too long'),
  body('district').optional().isString().isLength({ max: 100 }).withMessage('District name too long'),
  body('regency').optional().isString().isLength({ max: 100 }).withMessage('Regency name too long'),
  body('province').optional().isString().isLength({ max: 100 }).withMessage('Province name too long'),
  
  handleValidationErrors,
  patientController.createPatient
);

// ============================================================================
// BULK OPERATIONS (Optional - for future use)
// ============================================================================

/**
 * @route   POST /api/web/admin/patients/bulk-update
 * @desc    Bulk update patients status
 * @access  Admin only
 */
router.post('/bulk-update',
  body('patientIds')
    .isArray({ min: 1 })
    .withMessage('Patient IDs must be a non-empty array'),
  body('patientIds.*')
    .isUUID()
    .withMessage('Each patient ID must be a valid UUID'),
  body('isActive')
    .isBoolean()
    .withMessage('isActive must be a boolean'),
  handleValidationErrors,
  async (req, res) => {
    try {
      const { patientIds, isActive } = req.body;
      
      const updatedPatients = await prisma.user.updateMany({
        where: {
          id: { in: patientIds },
          role: { in: ['PATIENT', 'USER'] }
        },
        data: {
          isActive,
          updatedAt: new Date()
        }
      });

      res.json({
        success: true,
        data: {
          updatedCount: updatedPatients.count
        },
        message: `Successfully updated ${updatedPatients.count} patients`
      });
    } catch (error) {
      console.error('Bulk update error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update patients',
        error: error.message
      });
    }
  }
);

/**
 * @route   GET /api/web/admin/patients/export/csv
 * @desc    Export patients data as CSV
 * @access  Admin only
 */
router.get('/export/csv',
  query('isActive').optional().isBoolean().withMessage('isActive must be a boolean'),
  query('gender').optional().isIn(['MALE', 'FEMALE']).withMessage('Gender must be MALE or FEMALE'),
  handleValidationErrors,
  async (req, res) => {
    try {
      // This would need to be implemented with a CSV generation library
      res.json({
        success: false,
        message: 'CSV export not yet implemented',
        note: 'This feature requires CSV generation library implementation'
      });
    } catch (error) {
      console.error('Export error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to export data',
        error: error.message
      });
    }
  }
);

module.exports = router;