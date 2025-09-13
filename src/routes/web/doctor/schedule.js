const express = require('express');
const router = express.Router();
const { query } = require('express-validator');

const scheduleController = require('../../../controllers/web/doctor/scheduleController');
const { handleValidationErrors } = require('../../../middlewares/validation');

// Get current week schedule
router.get('/current-week', scheduleController.getCurrentWeekSchedule);

// Get specific week schedule
router.get('/week', 
  [
    query('offset').optional().isInt({ min: -52, max: 52 }).withMessage('Offset must be between -52 and 52')
  ],
  handleValidationErrors,
  scheduleController.getWeekSchedule
);

// Get upcoming schedules with pagination
router.get('/upcoming',
  [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be positive integer'),
    query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50'),
    query('startDate').optional().isISO8601().withMessage('Invalid start date format'),
    query('endDate').optional().isISO8601().withMessage('Invalid end date format')
  ],
  handleValidationErrors,
  scheduleController.getUpcomingSchedules
);

// Get schedule by specific date
router.get('/date/:date',
  scheduleController.getScheduleByDate
);

// Get schedule statistics
router.get('/stats',
  [
    query('period').optional().isIn(['week', 'month']).withMessage('Period must be week or month')
  ],
  handleValidationErrors,
  scheduleController.getScheduleStats
);

module.exports = router;