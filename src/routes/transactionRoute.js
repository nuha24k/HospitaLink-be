const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middlewares/auth');
const transactionController = require('../controllers/transactionController');

// User routes
router.get('/my-transactions', authMiddleware, transactionController.getUserTransactions);
router.get('/pending-payments', authMiddleware, transactionController.getPendingPayments);
router.get('/:transactionId', authMiddleware, transactionController.getTransactionById);

// Payment routes
router.post('/prescription/:prescriptionId/pay', authMiddleware, transactionController.createPrescriptionPayment);
router.post('/consultation/:consultationId/pay', authMiddleware, transactionController.createConsultationPayment);

// Admin routes
router.get('/admin/all', authMiddleware, transactionController.getAllTransactions);

module.exports = router;