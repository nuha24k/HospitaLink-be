const express = require('express');
const router = express.Router();
const { body } = require('express-validator');

const queueController = require('../../../controllers/web/doctor/queueController');
const { handleValidationErrors } = require('../../../middlewares/validation');

// Get queues
router.get('/today', queueController.getTodayQueueWeb);
router.get('/active', queueController.getActiveQueue);
router.get('/waiting', queueController.getWaitingQueues);
router.get('/history', queueController.getQueueHistory);

// Queue actions
router.post('/call-next', queueController.callNextPatientWeb);

// ✅ ENHANCED: Complete consultation with lab tests and prescriptions
router.post('/complete', 
  [
    body('queueId').isUUID().withMessage('Queue ID must be valid UUID'),
    body('diagnosis').isString().isLength({ min: 10 }).withMessage('Diagnosis must be at least 10 characters'),
    body('treatment').isString().isLength({ min: 10 }).withMessage('Treatment must be at least 10 characters'),
    body('notes').optional().isString(),
    body('prescriptions').optional().isArray(),
    body('prescriptions.*.medicationName').optional().isString(),
    body('prescriptions.*.quantity').optional().isInt({ min: 1 }),
    body('labTests').optional().isArray(),
    body('labTests.*.testName').optional().isString(),
    body('labTests.*.testType').optional().isString(),
    body('followUpDays').optional().isInt({ min: 1, max: 90 }),
    body('vitalSigns').optional().isObject()
  ],
  handleValidationErrors,
  queueController.completeConsultationWeb
);

router.post('/skip', 
  body('queueId').isUUID(),
  body('reason').optional().isString(),
  handleValidationErrors,
  queueController.skipPatientWeb
);

module.exports = router;