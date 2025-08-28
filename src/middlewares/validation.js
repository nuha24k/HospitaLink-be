const { body, query, param } = require('express-validator');

// Auth validations
const registerValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one lowercase letter, one uppercase letter, and one number'),
  body('fullName')
    .notEmpty()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Full name must be between 2 and 100 characters'),
  body('phone')
    .optional()
    .isMobilePhone('id-ID')
    .withMessage('Please provide a valid Indonesian phone number'),
  body('nik')
    .optional()
    .isLength({ min: 16, max: 16 })
    .isNumeric()
    .withMessage('NIK must be exactly 16 digits'),
  body('gender')
    .optional()
    .isIn(['MALE', 'FEMALE'])
    .withMessage('Gender must be either MALE or FEMALE'),
  body('dateOfBirth')
    .optional()
    .isISO8601()
    .withMessage('Please provide a valid date of birth'),
  body('fingerprintData')
    .optional()
    .isString()
    .withMessage('Fingerprint data must be a string'),
];

// Simplified login validation
const loginValidation = [
  body('email')
    .optional()
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  body('nik')
    .optional()
    .isLength({ min: 16, max: 16 })
    .isNumeric()
    .withMessage('NIK must be exactly 16 digits'),
  body('password')
    .optional()
    .notEmpty()
    .withMessage('Password is required when not using fingerprint'),
  body('fingerprintData')
    .optional()
    .isString()
    .withMessage('Fingerprint data must be a string'),
  body('loginType')
    .optional()
    .isIn(['patient', 'doctor'])
    .withMessage('Login type must be either patient or doctor'),
];

const updateProfileValidation = [
  body('fullName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Full name must be between 2 and 100 characters'),
  body('phone')
    .optional()
    .isMobilePhone('id-ID')
    .withMessage('Please provide a valid Indonesian phone number'),
  body('gender')
    .optional()
    .isIn(['MALE', 'FEMALE'])
    .withMessage('Gender must be either MALE or FEMALE'),
  body('dateOfBirth')
    .optional()
    .isISO8601()
    .withMessage('Please provide a valid date of birth'),
];

const changePasswordValidation = [
  body('currentPassword')
    .notEmpty()
    .withMessage('Current password is required'),
  body('newPassword')
    .isLength({ min: 6 })
    .withMessage('New password must be at least 6 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('New password must contain at least one lowercase letter, one uppercase letter, and one number'),
];

const fingerprintValidation = [
  body('fingerprintData')
    .notEmpty()
    .isString()
    .withMessage('Fingerprint data is required and must be a string'),
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
  idValidation,
  paginationValidation,
};