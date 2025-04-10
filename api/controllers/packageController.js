const { sequelize } = require('../db');
const { Op } = require('sequelize');
const { haversineDistance } = require('../../utils/distance');
const { geocodeAddress } = require('../../utils/geocode');
const Package = require('../models/package');
const Courier = require('../models/courier');
const Address = require('../models/address');
const PostalCode = require('../models/postalcode');
const User = require('../models/user');
const Delivery = require('../models/delivery');

exports.getPackages = async (req, res) => {
  try {
    const packages = await Package.findAll({
      include: [
        {
          model: Address,
          as: 'pickupAddress',
          include: [
            {
              model: PostalCode,
              as: 'postalCodeDetails',
              attributes: ['city', 'country'],
            },
          ],
        },
        {
          model: Address,
          as: 'dropoffAddress',
          include: [
            {
              model: PostalCode,
              as: 'postalCodeDetails',
              attributes: ['city', 'country'],
            },
          ],
        },
      ],
    });

    // Transformeer de data om city en country toe te voegen
    const transformedPackages = packages.map(pkg => {
      const pkgJson = pkg.toJSON();
      return {
        ...pkgJson,
        pickupAddress: {
          ...pkgJson.pickupAddress,
          city: pkgJson.pickupAddress.postalCodeDetails?.city || null,
          country: pkgJson.pickupAddress.postalCodeDetails?.country || null,
        },
        dropoffAddress: {
          ...pkgJson.dropoffAddress,
          city: pkgJson.dropoffAddress.postalCodeDetails?.city || null,
          country: pkgJson.dropoffAddress.postalCodeDetails?.country || null,
        },
      };
    });

    // Verwijder postalCodeDetails uit de response
    transformedPackages.forEach(pkg => {
      delete pkg.pickupAddress.postalCodeDetails;
      delete pkg.dropoffAddress.postalCodeDetails;
    });

    res.json(transformedPackages);
  } catch (err) {
    console.error('Error fetching packages:', err.message);
    res.status(500).json({ error: 'Error fetching packages', details: err.message });
  }
};

exports.getPackageById = async (req, res) => {
  try {
    const packageItem = await Package.findByPk(req.params.id, {
      include: [
        {
          model: Address,
          as: 'pickupAddress',
          include: [
            {
              model: PostalCode,
              as: 'postalCodeDetails',
              attributes: ['city', 'country'],
            },
          ],
        },
        {
          model: Address,
          as: 'dropoffAddress',
          include: [
            {
              model: PostalCode,
              as: 'postalCodeDetails',
              attributes: ['city', 'country'],
            },
          ],
        },
      ],
    });
    if (!packageItem) return res.status(404).json({ error: 'Package not found' });

    const transformedPackage = {
      ...packageItem.toJSON(),
      pickupAddress: {
        ...packageItem.pickupAddress.toJSON(),
        city: packageItem.pickupAddress.postalCodeDetails?.city || null,
        country: packageItem.pickupAddress.postalCodeDetails?.country || null,
      },
      dropoffAddress: {
        ...packageItem.dropoffAddress.toJSON(),
        city: packageItem.dropoffAddress.postalCodeDetails?.city || null,
        country: packageItem.dropoffAddress.postalCodeDetails?.country || null,
      },
    };

    delete transformedPackage.pickupAddress.postalCodeDetails;
    delete transformedPackage.dropoffAddress.postalCodeDetails;

    res.json(transformedPackage);
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
        {
          model: Address,
          as: 'pickupAddress',
          include: [
            {
              model: PostalCode,
              as: 'postalCodeDetails',
              attributes: ['city', 'country'],
            },
          ],
        },
        {
          model: Address,
          as: 'dropoffAddress',
          include: [
            {
              model: PostalCode,
              as: 'postalCodeDetails',
              attributes: ['city', 'country'],
            },
          ],
        },
      ],
    });

    // Transformeer de data om city en country toe te voegen
    const transformedPackages = packages.map(pkg => {
      const pkgJson = pkg.toJSON();
      return {
        ...pkgJson,
        pickupAddress: {
          ...pkgJson.pickupAddress,
          city: pkgJson.pickupAddress.postalCodeDetails?.city || null,
          country: pkgJson.pickupAddress.postalCodeDetails?.country || null,
        },
        dropoffAddress: {
          ...pkgJson.dropoffAddress,
          city: pkgJson.dropoffAddress.postalCodeDetails?.city || null,
          country: pkgJson.dropoffAddress.postalCodeDetails?.country || null,
        },
      };
    });

    // Verwijder postalCodeDetails uit de response
    transformedPackages.forEach(pkg => {
      delete pkg.pickupAddress.postalCodeDetails;
      delete pkg.dropoffAddress.postalCodeDetails;
    });

    res.json(transformedPackages);
  } catch (err) {
    console.error('Error fetching packages by user ID:', err.message);
    res.status(500).json({ error: 'Error fetching packages by user ID', details: err.message });
  }
};

exports.addPackage = async (req, res) => {
  console.log('Entering addPackage endpoint');
  const userId = req.body.user_id;
  const { description, pickup_address, dropoff_address, action_type, category, size } = req.body;

  console.log('Create package request received:', JSON.stringify(req.body, null, 2));

  // Validatie van verplichte velden
  if (!pickup_address || !dropoff_address) {
    return res.status(400).json({ error: 'Pickup and dropoff addresses are required' });
  }
  if (!userId || userId <= 0) {
    return res.status(400).json({ error: 'Invalid user_id' });
  }
  if (!action_type || !['send', 'receive'].includes(action_type)) {
    return res.status(400).json({ error: 'Invalid action_type, must be "send" or "receive"' });
  }
  if (!category || !['package', 'food', 'drink'].includes(category)) {
    return res.status(400).json({ error: 'Invalid category, must be "package", "food", or "drink"' });
  }
  if (!size || !['small', 'medium', 'large'].includes(size)) {
    return res.status(400).json({ error: 'Invalid size, must be "small", "medium", or "large"' });
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
        const postalCodeExists = await PostalCode.findOne({ where: { code: address.postal_code }, transaction });
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
      defaults: {
        street_name: pickup_address.street_name,
        house_number: pickup_address.house_number,
        extra_info: pickup_address.extra_info || null,
        postal_code: pickup_address.postal_code,
        lat: pickupCoords.lat,
        lng: pickupCoords.lng,
      },
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
      defaults: {
        street_name: dropoff_address.street_name,
        house_number: dropoff_address.house_number,
        extra_info: dropoff_address.extra_info || null,
        postal_code: dropoff_address.postal_code,
        lat: dropoffCoords.lat,
        lng: dropoffCoords.lng,
      },
      transaction,
    });
    console.log('Dropoff address created/updated:', dropoffAddress.toJSON());

    const packageItem = await Package.create({
      user_id: userId,
      description,
      pickup_address_id: pickupAddress.id,
      dropoff_address_id: dropoffAddress.id,
      action_type, // Nieuw veld
      category, // Nieuw veld
      size, // Nieuw veld
      status: 'pending',
    }, { transaction });
    console.log('Package created:', packageItem.toJSON());

    await transaction.commit();
    console.log('Transaction committed');

    // Haal het aangemaakte pakket op met alle relaties voor de response
    const createdPackage = await Package.findByPk(packageItem.id, {
      include: [
        {
          model: Address,
          as: 'pickupAddress',
          include: [
            {
              model: PostalCode,
              as: 'postalCodeDetails',
              attributes: ['city', 'country'],
            },
          ],
        },
        {
          model: Address,
          as: 'dropoffAddress',
          include: [
            {
              model: PostalCode,
              as: 'postalCodeDetails',
              attributes: ['city', 'country'],
            },
          ],
        },
      ],
    });

    const transformedPackage = {
      ...createdPackage.toJSON(),
      pickupAddress: {
        ...createdPackage.pickupAddress.toJSON(),
        city: createdPackage.pickupAddress.postalCodeDetails?.city || null,
        country: createdPackage.pickupAddress.postalCodeDetails?.country || null,
      },
      dropoffAddress: {
        ...createdPackage.dropoffAddress.toJSON(),
        city: createdPackage.dropoffAddress.postalCodeDetails?.city || null,
        country: createdPackage.dropoffAddress.postalCodeDetails?.country || null,
      },
    };

    delete transformedPackage.pickupAddress.postalCodeDetails;
    delete transformedPackage.dropoffAddress.postalCodeDetails;

    res.status(201).json(transformedPackage);
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
  const { description, pickup_address, dropoff_address, action_type, category, size, status } = req.body;
  const transaction = await sequelize.transaction();
  try {
    let pickupAddressId, dropoffAddressId;

    if (pickup_address) {
      const processPostalCode = async (address) => {
        if (!address.postal_code) {
          console.error('No postal_code provided for pickup_address');
          await transaction.rollback();
          return res.status(400).json({ error: 'Postal code is required for pickup address' });
        }

        const postalCodeExists = await PostalCode.findOne({ where: { code: address.postal_code }, transaction });
        if (!postalCodeExists) {
          console.log(`Adding new postal code: ${address.postal_code}, ${address.city || 'Unknown'}, ${address.country || 'Belgium'}`);
          await PostalCode.create({
            code: address.postal_code,
            city: address.city || 'Unknown',
            country: address.country || 'Belgium',
          }, { transaction });
          console.log(`Postal code ${address.postal_code} added`);
        } else {
          console.log(`Postal code ${address.postal_code} already exists`);
        }
      };
      await processPostalCode(pickup_address);

      const pickupCoords = await geocodeAddress(pickup_address);
      if (!pickupCoords || !pickupCoords.lat || !pickupCoords.lng) {
        console.error('Geocoding failed for pickup address:', pickupCoords);
        await transaction.rollback();
        return res.status(500).json({ error: 'Geocoding failed for pickup address', details: pickupCoords });
      }

      const [pickupAddress] = await Address.findOrCreate({
        where: {
          street_name: pickup_address.street_name || 'Unknown',
          house_number: pickup_address.house_number || 'Unknown',
          extra_info: pickup_address.extra_info || null,
          postal_code: pickup_address.postal_code,
        },
        defaults: {
          street_name: pickup_address.street_name || 'Unknown',
          house_number: pickup_address.house_number || 'Unknown',
          extra_info: pickup_address.extra_info || null,
          postal_code: pickup_address.postal_code,
          lat: pickupCoords.lat,
          lng: pickupCoords.lng,
        },
        transaction,
      });
      pickupAddressId = pickupAddress.id;
      console.log('Pickup address created/updated:', pickupAddress.toJSON());
    }

    if (dropoff_address) {
      const processPostalCode = async (address) => {
        if (!address.postal_code) {
          console.error('No postal_code provided for dropoff_address');
          await transaction.rollback();
          return res.status(400).json({ error: 'Postal code is required for dropoff address' });
        }

        const postalCodeExists = await PostalCode.findOne({ where: { code: address.postal_code }, transaction });
        if (!postalCodeExists) {
          console.log(`Adding new postal code: ${address.postal_code}, ${address.city || 'Unknown'}, ${address.country || 'Belgium'}`);
          await PostalCode.create({
            code: address.postal_code,
            city: address.city || 'Unknown',
            country: address.country || 'Belgium',
          }, { transaction });
          console.log(`Postal code ${address.postal_code} added`);
        } else {
          console.log(`Postal code ${address.postal_code} already exists`);
        }
      };
      await processPostalCode(dropoff_address);

      const dropoffCoords = await geocodeAddress(dropoff_address);
      if (!dropoffCoords || !dropoffCoords.lat || !dropoffCoords.lng) {
        console.error('Geocoding failed for dropoff address:', dropoffCoords);
        await transaction.rollback();
        return res.status(500).json({ error: 'Geocoding failed for dropoff address', details: dropoffCoords });
      }

      const [dropoffAddress] = await Address.findOrCreate({
        where: {
          street_name: dropoff_address.street_name || 'Unknown',
          house_number: dropoff_address.house_number || 'Unknown',
          extra_info: dropoff_address.extra_info || null,
          postal_code: dropoff_address.postal_code,
        },
        defaults: {
          street_name: dropoff_address.street_name || 'Unknown',
          house_number: dropoff_address.house_number || 'Unknown',
          extra_info: dropoff_address.extra_info || null,
          postal_code: dropoff_address.postal_code,
          lat: dropoffCoords.lat,
          lng: dropoffCoords.lng,
        },
        transaction,
      });
      dropoffAddressId = dropoffAddress.id;
      console.log('Dropoff address created/updated:', dropoffAddress.toJSON());
    }

    const updateData = {
      ...(description !== undefined && { description }),
      ...(pickupAddressId && { pickup_address_id: pickupAddressId }),
      ...(dropoffAddressId && { dropoff_address_id: dropoffAddressId }),
      ...(action_type && { action_type }),
      ...(category && { category }),
      ...(size && { size }),
      ...(status && { status }),
    };

    if (Object.keys(updateData).length === 0) {
      await transaction.rollback();
      return res.status(400).json({ error: 'No valid fields provided to update' });
    }

    // Validatie van nieuwe velden
    if (action_type && !['send', 'receive'].includes(action_type)) {
      await transaction.rollback();
      return res.status(400).json({ error: 'Invalid action_type, must be "send" or "receive"' });
    }
    if (category && !['package', 'food', 'drink'].includes(category)) {
      await transaction.rollback();
      return res.status(400).json({ error: 'Invalid category, must be "package", "food", or "drink"' });
    }
    if (size && !['small', 'medium', 'large'].includes(size)) {
      await transaction.rollback();
      return res.status(400).json({ error: 'Invalid size, must be "small", "medium", or "large"' });
    }

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
        {
          model: Address,
          as: 'pickupAddress',
          include: [{ model: PostalCode, as: 'postalCodeDetails', attributes: ['city', 'country'] }],
        },
        {
          model: Address,
          as: 'dropoffAddress',
          include: [{ model: PostalCode, as: 'postalCodeDetails', attributes: ['city', 'country'] }],
        },
      ],
      transaction,
    });

    await transaction.commit();
    console.log('Package updated:', updatedPackage.toJSON());

    const transformedPackage = {
      ...updatedPackage.toJSON(),
      pickupAddress: updatedPackage.pickupAddress ? {
        ...updatedPackage.pickupAddress.toJSON(),
        city: updatedPackage.pickupAddress.postalCodeDetails?.city || null,
        country: updatedPackage.pickupAddress.postalCodeDetails?.country || null,
      } : null,
      dropoffAddress: updatedPackage.dropoffAddress ? {
        ...updatedPackage.dropoffAddress.toJSON(),
        city: updatedPackage.dropoffAddress.postalCodeDetails?.city || null,
        country: updatedPackage.dropoffAddress.postalCodeDetails?.country || null,
      } : null,
    };
    delete transformedPackage.pickupAddress?.postalCodeDetails;
    delete transformedPackage.dropoffAddress?.postalCodeDetails;

    res.json(transformedPackage);
  } catch (err) {
    await transaction.rollback();
    console.error('Error updating package:', err.message, err.stack);
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

    let currentLocation;
    if (packageItem.status === 'assigned') {
      currentLocation = {
        lat: packageItem.pickupAddress.lat,
        lng: packageItem.pickupAddress.lng,
      };
    } else if (packageItem.status === 'delivered') {
      currentLocation = {
        lat: packageItem.dropoffAddress.lat,
        lng: packageItem.dropoffAddress.lng,
      };
    } else if (packageItem.status === 'in_transit') {
      const delivery = await Delivery.findOne({
        where: { package_id: packageId, status: 'picked_up' },
      });
      if (delivery) {
        const courier = await Courier.findByPk(delivery.courier_id);
        if (courier) {
          if (courier.current_lat && courier.current_lng) {
            currentLocation = {
              lat: courier.current_lat,
              lng: courier.current_lng,
            };
            console.log(`Courier location retrieved for package ${packageId}:`, currentLocation);
          } else {
            console.error(`Courier ${courier.id} has no current location set.`);
            currentLocation = {
              lat: packageItem.pickupAddress.lat,
              lng: packageItem.pickupAddress.lng,
            };
          }
        } else {
          console.error(`No courier found for delivery ${delivery.id}.`);
          currentLocation = {
            lat: packageItem.pickupAddress.lat,
            lng: packageItem.pickupAddress.lng,
          };
        }
      } else {
        console.error(`No active delivery found for package ${packageId}.`);
        currentLocation = {
          lat: packageItem.pickupAddress.lat,
          lng: packageItem.pickupAddress.lng,
        };
      }
    } else {
      return res.status(400).json({ error: 'Invalid package status for tracking' });
    }

    const trackingInfo = {
      packageId: packageItem.id,
      status: packageItem.status,
      currentLocation,
      pickupAddress: packageItem.pickupAddress,
      dropoffAddress: packageItem.dropoffAddress,
      estimatedDelivery: 'Niet beschikbaar',
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
        const postalCodeExists = await PostalCode.findOne({ where: { code: addressData.postal_code }, transaction });
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

    // Haal pakketten op, maar sluit pakketten uit die door de koerier zelf zijn aangemaakt
    const packages = await Package.findAll({
      where: {
        status: 'pending',
        user_id: { [Op.ne]: userId }
      },
      include: [
        {
          model: Address,
          as: 'pickupAddress',
          include: [
            {
              model: PostalCode,
              as: 'postalCodeDetails',
              attributes: ['city', 'country'],
            },
          ],
        },
        {
          model: Address,
          as: 'dropoffAddress',
          include: [
            {
              model: PostalCode,
              as: 'postalCodeDetails',
              attributes: ['city', 'country'],
            },
          ],
        },
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

    // Transformeer de data om city en country toe te voegen
    const transformedPackages = matchingPackages.map(pkg => {
      const pkgJson = pkg.toJSON();
      return {
        ...pkgJson,
        pickupAddress: {
          ...pkgJson.pickupAddress,
          city: pkgJson.pickupAddress.postalCodeDetails?.city || null,
          country: pkgJson.pickupAddress.postalCodeDetails?.country || null,
        },
        dropoffAddress: {
          ...pkgJson.dropoffAddress,
          city: pkgJson.dropoffAddress.postalCodeDetails?.city || null,
          country: pkgJson.dropoffAddress.postalCodeDetails?.country || null,
        },
      };
    });

    // Verwijder postalCodeDetails uit de response
    transformedPackages.forEach(pkg => {
      delete pkg.pickupAddress.postalCodeDetails;
      delete pkg.dropoffAddress.postalCodeDetails;
    });

    await transaction.commit();
    res.json({ message: 'Packages found', packages: transformedPackages });
  } catch (err) {
    await transaction.rollback();
    console.error('Search packages error:', err.message);
    res.status(500).json({ error: 'Error searching packages', details: err.message });
  }
};

exports.getPackageStats = async (req, res) => {
  const userId = req.params.userId;
  try {
    const totalSent = await Package.count({ where: { user_id: userId } });
    const statusCounts = await Package.findAll({
      attributes: ['status', [sequelize.fn('COUNT', sequelize.col('status')), 'count']],
      where: { user_id: userId },
      group: ['status']
    });
    const shipmentsPerMonth = await Package.findAll({
      attributes: [
        [sequelize.fn('YEAR', sequelize.col('created_at')), 'year'],
        [sequelize.fn('MONTH', sequelize.col('created_at')), 'month'],
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      where: { user_id: userId },
      group: ['year', 'month'],
      order: [['year', 'ASC'], ['month', 'ASC']]
    });
    res.json({
      totalSent,
      statusCounts: statusCounts.map(item => ({ status: item.status, count: item.get('count') })),
      shipmentsPerMonth: shipmentsPerMonth.map(item => ({
        year: item.get('year'),
        month: item.get('month'),
        count: item.get('count')
      }))
    });
  } catch (err) {
    console.error('Error fetching package stats:', err.message);
    res.status(500).json({ error: 'Error fetching package stats', details: err.message });
  }
};

module.exports = exports;