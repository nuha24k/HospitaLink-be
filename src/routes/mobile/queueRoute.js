// Create: HospitaLink-be/src/routes/mobile/queueRoute.js
const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../../middlewares/auth');
const queueController = require('../../controllers/mobile/queueController');

// Apply auth middleware
router.use(authMiddleware);

// Get active queue
router.get('/active', queueController.getActiveQueue);

// Get queue details
router.get('/:id', queueController.getQueueDetails);

// Cancel queue
router.patch('/:id/cancel', queueController.cancelQueue);

module.exports = router;