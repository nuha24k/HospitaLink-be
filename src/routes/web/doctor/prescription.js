const express = require('express');
const router = express.Router();
const { body, param, query } = require('express-validator');

const prescriptionController = require('../../../controllers/web/doctor/prescriptionController');
const { handleValidationErrors } = require('../../../middlewares/validation');

// Medication search & info routes
router.get('/medications/search',
  [
    query('q').isLength({ min: 2 }).withMessage('Query minimal 2 karakter'),
    query('category').optional().isString(),
    query('limit').optional().isInt({ min: 1, max: 50 })
  ],
  handleValidationErrors,
  prescriptionController.searchMedications
);

router.get('/medications/categories', 
  prescriptionController.getMedicationCategories
);

router.get('/medications/:id',
  param('id').isUUID(),
  handleValidationErrors,
  prescriptionController.getMedicationDetail
);

// Prescription routes
router.get('/today', prescriptionController.getTodayPrescriptions);

router.get('/history',
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 50 }),
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
    query('status').optional().isIn(['paid', 'pending', 'dispensed'])
  ],
  handleValidationErrors,
  prescriptionController.getPrescriptionHistory
);

router.get('/:id', 
  param('id').isUUID(),
  handleValidationErrors,
  prescriptionController.getPrescriptionDetail
);

// Create prescription
router.post('/',
  [
    body('userId').isUUID().withMessage('User ID harus valid UUID'),
    body('medications').isArray({ min: 1 }).withMessage('Minimal 1 obat harus dipilih'),
    body('medications.*.medicationId').isUUID().withMessage('Medication ID harus valid'),
    body('medications.*.quantity').isInt({ min: 1 }).withMessage('Kuantitas minimal 1'),
    body('medications.*.dosageInstructions').optional().isString(),
    body('medications.*.frequency').optional().isString(),
    body('medications.*.duration').optional().isString(),
    body('consultationId').optional().isUUID(),
    body('appointmentId').optional().isUUID(),
    body('instructions').optional().isString()
  ],
  handleValidationErrors,
  prescriptionController.createPrescription
);

module.exports = router;