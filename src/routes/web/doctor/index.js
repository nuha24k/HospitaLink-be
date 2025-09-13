const express = require('express');
const router = express.Router();

const { authWebMiddleware, requireRole } = require('../../../middlewares/auth');

// Import sub-routes
const dashboardRoutes = require('./dashboard');
const queueRoutes = require('./queue');
const prescriptionRoutes = require('./prescription');
const consultationRoutes = require('./consultation');
const chatRoutes = require('./chat');

// Public routes (no auth needed)
router.use('/dashboard', dashboardRoutes);

// Test route
router.get('/test', (req, res) => {
  res.json({
    success: true,
    message: 'Doctor web routes working',
    timestamp: new Date().toISOString(),
  });
});

// Apply auth middleware for all protected routes
router.use(authWebMiddleware);
router.use(requireRole(['DOCTOR']));

// Protected sub-routes
router.use('/queue', queueRoutes);
router.use('/prescriptions', prescriptionRoutes);
router.use('/consultations', consultationRoutes);
router.use('/chat', chatRoutes);

module.exports = router;