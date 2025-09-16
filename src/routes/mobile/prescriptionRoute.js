const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../../middlewares/auth');
const prescriptionController = require('../../controllers/mobile/prescriptionController');

// Get prescription history
router.get('/history', authMiddleware, prescriptionController.getPrescriptionHistory);

// Get prescription detail
router.get('/:prescriptionId', authMiddleware, prescriptionController.getPrescriptionDetail);

// Pay for prescription
router.post('/:prescriptionId/pay', authMiddleware, prescriptionController.payPrescription);

// Get lab results
router.get('/lab-results', authMiddleware, prescriptionController.getLabResults);

// Mark lab result as read
router.patch('/lab-results/:labResultId/read', authMiddleware, prescriptionController.markLabResultAsRead);

module.exports = router;