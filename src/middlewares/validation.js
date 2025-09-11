const { body, query, param } = require('express-validator');

// Auth validations
const registerValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long'),
  body('fullName')
    .isLength({ min: 2, max: 100 })
    .withMessage('Full name must be between 2 and 100 characters'),
  body('nik')
    .optional()
    .isLength({ min: 16, max: 16 })
    .isNumeric()
    .withMessage('NIK must be exactly 16 digits'),
  body('phone')
    .optional()
    .isMobilePhone('id-ID')
    .withMessage('Please provide a valid Indonesian phone number'),
];

// Simplified login validation
const loginValidation = [
  body('password')
    .notEmpty()
    .withMessage('Password is required'),
  body().custom((value, { req }) => {
    if (!req.body.email && !req.body.nik) {
      throw new Error('Either email or NIK is required');
    }
    return true;
  }),
];

// User profile validations
const updateProfileValidation = [
  body('phone')
    .optional()
    .isMobilePhone('id-ID')
    .withMessage('Please provide a valid Indonesian phone number'),
  body('gender')
    .optional()
    .isIn(['MALE', 'FEMALE'])
    .withMessage('Gender must be either MALE or FEMALE'),
];

const changePasswordValidation = [
  body('currentPassword')
    .notEmpty()
    .withMessage('Current password is required'),
  body('newPassword')
    .isLength({ min: 6 })
    .withMessage('New password must be at least 6 characters long'),
];

// Fingerprint validation
const fingerprintValidation = [
  body('fingerprintData')
    .notEmpty()
    .withMessage('Fingerprint data is required')
    .isString()
    .withMessage('Fingerprint data must be a string')
    .isLength({ min: 10 })
    .withMessage('Fingerprint data must be at least 10 characters'),
];

// Queue validations
const queueValidation = [
  body('appointmentType')
    .optional()
    .isIn(['CONSULTATION', 'CHECKUP', 'EMERGENCY'])
    .withMessage('Invalid appointment type'),
];

// Common validations
const idValidation = [
  param('id')
    .isUUID()
    .withMessage('Invalid ID format'),
];

const paginationValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
];

module.exports = {
  registerValidation,
  loginValidation,
  updateProfileValidation,
  changePasswordValidation,
  fingerprintValidation,
  queueValidation,
  idValidation,
  paginationValidation,
};