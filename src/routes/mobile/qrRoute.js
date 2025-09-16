// Create: HospitaLink-be/src/routes/mobile/qrRoute.js
const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../../middlewares/auth');
const qrController = require('../../controllers/mobile/qrController');

// Generate user QR code
router.post('/generate', authMiddleware, qrController.generateUserQR);

// Validate QR code (for staff scanning)
router.post('/validate', authMiddleware, qrController.validateQR);

// Get user QR data
router.get('/user-qr', authMiddleware, qrController.getUserQR);

// QR scan actions (for scanning machine QRs)
router.post('/scan-action', authMiddleware, qrController.handleQRScan);

module.exports = router;