const express = require('express');
const router = express.Router();
const doctorController = require('../../../controllers/web/admin/doctorController');
const { authWebMiddleware, requireRole } = require('../../../middlewares/auth');
const { body, query } = require('express-validator');
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
router.get('/',
    [
        query('page').optional().isInt({ min: 1 }),
        query('limit').optional().isInt({ min: 1, max: 100 }),
        query('search').optional().isString()
    ],
    handleValidationErrors,
    doctorController.getDoctors
);

/**
 * @route   GET /api/web/admin/doctors/attendance
 * @desc    Get doctors attendance status
 * @access  Admin only
 */
router.get('/attendance',
    [
        query('page').optional().isInt({ min: 1 }),
        query('limit').optional().isInt({ min: 1, max: 100 }),
        query('search').optional().isString(),
        query('specialty').optional().isString(),
        query('status').optional().isIn(['ALL', 'ON_DUTY', 'AVAILABLE', 'OFFLINE'])
    ],
    handleValidationErrors,
    doctorController.getDoctorsAttendance
);

/**
 * @route   GET /api/web/admin/doctors/schedule-summary
 * @desc    Get doctor schedule summary for specific date
 * @access  Admin only
 */
router.get('/schedule-summary',
    [
        query('date').optional().isISO8601().withMessage('Format tanggal harus YYYY-MM-DD')
    ],
    handleValidationErrors,
    doctorController.getDoctorScheduleSummary
);

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
 * @route   PATCH /api/web/admin/doctors/:id/duty-status
 * @desc    Update doctor duty status
 * @access  Admin only
 */
router.patch('/:id/duty-status',
    [
        body('isOnDuty').isBoolean().withMessage('Status bertugas harus berupa boolean')
    ],
    handleValidationErrors,
    doctorController.updateDoctorDutyStatus
);

/**
 * @route   PATCH /api/web/admin/doctors/:id/availability
 * @desc    Update doctor availability
 * @access  Admin only
 */
router.patch('/:id/availability',
    [
        body('isAvailable').isBoolean().withMessage('Status ketersediaan harus berupa boolean')
    ],
    handleValidationErrors,
    doctorController.updateDoctorAvailability
);

/**
 * @route   DELETE /api/web/admin/doctors/:id
 * @desc    Delete/deactivate doctor
 * @access  Admin only
 */
router.delete('/:id', doctorController.deleteDoctor);

module.exports = router;