const express = require('express');
const router = express.Router();
const { body, param, query } = require('express-validator');
const { validationResult } = require('express-validator');

// Import controller
const medicationController = require('../../../controllers/web/admin/medicationController');

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

// Validation rules
const medicationValidation = [
  body('medicationCode')
    .notEmpty()
    .withMessage('Medication code is required')
    .isLength({ max: 50 })
    .withMessage('Medication code must not exceed 50 characters'),
  
  body('genericName')
    .notEmpty()
    .withMessage('Generic name is required')
    .isLength({ max: 255 })
    .withMessage('Generic name must not exceed 255 characters'),
  
  body('brandName')
    .optional()
    .isLength({ max: 255 })
    .withMessage('Brand name must not exceed 255 characters'),
  
  body('category')
    .notEmpty()
    .withMessage('Category is required')
    .isLength({ max: 100 })
    .withMessage('Category must not exceed 100 characters'),
  
  body('dosageForm')
    .notEmpty()
    .withMessage('Dosage form is required')
    .isLength({ max: 100 })
    .withMessage('Dosage form must not exceed 100 characters'),
  
  body('strength')
    .notEmpty()
    .withMessage('Strength is required')
    .isLength({ max: 50 })
    .withMessage('Strength must not exceed 50 characters'),
  
  body('unit')
    .notEmpty()
    .withMessage('Unit is required')
    .isLength({ max: 20 })
    .withMessage('Unit must not exceed 20 characters'),
  
  body('manufacturer')
    .optional()
    .isLength({ max: 255 })
    .withMessage('Manufacturer must not exceed 255 characters'),
  
  body('pricePerUnit')
    .notEmpty()
    .withMessage('Price per unit is required')
    .isFloat({ min: 0 })
    .withMessage('Price per unit must be a positive number'),
  
  body('stock')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Stock must be a non-negative integer'),
  
  body('minStock')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Minimum stock must be a non-negative integer'),
  
  body('maxStock')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Maximum stock must be a positive integer'),
  
  body('requiresPrescription')
    .optional()
    .isBoolean()
    .withMessage('Requires prescription must be a boolean'),
  
  body('isControlled')
    .optional()
    .isBoolean()
    .withMessage('Is controlled must be a boolean'),
  
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('Is active must be a boolean')
];

const updateMedicationValidation = [
  body('medicationCode')
    .optional()
    .isLength({ max: 50 })
    .withMessage('Medication code must not exceed 50 characters'),
  
  body('genericName')
    .optional()
    .isLength({ max: 255 })
    .withMessage('Generic name must not exceed 255 characters'),
  
  body('brandName')
    .optional()
    .isLength({ max: 255 })
    .withMessage('Brand name must not exceed 255 characters'),
  
  body('category')
    .optional()
    .isLength({ max: 100 })
    .withMessage('Category must not exceed 100 characters'),
  
  body('dosageForm')
    .optional()
    .isLength({ max: 100 })
    .withMessage('Dosage form must not exceed 100 characters'),
  
  body('strength')
    .optional()
    .isLength({ max: 50 })
    .withMessage('Strength must not exceed 50 characters'),
  
  body('unit')
    .optional()
    .isLength({ max: 20 })
    .withMessage('Unit must not exceed 20 characters'),
  
  body('manufacturer')
    .optional()
    .isLength({ max: 255 })
    .withMessage('Manufacturer must not exceed 255 characters'),
  
  body('pricePerUnit')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Price per unit must be a positive number'),
  
  body('stock')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Stock must be a non-negative integer'),
  
  body('minStock')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Minimum stock must be a non-negative integer'),
  
  body('maxStock')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Maximum stock must be a positive integer'),
  
  body('requiresPrescription')
    .optional()
    .isBoolean()
    .withMessage('Requires prescription must be a boolean'),
  
  body('isControlled')
    .optional()
    .isBoolean()
    .withMessage('Is controlled must be a boolean'),
  
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('Is active must be a boolean')
];

const stockUpdateValidation = [
  body('stock')
    .notEmpty()
    .withMessage('Stock value is required')
    .isInt({ min: 0 })
    .withMessage('Stock must be a non-negative integer'),
  
  body('operation')
    .optional()
    .isIn(['set', 'add', 'subtract'])
    .withMessage('Operation must be one of: set, add, subtract')
];

const idValidation = [
  param('id')
    .notEmpty()
    .withMessage('Medication ID is required')
    .isUUID()
    .withMessage('Invalid medication ID format')
];

// ============================================================================
// MEDICATION CRUD ROUTES
// ============================================================================

/**
 * @route   GET /api/web/admin/medications
 * @desc    Get all medications with pagination and filtering
 * @access  Admin only
 */
router.get('/', 
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('search').optional().isLength({ max: 255 }).withMessage('Search term too long'),
  query('category').optional().isLength({ max: 100 }).withMessage('Category too long'),
  query('isActive').optional().isBoolean().withMessage('isActive must be a boolean'),
  query('requiresPrescription').optional().isBoolean().withMessage('requiresPrescription must be a boolean'),
  query('isControlled').optional().isBoolean().withMessage('isControlled must be a boolean'),
  query('sortBy').optional().isIn(['genericName', 'brandName', 'category', 'pricePerUnit', 'stock', 'createdAt']).withMessage('Invalid sort field'),
  query('sortOrder').optional().isIn(['asc', 'desc']).withMessage('Sort order must be asc or desc'),
  handleValidationErrors,
  medicationController.getAllMedications
);

/**
 * @route   GET /api/web/admin/medications/statistics
 * @desc    Get medication statistics
 * @access  Admin only
 */
router.get('/statistics', 
  medicationController.getMedicationStatistics
);

/**
 * @route   GET /api/web/admin/medications/low-stock
 * @desc    Get low stock medications
 * @access  Admin only
 */
router.get('/low-stock', 
  medicationController.getLowStockMedications
);

/**
 * @route   GET /api/web/admin/medications/:id
 * @desc    Get medication by ID
 * @access  Admin only
 */
router.get('/:id', 
  idValidation,
  handleValidationErrors,
  medicationController.getMedicationById
);

/**
 * @route   POST /api/web/admin/medications
 * @desc    Create new medication
 * @access  Admin only
 */
router.post('/', 
  medicationValidation,
  handleValidationErrors,
  medicationController.createMedication
);

/**
 * @route   PUT /api/web/admin/medications/:id
 * @desc    Update medication
 * @access  Admin only
 */
router.put('/:id', 
  idValidation,
  updateMedicationValidation,
  handleValidationErrors,
  medicationController.updateMedication
);

/**
 * @route   PATCH /api/web/admin/medications/:id/stock
 * @desc    Update medication stock
 * @access  Admin only
 */
router.patch('/:id/stock', 
  idValidation,
  stockUpdateValidation,
  handleValidationErrors,
  medicationController.updateMedicationStock
);

/**
 * @route   DELETE /api/web/admin/medications/:id
 * @desc    Delete medication (soft delete by default)
 * @access  Admin only
 */
router.delete('/:id', 
  idValidation,
  query('permanent').optional().isBoolean().withMessage('Permanent must be a boolean'),
  handleValidationErrors,
  medicationController.deleteMedication
);

module.exports = router;