const { sequelize } = require('../db');
const Courier = require('../models/courier');
const User = require('../models/user');
const Address = require('../models/address');

exports.getCouriers = async (req, res) => {
  try {
    const couriers = await Courier.findAll({
      include: [
        { model: Address, as: 'currentAddress' },
        { model: Address, as: 'startAddress' },
        { model: Address, as: 'destinationAddress' },
      ],
    });
    res.json(couriers);
  } catch (err) {
    res.status(500).json({ error: 'Error fetching couriers', details: err.message });
  }
};

exports.getCourierById = async (req, res) => {
  try {
    const courier = await Courier.findByPk(req.params.id, {
      include: [
        { model: Address, as: 'currentAddress' },
        { model: Address, as: 'startAddress' },
        { model: Address, as: 'destinationAddress' },
      ],
    });
    if (!courier) return res.status(404).json({ error: 'Courier not found' });
    res.json(courier);
  } catch (err) {
    res.status(500).json({ error: 'Error fetching courier', details: err.message });
  }
};

exports.getCourierByUserId = async (req, res) => {
  try {
    const courier = await Courier.findOne({
      where: { user_id: req.params.userId },
      include: [
        { model: Address, as: 'currentAddress' },
        { model: Address, as: 'startAddress' },
        { model: Address, as: 'destinationAddress' },
      ],
    });
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

  const transaction = await sequelize.transaction();
  try {
    const user = await User.findByPk(user_id, { transaction });
    if (!user) {
      console.log(`User met ID ${user_id} niet gevonden`);
      await transaction.rollback();
      return res.status(404).json({ error: 'User does not exist' });
    }

    const existingCourier = await Courier.findOne({ where: { user_id }, transaction });
    if (existingCourier) {
      await transaction.rollback();
      return res.status(400).json({ error: 'User is already a courier' });
    }

    const courierData = {
      user_id,
      current_address_id: null,
      start_address_id: null,
      destination_address_id: null,
      pickup_radius: 5.0,
      dropoff_radius: 5.0,
      availability: true,
      itsme_code,
      license_number: license_number || null,
      current_lat: null,
      current_lng: null,
    };

    console.log('Data to create:', courierData);
    const courier = await Courier.create(courierData, { transaction });
    console.log('Created courier:', courier.toJSON());

    const [updated] = await User.update(
      { role: 'courier' },
      { where: { id: user_id }, transaction }
    );
    console.log(`Updated ${updated} user rows to role 'courier' for user_id ${user_id}`);

    if (updated === 0) {
      await Courier.destroy({ where: { id: courier.id }, transaction });
      await transaction.rollback();
      return res.status(500).json({ error: 'Failed to update user role, courier creation rolled back' });
    }

    await transaction.commit();
    res.status(201).json({ message: 'Courier created successfully', courierId: courier.id });
  } catch (err) {
    await transaction.rollback();
    console.error('Error in becomeCourier:', err);
    res.status(500).json({ error: 'Error creating courier', details: err.message });
  }
};

exports.updateCourier = async (req, res) => {
  const { start_address, destination_address, pickup_radius, dropoff_radius, availability } = req.body;
  const transaction = await sequelize.transaction();

  try {
    const courier = await Courier.findByPk(req.params.id, { transaction });
    if (!courier) {
      await transaction.rollback();
      return res.status(404).json({ error: 'Courier not found' });
    }

    let startAddressId, destAddressId;
    if (start_address) {
      const [startAddress, created] = await Address.findOrCreate({
        where: {
          street_name: start_address.street_name,
          house_number: start_address.house_number,
          extra_info: start_address.extra_info || null,
          postal_code: start_address.postal_code,
        },
        defaults: start_address,
        transaction,
      });
      startAddressId = startAddress.id;
    }

    if (destination_address) {
      const [destAddress, created] = await Address.findOrCreate({
        where: {
          street_name: destination_address.street_name,
          house_number: destination_address.house_number,
          extra_info: destination_address.extra_info || null,
          postal_code: destination_address.postal_code,
        },
        defaults: destination_address,
        transaction,
      });
      destAddressId = destAddress.id;
    }

    const updateData = {
      ...(startAddressId && { start_address_id: startAddressId }),
      ...(destAddressId && { destination_address_id: destAddressId }),
      pickup_radius: pickup_radius || courier.pickup_radius,
      dropoff_radius: dropoff_radius || courier.dropoff_radius,
      availability: availability !== undefined ? availability : courier.availability,
    };

    const [updated] = await Courier.update(updateData, { where: { id: req.params.id }, transaction });
    if (updated === 0) {
      await transaction.rollback();
      return res.status(404).json({ error: 'Courier not found' });
    }

    const updatedCourier = await Courier.findByPk(req.params.id, {
      include: [
        { model: Address, as: 'currentAddress' },
        { model: Address, as: 'startAddress' },
        { model: Address, as: 'destinationAddress' },
      ],
      transaction,
    });

    await transaction.commit();
    res.json(updatedCourier);
  } catch (err) {
    await transaction.rollback();
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

exports.updateCourierLocation = async (req, res) => {
  const id = req.params.id; // Get the ID from the URL
  const { lat, lng } = req.body; // Get lat and lng from the body
  try {
    const courier = await Courier.findByPk(id);
    if (!courier) return res.status(404).json({ error: 'Courier not found' });
    await courier.update({ current_lat: lat, current_lng: lng });
    res.json({ message: 'Location updated' });
  } catch (err) {
    res.status(500).json({ error: 'Error updating location', details: err.message });
  }
};