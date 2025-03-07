const express = require('express');
const router = express.Router();
const deliveryController = require('../controllers/deliveryController');

router.get('/', deliveryController.getDeliveries);
router.get('/:id', deliveryController.getDeliveryById);
router.post('/', deliveryController.createDelivery);
router.put('/:id', deliveryController.updateDelivery);
router.delete('/:id', deliveryController.cancelDelivery);
router.get('/users/:userId', deliveryController.getDeliveryHistory);

module.exports = router;