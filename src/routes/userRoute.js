const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authMiddleware, requireRole } = require('../middlewares/auth');
const { updateProfileValidation, changePasswordValidation, fingerprintValidation } = require('../middlewares/validation');
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
// PUBLIC ROUTES (For Testing)
// ============================================================================

/**
 * @route   GET /api/users/test
 * @desc    Test user routes
 * @access  Public
 */
router.get('/test', (req, res) => {
  res.json({
    success: true,
    message: 'User routes working',
    timestamp: new Date().toISOString(),
  });
});

// ============================================================================
// USER ROUTES (Authenticated)
// ============================================================================
router.use(authMiddleware); // All routes below require authentication

// Profile management
router.get('/profile', userController.getProfile);
router.put('/profile', 
  userController.upload.single('profilePicture'),
  updateProfileValidation,
  handleValidationErrors,
  userController.updateProfile
);

// Account management
router.put('/change-email', userController.changeEmail);
router.put('/change-password', 
  changePasswordValidation,
  handleValidationErrors,
  userController.changePassword
);

// Fingerprint management
router.post('/register-fingerprint',
  fingerprintValidation,
  handleValidationErrors,
  userController.registerFingerprint
);

// ============================================================================
// ADMIN ROUTES
// ============================================================================
router.get('/', requireRole(['ADMIN']), userController.getAllUsers);
router.get('/:id', requireRole(['ADMIN']), userController.getUserById);

module.exports = router;