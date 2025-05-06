const { sequelize, models } = require('../db');
const { Op } = require('sequelize');
const { haversineDistance } = require('../../utils/distance');
const { geocodeAddress } = require('../../utils/geocode');
const Delivery = models.Delivery;
const Package = models.Package;
const Courier = models.Courier;
const Address = models.Address;
const PostalCode = models.PostalCode;
const User = models.User;

exports.getPackages = async (req, res) => {
    try {
        console.log('Fetching all packages');
        const packages = await Package.findAll({
            include: [
                {
                    model: Address,
                    as: 'pickupAddress',
                    required: false,
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
                    required: false,
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

        console.log(`Found ${packages.length} packages`);

        // Transformeer de data om city en country toe te voegen
        const transformedPackages = packages.map(pkg => {
            const pkgJson = pkg.toJSON();
            return {
                ...pkgJson,
                pickupAddress: pkgJson.pickupAddress ? {
                    ...pkgJson.pickupAddress,
                    city: pkgJson.pickupAddress.postalCodeDetails?.city || null,
                    country: pkgJson.pickupAddress.postalCodeDetails?.country || null,
                } : null,
                dropoffAddress: pkgJson.dropoffAddress ? {
                    ...pkgJson.dropoffAddress,
                    city: pkgJson.dropoffAddress.postalCodeDetails?.city || null,
                    country: pkgJson.dropoffAddress.postalCodeDetails?.country || null,
                } : null,
            };
        });

        // Verwijder postalCodeDetails uit de response
        transformedPackages.forEach(pkg => {
            if (pkg.pickupAddress) delete pkg.pickupAddress.postalCodeDetails;
            if (pkg.dropoffAddress) delete pkg.dropoffAddress.postalCodeDetails;
        });

        res.json(transformedPackages);
    } catch (err) {
        console.error('Error fetching packages:', err.message, err.stack);
        res.status(500).json({ error: 'Error fetching packages', details: err.message });
    }
};

exports.getPackageById = async (req, res) => {
    try {
        console.log(`Fetching package with ID: ${req.params.id}`);
        const packageItem = await Package.findByPk(req.params.id, {
            include: [
                {
                    model: Address,
                    as: 'pickupAddress',
                    required: false,
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
                    required: false,
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

        if (!packageItem) {
            console.log(`Package with ID ${req.params.id} not found`);
            return res.status(404).json({ error: 'Package not found' });
        }

        const transformedPackage = {
            ...packageItem.toJSON(),
            pickupAddress: packageItem.pickupAddress ? {
                ...packageItem.pickupAddress.toJSON(),
                city: packageItem.pickupAddress.postalCodeDetails?.city || null,
                country: packageItem.pickupAddress.postalCodeDetails?.country || null,
            } : null,
            dropoffAddress: packageItem.dropoffAddress ? {
                ...packageItem.dropoffAddress.toJSON(),
                city: packageItem.dropoffAddress.postalCodeDetails?.city || null,
                country: packageItem.dropoffAddress.postalCodeDetails?.country || null,
            } : null,
        };

        delete transformedPackage.pickupAddress?.postalCodeDetails;
        delete transformedPackage.dropoffAddress?.postalCodeDetails;

        res.json(transformedPackage);
    } catch (err) {
        console.error('Error fetching package:', err.message, err.stack);
        res.status(500).json({ error: 'Error fetching package', details: err.message });
    }
};

exports.getPackagesByUserId = async (req, res) => {
    try {
        const userId = req.params.userId;
        console.log(`Fetching packages for user_id: ${userId}`);
        if (!userId || userId <= 0) {
            console.log('Invalid user_id provided');
            return res.status(400).json({ error: 'Invalid user_id' });
        }
        const packages = await Package.findAll({
            where: { user_id: userId },
            include: [
                {
                    model: Address,
                    as: 'pickupAddress',
                    required: false,
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
                    required: false,
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

        console.log(`Found ${packages.length} packages for user_id: ${userId}`);

        // Transformeer de data om city en country toe te voegen
        const transformedPackages = packages.map(pkg => {
            const pkgJson = pkg.toJSON();
            return {
                ...pkgJson,
                pickupAddress: pkgJson.pickupAddress ? {
                    ...pkgJson.pickupAddress,
                    city: pkgJson.pickupAddress.postalCodeDetails?.city || null,
                    country: pkgJson.pickupAddress.postalCodeDetails?.country || null,
                } : null,
                dropoffAddress: pkgJson.dropoffAddress ? {
                    ...pkgJson.dropoffAddress,
                    city: pkgJson.dropoffAddress.postalCodeDetails?.city || null,
                    country: pkgJson.dropoffAddress.postalCodeDetails?.country || null,
                } : null,
            };
        });

        // Verwijder postalCodeDetails uit de response
        transformedPackages.forEach(pkg => {
            if (pkg.pickupAddress) delete pkg.pickupAddress.postalCodeDetails;
            if (pkg.dropoffAddress) delete pkg.dropoffAddress.postalCodeDetails;
        });

        res.json(transformedPackages);
    } catch (err) {
        console.error('Error fetching packages by user ID:', err.message, err.stack);
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
        console.log('Missing pickup or dropoff address');
        return res.status(400).json({ error: 'Pickup and dropoff addresses are required' });
    }
    if (!userId || userId <= 0) {
        console.log('Invalid user_id');
        return res.status(400).json({ error: 'Invalid user_id' });
    }
    if (!action_type || !['send', 'receive'].includes(action_type)) {
        console.log('Invalid action_type:', action_type);
        return res.status(400).json({ error: 'Invalid action_type, must be "send" or "receive"' });
    }
    if (!category || !['package', 'food', 'drink'].includes(category)) {
        console.log('Invalid category:', category);
        return res.status(400).json({ error: 'Invalid category, must be "package", "food", or "drink"' });
    }
    if (!size || !['small', 'medium', 'large'].includes(size)) {
        console.log('Invalid size:', size);
        return res.status(400).json({ error: 'Invalid size, must be "small", "medium", or "large"' });
    }

    const transaction = await sequelize.transaction();
    try {
        const user = await User.findByPk(userId, { transaction });
        if (!user) {
            console.log('User not found for user_id:', userId);
            await transaction.rollback();
            return res.status(403).json({ error: 'User does not exist' });
        }

        const processPostalCode = async (address) => {
            if (address.postal_code) {
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
            } else {
                console.log('No postal_code provided for address');
                await transaction.rollback();
                throw new Error('Postal code is required for address');
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
        console.log('Pickup address created/updated:', pickupAddress.toJSON());

        const dropoffCoords = await geocodeAddress(dropoff_address);
        if (!dropoffCoords.lat || !dropoffCoords.lng) {
            console.log('Geocoding failed for dropoff address:', dropoffCoords);
            await transaction.rollback();
            return res.status(500).json({ error: 'Geocoding failed for dropoff address' });
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
        console.log('Dropoff address created/updated:', dropoffAddress.toJSON());

        const packageItem = await Package.create({
            user_id: userId,
            description,
            pickup_address_id: pickupAddress.id,
            dropoff_address_id: dropoffAddress.id,
            action_type,
            category,
            size,
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
                    required: false,
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
                    required: false,
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
            pickupAddress: createdPackage.pickupAddress ? {
                ...createdPackage.pickupAddress.toJSON(),
                city: createdPackage.pickupAddress.postalCodeDetails?.city || null,
                country: createdPackage.pickupAddress.postalCodeDetails?.country || null,
            } : null,
            dropoffAddress: createdPackage.dropoffAddress ? {
                ...createdPackage.dropoffAddress.toJSON(),
                city: createdPackage.dropoffAddress.postalCodeDetails?.city || null,
                country: createdPackage.dropoffAddress.postalCodeDetails?.country || null,
            } : null,
        };

        delete transformedPackage.pickupAddress?.postalCodeDetails;
        delete transformedPackage.dropoffAddress?.postalCodeDetails;

        res.status(201).json(transformedPackage);
    } catch (err) {
        await transaction.rollback();
        console.error('Error adding package:', err.message, err.stack);
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
                    throw new Error('Postal code is required for pickup address');
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
                    throw new Error('Postal code is required for dropoff address');
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
            console.log('No valid fields provided to update');
            await transaction.rollback();
            return res.status(400).json({ error: 'No valid fields provided to update' });
        }

        // Validatie van nieuwe velden
        if (action_type && !['send', 'receive'].includes(action_type)) {
            console.log('Invalid action_type:', action_type);
            await transaction.rollback();
            return res.status(400).json({ error: 'Invalid action_type, must be "send" or "receive"' });
        }
        if (category && !['package', 'food', 'drink'].includes(category)) {
            console.log('Invalid category:', category);
            await transaction.rollback();
            return res.status(400).json({ error: 'Invalid category, must be "package", "food", or "drink"' });
        }
        if (size && !['small', 'medium', 'large'].includes(size)) {
            console.log('Invalid size:', size);
            await transaction.rollback();
            return res.status(400).json({ error: 'Invalid size, must be "small", "medium", or "large"' });
        }

        const [updated] = await Package.update(
            updateData,
            { where: { id: req.params.id }, transaction }
        );
        if (updated === 0) {
            console.log(`Package with ID ${req.params.id} not found`);
            await transaction.rollback();
            return res.status(404).json({ error: 'Package not found' });
        }

        const updatedPackage = await Package.findByPk(req.params.id, {
            include: [
                {
                    model: Address,
                    as: 'pickupAddress',
                    required: false,
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
                    required: false,
                    include: [
                        {
                            model: PostalCode,
                            as: 'postalCodeDetails',
                            attributes: ['city', 'country'],
                        },
                    ],
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
        console.log(`Deleting package with ID: ${req.params.id}`);
        const deleted = await Package.destroy({ where: { id: req.params.id } });
        if (deleted === 0) {
            console.log(`Package with ID ${req.params.id} not found`);
            return res.status(404).json({ error: 'Package not found' });
        }
        console.log(`Package with ID ${req.params.id} deleted`);
        res.status(204).send();
    } catch (err) {
        console.error('Error deleting package:', err.message, err.stack);
        res.status(500).json({ error: 'Error deleting package', details: err.message });
    }
};

exports.trackPackage = async (req, res) => {
    const packageId = req.params.id;
    console.log(`Tracking package with ID: ${packageId}`);
    try {
        const packageItem = await Package.findByPk(packageId, {
            include: [
                { model: Address, as: 'pickupAddress', required: false },
                { model: Address, as: 'dropoffAddress', required: false },
            ],
        });
        if (!packageItem) {
            console.log(`Package with ID ${packageId} not found`);
            return res.status(404).json({ error: 'Package not found' });
        }

        let currentLocation;
        if (packageItem.status === 'pending' || packageItem.status === 'assigned') {
            currentLocation = {
                lat: packageItem.pickupAddress?.lat,
                lng: packageItem.pickupAddress?.lng,
            };
        } else if (packageItem.status === 'delivered') {
            currentLocation = {
                lat: packageItem.dropoffAddress?.lat,
                lng: packageItem.dropoffAddress?.lng,
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
                        console.error(`Courier ${courier.id} has no current location set`);
                        currentLocation = {
                            lat: packageItem.pickupAddress?.lat,
                            lng: packageItem.pickupAddress?.lng,
                        };
                    }
                } else {
                    console.error(`No courier found for delivery ${delivery.id}`);
                    currentLocation = {
                        lat: packageItem.pickupAddress?.lat,
                        lng: packageItem.pickupAddress?.lng,
                    };
                }
            } else {
                console.error(`No active delivery found for package ${packageId}`);
                currentLocation = {
                    lat: packageItem.pickupAddress?.lat,
                    lng: packageItem.pickupAddress?.lng,
                };
            }
        } else {
            console.log(`Invalid package status for tracking: ${packageItem.status}`);
            return res.status(400).json({ error: 'Invalid package status for tracking' });
        }

        if (!currentLocation.lat || !currentLocation.lng) {
            console.error(`Invalid current location for package ${packageId}:`, currentLocation);
            return res.status(400).json({ error: 'Unable to determine current location due to missing coordinates' });
        }

        const trackingInfo = {
            packageId: packageItem.id,
            status: packageItem.status,
            currentLocation,
            pickupAddress: packageItem.pickupAddress ? { ...packageItem.pickupAddress.toJSON() } : null,
            dropoffAddress: packageItem.dropoffAddress ? { ...packageItem.dropoffAddress.toJSON() } : null,
            estimatedDelivery: 'Niet beschikbaar',
        };

        res.json(trackingInfo);
    } catch (err) {
        console.error('Error tracking package:', err.message, err.stack);
        res.status(500).json({ error: 'Error tracking package', details: err.message });
    }
};

exports.searchPackages = async (req, res) => {
    const userId = req.body.user_id;
    const { start_address, destination_address, pickup_radius, dropoff_radius, use_current_as_start } = req.body;

    console.log('Request body received:', JSON.stringify(req.body, null, 2));

    // Validatie van verplichte velden
    if (!pickup_radius || !dropoff_radius) {
        console.log('Missing pickup_radius or dropoff_radius');
        return res.status(400).json({ error: 'Pickup radius and dropoff radius are required' });
    }
    if (!start_address.city || !start_address.country || !destination_address.city || !destination_address.country) {
        console.log('Missing city or country for start_address or destination_address');
        return res.status(400).json({ error: 'City and country are required for both start and destination addresses' });
    }
    if (!userId || userId <= 0) {
        console.log('Invalid user_id');
        return res.status(400).json({ error: 'Invalid user_id' });
    }

    const transaction = await sequelize.transaction();
    try {
        console.log(`Finding courier with user_id: ${userId}`);
        const courier = await Courier.findOne({ where: { user_id: userId }, transaction });
        if (!courier) {
            console.log(`Courier not found for user_id: ${userId}`);
            await transaction.rollback();
            return res.status(403).json({ error: 'User is not a courier' });
        }
        console.log('Courier found:', courier.toJSON());

        let startAddressData = { ...start_address, country: start_address.country || 'Belgium' };
        if (use_current_as_start && courier.current_lat && courier.current_lng) {
            console.log('Using courier current location as start address');
            startAddressData = {
                street_name: start_address.street_name || 'Current Location',
                house_number: start_address.house_number || 'Unknown',
                extra_info: start_address.extra_info || null,
                postal_code: start_address.postal_code || 'Unknown',
                city: start_address.city,
                country: start_address.country || 'Belgium',
                lat: courier.current_lat,
                lng: courier.current_lng,
            };
        }

        console.log('Processing start address:', startAddressData);
        let startAddress = await Address.findOne({
            where: {
                street_name: startAddressData.street_name || 'Unknown',
                house_number: startAddressData.house_number || 'Unknown',
                extra_info: startAddressData.extra_info || null,
                postal_code: startAddressData.postal_code || 'Unknown',
            },
            transaction,
        });

        if (!startAddress) {
            const startCoords = startAddressData.lat && startAddressData.lng
                ? { lat: startAddressData.lat, lng: startAddressData.lng }
                : await geocodeAddress(startAddressData);
            if (!startCoords || !startCoords.lat || !startCoords.lng) {
                console.error('Failed to geocode start address:', startCoords);
                await transaction.rollback();
                return res.status(500).json({ error: 'Failed to geocode start address' });
            }
            startAddress = await Address.create({
                street_name: startAddressData.street_name || 'Unknown',
                house_number: startAddressData.house_number || 'Unknown',
                extra_info: startAddressData.extra_info || null,
                postal_code: startAddressData.postal_code || 'Unknown',
                lat: startCoords.lat,
                lng: startCoords.lng,
            }, { transaction });
            console.log('Start address created:', startAddress.toJSON());
        } else if (!startAddress.lat || !startAddress.lng) {
            const startCoords = await geocodeAddress(startAddressData);
            if (!startCoords || !startCoords.lat || !startCoords.lng) {
                console.error('Failed to update start address coordinates:', startCoords);
                await transaction.rollback();
                return res.status(500).json({ error: 'Failed to update start address coordinates' });
            }
            await startAddress.update({ lat: startCoords.lat, lng: startCoords.lng }, { transaction });
            console.log('Start address updated with coordinates:', startAddress.toJSON());
        }

        let destAddressData = { ...destination_address, country: destination_address.country || 'Belgium' };
        console.log('Processing destination address:', destAddressData);
        let destAddress = await Address.findOne({
            where: {
                street_name: destAddressData.street_name || 'Unknown',
                house_number: destAddressData.house_number || 'Unknown',
                extra_info: destAddressData.extra_info || null,
                postal_code: destAddressData.postal_code || 'Unknown',
            },
            transaction,
        });

        if (!destAddress) {
            const destCoords = await geocodeAddress(destAddressData);
            if (!destCoords || !destCoords.lat || !destCoords.lng) {
                console.error('Failed to geocode destination address:', destCoords);
                await transaction.rollback();
                return res.status(500).json({ error: 'Failed to geocode destination address' });
            }
            destAddress = await Address.create({
                street_name: destAddressData.street_name || 'Unknown',
                house_number: destAddressData.house_number || 'Unknown',
                extra_info: destAddressData.extra_info || null,
                postal_code: destAddressData.postal_code || 'Unknown',
                lat: destCoords.lat,
                lng: destCoords.lng,
            }, { transaction });
            console.log('Destination address created:', destAddress.toJSON());
        } else if (!destAddress.lat || !destAddress.lng) {
            const destCoords = await geocodeAddress(destAddressData);
            if (!destCoords || !destCoords.lat || !destCoords.lng) {
                console.error('Failed to update destination address coordinates:', destCoords);
                await transaction.rollback();
                return res.status(500).json({ error: 'Failed to update destination address coordinates' });
            }
            await destAddress.update({ lat: destCoords.lat, lng: destCoords.lng }, { transaction });
            console.log('Destination address updated with coordinates:', destAddress.toJSON());
        }

        const processPostalCode = async (addressData) => {
            if (addressData.postal_code && addressData.postal_code !== 'Unknown') {
                const postalCodeExists = await PostalCode.findOne({ where: { code: addressData.postal_code }, transaction });
                if (!postalCodeExists) {
                    console.log(`Adding new postal code: ${addressData.postal_code}, ${addressData.city || 'Unknown'}, ${addressData.country || 'Belgium'}`);
                    await PostalCode.create({
                        code: addressData.postal_code,
                        city: addressData.city || 'Unknown',
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

        console.log('Updating courier with start_address_id and destination_address_id');
        await courier.update({
            start_address_id: startAddress.id,
            destination_address_id: destAddress.id,
        }, { transaction });
        console.log('Courier updated:', courier.toJSON());

        // Haal pakketten op, maar sluit pakketten uit die door de koerier zelf zijn aangemaakt
        console.log('Fetching pending packages excluding user_id:', userId);
        const packages = await Package.findAll({
            where: {
                status: 'pending',
                user_id: { [Op.ne]: userId },
            },
            include: [
                {
                    model: Address,
                    as: 'pickupAddress',
                    required: false,
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
                    required: false,
                    include: [
                        {
                            model: PostalCode,
                            as: 'postalCodeDetails',
                            attributes: ['city', 'country'],
                        },
                    ],
                },
            ],
            transaction,
        });

        console.log(`Found ${packages.length} pending packages`);

        const matchingPackages = [];
        for (const pkg of packages) {
            if (!pkg.pickupAddress?.lat || !pkg.pickupAddress?.lng || !pkg.dropoffAddress?.lat || !pkg.dropoffAddress?.lng) {
                console.error(`Package ${pkg.id} has missing coordinates, skipping`);
                continue;
            }

            const pickupCoords = { lat: pkg.pickupAddress.lat, lng: pkg.pickupAddress.lng };
            const dropoffCoords = { lat: pkg.dropoffAddress.lat, lng: pkg.dropoffAddress.lng };
            const startCoords = { lat: startAddress.lat, lng: startAddress.lng };
            const destCoords = { lat: destAddress.lat, lng: destAddress.lng };

            const pickupDistance = haversineDistance(startCoords, pickupCoords);
            const dropoffDistance = haversineDistance(destCoords, dropoffCoords);

            console.log(`Package ${pkg.id}: Pickup Distance = ${pickupDistance} km, Dropoff Distance = ${dropoffDistance} km, Pickup Radius = ${pickup_radius} km, Dropoff Radius = ${dropoff_radius} km`);

            if (pickupDistance <= pickup_radius && dropoffDistance <= dropoff_radius) {
                matchingPackages.push(pkg);
                console.log(`Package ${pkg.id} matches criteria`);
            } else {
                console.log(`Package ${pkg.id} does not match criteria`);
            }
        }

        console.log(`Found ${matchingPackages.length} matching packages`);

        // Transformeer de data om city en country toe te voegen
        const transformedPackages = matchingPackages.map(pkg => {
            const pkgJson = pkg.toJSON();
            return {
                ...pkgJson,
                pickupAddress: pkgJson.pickupAddress ? {
                    ...pkgJson.pickupAddress,
                    city: pkgJson.pickupAddress.postalCodeDetails?.city || null,
                    country: pkgJson.pickupAddress.postalCodeDetails?.country || null,
                } : null,
                dropoffAddress: pkgJson.dropoffAddress ? {
                    ...pkgJson.dropoffAddress,
                    city: pkgJson.dropoffAddress.postalCodeDetails?.city || null,
                    country: pkgJson.dropoffAddress.postalCodeDetails?.country || null,
                } : null,
            };
        });

        // Verwijder postalCodeDetails uit de response
        transformedPackages.forEach(pkg => {
            if (pkg.pickupAddress) delete pkg.pickupAddress.postalCodeDetails;
            if (pkg.dropoffAddress) delete pkg.dropoffAddress.postalCodeDetails;
        });

        await transaction.commit();
        console.log('Transaction committed');
        res.json({ message: `Found ${matchingPackages.length} matching packages`, packages: transformedPackages });
    } catch (err) {
        await transaction.rollback();
        console.error('Search packages error:', err.message, err.stack);
        res.status(500).json({ error: 'Error searching packages', details: err.message });
    }
};

exports.getPackageStats = async (req, res) => {
    const userId = req.params.userId;
    console.log(`Fetching package stats for user_id: ${userId}`);
    try {
        const totalSent = await Package.count({ where: { user_id: userId } });
        const statusCounts = await Package.findAll({
            attributes: ['status', [sequelize.fn('COUNT', sequelize.col('status')), 'count']],
            where: { user_id: userId },
            group: ['status'],
            raw: true,
        });
        const shipmentsPerMonth = await Package.findAll({
            attributes: [
                [sequelize.fn('YEAR', sequelize.col('created_at')), 'year'],
                [sequelize.fn('MONTH', sequelize.col('created_at')), 'month'],
                [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
            ],
            where: { user_id: userId },
            group: ['year', 'month'],
            order: [['year', 'ASC'], ['month', 'ASC']],
            raw: true,
        });
        res.json({
            totalSent,
            statusCounts: statusCounts.map(item => ({ status: item.status, count: item.count })),
            shipmentsPerMonth: shipmentsPerMonth.map(item => ({
                year: item.year,
                month: item.month,
                count: item.count,
            })),
        });
    } catch (err) {
        console.error('Error fetching package stats:', err.message, err.stack);
        res.status(500).json({ error: 'Error fetching package stats', details: err.message });
    }
};

module.exports = exports;