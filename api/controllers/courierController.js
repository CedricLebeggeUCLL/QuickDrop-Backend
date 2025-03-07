const { sequelize } = require('../db');
const Courier = require('../models/courier');

exports.getCouriers = async (req, res) => {
  try {
    const couriers = await Courier.findAll();
    res.json(couriers);
  } catch (err) {
    res.status(500).json({ error: 'Error fetching couriers', details: err.message });
  }
};

exports.getCourierById = async (req, res) => {
  try {
    const courier = await Courier.findByPk(req.params.id);
    if (!courier) return res.status(404).json({ error: 'Courier not found' });
    res.json(courier);
  } catch (err) {
    res.status(500).json({ error: 'Error fetching courier', details: err.message });
  }
};

exports.becomeCourier = async (req, res) => {
  const userId = req.body.user_id; // Will be from JWT later
  const { current_location, destination, pickup_radius, dropoff_radius } = req.body;

  try {
    const existingCourier = await Courier.findOne({ where: { user_id: userId } });
    if (existingCourier) {
      return res.status(400).json({ error: 'User is already a courier' });
    }

    const courier = await Courier.create({
      user_id: userId,
      current_location: current_location || { lat: 0, lng: 0 },
      destination: destination || null,
      pickup_radius: pickup_radius || 5.0,
      dropoff_radius: dropoff_radius || 5.0,
      availability: true
    });
    res.status(201).json({ message: 'Courier created successfully', courierId: courier.id });
  } catch (err) {
    res.status(500).json({ error: 'Error creating courier', details: err.message });
  }
};

exports.updateCourier = async (req, res) => {
  const { current_location, destination, pickup_radius, dropoff_radius, availability } = req.body;
  try {
    const [updated] = await Courier.update(
      { current_location, destination, pickup_radius, dropoff_radius, availability },
      { where: { id: req.params.id } }
    );
    if (updated === 0) return res.status(404).json({ error: 'Courier not found' });
    const updatedCourier = await Courier.findByPk(req.params.id);
    res.json(updatedCourier);
  } catch (err) {
    res.status(500).json({ error: 'Error updating courier', details: err.message });
  }
};

exports.deleteCourier = async (req, res) => {
  try {
    const deleted = await Courier.destroy({ where: { id: req.params.id } });
    if (deleted === 0) return res.status(404).json({ error: 'Courier not found' });
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: 'Error deleting courier', details: err.message });
  }
};