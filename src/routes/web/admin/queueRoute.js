const express = require('express');
const router = express.Router();
const { query } = require('express-validator');

const queueController = require('../../../controllers/web/admin/queueController');
const { handleValidationErrors } = require('../../../middlewares/validation');
const { requireRole } = require('../../../middlewares/auth');

/**
 * @route   GET /api/web/admin/queue
 * @desc    Get all queues with pagination and filters
 * @access  Admin only
 */
router.get('/', 
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601(),
  query('status').optional().isIn(['WAITING', 'CALLED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'ALL']),
  query('doctorId').optional().isUUID(),
  query('search').optional().isString(),
  handleValidationErrors,
  queueController.getQueues
);

/**
 * @route   GET /api/web/admin/queue/today
 * @desc    Get today's queues summary
 * @access  Admin only
 */
router.get('/today', queueController.getTodayQueues);

/**
 * @route   GET /api/web/admin/queue/history
 * @desc    Get queue history (completed queues)
 * @access  Admin only
 */
router.get('/history', 
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601(),
  query('doctorId').optional().isUUID(),
  query('search').optional().isString(),
  handleValidationErrors,
  queueController.getQueueHistory
);

/**
 * @route   GET /api/web/admin/queue/analytics
 * @desc    Get queue analytics and statistics
 * @access  Admin only
 */
router.get('/analytics', 
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601(),
  handleValidationErrors,
  queueController.getQueueAnalytics
);

/**
 * @route   PATCH /api/web/admin/queue/:queueId/call
 * @desc    Call patient (WAITING -> CALLED)
 * @access  Admin only
 */
router.patch('/:queueId/call', queueController.callPatient);

/**
 * @route   PATCH /api/web/admin/queue/:queueId/start
 * @desc    Start consultation (CALLED -> IN_PROGRESS)
 * @access  Admin only
 */
router.patch('/:queueId/start', queueController.startConsultation);

/**
 * @route   PATCH /api/web/admin/queue/:queueId/complete
 * @desc    Complete consultation (IN_PROGRESS -> COMPLETED)
 * @access  Admin only
 */
router.patch('/:queueId/complete', queueController.completeConsultation);

/**
 * @route   PATCH /api/web/admin/queue/:queueId/cancel
 * @desc    Cancel queue (Any status -> CANCELLED)
 * @access  Admin only
 */
router.patch('/:queueId/cancel', queueController.cancelQueue);

/**
 * @route   GET /api/web/admin/queue/:id
 * @desc    Get queue by ID with full details
 * @access  Admin only
 */
router.get('/:id', queueController.getQueueById);

module.exports = router;