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
  const userId = req.body.user_id;
  const { package_id, start_address, destination_address, pickup_radius, dropoff_radius } = req.body;

  const transaction = await sequelize.transaction();
  try {
    const courier = await Courier.findOne({ where: { user_id: userId }, transaction });
    if (!courier) {
      await transaction.rollback();
      return res.status(403).json({ error: 'User is not a courier' });
    }

    const package = await Package.findByPk(package_id, { transaction });
    if (!package) {
      await transaction.rollback();
      return res.status(404).json({ error: 'Package not found' });
    }

    // Geocode adressen voor afstandsberekening
    const startAddressObj = start_address || (await Address.findByPk(courier.start_address_id));
    const destAddressObj = destination_address || (await Address.findByPk(courier.destination_address_id));
    const pickupAddressObj = await Address.findByPk(package.pickup_address_id);
    const dropoffAddressObj = await Address.findByPk(package.dropoff_address_id);

    const startCoords = await geocodeAddress(startAddressObj);
    const destCoords = await geocodeAddress(destAddressObj);
    const pickupCoords = await geocodeAddress(pickupAddressObj);
    const dropoffCoords = await geocodeAddress(dropoffAddressObj);

    const pickupDistance = haversineDistance(startCoords, pickupCoords);
    const dropoffDistance = haversineDistance(destCoords, dropoffCoords);
    const effectivePickupRadius = pickup_radius || courier.pickup_radius;
    const effectiveDropoffRadius = dropoff_radius || courier.dropoff_radius;

    if (pickupDistance > effectivePickupRadius || dropoffDistance > effectiveDropoffRadius) {
      await transaction.rollback();
      return res.status(400).json({ error: 'Package is outside the specified radii' });
    }

    // Update courier adressen indien nieuwe adressen zijn meegegeven
    if (start_address) {
      const [startAddress] = await Address.findOrCreate({
        where: {
          street_name: start_address.street_name,
          house_number: start_address.house_number,
          extra_info: start_address.extra_info || null,
          postal_code: start_address.postal_code,
        },
        defaults: start_address,
        transaction,
      });
      await courier.update({ start_address_id: startAddress.id }, { transaction });
    }

    if (destination_address) {
      const [destAddress] = await Address.findOrCreate({
        where: {
          street_name: destination_address.street_name,
          house_number: destination_address.house_number,
          extra_info: destination_address.extra_info || null,
          postal_code: destination_address.postal_code,
        },
        defaults: destination_address,
        transaction,
      });
      await courier.update({ destination_address_id: destAddress.id }, { transaction });
    }

    // Maak een nieuwe Delivery
    const delivery = await Delivery.create({
      package_id: package.id,
      courier_id: courier.id,
      pickup_address_id: package.pickup_address_id,
      dropoff_address_id: package.dropoff_address_id,
      status: 'assigned',
    }, { transaction });

    await Package.update({ status: 'in_transit' }, { where: { id: package.id }, transaction });
    await transaction.commit();
    res.status(201).json({ message: 'Delivery created successfully', deliveryId: delivery.id });
  } catch (err) {
    await transaction.rollback();
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