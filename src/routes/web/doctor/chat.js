// Update: HospitaLink-be/src/routes/web/doctor/chat.js
const express = require('express');
const router = express.Router();
const { body, param } = require('express-validator');
const { handleValidationErrors } = require('../../../middlewares/validation');

const chatController = require('../../../controllers/web/doctor/chatController');

// Test route untuk debugging
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
  param('consultationId').isUUID(),
  handleValidationErrors,
  chatController.getChatConversation
);

// Send message in chat
router.post('/conversation/:consultationId/message',
  [
    param('consultationId').isUUID(),
    body('message').optional().isString().isLength({ min: 1, max: 1000 }),
    body('type').optional().isIn(['text', 'image', 'file']),
    body('attachments').optional().isArray()
  ],
  handleValidationErrors,
  chatController.sendMessage
);

// Complete chat consultation
router.post('/conversation/:consultationId/complete',
  [
    param('consultationId').isUUID(),
    body('decision').isIn(['PRESCRIPTION_ONLY', 'APPOINTMENT_NEEDED', 'SPECIALIST_REFERRAL', 'SELF_CARE', 'EMERGENCY_REFERRAL']),
    body('doctorNotes').isString().isLength({ min: 10, max: 2000 }),
    body('prescriptions').optional().isArray(),
    body('followUpDays').optional().isInt({ min: 1, max: 30 }),
    body('referralSpecialty').optional().isString(),
    body('appointmentNeeded').optional().isBoolean()
  ],
  handleValidationErrors,
  chatController.completeChatConsultation
);

module.exports = router;