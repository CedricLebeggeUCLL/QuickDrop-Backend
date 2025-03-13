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
    console.error('Error fetching packages:', err.message);
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
    console.error('Error fetching package:', err.message);
    res.status(500).json({ error: 'Error fetching package', details: err.message });
  }
};

exports.getPackagesByUserId = async (req, res) => {
  try {
    const userId = req.params.userId;
    if (!userId || userId <= 0) {
      return res.status(400).json({ error: 'Invalid user_id' });
    }
    const packages = await Package.findAll({
      where: { user_id: userId },
      include: [
        { model: Address, as: 'pickupAddress' },
        { model: Address, as: 'dropoffAddress' },
      ],
    });
    res.json(packages);
  } catch (err) {
    console.error('Error fetching packages by user ID:', err.message);
    res.status(500).json({ error: 'Error fetching packages by user ID', details: err.message });
  }
};

exports.addPackage = async (req, res) => {
  console.log('Entering addPackage endpoint');
  const userId = req.body.user_id;
  const { description, pickup_address, dropoff_address } = req.body;

  console.log('Create package request received:', JSON.stringify(req.body, null, 2));

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

    const processPostalCode = async (address) => {
      if (address.postal_code) {
        const postalCodeExists = await PostalCode.findOne({ where: { code: address.postal_code } });
        if (!postalCodeExists) {
          console.log(`Adding new postal code: ${address.postal_code}, ${address.city}, ${address.country || 'Belgium'}`);
          await PostalCode.create({
            code: address.postal_code,
            city: address.city,
            country: address.country || 'Belgium',
          }, { transaction });
          console.log(`Postal code ${address.postal_code} added`);
        } else {
          console.log(`Postal code ${address.postal_code} already exists`);
        }
      } else {
        console.log('No postal_code provided for address');
        await transaction.rollback();
        return res.status(400).json({ error: 'Postal code is required for address' });
      }
    };

    await processPostalCode(pickup_address);
    await processPostalCode(dropoff_address);

    const pickupCoords = await geocodeAddress(pickup_address);
    if (!pickupCoords.lat || !pickupCoords.lng) {
      console.log('Geocoding failed for pickup address:', pickupCoords);
      await transaction.rollback();
      return res.status(500).json({ error: 'Geocoding failed for pickup address' });
    }
    const [pickupAddress] = await Address.findOrCreate({
      where: {
        street_name: pickup_address.street_name,
        house_number: pickup_address.house_number,
        extra_info: pickup_address.extra_info || null,
        postal_code: pickup_address.postal_code,
      },
      defaults: { ...pickup_address, lat: pickupCoords.lat, lng: pickupCoords.lng },
      transaction,
    });
    console.log('Pickup address created/updated:', pickupAddress.toJSON());

    const dropoffCoords = await geocodeAddress(dropoff_address);
    if (!dropoffCoords.lat || !dropoffCoords.lng) {
      console.log('Geocoding failed for dropoff address:', dropoffCoords);
      await transaction.rollback();
      return res.status(500).json({ error: 'Geocoding failed for dropoff address' });
    }
    const [dropoffAddress] = await Address.findOrCreate({
      where: {
        street_name: dropoff_address.street_name,
        house_number: dropoff_address.house_number,
        extra_info: dropoff_address.extra_info || null,
        postal_code: dropoff_address.postal_code,
      },
      defaults: { ...dropoff_address, lat: dropoffCoords.lat, lng: dropoffCoords.lng },
      transaction,
    });
    console.log('Dropoff address created/updated:', dropoffAddress.toJSON());

    const packageItem = await Package.create({
      user_id: userId,
      description,
      pickup_address_id: pickupAddress.id,
      dropoff_address_id: dropoffAddress.id,
      status: 'pending',
    }, { transaction });
    console.log('Package created:', packageItem.toJSON());

    await transaction.commit();
    console.log('Transaction committed');
    res.status(201).json({ message: 'Package added successfully', packageId: packageItem.id });
  } catch (err) {
    await transaction.rollback();
    console.error('Error adding package:', err.message);
    if (err.name === 'SequelizeForeignKeyConstraintError') {
      res.status(403).json({ error: 'User or postal code does not exist', details: err.message });
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
      const processPostalCode = async (address) => {
        if (address.postal_code) {
          const postalCodeExists = await PostalCode.findOne({ where: { code: address.postal_code } });
          if (!postalCodeExists) {
            console.log(`Adding new postal code: ${address.postal_code}, ${address.city}, ${address.country || 'Belgium'}`);
            await PostalCode.create({
              code: address.postal_code,
              city: address.city,
              country: address.country || 'Belgium',
            }, { transaction });
            console.log(`Postal code ${address.postal_code} added`);
          } else {
            console.log(`Postal code ${address.postal_code} already exists`);
          }
        } else {
          console.log('No postal_code provided for address');
          await transaction.rollback();
          return res.status(400).json({ error: 'Postal code is required for address' });
        }
      };
      await processPostalCode(pickup_address);

      const pickupCoords = await geocodeAddress(pickup_address);
      if (!pickupCoords.lat || !pickupCoords.lng) {
        console.log('Geocoding failed for pickup address:', pickupCoords);
        await transaction.rollback();
        return res.status(500).json({ error: 'Geocoding failed for pickup address' });
      }
      const [pickupAddress] = await Address.findOrCreate({
        where: {
          street_name: pickup_address.street_name,
          house_number: pickup_address.house_number,
          extra_info: pickup_address.extra_info || null,
          postal_code: pickup_address.postal_code,
        },
        defaults: { ...pickup_address, lat: pickupCoords.lat, lng: pickupCoords.lng },
        transaction,
      });
      pickupAddressId = pickupAddress.id;
      console.log('Pickup address created/updated:', pickupAddress.toJSON());
    }

    if (dropoff_address) {
      const processPostalCode = async (address) => {
        if (address.postal_code) {
          const postalCodeExists = await PostalCode.findOne({ where: { code: address.postal_code } });
          if (!postalCodeExists) {
            console.log(`Adding new postal code: ${address.postal_code}, ${address.city}, ${address.country || 'Belgium'}`);
            await PostalCode.create({
              code: address.postal_code,
              city: address.city,
              country: address.country || 'Belgium',
            }, { transaction });
            console.log(`Postal code ${address.postal_code} added`);
          } else {
            console.log(`Postal code ${address.postal_code} already exists`);
          }
        } else {
          console.log('No postal_code provided for address');
          await transaction.rollback();
          return res.status(400).json({ error: 'Postal code is required for address' });
        }
      };
      await processPostalCode(dropoff_address);

      const dropoffCoords = await geocodeAddress(dropoff_address);
      if (!dropoffCoords.lat || !dropoffCoords.lng) {
        console.log('Geocoding failed for dropoff address:', dropoffCoords);
        await transaction.rollback();
        return res.status(500).json({ error: 'Geocoding failed for dropoff address' });
      }
      const [dropoffAddress] = await Address.findOrCreate({
        where: {
          street_name: dropoff_address.street_name,
          house_number: dropoff_address.house_number,
          extra_info: dropoff_address.extra_info || null,
          postal_code: dropoff_address.postal_code,
        },
        defaults: { ...dropoff_address, lat: dropoffCoords.lat, lng: dropoffCoords.lng },
        transaction,
      });
      dropoffAddressId = dropoffAddress.id;
      console.log('Dropoff address created/updated:', dropoffAddress.toJSON());
    }

    const updateData = {
      description,
      ...(pickupAddressId && { pickup_address_id: pickupAddressId }),
      ...(dropoffAddressId && { dropoff_address_id: dropoffAddressId }),
      ...(status && { status }), // Alleen updaten als status is meegegeven
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
    console.log('Package updated:', updatedPackage.toJSON());
    res.json(updatedPackage);
  } catch (err) {
    await transaction.rollback();
    console.error('Error updating package:', err.message);
    res.status(500).json({ error: 'Error updating package', details: err.message });
  }
};

exports.deletePackage = async (req, res) => {
  try {
    const deleted = await Package.destroy({ where: { id: req.params.id } });
    if (deleted === 0) return res.status(404).json({ error: 'Package not found' });
    console.log(`Package with id ${req.params.id} deleted`);
    res.status(204).send();
  } catch (err) {
    console.error('Error deleting package:', err.message);
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
      return res.status(404).json({ error: 'Delivery not found for this package' });
    }

    const courier = await Courier.findByPk(delivery.courier_id, {
      include: [{ model: Address, as: 'currentAddress' }],
    });
    if (!courier) {
      return res.status(404).json({ error: 'Courier not found' });
    }

    const currentCoords = courier.currentAddress
      ? await geocodeAddress(courier.currentAddress)
      : { lat: null, lng: null };

    const trackingInfo = {
      packageId: packageItem.id,
      status: packageItem.status,
      pickupAddress: packageItem.pickupAddress,
      dropoffAddress: packageItem.dropoffAddress,
      currentLocation: currentCoords,
      estimatedDelivery: delivery.delivery_time || 'Niet beschikbaar',
    };

    res.json(trackingInfo);
  } catch (err) {
    console.error('Error tracking package:', err.message);
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

    if (!startAddress) {
      const startCoords = await geocodeAddress(startAddressData);
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
    } else if (!startAddress.lat || !startAddress.lng) {
      const startCoords = await geocodeAddress(startAddressData);
      if (!startCoords || !startCoords.lat || !startCoords.lng) {
        throw new Error('Failed to update start address: No coordinates returned');
      }
      await startAddress.update({ lat: startCoords.lat, lng: startCoords.lng }, { transaction });
    }

    let destAddressData = { ...destination_address, country: 'Belgium' };
    let destAddress = await Address.findOne({
      where: {
        street_name: destAddressData.street_name,
        house_number: destAddressData.house_number,
        extra_info: destAddressData.extra_info,
        postal_code: destAddressData.postal_code,
      },
    });

    if (!destAddress) {
      const destCoords = await geocodeAddress(destAddressData);
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
    } else if (!destAddress.lat || !destAddress.lng) {
      const destCoords = await geocodeAddress(destAddressData);
      if (!destCoords || !destCoords.lat || !destCoords.lng) {
        throw new Error('Failed to update destination address: No coordinates returned');
      }
      await destAddress.update({ lat: destCoords.lat, lng: destCoords.lng }, { transaction });
    }

    const processPostalCode = async (addressData) => {
      if (addressData.postal_code) {
        const postalCodeExists = await PostalCode.findOne({ where: { code: addressData.postal_code } });
        if (!postalCodeExists) {
          console.log(`Adding new postal code: ${addressData.postal_code}, ${addressData.city}, ${addressData.country || 'Belgium'}`);
          await PostalCode.create({
            code: addressData.postal_code,
            city: addressData.city,
            country: addressData.country || 'Belgium',
          }, { transaction });
          console.log(`Postal code ${addressData.postal_code} added`);
        } else {
          console.log(`Postal code ${addressData.postal_code} already exists`);
        }
      }
    };

    await processPostalCode(startAddressData);
    await processPostalCode(destAddressData);

    await courier.update({
      start_address_id: startAddress.id,
      destination_address_id: destAddress.id,
    }, { transaction });

    const packages = await Package.findAll({
      where: { status: 'pending' },
      include: [
        { model: Address, as: 'pickupAddress' },
        { model: Address, as: 'dropoffAddress' },
      ],
    });

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
    console.error('Search packages error:', err.message);
    res.status(500).json({ error: 'Error searching packages', details: err.message });
  }
};

module.exports = exports;