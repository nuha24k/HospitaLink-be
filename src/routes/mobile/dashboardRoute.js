const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../../middlewares/auth');
const dashboardController = require('../../controllers/mobile/dashboardController');

// Apply auth middleware to all routes
router.use(authMiddleware);

// Get complete dashboard data
router.get('/', dashboardController.getDashboardData);

// Get quick stats only
router.get('/stats', dashboardController.getQuickStats);

module.exports = router;