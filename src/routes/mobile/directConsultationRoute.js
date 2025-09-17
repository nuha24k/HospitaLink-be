const express = require('express');
const router = express.Router();
const directConsultationController = require('../../controllers/mobile/directConsultationController');
const { authMiddleware } = require('../../middlewares/auth');
const { body, param } = require('express-validator');
const { validationResult } = require('express-validator');

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

// ✅ Get available doctors for direct consultation
router.get('/available-doctors', 
  authMiddleware,
  directConsultationController.getAvailableDoctors
);

// ✅ FIXED: Start direct consultation with proper validation
router.post('/start', 
  authMiddleware,
  body('doctorId').isUUID().withMessage('Valid doctor ID is required'),
  body('symptoms').isArray({ min: 1 }).withMessage('Symptoms are required'),
  body('symptoms.*').isString().notEmpty().withMessage('Each symptom must be a non-empty string'),
  // ✅ FIXED: Allow optional notes, convert null to empty string
  body('notes').optional({ nullable: true }).isString().withMessage('Notes must be a string').customSanitizer(value => {
    return value === null || value === undefined ? '' : value;
  }),
  body('consultationType').optional().isIn(['CHAT', 'CALL']).withMessage('Invalid consultation type'),
  handleValidationErrors,
  directConsultationController.startDirectConsultation
);

// ✅ Get consultation details
router.get('/details/:consultationId', 
  authMiddleware,
  param('consultationId').isUUID().withMessage('Valid consultation ID is required'),
  handleValidationErrors,
  directConsultationController.getConsultationDetails
);

module.exports = router;