const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../../middlewares/auth');
const transactionController = require('../../controllers/transactionController');

// Mobile-specific transaction routes
router.get('/history', authMiddleware, transactionController.getUserTransactions);
router.get('/pending', authMiddleware, transactionController.getPendingPayments);
router.get('/:transactionId', authMiddleware, transactionController.getTransactionById);

// Payment routes for mobile
router.post('/pay-prescription/:prescriptionId', authMiddleware, transactionController.createPrescriptionPayment);
router.post('/pay-consultation/:consultationId', authMiddleware, transactionController.createConsultationPayment);

module.exports = router;