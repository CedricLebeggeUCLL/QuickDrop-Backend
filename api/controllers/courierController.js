const { sequelize } = require('../db');
const Courier = require('../models/courier');

exports.getCouriers = async (req, res) => {
  try {
    const couriers = await Courier.findAll();
    res.json(couriers);
  } catch (err) {
    res.status(500).json({ error: 'Fout bij ophalen van koeriers', details: err.message });
  }
};

exports.getCourierById = async (req, res) => {
  try {
    const courier = await Courier.findByPk(req.params.id);
    if (!courier) return res.status(404).json({ error: 'Koerier niet gevonden' });
    res.json(courier);
  } catch (err) {
    res.status(500).json({ error: 'Fout bij ophalen van koerier', details: err.message });
  }
};

exports.createCourier = async (req, res) => {
  const { user_id, current_location, destination, availability } = req.body;
  try {
    const courier = await Courier.create({ user_id, current_location, destination, availability: availability || true });
    res.status(201).json(courier);
  } catch (err) {
    res.status(500).json({ error: 'Fout bij aanmaken koerier', details: err.message });
  }
};

exports.updateCourier = async (req, res) => {
  try {
    const [updated] = await Courier.update(req.body, { where: { id: req.params.id } });
    if (updated === 0) return res.status(404).json({ error: 'Koerier niet gevonden' });
    const updatedCourier = await Courier.findByPk(req.params.id);
    res.json(updatedCourier);
  } catch (err) {
    res.status(500).json({ error: 'Fout bij updaten van koerier', details: err.message });
  }
};

exports.deleteCourier = async (req, res) => {
  try {
    const deleted = await Courier.destroy({ where: { id: req.params.id } });
    if (deleted === 0) return res.status(404).json({ error: 'Koerier niet gevonden' });
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: 'Fout bij verwijderen van koerier', details: err.message });
  }
};