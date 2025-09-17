// Update: HospitaLink-be/src/routes/web/doctor/chat.js
const express = require('express');
const router = express.Router();
const { body, param } = require('express-validator');
const { handleValidationErrors } = require('../../../middlewares/validation');

const chatController = require('../../../controllers/web/doctor/chatController');

// Test route
router.get('/test', (req, res) => {
  res.json({
    success: true,
    message: 'Chat routes working',
    user: req.user?.id,
    role: req.user?.role,
    timestamp: new Date().toISOString()
  });
});

// Get active chat sessions
router.get('/sessions', chatController.getActiveChatSessions);

// Get specific chat conversation
router.get('/conversation/:consultationId', 
  param('consultationId').isUUID().withMessage('Invalid consultation ID'),
  handleValidationErrors,
  chatController.getChatConversation
);

// Send message in chat
router.post('/conversation/:consultationId/message',
  [
    param('consultationId').isUUID().withMessage('Invalid consultation ID'),
    body('message').optional().isString().isLength({ min: 1, max: 1000 }).withMessage('Message must be 1-1000 characters'),
    body('type').optional().isIn(['text', 'image', 'file']).withMessage('Invalid message type'),
    body('attachments').optional().isArray().withMessage('Attachments must be an array')
  ],
  handleValidationErrors,
  chatController.sendMessage
);

// Complete chat consultation - FIXED VALIDATION
router.post('/conversation/:consultationId/complete',
  [
    param('consultationId').isUUID().withMessage('Invalid consultation ID'),
    body('diagnosis')
      .isString().withMessage('Diagnosis must be a string')
      .isLength({ min: 10, max: 500 }).withMessage('Diagnosis must be 10-500 characters'),
    body('treatment')
      .isString().withMessage('Treatment must be a string') 
      .isLength({ min: 10, max: 1000 }).withMessage('Treatment must be 10-1000 characters'),
    body('doctorNotes')
      .optional()
      .isString().withMessage('Doctor notes must be a string')
      .isLength({ max: 2000 }).withMessage('Doctor notes max 2000 characters'),
    body('prescriptions')
      .optional()
      .isArray().withMessage('Prescriptions must be an array'),
    body('prescriptions.*.medicationId')
      .optional()
      .isString().withMessage('Medication ID must be a string'),
    body('prescriptions.*.quantity')
      .optional()
      .isInt({ min: 1 }).withMessage('Quantity must be a positive integer'),
    body('followUpDays')
      .optional()
      .isInt({ min: 1, max: 90 }).withMessage('Follow up must be 1-90 days'),
    body('decision')
      .optional()
      .isIn(['PRESCRIPTION_ONLY', 'APPOINTMENT_NEEDED', 'SELF_CARE', 'EMERGENCY_REFERRAL'])
      .withMessage('Invalid decision type')
  ],
  handleValidationErrors,
  chatController.completeChatConsultation
);

module.exports = router;