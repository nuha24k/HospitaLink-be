const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../../middlewares/auth');
const transactionController = require('../../controllers/transactionController');

router.get('/history', authMiddleware, transactionController.getUserTransactions);
router.get('/pending', authMiddleware, transactionController.getPendingPayments);
router.get('/:transactionId', authMiddleware, transactionController.getTransactionById);

router.post('/pay-prescription/:prescriptionId', authMiddleware, transactionController.createPrescriptionPayment);
router.post('/pay-consultation/:consultationId', authMiddleware, transactionController.createConsultationPayment);

router.post('/midtrans/notification', transactionController.handleMidtransNotification);
router.get('/payment-status/:orderId', authMiddleware, transactionController.checkPaymentStatus);

module.exports = router;