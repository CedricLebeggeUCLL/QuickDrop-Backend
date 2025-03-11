const { haversineDistance } = require('../../utils/distance');
const { geocodeAddress } = require('../../utils/geocode');
const Package = require('../models/package');
const Courier = require('../models/courier');
const Address = require('../models/address');
const PostalCode = require('../models/postalcode');

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
  const { start_location, destination, pickup_radius, dropoff_radius, use_current_as_start } = req.body;

  console.log('Request body:', req.body);

  if (!pickup_radius || !dropoff_radius) {
    return res.status(400).json({ error: 'Pickup radius and dropoff radius are required' });
  }

  try {
    // Haal de courier op
    const courier = await Courier.findOne({
      where: { user_id: userId },
      include: [
        { model: Address, as: 'currentAddress' },
        { model: Address, as: 'startAddress' },
        { model: Address, as: 'destinationAddress' },
      ],
    });
    if (!courier) return res.status(403).json({ error: 'User is not a courier' });

    // Controleer of de courier een start- en bestemmingsadres heeft
    if (!courier.start_address_id || !courier.destination_address_id) {
      return res.status(400).json({ error: 'Courier must have a start and destination address set' });
    }

    // Maak nieuwe adressen aan vanuit het verzoek
    let startAddressData = start_location;
    if (use_current_as_start && courier.currentAddress) {
      startAddressData = {
        street_name: courier.currentAddress.street_name,
        house_number: courier.currentAddress.house_number,
        extra_info: courier.currentAddress.extra_info,
        postal_code: courier.currentAddress.postal_code,
        city: (await PostalCode.findByPk(courier.currentAddress.postal_code)).city,
        country: (await PostalCode.findByPk(courier.currentAddress.postal_code)).country,
      };
    }

    // Controleer of de opgegeven postcode bestaat, zo niet, voeg toe
    const startPostalCode = await PostalCode.findByPk(startAddressData.postal_code);
    if (!startPostalCode) {
      await PostalCode.create({
        code: startAddressData.postal_code,
        city: startAddressData.city,
        country: startAddressData.country,
      });
    }

    const destPostalCode = await PostalCode.findByPk(destination.postal_code);
    if (!destPostalCode) {
      await PostalCode.create({
        code: destination.postal_code,
        city: destination.city,
        country: destination.country,
      });
    }

    // Maak nieuwe adressen aan voor start en destination
    const startAddress = await Address.create({
      street_name: startAddressData.street_name,
      house_number: startAddressData.house_number,
      extra_info: startAddressData.extra_info,
      postal_code: startAddressData.postal_code,
    });

    const destAddress = await Address.create({
      street_name: destination.street_name,
      house_number: destination.house_number,
      extra_info: destination.extra_info,
      postal_code: destination.postal_code,
    });

    // Update de courier met de nieuwe adressen
    await courier.update({
      start_address_id: startAddress.id,
      destination_address_id: destAddress.id,
    });

    const packages = await Package.findAll({
      where: { status: 'pending' },
      include: [
        { model: Address, as: 'pickupAddress' },
        { model: Address, as: 'dropoffAddress' },
      ],
    });

    console.log('Pending packages:', JSON.stringify(packages, null, 2));

    // Geocode de start- en bestemmingsadressen van de courier
    const startPostalCodeData = await PostalCode.findByPk(startAddress.postal_code);
    const destPostalCodeData = await PostalCode.findByPk(destAddress.postal_code);

    const startAddressObj = {
      street_name: startAddress.street_name,
      house_number: startAddress.house_number,
      extra_info: startAddress.extra_info,
      city: startPostalCodeData.city,
      postal_code: startAddress.postal_code,
      country: startPostalCodeData.country,
    };

    const destAddressObj = {
      street_name: destAddress.street_name,
      house_number: destAddress.house_number,
      extra_info: destAddress.extra_info,
      city: destPostalCodeData.city,
      postal_code: destAddress.postal_code,
      country: destPostalCodeData.country,
    };

    const startCoords = await geocodeAddress(startAddressObj);
    const destCoords = await geocodeAddress(destAddressObj);

    const matchingPackages = [];
    for (const pkg of packages) {
      try {
        const pickupPostalCode = await PostalCode.findByPk(pkg.pickupAddress.postal_code);
        const dropoffPostalCode = await PostalCode.findByPk(pkg.dropoffAddress.postal_code);

        const pickupAddressObj = {
          street_name: pkg.pickupAddress.street_name,
          house_number: pkg.pickupAddress.house_number,
          extra_info: pkg.pickupAddress.extra_info,
          city: pickupPostalCode.city,
          postal_code: pkg.pickupAddress.postal_code,
          country: pickupPostalCode.country,
        };

        const dropoffAddressObj = {
          street_name: pkg.dropoffAddress.street_name,
          house_number: pkg.dropoffAddress.house_number,
          extra_info: pkg.dropoffAddress.extra_info,
          city: dropoffPostalCode.city,
          postal_code: pkg.dropoffAddress.postal_code,
          country: dropoffPostalCode.country,
        };

        // Geocode de pakketadressen
        const pickupCoords = await geocodeAddress(pickupAddressObj);
        const dropoffCoords = await geocodeAddress(dropoffAddressObj);

        // Bereken de afstanden
        const pickupDistance = haversineDistance(startCoords, pickupCoords);
        const dropoffDistance = haversineDistance(destCoords, dropoffCoords);

        console.log(`Package ID ${pkg.id}: Start = ${JSON.stringify(startCoords)}, Pickup = ${JSON.stringify(pickupCoords)}, Pickup Distance = ${pickupDistance} km`);
        console.log(`Package ID ${pkg.id}: Dest = ${JSON.stringify(destCoords)}, Dropoff = ${JSON.stringify(dropoffCoords)}, Dropoff Distance = ${dropoffDistance} km`);
        console.log(`Package ID ${pkg.id}: Pickup Radius = ${pickup_radius}, Dropoff Radius = ${dropoff_radius}, Match = ${pickupDistance <= pickup_radius && dropoffDistance <= dropoff_radius}`);

        if (pickupDistance <= pickup_radius && dropoffDistance <= dropoff_radius) {
          matchingPackages.push(pkg);
        }
      } catch (error) {
        console.error(`Error processing package ID ${pkg.id}:`, error.message);
        continue; // Sla pakket over bij geocoding-fouten
      }
    }

    res.json({ message: 'Packages found', packages: matchingPackages });
  } catch (err) {
    res.status(500).json({ error: 'Error searching packages', details: err.message });
  }
};