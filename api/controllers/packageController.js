const { sequelize } = require('../db');
const { haversineDistance } = require('../../utils/distance');
const { geocodeAddress } = require('../../utils/geocode');
const Package = require('../models/package');
const Courier = require('../models/courier');
const Address = require('../models/address');
const PostalCode = require('../models/postalcode');
const User = require('../models/user');

exports.getPackages = async (req, res) => {
  try {
    const packages = await Package.findAll({
      include: [
        { model: Address, as: 'pickupAddress' },
        { model: Address, as: 'dropoffAddress' },
      ],
    });
    res.json(packages);
  } catch (err) {
    res.status(500).json({ error: 'Error fetching packages', details: err.message });
  }
};

exports.getPackageById = async (req, res) => {
  try {
    const packageItem = await Package.findByPk(req.params.id, {
      include: [
        { model: Address, as: 'pickupAddress' },
        { model: Address, as: 'dropoffAddress' },
      ],
    });
    if (!packageItem) return res.status(404).json({ error: 'Package not found' });
    res.json(packageItem);
  } catch (err) {
    res.status(500).json({ error: 'Error fetching package', details: err.message });
  }
};

exports.addPackage = async (req, res) => {
  const userId = req.body.user_id;
  const { description, pickup_address, dropoff_address } = req.body;

  if (!pickup_address || !dropoff_address) {
    return res.status(400).json({ error: 'Pickup and dropoff addresses are required' });
  }

  if (!userId || userId <= 0) {
    return res.status(400).json({ error: 'Invalid user_id' });
  }

  const transaction = await sequelize.transaction();
  try {
    const user = await User.findByPk(userId, { transaction });
    if (!user) {
      await transaction.rollback();
      return res.status(403).json({ error: 'User does not exist' });
    }

    // Maak pickup-adres
    const [pickupAddress] = await Address.findOrCreate({
      where: {
        street_name: pickup_address.street_name,
        house_number: pickup_address.house_number,
        extra_info: pickup_address.extra_info || null,
        postal_code: pickup_address.postal_code,
      },
      defaults: pickup_address,
      transaction,
    });

    // Maak dropoff-adres
    const [dropoffAddress] = await Address.findOrCreate({
      where: {
        street_name: dropoff_address.street_name,
        house_number: dropoff_address.house_number,
        extra_info: dropoff_address.extra_info || null,
        postal_code: dropoff_address.postal_code,
      },
      defaults: dropoff_address,
      transaction,
    });

    const packageItem = await Package.create({
      user_id: userId,
      description,
      pickup_address_id: pickupAddress.id,
      dropoff_address_id: dropoffAddress.id,
      status: 'pending',
    }, { transaction });

    await transaction.commit();
    res.status(201).json({ message: 'Package added successfully', packageId: packageItem.id });
  } catch (err) {
    await transaction.rollback();
    if (err.name === 'SequelizeForeignKeyConstraintError') {
      res.status(403).json({ error: 'User does not exist', details: err.message });
    } else {
      res.status(500).json({ error: 'Error adding package', details: err.message });
    }
  }
};

exports.updatePackage = async (req, res) => {
  const { description, pickup_address, dropoff_address, status } = req.body;
  const transaction = await sequelize.transaction();
  try {
    let pickupAddressId, dropoffAddressId;

    if (pickup_address) {
      const [pickupAddress] = await Address.findOrCreate({
        where: {
          street_name: pickup_address.street_name,
          house_number: pickup_address.house_number,
          extra_info: pickup_address.extra_info || null,
          postal_code: pickup_address.postal_code,
        },
        defaults: pickup_address,
        transaction,
      });
      pickupAddressId = pickupAddress.id;
    }

    if (dropoff_address) {
      const [dropoffAddress] = await Address.findOrCreate({
        where: {
          street_name: dropoff_address.street_name,
          house_number: dropoff_address.house_number,
          extra_info: dropoff_address.extra_info || null,
          postal_code: dropoff_address.postal_code,
        },
        defaults: dropoff_address,
        transaction,
      });
      dropoffAddressId = dropoffAddress.id;
    }

    const updateData = {
      description,
      ...(pickupAddressId && { pickup_address_id: pickupAddressId }),
      ...(dropoffAddressId && { dropoff_address_id: dropoffAddressId }),
      status,
    };

    const [updated] = await Package.update(
      updateData,
      { where: { id: req.params.id }, transaction }
    );
    if (updated === 0) {
      await transaction.rollback();
      return res.status(404).json({ error: 'Package not found' });
    }

    const updatedPackage = await Package.findByPk(req.params.id, {
      include: [
        { model: Address, as: 'pickupAddress' },
        { model: Address, as: 'dropoffAddress' },
      ],
      transaction,
    });

    await transaction.commit();
    res.json(updatedPackage);
  } catch (err) {
    await transaction.rollback();
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
    const packageItem = await Package.findByPk(packageId, {
      include: [
        { model: Address, as: 'pickupAddress' },
        { model: Address, as: 'dropoffAddress' },
      ],
    });
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

    const courier = await Courier.findByPk(delivery.courier_id, {
      include: [{ model: Address, as: 'currentAddress' }],
    });
    if (!courier) {
      return res.status(404).json({ error: 'Courier not found' });
    }

    // Geocode het huidige adres van de courier voor tracking
    const currentCoords = await geocodeAddress(courier.currentAddress);
    res.json({ packageId, currentLocation: currentCoords });
  } catch (err) {
    res.status(500).json({ error: 'Error tracking package', details: err.message });
  }
};

exports.searchPackages = async (req, res) => {
  const userId = req.body.user_id;
  const { start_address, destination_address, pickup_radius, dropoff_radius, use_current_as_start } = req.body;

  console.log('Request body received:', JSON.stringify(req.body, null, 2));

  if (!pickup_radius || !dropoff_radius) {
    return res.status(400).json({ error: 'Pickup radius and dropoff radius are required' });
  }

  if (!start_address.city || !start_address.country || !destination_address.city || !destination_address.country) {
    return res.status(400).json({ error: 'City and country are required for both start and destination addresses' });
  }

  start_address.extra_info = start_address.extra_info !== undefined ? start_address.extra_info : null;
  destination_address.extra_info = destination_address.extra_info !== undefined ? destination_address.extra_info : null;

  const transaction = await sequelize.transaction();
  try {
    const courier = await Courier.findOne({
      where: { user_id: userId },
      include: [
        { model: Address, as: 'currentAddress' },
        { model: Address, as: 'startAddress' },
        { model: Address, as: 'destinationAddress' },
      ],
    });
    if (!courier) {
      await transaction.rollback();
      return res.status(403).json({ error: 'User is not a courier' });
    }

    // Verwerk startadres
    let startAddressData = { ...start_address, country: 'Belgium' };
    if (use_current_as_start && courier.currentAddress) {
      startAddressData = {
        street_name: courier.currentAddress.street_name,
        house_number: courier.currentAddress.house_number,
        extra_info: courier.currentAddress.extra_info || null,
        postal_code: courier.currentAddress.postal_code,
        city: start_address.city,
        country: 'Belgium',
      };
    }

    let startAddress = await Address.findOne({
      where: {
        street_name: startAddressData.street_name,
        house_number: startAddressData.house_number,
        extra_info: startAddressData.extra_info,
        postal_code: startAddressData.postal_code,
      },
    });

    console.log('Start address from DB:', startAddress ? startAddress.toJSON() : 'Not found');

    if (!startAddress) {
      const startCoords = await geocodeAddress(startAddressData);
      console.log('Geocoded start address:', startCoords);
      if (!startCoords || !startCoords.lat || !startCoords.lng) {
        throw new Error('Failed to geocode start address: No coordinates returned');
      }
      startAddress = await Address.create({
        street_name: startAddressData.street_name,
        house_number: startAddressData.house_number,
        extra_info: startAddressData.extra_info,
        postal_code: startAddressData.postal_code,
        lat: startCoords.lat,
        lng: startCoords.lng,
      }, { transaction });
      console.log('Created start address:', startAddress.toJSON());
    } else if (!startAddress.lat || !startAddress.lng) {
      const startCoords = await geocodeAddress(startAddressData);
      console.log('Updating start address with coords:', startCoords);
      if (!startCoords || !startCoords.lat || !startCoords.lng) {
        throw new Error('Failed to update start address: No coordinates returned');
      }
      await startAddress.update({ lat: startCoords.lat, lng: startCoords.lng }, { transaction });
      console.log('Updated start address:', startAddress.toJSON());
    }

    // Verwerk bestemmingsadres
    let destAddressData = { ...destination_address, country: 'Belgium' };
    let destAddress = await Address.findOne({
      where: {
        street_name: destAddressData.street_name,
        house_number: destAddressData.house_number,
        extra_info: destAddressData.extra_info,
        postal_code: destAddressData.postal_code,
      },
    });

    console.log('Destination address from DB:', destAddress ? destAddress.toJSON() : 'Not found');

    if (!destAddress) {
      const destCoords = await geocodeAddress(destAddressData);
      console.log('Geocoded destination address:', destCoords);
      if (!destCoords || !destCoords.lat || !destCoords.lng) {
        throw new Error('Failed to geocode destination address: No coordinates returned');
      }
      destAddress = await Address.create({
        street_name: destAddressData.street_name,
        house_number: destAddressData.house_number,
        extra_info: destAddressData.extra_info,
        postal_code: destAddressData.postal_code,
        lat: destCoords.lat,
        lng: destCoords.lng,
      }, { transaction });
      console.log('Created destination address:', destAddress.toJSON());
    } else if (!destAddress.lat || !destAddress.lng) {
      const destCoords = await geocodeAddress(destAddressData);
      console.log('Updating destination address with coords:', destCoords);
      if (!destCoords || !destCoords.lat || !destCoords.lng) {
        throw new Error('Failed to update destination address: No coordinates returned');
      }
      await destAddress.update({ lat: destCoords.lat, lng: destCoords.lng }, { transaction });
      console.log('Updated destination address:', destAddress.toJSON());
    }

    // Postcodes toevoegen
    const startPostalCode = await PostalCode.findByPk(startAddressData.postal_code);
    if (!startPostalCode) {
      await PostalCode.create({
        code: startAddressData.postal_code,
        city: startAddressData.city,
        country: 'Belgium',
      }, { transaction });
    }

    const destPostalCode = await PostalCode.findByPk(destAddressData.postal_code);
    if (!destPostalCode) {
      await PostalCode.create({
        code: destAddressData.postal_code,
        city: destAddressData.city,
        country: 'Belgium',
      }, { transaction });
    }

    // Update koerier
    await courier.update({
      start_address_id: startAddress.id,
      destination_address_id: destAddress.id,
    }, { transaction });

    // Haal pakketten op
    const packages = await Package.findAll({
      where: { status: 'pending' },
      include: [
        { model: Address, as: 'pickupAddress' },
        { model: Address, as: 'dropoffAddress' },
      ],
    });

    console.log('Pending packages:', JSON.stringify(packages, null, 2));

    const matchingPackages = [];
    for (const pkg of packages) {
      if (!pkg.pickupAddress.lat || !pkg.pickupAddress.lng || !pkg.dropoffAddress.lat || !pkg.dropoffAddress.lng) {
        console.error(`Package ${pkg.id} has missing coordinates, skipping`);
        continue;
      }

      const pickupCoords = { lat: pkg.pickupAddress.lat, lng: pkg.pickupAddress.lng };
      const dropoffCoords = { lat: pkg.dropoffAddress.lat, lng: pkg.dropoffAddress.lng };
      const startCoords = { lat: startAddress.lat, lng: startAddress.lng };
      const destCoords = { lat: destAddress.lat, lng: destAddress.lng };

      const pickupDistance = haversineDistance(startCoords, pickupCoords);
      const dropoffDistance = haversineDistance(destCoords, dropoffCoords);

      console.log(`Package ${pkg.id}: Pickup Distance = ${pickupDistance} km, Dropoff Distance = ${dropoffDistance} km`);

      if (pickupDistance <= pickup_radius && dropoffDistance <= dropoff_radius) {
        matchingPackages.push(pkg);
      }
    }

    await transaction.commit();
    res.json({ message: 'Packages found', packages: matchingPackages });
  } catch (err) {
    await transaction.rollback();
    console.error('Search packages error:', err);
    res.status(500).json({ error: 'Error searching packages', details: err.message });
  }
};

module.exports = exports;