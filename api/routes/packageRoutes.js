const express = require('express');
const router = express.Router();
const packageController = require('../controllers/packageController'); // Zorg dat dit het juiste pad is

// Routes voor pakketten
router.get('/', packageController.getPackages);           // Alle pakketten ophalen
router.get('/:id', packageController.getPackageById);     // Specifiek pakket ophalen
router.post('/', packageController.addPackage);           // Nieuw pakket toevoegen
router.put('/:id', packageController.updatePackage);      // Pakket bijwerken
router.delete('/:id', packageController.deletePackage);   // Pakket verwijderen
router.get('/track/:id', packageController.trackPackage); // Pakket traceren

module.exports = router;