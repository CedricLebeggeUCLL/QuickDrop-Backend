const { sequelize } = require('../db');
const Delivery = require('../models/delivery');
const Package = require('../models/package');
const Courier = require('../models/courier');
const { haversineDistance } = require('../../utils/distance');

exports.getDeliveries = async (req, res) => {
  try {
    const deliveries = await Delivery.findAll({
      include: [Package, Courier]
    });
    res.json(deliveries);
  } catch (err) {
    res.status(500).json({ error: 'Error fetching deliveries', details: err.message });
  }
};

exports.getDeliveryById = async (req, res) => {
  try {
    const delivery = await Delivery.findByPk(req.params.id, {
      include: [Package, Courier]
    });
    if (!delivery) return res.status(404).json({ error: 'Delivery not found' });
    res.json(delivery);
  } catch (err) {
    res.status(500).json({ error: 'Error fetching delivery', details: err.message });
  }
};

exports.createDelivery = async (req, res) => {
  const userId = req.body.user_id;
  const { package_id, start_location, destination, pickup_radius, dropoff_radius } = req.body;

  try {
    const courier = await Courier.findOne({ where: { user_id: userId } });
    if (!courier) return res.status(403).json({ error: 'User is not a courier' });

    const package = await Package.findByPk(package_id);
    if (!package) return res.status(404).json({ error: 'Package not found' });

    const pickupDistance = haversineDistance(start_location || courier.current_location, package.pickup_location);
    const dropoffDistance = haversineDistance(destination || courier.destination, package.dropoff_location);
    const effectivePickupRadius = pickup_radius || courier.pickup_radius;
    const effectiveDropoffRadius = dropoff_radius || courier.dropoff_radius;

    if (pickupDistance > effectivePickupRadius || dropoffDistance > effectiveDropoffRadius) {
      return res.status(400).json({ error: 'Package is outside the specified radii' });
    }

    // Update courier data when creating a delivery
    await Courier.update(
      { current_location: start_location || courier.current_location, destination: destination || courier.destination, pickup_radius: effectivePickupRadius, dropoff_radius: effectiveDropoffRadius },
      { where: { user_id: userId } }
    );

    // Maak een nieuwe Delivery met pickup_location en dropoff_location
    const delivery = await Delivery.create({
      package_id: package.id,
      courier_id: courier.id,
      pickup_location: package.pickup_location, // Kopieer van het pakket
      dropoff_location: package.dropoff_location, // Kopieer van het pakket
      status: 'assigned' // Default waarde, maar expliciet ingesteld
    });

    await Package.update({ status: 'in_transit' }, { where: { id: package.id } });
    res.status(201).json({ message: 'Delivery created successfully', deliveryId: delivery.id });
  } catch (err) {
    res.status(500).json({ error: 'Error creating delivery', details: err.message });
  }
};

exports.updateDelivery = async (req, res) => {
  const { status, pickup_time, delivery_time } = req.body; // Ontvang status en tijdstempels
  const validDeliveryStatuses = ['assigned', 'picked_up', 'delivered'];
  const validPackageStatuses = ['pending', 'assigned', 'in_transit', 'delivered'];
  console.log('Received update request for deliveryId:', req.params.id, 'with status:', status, 'pickup_time:', pickup_time, 'delivery_time:', delivery_time);

  if (!status || !validDeliveryStatuses.includes(status)) {
    return res.status(400).json({ error: 'Invalid delivery status value. Must be one of: assigned, picked_up, delivered' });
  }

  const transaction = await sequelize.transaction(); // Start een transactie
  try {
    const updateData = { status };

    // Stel pickup_time in bij 'picked_up'
    if (status === 'picked_up') {
      updateData.pickup_time = pickup_time ? new Date(pickup_time) : new Date();
      console.log('Setting pickup_time to:', updateData.pickup_time);

      // Werk de package-status bij naar 'in_transit'
      const delivery = await Delivery.findByPk(req.params.id, { transaction });
      if (!delivery || !delivery.package_id) {
        console.log('No valid package_id found for delivery:', req.params.id);
        await transaction.rollback();
        return res.status(400).json({ error: 'No associated package found' });
      }
      const [packageUpdated] = await Package.update(
        { status: 'in_transit' },
        { where: { id: delivery.package_id }, transaction }
      );
      if (packageUpdated === 0) {
        console.log('Failed to update package status to in_transit for package_id:', delivery.package_id);
        await transaction.rollback();
        return res.status(404).json({ error: 'Failed to update package status to in_transit' });
      }
      console.log('Successfully updated package status to in_transit for package_id:', delivery.package_id);
    }

    // Stel delivery_time in bij 'delivered'
    if (status === 'delivered') {
      updateData.delivery_time = delivery_time ? new Date(delivery_time) : new Date();
      console.log('Setting delivery_time to:', updateData.delivery_time);

      // Werk de package-status bij naar 'delivered'
      const delivery = await Delivery.findByPk(req.params.id, { transaction });
      if (!delivery || !delivery.package_id) {
        console.log('No valid package_id found for delivery:', req.params.id);
        await transaction.rollback();
        return res.status(400).json({ error: 'No associated package found' });
      }
      const [packageUpdated] = await Package.update(
        { status: 'delivered' },
        { where: { id: delivery.package_id }, transaction }
      );
      if (packageUpdated === 0) {
        console.log('Failed to update package status to delivered for package_id:', delivery.package_id);
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
      include: [Package, Courier],
      transaction
    });

    await transaction.commit(); // Commit de transactie als alles succesvol is
    console.log('Update successful, returning:', updatedDelivery);
    res.json(updatedDelivery);
  } catch (err) {
    await transaction.rollback(); // Rol terug bij fout
    console.error('Error updating delivery:', err.message, err.stack);
    res.status(500).json({ error: 'Error updating delivery', details: err.message });
  }
};

exports.cancelDelivery = async (req, res) => {
  try {
    const delivery = await Delivery.findByPk(req.params.id);
    if (!delivery) return res.status(404).json({ error: 'Delivery not found' });

    await Package.update({ status: 'pending' }, { where: { id: delivery.package_id } });
    await Delivery.destroy({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) {
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
        required: true
      }, Courier]
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
      include: [Package, Courier]
    });

    res.json(deliveries);
  } catch (err) {
    res.status(500).json({ error: 'Error fetching courier deliveries', details: err.message });
  }
};