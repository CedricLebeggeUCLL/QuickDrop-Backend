const { sequelize } = require('../db');
const Courier = require('../models/courier');
const User = require('../models/user');

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

exports.getCourierByUserId = async (req, res) => {
  try {
    const courier = await Courier.findOne({ where: { user_id: req.params.userId } });
    if (!courier) return res.status(404).json({ error: 'Courier not found for this user' });
    res.json(courier);
  } catch (err) {
    res.status(500).json({ error: 'Error fetching courier by user ID', details: err.message });
  }
};

exports.becomeCourier = async (req, res) => {
  const { user_id, itsme_code, license_number } = req.body;

  if (!user_id || user_id <= 0) {
    return res.status(400).json({ error: 'Invalid user_id' });
  }

  if (!itsme_code) {
    return res.status(400).json({ error: 'Itsme verification code is required' });
  }

  try {
    // Controleer of de user bestaat vóór het aanmaken van de courier
    const user = await User.findByPk(user_id);
    if (!user) {
      console.log(`User met ID ${user_id} niet gevonden`);
      return res.status(404).json({ error: 'User does not exist' });
    }

    // Controleer of de user al een courier is
    const existingCourier = await Courier.findOne({ where: { user_id } });
    if (existingCourier) {
      return res.status(400).json({ error: 'User is already a courier' });
    }

    // Maak de nieuwe courier
    const courierData = {
      user_id: user_id,
      current_location: null,
      destination: null,
      pickup_radius: 5.0,
      dropoff_radius: 5.0,
      availability: true,
      itsme_code: itsme_code,
      license_number: license_number || null
    };

    console.log('Data to create:', courierData); // Debug-log: wat we opslaan
    const courier = await Courier.create(courierData);
    console.log('Created courier:', courier.toJSON()); // Debug-log: opgeslagen courier

    // Update de rol van de gebruiker naar 'courier'
    const [updated] = await User.update(
      { role: 'courier' },
      { where: { id: user_id } }
    );
    console.log(`Updated ${updated} user rows to role 'courier' for user_id ${user_id}`); // Debug-log

    if (updated === 0) {
      // Rollback: verwijder de courier als de rol-update faalt
      await Courier.destroy({ where: { id: courier.id } });
      return res.status(500).json({ error: 'Failed to update user role, courier creation rolled back' });
    }

    res.status(201).json({ message: 'Courier created successfully', courierId: courier.id });
  } catch (err) {
    console.error('Error in becomeCourier:', err); // Debug-log: eventuele fouten
    res.status(500).json({ error: 'Error creating courier', details: err.message });
  }
};

exports.updateCourier = async (req, res) => {
  const { current_location, destination, pickup_radius, dropoff_radius, availability } = req.body;
  try {
    const [updated] = await Courier.update(
      { 
        current_location: Array.isArray(current_location) ? current_location : [current_location.lat, current_location.lng],
        destination: Array.isArray(destination) ? destination : [destination.lat, destination.lng],
        pickup_radius: pickup_radius || 5.0,
        dropoff_radius: dropoff_radius || 5.0,
        availability: availability !== undefined ? availability : true
      },
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