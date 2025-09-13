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

router.post('/complete', 
  body('queueId').isUUID(),
  body('notes').optional().isString(),
  body('diagnosis').optional().isString(),
  body('treatment').optional().isString(),
  body('prescriptions').optional().isArray(),
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