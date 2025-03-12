const { sequelize } = require('../db');
const Delivery = require('../models/delivery');
const Package = require('../models/package');
const Courier = require('../models/courier');
const Address = require('../models/address');
const { haversineDistance } = require('../../utils/distance');
const { geocodeAddress } = require('../../utils/geocode');

exports.getDeliveries = async (req, res) => {
  try {
    const deliveries = await Delivery.findAll({
      include: [
        { model: Package, include: [{ model: Address, as: 'pickupAddress' }, { model: Address, as: 'dropoffAddress' }] },
        { model: Courier, include: [{ model: Address, as: 'currentAddress' }, { model: Address, as: 'startAddress' }, { model: Address, as: 'destinationAddress' }] },
      ],
    });
    res.json(deliveries);
  } catch (err) {
    res.status(500).json({ error: 'Error fetching deliveries', details: err.message });
  }
};

exports.getDeliveryById = async (req, res) => {
  try {
    const delivery = await Delivery.findByPk(req.params.id, {
      include: [
        { model: Package, include: [{ model: Address, as: 'pickupAddress' }, { model: Address, as: 'dropoffAddress' }] },
        { model: Courier, include: [{ model: Address, as: 'currentAddress' }, { model: Address, as: 'startAddress' }, { model: Address, as: 'destinationAddress' }] },
      ],
    });
    if (!delivery) return res.status(404).json({ error: 'Delivery not found' });
    res.json(delivery);
  } catch (err) {
    res.status(500).json({ error: 'Error fetching delivery', details: err.message });
  }
};

exports.createDelivery = async (req, res) => {
  console.log('Entering createDelivery endpoint');
  const { user_id, package_id } = req.body;

  console.log('Create delivery request received:', JSON.stringify(req.body, null, 2));

  const transaction = await sequelize.transaction();
  try {
    // Controleer koerier
    console.log('Finding courier with user_id:', user_id);
    const courier = await Courier.findOne({ where: { user_id }, transaction });
    if (!courier) {
      console.log('Courier not found for user_id:', user_id);
      await transaction.rollback();
      return res.status(403).json({ error: 'User is not a courier' });
    }
    console.log('Courier found:', courier.toJSON());

    // Controleer pakket
    console.log('Finding package with package_id:', package_id);
    const package = await Package.findByPk(package_id, {
      include: [
        { model: Address, as: 'pickupAddress' },
        { model: Address, as: 'dropoffAddress' },
      ],
      transaction,
    });
    if (!package) {
      console.log('Package not found for package_id:', package_id);
      await transaction.rollback();
      return res.status(404).json({ error: 'Package not found' });
    }
    console.log('Package found:', package.toJSON());
    if (package.status !== 'pending') {
      console.log('Package is not pending, current status:', package.status);
      await transaction.rollback();
      return res.status(400).json({ error: 'Package is not available for assignment' });
    }

    // Maak delivery aan
    console.log('Creating delivery...');
    const delivery = await Delivery.create({
      package_id: package.id,
      courier_id: courier.id,
      pickup_address_id: package.pickup_address_id,
      dropoff_address_id: package.dropoff_address_id,
      status: 'assigned',
    }, { transaction });
    console.log('Delivery created:', delivery.toJSON());

    // Update pakketstatus
    console.log('Updating package status to assigned...');
    await package.update({ status: 'assigned' }, { transaction });
    console.log('Package updated:', package.toJSON());

    await transaction.commit();
    console.log('Transaction committed');
    res.status(201).json({ message: 'Delivery created successfully', deliveryId: delivery.id });
  } catch (err) {
    await transaction.rollback();
    console.error('Create delivery error:', err);
    res.status(500).json({ error: 'Error creating delivery', details: err.message });
  }
};

exports.updateDelivery = async (req, res) => {
  const { status, pickup_time, delivery_time } = req.body;
  const validDeliveryStatuses = ['assigned', 'picked_up', 'delivered'];
  const validPackageStatuses = ['pending', 'assigned', 'in_transit', 'delivered'];

  if (!status || !validDeliveryStatuses.includes(status)) {
    return res.status(400).json({ error: 'Invalid delivery status value. Must be one of: assigned, picked_up, delivered' });
  }

  const transaction = await sequelize.transaction();
  try {
    const updateData = { status };

    if (status === 'picked_up') {
      updateData.pickup_time = pickup_time ? new Date(pickup_time) : new Date();
      console.log('Setting pickup_time to:', updateData.pickup_time);

      const delivery = await Delivery.findByPk(req.params.id, { transaction });
      if (!delivery || !delivery.package_id) {
        await transaction.rollback();
        return res.status(400).json({ error: 'No associated package found' });
      }
      const [packageUpdated] = await Package.update(
        { status: 'in_transit' },
        { where: { id: delivery.package_id }, transaction }
      );
      if (packageUpdated === 0) {
        await transaction.rollback();
        return res.status(404).json({ error: 'Failed to update package status to in_transit' });
      }
      console.log('Successfully updated package status to in_transit for package_id:', delivery.package_id);
    }

    if (status === 'delivered') {
      updateData.delivery_time = delivery_time ? new Date(delivery_time) : new Date();
      console.log('Setting delivery_time to:', updateData.delivery_time);

      const delivery = await Delivery.findByPk(req.params.id, { transaction });
      if (!delivery || !delivery.package_id) {
        await transaction.rollback();
        return res.status(400).json({ error: 'No associated package found' });
      }
      const [packageUpdated] = await Package.update(
        { status: 'delivered' },
        { where: { id: delivery.package_id }, transaction }
      );
      if (packageUpdated === 0) {
        await transaction.rollback();
        return res.status(404).json({ error: 'Failed to update package status to delivered' });
      }
      console.log('Successfully updated package status to delivered for package_id:', delivery.package_id);
    }

    const [updated] = await Delivery.update(
      updateData,
      { where: { id: req.params.id }, transaction }
    );

    if (updated === 0) {
      await transaction.rollback();
      return res.status(404).json({ error: 'Delivery not found' });
    }

    const updatedDelivery = await Delivery.findByPk(req.params.id, {
      include: [
        { model: Package, include: [{ model: Address, as: 'pickupAddress' }, { model: Address, as: 'dropoffAddress' }] },
        { model: Courier, include: [{ model: Address, as: 'currentAddress' }, { model: Address, as: 'startAddress' }, { model: Address, as: 'destinationAddress' }] },
      ],
      transaction,
    });

    await transaction.commit();
    console.log('Update successful, returning:', updatedDelivery);
    res.json(updatedDelivery);
  } catch (err) {
    await transaction.rollback();
    console.error('Error updating delivery:', err.message, err.stack);
    res.status(500).json({ error: 'Error updating delivery', details: err.message });
  }
};

exports.cancelDelivery = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const delivery = await Delivery.findByPk(req.params.id, { transaction });
    if (!delivery) {
      await transaction.rollback();
      return res.status(404).json({ error: 'Delivery not found' });
    }

    await Package.update({ status: 'pending' }, { where: { id: delivery.package_id }, transaction });
    await Delivery.destroy({ where: { id: req.params.id }, transaction });
    await transaction.commit();
    res.status(204).send();
  } catch (err) {
    await transaction.rollback();
    res.status(500).json({ error: 'Error canceling delivery', details: err.message });
  }
};

exports.getDeliveryHistory = async (req, res) => {
  const userId = req.params.userId;

  try {
    const deliveries = await Delivery.findAll({
      include: [{
        model: Package,
        where: { user_id: userId },
        required: true,
        include: [{ model: Address, as: 'pickupAddress' }, { model: Address, as: 'dropoffAddress' }],
      }, {
        model: Courier,
        include: [{ model: Address, as: 'currentAddress' }, { model: Address, as: 'startAddress' }, { model: Address, as: 'destinationAddress' }],
      }],
    });
    res.json(deliveries);
  } catch (err) {
    res.status(500).json({ error: 'Error fetching delivery history', details: err.message });
  }
};

exports.getCourierDeliveries = async (req, res) => {
  const userId = req.params.userId;

  try {
    const courier = await Courier.findOne({ where: { user_id: userId } });
    if (!courier) {
      return res.status(404).json({ error: 'Courier not found for this user' });
    }

    const deliveries = await Delivery.findAll({
      where: { courier_id: courier.id },
      include: [
        { model: Package, include: [{ model: Address, as: 'pickupAddress' }, { model: Address, as: 'dropoffAddress' }] },
        { model: Courier, include: [{ model: Address, as: 'currentAddress' }, { model: Address, as: 'startAddress' }, { model: Address, as: 'destinationAddress' }] },
      ],
    });

    res.json(deliveries);
  } catch (err) {
    res.status(500).json({ error: 'Error fetching courier deliveries', details: err.message });
  }
};