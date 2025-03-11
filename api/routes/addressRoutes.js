const express = require('express');
const router = express.Router();
const addressController = require('../controllers/addressController');

router.get('/', addressController.getAddresses); // Alle adressen ophalen
router.get('/:id', addressController.getAddressById); // Een specifiek adres ophalen
router.post('/', addressController.createAddress); // Nieuw adres aanmaken
router.put('/:id', addressController.updateAddress); // Adres bijwerken
router.delete('/:id', addressController.deleteAddress); // Adres verwijderen

module.exports = router;