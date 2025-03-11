const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');

router.get('/', userController.getUsers); // Alle gebruikers ophalen
router.get('/:id', userController.getUserById); // Een specifieke gebruiker ophalen
router.post('/', userController.createUser); // Nieuwe gebruiker aanmaken
router.put('/:id', userController.updateUser); // Gebruiker bijwerken
router.delete('/:id', userController.deleteUser); // Gebruiker verwijderen
router.post('/register', userController.registerUser); // Gebruiker registreren
router.post('/login', userController.loginUser); // Gebruiker inloggen

module.exports = router;