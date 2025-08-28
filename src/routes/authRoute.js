const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// ============================================================================
// PUBLIC ROUTES (No Authentication Required)
// ============================================================================

/**
 * @route   POST /api/auth/register
 * @desc    Register new patient (mobile app)
 * @access  Public
 */
router.post('/register', authController.registerPatient);

/**
 * @route   POST /api/auth/login
 * @desc    Login for mobile app (patients/doctors)
 * @access  Public
 */
router.post('/login', authController.loginMobile);

/**
 * @route   POST /api/auth/mobile/register
 * @desc    Register new patient (mobile app - explicit)
 * @access  Public
 */
router.post('/mobile/register', authController.registerPatient);

/**
 * @route   POST /api/auth/mobile/login
 * @desc    Login for mobile app (patients/doctors - explicit)
 * @access  Public
 */
router.post('/mobile/login', authController.loginMobile);

/**
 * @route   POST /api/auth/web/login
 * @desc    Login for web platform (hospital staff)
 * @access  Public
 */
router.post('/web/login', authController.loginWeb);

// ============================================================================
// TEST ROUTES
// ============================================================================

/**
 * @route   GET /api/auth/test
 * @desc    Test auth routes
 * @access  Public
 */
router.get('/test', (req, res) => {
  res.json({
    success: true,
    message: 'Auth routes working',
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;