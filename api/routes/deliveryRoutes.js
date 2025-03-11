const express = require('express');
const router = express.Router();
const deliveryController = require('../controllers/deliveryController');

router.get('/', deliveryController.getDeliveries); // Alle deliveries ophalen
router.get('/:id', deliveryController.getDeliveryById); // Een specifieke delivery ophalen
router.post('/', deliveryController.createDelivery); // Nieuwe delivery aanmaken
router.put('/:id', deliveryController.updateDelivery); // Delivery bijwerken
router.delete('/:id', deliveryController.cancelDelivery); // Delivery annuleren
router.get('/history/:userId', deliveryController.getDeliveryHistory); // Leveringsgeschiedenis van een user
router.get('/courier/:userId', deliveryController.getCourierDeliveries); // Deliveries van een specifieke courier

module.exports = router;