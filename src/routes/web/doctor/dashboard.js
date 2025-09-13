const express = require('express');
const router = express.Router();
const { body } = require('express-validator');

const dashboardController = require('../../../controllers/web/doctor/dashboardController');
const { handleValidationErrors } = require('../../../middlewares/validation');
const { authWebMiddleware } = require('../../../middlewares/auth');

// Public routes
router.post('/login', 
  body('nik').optional().isLength({ min: 16, max: 16 }),
  body('email').optional().isEmail(),
  body('password').optional().isLength({ min: 6 }),
  body('fingerprintData').optional().isString(),
  handleValidationErrors,
  dashboardController.loginDoctorWeb
);

router.post('/logout', dashboardController.logoutDoctorWeb);

// Protected routes
router.get('/', authWebMiddleware, dashboardController.getDoctorDashboard);

module.exports = router;