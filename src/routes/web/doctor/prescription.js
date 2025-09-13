const express = require('express');
const router = express.Router();
const { body, param } = require('express-validator');

const prescriptionController = require('../../../controllers/web/doctor/prescriptionController');
const { handleValidationErrors } = require('../../../middlewares/validation');

// Get prescriptions
router.get('/today', prescriptionController.getTodayPrescriptions);
router.get('/history', prescriptionController.getPrescriptionHistory);
router.get('/:id', 
  param('id').isUUID(),
  handleValidationErrors,
  prescriptionController.getPrescriptionDetail
);

// Create prescription
router.post('/',
  body('userId').isUUID(),
  body('medications').isArray({ min: 1 }),
  body('consultationId').optional().isUUID(),
  body('appointmentId').optional().isUUID(),
  body('instructions').optional().isString(),
  body('totalAmount').optional().isNumeric(),
  handleValidationErrors,
  prescriptionController.createPrescription
);

module.exports = router;