const express = require('express');
const router = express.Router();
const doctorController = require('../../../controllers/web/admin/doctorController');
const { body } = require('express-validator');
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

// Validation rules
const doctorValidation = [
    body('email').isEmail().withMessage('Email harus valid'),
    body('fullName').notEmpty().withMessage('Nama lengkap wajib diisi'),
    body('licenseNumber').notEmpty().withMessage('Nomor lisensi wajib diisi'),
    body('specialty').notEmpty().withMessage('Spesialisasi wajib diisi'),
    body('phone').optional().isMobilePhone('id-ID').withMessage('Format nomor telepon tidak valid'),
    body('gender').optional().isIn(['MALE', 'FEMALE']).withMessage('Gender harus MALE atau FEMALE'),
    body('consultationFee').optional().isNumeric().withMessage('Biaya konsultasi harus berupa angka')
];

const updateDoctorValidation = [
    body('fullName').optional().notEmpty().withMessage('Nama lengkap tidak boleh kosong'),
    body('licenseNumber').optional().notEmpty().withMessage('Nomor lisensi tidak boleh kosong'),
    body('specialty').optional().notEmpty().withMessage('Spesialisasi tidak boleh kosong'),
    body('phone').optional().isMobilePhone('id-ID').withMessage('Format nomor telepon tidak valid'),
    body('gender').optional().isIn(['MALE', 'FEMALE']).withMessage('Gender harus MALE atau FEMALE'),
    body('consultationFee').optional().isNumeric().withMessage('Biaya konsultasi harus berupa angka')
];

/**
 * @route   GET /api/web/admin/doctors
 * @desc    Get all doctors with pagination
 * @access  Admin only
 */
router.get('/', doctorController.getDoctors);

/**
 * @route   GET /api/web/admin/doctors/search
 * @desc    Search doctors
 * @access  Admin only
 */
router.get('/search', doctorController.searchDoctors);

/**
 * @route   GET /api/web/admin/doctors/:id
 * @desc    Get doctor by ID
 * @access  Admin only
 */
router.get('/:id', doctorController.getDoctorById);

/**
 * @route   POST /api/web/admin/doctors
 * @desc    Create new doctor
 * @access  Admin only
 */
router.post('/',
    doctorValidation.concat([
        body('password').isLength({ min: 6 }).withMessage('Password minimal 6 karakter')
    ]),
    handleValidationErrors,
    doctorController.createDoctor
);

/**
 * @route   PUT /api/web/admin/doctors/:id
 * @desc    Update doctor
 * @access  Admin only
 */
router.put('/:id',
    updateDoctorValidation,
    handleValidationErrors,
    doctorController.updateDoctor
);

/**
 * @route   DELETE /api/web/admin/doctors/:id
 * @desc    Delete/deactivate doctor
 * @access  Admin only
 */
router.delete('/:id', doctorController.deleteDoctor);

module.exports = router;