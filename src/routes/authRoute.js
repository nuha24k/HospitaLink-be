const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { registerValidation, loginValidation } = require('../middlewares/validation');
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
// MOBILE AUTHENTICATION (Patients Only)
// ============================================================================

/**
 * @route   POST /api/auth/mobile/register
 * @desc    Register new user (mobile app)
 * @access  Public
 */
router.post('/mobile/register',
  registerValidation,
  handleValidationErrors,
  authController.registerUser
);

/**
 * @route   POST /api/auth/mobile/login
 * @desc    Login user (mobile app)
 * @access  Public
 */
router.post('/mobile/login',
  loginValidation,
  handleValidationErrors,
  authController.loginUser
);

/**
 * @route   POST /api/auth/mobile/fingerprint-login
 * @desc    Login user with fingerprint (mobile app)
 * @access  Public
 */
router.post('/mobile/fingerprint-login', authController.fingerprintLogin);

/**
 * @route   POST /api/auth/mobile/fingerprint-verify
 * @desc    Verify fingerprint data for user (mobile app)
 * @access  Public
 */
router.post('/mobile/fingerprint-verify', authController.fingerprintVerify);

/**
 * @route   GET /api/auth/test
 * @desc    Test auth routes
 * @access  Public
 */
router.get('/test', (req, res) => {
  res.json({
    success: true,
    message: 'Auth routes working (mobile only)',
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;