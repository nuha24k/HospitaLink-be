const express = require('express');
const router = express.Router();
const { body } = require('express-validator');

const dashboardController = require('../../../controllers/web/doctor/dashboardController');
const { handleValidationErrors } = require('../../../middlewares/validation');
const { authWebMiddleware } = require('../../../middlewares/auth');

// Protected routes
router.get('/', authWebMiddleware, dashboardController.getDoctorDashboard);

module.exports = router;