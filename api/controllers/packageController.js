const { sequelize } = require('../db');
const Package = require('../models/package');

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
    const package = await Package.findByPk(req.params.id);
    if (!package) return res.status(404).json({ error: 'Package not found' });
    res.json(package);
  } catch (err) {
    res.status(500).json({ error: 'Error fetching package', details: err.message });
  }
};

exports.addPackage = async (req, res) => {
  const userId = req.body.user_id; // Will be from JWT later
  const { description, pickup_location, dropoff_location, pickup_address, dropoff_address } = req.body;

  if (!pickup_location || !dropoff_location) {
    return res.status(400).json({ error: 'Pickup and dropoff locations are required' });
  }

  try {
    const package = await Package.create({
      user_id: userId,
      description,
      pickup_location,
      dropoff_location,
      pickup_address,
      dropoff_address,
      status: 'pending'
    });
    res.status(201).json({ message: 'Package added successfully', packageId: package.id });
  } catch (err) {
    res.status(500).json({ error: 'Error adding package', details: err.message });
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
    const package = await Package.findByPk(packageId);
    if (!package) {
      return res.status(404).json({ error: 'Package not found' });
    }
    if (package.status !== 'in_transit') {
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