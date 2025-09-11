const express = require('express');
const router = express.Router();
const consultationController = require('../controllers/consultationController');
const { authMiddleware, requireRole } = require('../middlewares/auth');
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

// AI Screening validation
const aiScreeningValidation = [
  body('symptoms').isArray({ min: 1 }).withMessage('Symptoms are required'),
  body('symptoms.*').isString().notEmpty().withMessage('Each symptom must be a non-empty string'),
  body('chatHistory').optional().isArray().withMessage('Chat history must be an array'),
];

/**
 * NEW FLOW ENDPOINTS
 */

// Step 1: AI Screening
router.post('/ai-screening', 
  authMiddleware,
  aiScreeningValidation, 
  handleValidationErrors, 
  consultationController.aiScreening
);

// Step 2: Request Doctor Chat (Asynchronous)
router.post('/request-doctor-chat', 
  authMiddleware,
  body('consultationId').isUUID().withMessage('Valid consultation ID is required'),
  body('paymentMethod').optional().isIn(['CASH', 'CREDIT_CARD', 'QRIS', 'BPJS']),
  handleValidationErrors,
  consultationController.requestDoctorChat
);

// Step 3: Complete Doctor Chat (Doctor endpoint - will be handled by web)
router.post('/complete-doctor-chat', 
  authMiddleware,
  requireRole(['DOCTOR']),
  body('consultationId').isUUID().withMessage('Valid consultation ID is required'),
  body('doctorDecision').isIn(['PRESCRIPTION_ONLY', 'APPOINTMENT_NEEDED', 'EMERGENCY_REFERRAL', 'SELF_CARE']).withMessage('Valid doctor decision is required'),
  body('doctorNotes').optional().isString(),
  body('prescriptions').optional().isArray(),
  body('followUpInDays').optional().isInt({ min: 1, max: 90 }),
  handleValidationErrors,
  consultationController.completeDoctorChat
);

// Step 4: Book Appointment from Consultation
router.post('/book-appointment-from-consultation', 
  authMiddleware,
  body('consultationId').isUUID().withMessage('Valid consultation ID is required'),
  body('selectedSlot').isObject().withMessage('Selected slot is required'),
  body('selectedSlot.doctorId').isUUID().withMessage('Valid doctor ID is required'),
  body('selectedSlot.appointmentDate').isISO8601().withMessage('Valid appointment date is required'),
  body('selectedSlot.startTime').isISO8601().withMessage('Valid start time is required'),
  body('paymentMethod').optional().isIn(['CASH', 'CREDIT_CARD', 'QRIS', 'BPJS']),
  handleValidationErrors,
  consultationController.bookAppointmentFromConsultation
);

// Direct queue (walk-in style)
router.post('/take-direct-queue', 
  authMiddleware,
  body('appointmentType').optional().isIn(['WALK_IN', 'SCHEDULED']),
  body('doctorId').optional().isUUID(),
  handleValidationErrors,
  consultationController.takeDirectQueue
);

// Get consultation history
router.get('/history/:userId', 
  authMiddleware,
  param('userId').isUUID().withMessage('Valid user ID is required'),
  handleValidationErrors,
  consultationController.getConsultationHistory
);

// Test AI connection
router.get('/test-ai', consultationController.testAIConnection);

/**
 * BACKWARD COMPATIBILITY (keep old endpoints)
 */
router.post('/request-doctor', consultationController.requestDoctorChat);
router.post('/complete', consultationController.completeDoctorChat);
router.post('/book-appointment', consultationController.bookAppointmentFromConsultation);

module.exports = router;