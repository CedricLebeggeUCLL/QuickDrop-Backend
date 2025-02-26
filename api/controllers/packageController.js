const { sequelize } = require('../db');
const Package = require('../models/package');

exports.getPackages = async (req, res) => {
  try {
    const packages = await Package.findAll();
    res.json(packages);
  } catch (err) {
    res.status(500).json({ error: 'Fout bij ophalen van pakketten', details: err.message });
  }
};

exports.getPackageById = async (req, res) => {
  try {
    const package = await Package.findByPk(req.params.id);
    if (!package) return res.status(404).json({ error: 'Pakket niet gevonden' });
    res.json(package);
  } catch (err) {
    res.status(500).json({ error: 'Fout bij ophalen van pakket', details: err.message });
  }
};

exports.createPackage = async (req, res) => {
  const { user_id, description, status } = req.body;
  try {
    const package = await Package.create({ user_id, description, status: status || 'pending' });
    res.status(201).json(package);
  } catch (err) {
    res.status(500).json({ error: 'Fout bij aanmaken pakket', details: err.message });
  }
};

exports.updatePackage = async (req, res) => {
  try {
    const [updated] = await Package.update(req.body, { where: { id: req.params.id } });
    if (updated === 0) return res.status(404).json({ error: 'Pakket niet gevonden' });
    const updatedPackage = await Package.findByPk(req.params.id);
    res.json(updatedPackage);
  } catch (err) {
    res.status(500).json({ error: 'Fout bij updaten van pakket', details: err.message });
  }
};

exports.deletePackage = async (req, res) => {
  try {
    const deleted = await Package.destroy({ where: { id: req.params.id } });
    if (deleted === 0) return res.status(404).json({ error: 'Pakket niet gevonden' });
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: 'Fout bij verwijderen van pakket', details: err.message });
  }
};