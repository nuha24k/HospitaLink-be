const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../../middlewares/auth');
const medicalHistoryController = require('../../controllers/mobile/medicalHistoryController');

// Get combined medical history
router.get('/combined-history', authMiddleware, medicalHistoryController.getCombinedHistory);

// Get medical records
router.get('/', authMiddleware, medicalHistoryController.getMedicalRecords);

// Get lab results
router.get('/lab-results', authMiddleware, medicalHistoryController.getLabResults);

// Get consultation history
router.get('/consultations/history', authMiddleware, medicalHistoryController.getConsultationHistory);

// Get queue history
router.get('/queues/history', authMiddleware, medicalHistoryController.getQueueHistory);

// Get prescription history
router.get('/prescriptions/history', authMiddleware, medicalHistoryController.getPrescriptionHistory);

module.exports = router;