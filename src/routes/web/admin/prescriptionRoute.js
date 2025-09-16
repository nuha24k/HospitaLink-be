const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { validationResult } = require('express-validator');

// Import controller
const prescriptionController = require('../../../controllers/web/admin/prescriptionController');

// Validation middleware
const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            message: 'Validation failed',
            errors: errors.array(),
        });
    }
    next();
};

// ============================================================================
// PRESCRIPTION MANAGEMENT ROUTES
// ============================================================================

/**
 * @route   GET /api/web/admin/prescriptions/search-medications
 * @desc    Search medications for prescription
 * @access  Admin only
 */
router.get('/search-medications', prescriptionController.searchMedications);

/**
 * @route   GET /api/web/admin/prescriptions/medication-categories
 * @desc    Get medication categories
 * @access  Admin only
 */
router.get('/medication-categories', prescriptionController.getMedicationCategories);

/**
 * @route   GET /api/web/admin/prescriptions/medication/:id
 * @desc    Get medication detail
 * @access  Admin only
 */
router.get('/medication/:id', prescriptionController.getMedicationDetail);

/**
 * @route   GET /api/web/admin/prescriptions/code/:code
 * @desc    Get prescription detail by code
 * @access  Admin only
 */
router.get('/code/:code', prescriptionController.getPrescriptionByCode);

/**
 * @route   GET /api/web/admin/prescriptions/:id
 * @desc    Get prescription detail by ID
 * @access  Admin only
 */
router.get('/:id', prescriptionController.getPrescriptionDetail);

/**
 * @route   PUT /api/web/admin/prescriptions/:id/payment
 * @desc    Update prescription payment status
 * @access  Admin only
 */
router.put('/:id/payment', 
    body('paymentStatus').optional().isIn(['PENDING', 'PAID', 'FAILED']).withMessage('Invalid payment status'),
    body('paymentMethod').optional().isIn(['CASH', 'INSURANCE', 'CREDIT_CARD', 'BANK_TRANSFER']).withMessage('Invalid payment method'),
    body('pharmacyNotes').optional().isString().withMessage('Pharmacy notes must be a string'),
    handleValidationErrors,
    prescriptionController.updatePrescriptionPayment
);

/**
 * @route   PUT /api/web/admin/prescriptions/:id/dispense
 * @desc    Mark prescription as dispensed
 * @access  Admin only
 */
router.put('/:id/dispense',
    body('pharmacyNotes').optional().isString().withMessage('Pharmacy notes must be a string'),
    handleValidationErrors,
    prescriptionController.dispensePrescription
);

/**
 * @route   GET /api/web/admin/prescriptions
 * @desc    Get prescription history with filters
 * @access  Admin only
 */
router.get('/', prescriptionController.getPrescriptionHistory);

module.exports = router;