const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { validationResult } = require('express-validator');

// Import controller
const checkinPatientController = require('../../../controllers/web/admin/checkinPatientController');

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

/**
 * @route   POST /api/web/admin/checkin
 * @desc    Check in patient via QR code scan
 * @access  Admin only
 */
router.post('/', 
  body('qrCode')
    .exists()
    .withMessage('QR Code is required')
    .isString()
    .withMessage('QR Code must be a string')
    .trim()
    .isLength({ min: 1 })
    .withMessage('QR Code cannot be empty'),
  handleValidationErrors,
  checkinPatientController.checkinPatientByQR
);

/**
 * @route   GET /api/web/admin/checkin/queue-status
 * @desc    Get current queue status for today
 * @access  Admin only
 */
router.get('/queue-status', checkinPatientController.getQueueStatus);

/**
 * @route   PATCH /api/web/admin/checkin/call-next
 * @desc    Update queue status (call next patient)
 * @access  Admin only
 */
router.patch('/call-next',
  body('doctorId')
    .optional()
    .isString()
    .withMessage('Doctor ID must be a string'),
  handleValidationErrors,
  checkinPatientController.callNextPatient
);

module.exports = router;