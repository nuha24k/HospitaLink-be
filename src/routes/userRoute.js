const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authMiddleware, checkRole } = require('../middlewares/auth');


router.get('/', userController.getAllUsers);           // Menjadi /api/users
router.get('/:id', userController.getUserById);        // Menjadi /api/users/:id
router.post('/', userController.createUser);           // Menjadi /api/users
router.put('/:id', userController.updateUser);         // Menjadi /api/users/:id
router.delete('/:id', userController.deleteUser);      // Menjadi /api/users/:id

module.exports = router;