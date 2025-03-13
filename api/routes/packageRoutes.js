const express = require('express');
const router = express.Router();
const packageController = require('../controllers/packageController');

router.get('/', packageController.getPackages); // Alle packages ophalen
router.get('/:id', packageController.getPackageById); // Een specifieke package ophalen
router.get('/user/:userId', packageController.getPackagesByUserId); // Nieuwe route voor pakketten per user
router.post('/', packageController.addPackage); // Nieuwe package aanmaken
router.put('/:id', packageController.updatePackage); // Package bijwerken
router.delete('/:id', packageController.deletePackage); // Package verwijderen
router.get('/:id/track', packageController.trackPackage); // Package volgen
router.post('/search', packageController.searchPackages); // Packages zoeken

module.exports = router;