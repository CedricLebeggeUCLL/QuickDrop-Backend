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

exports.searchPackages = async (req, res) => {
  const userId = req.body.user_id;
  const { start_location, destination, pickup_radius, dropoff_radius } = req.body;

  console.log('Request body:', req.body);

  if (!start_location || !destination || !pickup_radius || !dropoff_radius) {
    return res.status(400).json({ error: 'Start location, destination, pickup radius, and dropoff radius are required' });
  }

  try {
    const courier = await Courier.findOne({ where: { user_id: userId } });
    if (!courier) return res.status(403).json({ error: 'User is not a courier' });

    const packages = await Package.findAll({ where: { status: 'pending' } });
    console.log('Pending packages:', JSON.stringify(packages, null, 2));

    const matchingPackages = packages.filter(package => {
      try {
        const pickupDistance = haversineDistance(start_location, package.pickup_location);
        const dropoffDistance = haversineDistance(destination, package.dropoff_location);
        console.log(`Package ID ${package.id}: Start = ${JSON.stringify(start_location)}, Pickup = ${JSON.stringify(package.pickup_location)}, Pickup Distance = ${pickupDistance} km`);
        console.log(`Package ID ${package.id}: Dest = ${JSON.stringify(destination)}, Dropoff = ${JSON.stringify(package.dropoff_location)}, Dropoff Distance = ${dropoffDistance} km`);
        console.log(`Package ID ${package.id}: Pickup Radius = ${pickup_radius}, Dropoff Radius = ${dropoff_radius}, Match = ${pickupDistance <= pickup_radius && dropoffDistance <= dropoff_radius}`);
        return pickupDistance <= pickup_radius && dropoffDistance <= dropoff_radius;
      } catch (error) {
        console.error(`Error processing package ID ${package.id}:`, error.message);
        return false; // Skip packages with invalid data
      }
    });

    res.json({ message: 'Packages found', packages: matchingPackages });
  } catch (err) {
    res.status(500).json({ error: 'Error searching packages', details: err.message });
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

    const delivery = await Delivery.create({ package_id: package.id, courier_id: courier.id });
    await Package.update({ status: 'in_transit' }, { where: { id: package.id } });
    res.status(201).json({ message: 'Delivery created successfully', deliveryId: delivery.id });
  } catch (err) {
    res.status(500).json({ error: 'Error creating delivery', details: err.message });
  }
};

exports.updateDelivery = async (req, res) => {
  const { package_id, courier_id } = req.body;
  try {
    const [updated] = await Delivery.update(
      { package_id, courier_id },
      { where: { id: req.params.id } }
    );
    if (updated === 0) return res.status(404).json({ error: 'Delivery not found' });
    const updatedDelivery = await Delivery.findByPk(req.params.id, {
      include: [Package, Courier]
    });
    res.json(updatedDelivery);
  } catch (err) {
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