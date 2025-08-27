const express = require('express');
const router = express.Router();
const { register, login } = require('../controllers/authController');
const { authMiddleware, checkRole } = require('../middlewares/auth');

// Use multiple single uploads instead of fields
router.post('/register', register);

router.post('/login', login);


module.exports = router;