const express = require('express');
const router = express.Router();
const courierController = require('../controllers/courierController');

router.get('/', courierController.getCouriers);
router.get('/:id', courierController.getCourierById);
router.get('/user/:userId', courierController.getCourierByUserId);
router.post('/become', courierController.becomeCourier);
router.post('/itsme-callback', courierController.handleItsmeCallback);
router.put('/:id', courierController.updateCourier);
router.delete('/:id', courierController.deleteCourier);
router.put('/:id/location', courierController.updateCourierLocation);

module.exports = router;