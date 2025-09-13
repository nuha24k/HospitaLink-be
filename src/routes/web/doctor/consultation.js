const express = require('express');
const router = express.Router();
const { body, param } = require('express-validator');

const consultationController = require('../../../controllers/web/doctor/consultationController');
const { handleValidationErrors } = require('../../../middlewares/validation');

// Get consultations
router.get('/pending', consultationController.getPendingConsultationsWeb);

// Complete consultation
router.post('/:consultationId/complete', 
  param('consultationId').isUUID(),
  body('doctorDecision').isIn(['PRESCRIPTION_ONLY', 'APPOINTMENT_NEEDED', 'EMERGENCY_REFERRAL', 'SELF_CARE']),
  body('doctorNotes').optional().isString(),
  body('prescriptions').optional().isArray(),
  body('followUpInDays').optional().isInt({ min: 1, max: 90 }),
  handleValidationErrors,
  consultationController.completeOnlineConsultationWeb
);

module.exports = router;