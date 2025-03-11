const express = require('express');
const router = express.Router();
const courierController = require('../controllers/courierController');

router.get('/', courierController.getCouriers); // Alle couriers ophalen
router.get('/:id', courierController.getCourierById); // Een specifieke courier ophalen
router.get('/user/:userId', courierController.getCourierByUserId); // Courier ophalen op basis van userId
router.post('/become', courierController.becomeCourier); // Nieuwe courier aanmaken
router.put('/:id', courierController.updateCourier); // Courier bijwerken
router.delete('/:id', courierController.deleteCourier); // Courier verwijderen

module.exports = router;