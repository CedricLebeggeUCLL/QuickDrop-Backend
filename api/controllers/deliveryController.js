const { sequelize } = require('../db');
const Delivery = require('../models/delivery');

exports.getDeliveries = async (req, res) => {
  try {
    const deliveries = await Delivery.findAll();
    res.json(deliveries);
  } catch (err) {
    res.status(500).json({ error: 'Fout bij ophalen van leveringen', details: err.message });
  }
};

exports.getDeliveryById = async (req, res) => {
  try {
    const delivery = await Delivery.findByPk(req.params.id);
    if (!delivery) return res.status(404).json({ error: 'Levering niet gevonden' });
    res.json(delivery);
  } catch (err) {
    res.status(500).json({ error: 'Fout bij ophalen van levering', details: err.message });
  }
};

exports.createDelivery = async (req, res) => {
  const { package_id, courier_id, pickup_time, delivery_time } = req.body;
  try {
    const delivery = await Delivery.create({ package_id, courier_id, pickup_time, delivery_time });
    res.status(201).json(delivery);
  } catch (err) {
    res.status(500).json({ error: 'Fout bij aanmaken levering', details: err.message });
  }
};

exports.updateDelivery = async (req, res) => {
  try {
    const [updated] = await Delivery.update(req.body, { where: { id: req.params.id } });
    if (updated === 0) return res.status(404).json({ error: 'Levering niet gevonden' });
    const updatedDelivery = await Delivery.findByPk(req.params.id);
    res.json(updatedDelivery);
  } catch (err) {
    res.status(500).json({ error: 'Fout bij updaten van levering', details: err.message });
  }
};

exports.deleteDelivery = async (req, res) => {
  try {
    const deleted = await Delivery.destroy({ where: { id: req.params.id } });
    if (deleted === 0) return res.status(404).json({ error: 'Levering niet gevonden' });
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: 'Fout bij verwijderen van levering', details: err.message });
  }
};