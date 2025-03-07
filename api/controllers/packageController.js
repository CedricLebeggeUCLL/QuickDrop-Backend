const { sequelize } = require('../db');
const Package = require('../models/package');
const User = require('../models/user'); // Importeer User-model om te valideren
const Courier = require('../models/courier'); // Importeer Courier-model voor validatie
const { haversineDistance } = require('../../utils/distance'); // Zorg dat deze utility bestaat

exports.getPackages = async (req, res) => {
  try {
    const packages = await Package.findAll();
    res.json(packages);
  } catch (err) {
    res.status(500).json({ error: 'Error fetching packages', details: err.message });
  }
};

exports.getPackageById = async (req, res) => {
  try {
    const packageItem = await Package.findByPk(req.params.id);
    if (!packageItem) return res.status(404).json({ error: 'Package not found' });
    res.json(packageItem);
  } catch (err) {
    res.status(500).json({ error: 'Error fetching package', details: err.message });
  }
};

exports.addPackage = async (req, res) => {
  const userId = req.body.user_id; // Wordt later uit JWT gehaald
  const { description, pickup_location, dropoff_location, pickup_address, dropoff_address } = req.body;

  if (!pickup_location || !dropoff_location) {
    return res.status(400).json({ error: 'Pickup and dropoff locations are required' });
  }

  if (!userId || userId <= 0) {
    return res.status(400).json({ error: 'Invalid user_id' });
  }

  try {
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(403).json({ error: 'User does not exist' });
    }

    const packageItem = await Package.create({
      user_id: userId,
      description,
      pickup_location,
      dropoff_location,
      pickup_address,
      dropoff_address,
      status: 'pending'
    });
    res.status(201).json({ message: 'Package added successfully', packageId: packageItem.id });
  } catch (err) {
    if (err.name === 'SequelizeForeignKeyConstraintError') {
      res.status(403).json({ error: 'User does not exist', details: err.message });
    } else {
      res.status(500).json({ error: 'Error adding package', details: err.message });
    }
  }
};

exports.updatePackage = async (req, res) => {
  const { description, pickup_location, dropoff_location, pickup_address, dropoff_address, status } = req.body;
  try {
    const [updated] = await Package.update(
      { description, pickup_location, dropoff_location, pickup_address, dropoff_address, status },
      { where: { id: req.params.id } }
    );
    if (updated === 0) return res.status(404).json({ error: 'Package not found' });
    const updatedPackage = await Package.findByPk(req.params.id);
    res.json(updatedPackage);
  } catch (err) {
    res.status(500).json({ error: 'Error updating package', details: err.message });
  }
};

exports.deletePackage = async (req, res) => {
  try {
    const deleted = await Package.destroy({ where: { id: req.params.id } });
    if (deleted === 0) return res.status(404).json({ error: 'Package not found' });
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: 'Error deleting package', details: err.message });
  }
};

exports.trackPackage = async (req, res) => {
  const packageId = req.params.id;

  try {
    const packageItem = await Package.findByPk(packageId);
    if (!packageItem) {
      return res.status(404).json({ error: 'Package not found' });
    }
    if (packageItem.status !== 'in_transit') {
      return res.status(400).json({ error: 'Package is not in transit' });
    }

    const delivery = await Delivery.findOne({ where: { package_id: packageId } });
    if (!delivery) {
      return res.status(404).json({ error: 'Delivery not found' });
    }

    const courier = await Courier.findByPk(delivery.courier_id);
    if (!courier) {
      return res.status(404).json({ error: 'Courier not found' });
    }

    res.json({ packageId, currentLocation: courier.current_location });
  } catch (err) {
    res.status(500).json({ error: 'Error tracking package', details: err.message });
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
    // Controleer of de gebruiker een koerier is
    const courier = await Courier.findOne({ where: { user_id: userId } });
    if (!courier) return res.status(403).json({ error: 'User is not a courier' });

    const packages = await Package.findAll({ where: { status: 'pending' } });
    console.log('Pending packages:', JSON.stringify(packages, null, 2));

    const matchingPackages = packages.filter(packageItem => {
      try {
        const pickupDistance = haversineDistance(start_location, packageItem.pickup_location);
        const dropoffDistance = haversineDistance(destination, packageItem.dropoff_location);
        console.log(`Package ID ${packageItem.id}: Start = ${JSON.stringify(start_location)}, Pickup = ${JSON.stringify(packageItem.pickup_location)}, Pickup Distance = ${pickupDistance} km`);
        console.log(`Package ID ${packageItem.id}: Dest = ${JSON.stringify(destination)}, Dropoff = ${JSON.stringify(packageItem.dropoff_location)}, Dropoff Distance = ${dropoffDistance} km`);
        console.log(`Package ID ${packageItem.id}: Pickup Radius = ${pickup_radius}, Dropoff Radius = ${dropoff_radius}, Match = ${pickupDistance <= pickup_radius && dropoffDistance <= dropoff_radius}`);
        return pickupDistance <= pickup_radius && dropoffDistance <= dropoff_radius;
      } catch (error) {
        console.error(`Error processing package ID ${packageItem.id}:`, error.message);
        return false; // Skip pakketten met ongeldige data
      }
    });

    res.json({ message: 'Packages found', packages: matchingPackages });
  } catch (err) {
    res.status(500).json({ error: 'Error searching packages', details: err.message });
  }
};