const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const authMiddleware = require('../../utils/authMiddleware');

// Publieke routes
router.post('/register', userController.registerUser);
router.post('/login', userController.loginUser);
router.post('/refresh', userController.refreshToken); // New refresh endpoint

// Beschermde routes
router.get('/', authMiddleware, userController.getUsers);
router.get('/:id', authMiddleware, userController.getUserById);
router.post('/', authMiddleware, userController.createUser);
router.put('/:id', authMiddleware, userController.updateUser);
router.delete('/:id', authMiddleware, userController.deleteUser);

module.exports = router;