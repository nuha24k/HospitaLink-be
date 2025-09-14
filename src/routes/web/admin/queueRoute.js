const express = require('express');
const router = express.Router();
const { query } = require('express-validator');

const queueController = require('../../../controllers/web/admin/queueController');
const { handleValidationErrors } = require('../../../middlewares/validation');

/**
 * @route   GET /api/web/admin/queues
 * @desc    Get all queues with pagination and filters
 * @access  Admin only
 */
router.get('/', 
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601(),
  query('status').optional().isIn(['WAITING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'ALL']),
  query('doctorId').optional().isUUID(),
  query('search').optional().isString(),
  handleValidationErrors,
  queueController.getQueues
);

/**
 * @route   GET /api/web/admin/queues/today
 * @desc    Get today's queues summary
 * @access  Admin only
 */
router.get('/today', queueController.getTodayQueues);

/**
 * @route   GET /api/web/admin/queues/history
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
 * @route   GET /api/web/admin/queues/analytics
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
 * @route   GET /api/web/admin/queues/:id
 * @desc    Get queue by ID with full details
 * @access  Admin only
 */
router.get('/:id', 
  queueController.getQueueById
);

module.exports = router;