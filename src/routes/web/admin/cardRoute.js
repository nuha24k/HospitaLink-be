const express = require('express');
const router = express.Router();
const cardController = require('../../../controllers/web/admin/cardController');
const { authWebMiddleware, requireRole } = require('../../../middlewares/auth');
const { query } = require('express-validator');
const { validationResult } = require('express-validator');

// Validation middleware
const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            message: 'Validation failed',
            errors: errors.array()
        });
    }
    next();
};

// Apply authentication middleware
router.use(authWebMiddleware);
router.use(requireRole(['ADMIN']));

/**
 * @route   GET /api/web/admin/cards
 * @desc    Get patient cards for admin dashboard
 * @access  Admin only
 */
router.get('/',
    [
        query('page').optional().isInt({ min: 1 }),
        query('limit').optional().isInt({ min: 1, max: 100 }),
        query('search').optional().isString()
    ],
    handleValidationErrors,
    cardController.getCards
);

/**
 * @route   GET /api/web/admin/cards/:id
 * @desc    Get specific patient card
 * @access  Admin only
 */
router.get('/:id', cardController.getCardById);

/**
 * @route   GET /api/web/admin/cards/:id/download
 * @desc    Download patient card as PDF
 * @access  Admin only
 */
router.get('/:id/download', cardController.downloadCardPdf);

module.exports = router;