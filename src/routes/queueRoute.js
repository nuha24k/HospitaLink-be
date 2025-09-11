const express = require('express');
const router = express.Router();
const queueController = require('../controllers/queueController');
const { authMiddleware, requireRole } = require('../middlewares/auth');

// ============================================================================
// PUBLIC ROUTES
// ============================================================================

/**
 * @route   GET /api/queue/test
 * @desc    Test queue routes
 * @access  Public
 */
router.get('/test', (req, res) => {
  res.json({
    success: true,
    message: 'Queue routes working',
    timestamp: new Date().toISOString(),
  });
});

// ============================================================================
// USER ROUTES (Authenticated)
// ============================================================================
router.use(authMiddleware); // All routes below require authentication

/**
 * @route   POST /api/queue/take
 * @desc    Take queue for consultation
 * @access  User only
 */
router.post('/take', requireRole(['USER']), queueController.takeQueue);

/**
 * @route   GET /api/queue/my-queue
 * @desc    Get user's current queue
 * @access  User only
 */
router.get('/my-queue', requireRole(['USER']), queueController.getMyQueue);

/**
 * @route   GET /api/queue/status/:queueId
 * @desc    Get queue status by ID
 * @access  Queue owner or Admin
 */
router.get('/status/:queueId', queueController.getQueueStatus);

/**
 * @route   PUT /api/queue/cancel/:queueId
 * @desc    Cancel queue
 * @access  Queue owner only
 */
router.put('/cancel/:queueId', requireRole(['USER']), queueController.cancelQueue);

// ============================================================================
// ADMIN ROUTES
// ============================================================================

/**
 * @route   GET /api/queue/today
 * @desc    Get today's all queues (Admin dashboard)
 * @access  Admin only
 */
router.get('/today', requireRole(['ADMIN']), queueController.getTodayQueues);

module.exports = router;