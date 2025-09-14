const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../../middlewares/auth');
const notificationController = require('../../controllers/mobile/notificationController');

// Apply auth middleware to all routes
router.use(authMiddleware);

// Get all notifications with filtering and pagination
router.get('/', notificationController.getNotifications);

// Mark single notification as read
router.put('/:notificationId/read', notificationController.markAsRead);

// Mark all notifications as read
router.put('/read-all', notificationController.markAllAsRead);

// Delete single notification
router.delete('/:notificationId', notificationController.deleteNotification);

// Clear all notifications
router.delete('/', notificationController.clearAllNotifications);

// Create notification (for testing/admin)
router.post('/', notificationController.createNotification);

// Notification templates
router.post('/queue', notificationController.sendQueueNotification);
router.post('/appointment-reminder', notificationController.sendAppointmentReminder);
router.post('/lab-result', notificationController.sendLabResultNotification);

module.exports = router;