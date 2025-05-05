const { sequelize, models } = require('../db');
const Delivery = models.Delivery;
const Package = models.Package;
const Courier = models.Courier;
const Address = models.Address;
const PostalCode = models.PostalCode;
const { haversineDistance } = require('../../utils/distance');
const { geocodeAddress } = require('../../utils/geocode');

exports.getDeliveries = async (req, res) => {
    try {
        console.log('Fetching all deliveries');
        const deliveries = await Delivery.findAll({
            include: [
                {
                    model: Package,
                    as: 'package',
                    include: [
                        { model: Address, as: 'pickupAddress' },
                        { model: Address, as: 'dropoffAddress' },
                    ],
                },
                {
                    model: Courier,
                    as: 'courier',
                    required: false, // Make optional
                },
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

        console.log(`Found ${deliveries.length} deliveries`);

        // Transformeer de data om city en country toe te voegen
        const transformedDeliveries = deliveries.map(delivery => {
            const deliveryJson = delivery.toJSON();
            return {
                ...deliveryJson,
                pickupAddress: {
                    ...deliveryJson.pickupAddress,
                    city: deliveryJson.pickupAddress.postalCodeDetails?.city || null,
                    country: deliveryJson.pickupAddress.postalCodeDetails?.country || null,
                },
                dropoffAddress: {
                    ...deliveryJson.dropoffAddress,
                    city: deliveryJson.dropoffAddress.postalCodeDetails?.city || null,
                    country: deliveryJson.dropoffAddress.postalCodeDetails?.country || null,
                },
            };
        });

        // Verwijder postalCodeDetails uit de response
        transformedDeliveries.forEach(delivery => {
            delete delivery.pickupAddress.postalCodeDetails;
            delete delivery.dropoffAddress.postalCodeDetails;
        });

        res.json(transformedDeliveries);
    } catch (err) {
        console.error('Error fetching deliveries:', err.message, err.stack);
        res.status(500).json({ error: 'Error fetching deliveries', details: err.message });
    }
};

exports.getDeliveryById = async (req, res) => {
    try {
        console.log(`Fetching delivery with ID: ${req.params.id}`);
        const delivery = await Delivery.findByPk(req.params.id, {
            include: [
                {
                    model: Package,
                    as: 'package',
                    include: [
                        { model: Address, as: 'pickupAddress' },
                        { model: Address, as: 'dropoffAddress' },
                    ],
                },
                {
                    model: Courier,
                    as: 'courier',
                    required: false, // Make optional
                },
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

        if (!delivery) {
            console.log(`Delivery with ID ${req.params.id} not found`);
            return res.status(404).json({ error: 'Delivery not found' });
        }

        const transformedDelivery = {
            ...delivery.toJSON(),
            pickupAddress: {
                ...delivery.pickupAddress.toJSON(),
                city: delivery.pickupAddress.postalCodeDetails?.city || null,
                country: delivery.pickupAddress.postalCodeDetails?.country || null,
            },
            dropoffAddress: {
                ...delivery.dropoffAddress.toJSON(),
                city: delivery.dropoffAddress.postalCodeDetails?.city || null,
                country: delivery.dropoffAddress.postalCodeDetails?.country || null,
            },
        };

        delete transformedDelivery.pickupAddress.postalCodeDetails;
        delete transformedDelivery.dropoffAddress.postalCodeDetails;

        res.json(transformedDelivery);
    } catch (err) {
        console.error('Error fetching delivery:', err.message, err.stack);
        res.status(500).json({ error: 'Error fetching delivery', details: err.message });
    }
};

exports.createDelivery = async (req, res) => {
    console.log('Entering createDelivery endpoint');
    const { user_id, package_id } = req.body;

    console.log('Create delivery request received:', JSON.stringify(req.body, null, 2));

    const transaction = await sequelize.transaction();
    try {
        console.log('Finding courier with user_id:', user_id);
        const courier = await Courier.findOne({ where: { user_id }, transaction });
        if (!courier) {
            console.log('Courier not found for user_id:', user_id);
            await transaction.rollback();
            return res.status(403).json({ error: 'User is not a courier' });
        }
        console.log('Courier found:', courier.toJSON());

        console.log('Finding package with package_id:', package_id);
        const package = await Package.findByPk(package_id, {
            include: [
                { model: Address, as: 'pickupAddress' },
                { model: Address, as: 'dropoffAddress' },
            ],
            transaction,
        });
        if (!package) {
            console.log('Package not found for package_id:', package_id);
            await transaction.rollback();
            return res.status(404).json({ error: 'Package not found' });
        }
        console.log('Package found:', package.toJSON());
        if (package.status !== 'pending') {
            console.log('Package is not pending, current status:', package.status);
            await transaction.rollback();
            return res.status(400).json({ error: 'Package is not available for assignment' });
        }

        console.log('Creating delivery...');
        const delivery = await Delivery.create({
            package_id: package.id,
            courier_id: courier.id,
            pickup_address_id: package.pickup_address_id,
            dropoff_address_id: package.dropoff_address_id,
            status: 'assigned',
        }, { transaction });
        console.log('Delivery created:', delivery.toJSON());

        console.log('Updating package status to assigned...');
        await package.update({ status: 'assigned' }, { transaction });
        console.log('Package updated:', package.toJSON());

        // Fetch the created delivery with full details
        const createdDelivery = await Delivery.findByPk(delivery.id, {
            include: [
                {
                    model: Package,
                    as: 'package',
                    include: [
                        { model: Address, as: 'pickupAddress' },
                        { model: Address, as: 'dropoffAddress' },
                    ],
                },
                {
                    model: Courier,
                    as: 'courier',
                    required: false, // Make optional
                },
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
            transaction,
        });

        await transaction.commit();
        console.log('Transaction committed');

        const transformedDelivery = {
            ...createdDelivery.toJSON(),
            pickupAddress: {
                ...createdDelivery.pickupAddress.toJSON(),
                city: createdDelivery.pickupAddress.postalCodeDetails?.city || null,
                country: createdDelivery.pickupAddress.postalCodeDetails?.country || null,
            },
            dropoffAddress: {
                ...createdDelivery.dropoffAddress.toJSON(),
                city: createdDelivery.dropoffAddress.postalCodeDetails?.city || null,
                country: createdDelivery.dropoffAddress.postalCodeDetails?.country || null,
            },
        };

        delete transformedDelivery.pickupAddress.postalCodeDetails;
        delete transformedDelivery.dropoffAddress.postalCodeDetails;

        res.status(201).json(transformedDelivery);
    } catch (err) {
        await transaction.rollback();
        console.error('Create delivery error:', err.message, err.stack);
        res.status(500).json({ error: 'Error creating delivery', details: err.message });
    }
};

exports.updateDelivery = async (req, res) => {
    const { status, pickup_time, delivery_time } = req.body;
    const validDeliveryStatuses = ['assigned', 'picked_up', 'delivered'];

    if (!status || !validDeliveryStatuses.includes(status)) {
        console.log('Invalid status provided:', status);
        return res.status(400).json({ error: 'Invalid delivery status value. Must be one of: assigned, picked_up, delivered' });
    }

    const transaction = await sequelize.transaction();
    try {
        console.log(`Updating delivery with ID: ${req.params.id}`);
        const delivery = await Delivery.findByPk(req.params.id, { transaction });
        if (!delivery) {
            console.log(`Delivery with ID ${req.params.id} not found`);
            await transaction.rollback();
            return res.status(404).json({ error: 'Delivery not found' });
        }

        const updateData = { status };

        if (status === 'picked_up') {
            updateData.pickup_time = pickup_time ? new Date(pickup_time) : new Date();
            console.log('Setting pickup_time to:', updateData.pickup_time);

            // Update associated package
            const package = await Package.findByPk(delivery.package_id, { transaction });
            if (!package) {
                console.log('No associated package found for delivery:', delivery.id);
                await transaction.rollback();
                return res.status(400).json({ error: 'No associated package found' });
            }
            await package.update({ status: 'in_transit' }, { transaction });
            console.log('Updated package to in_transit for package_id:', package.id);
        }

        if (status === 'delivered') {
            updateData.delivery_time = delivery_time ? new Date(delivery_time) : new Date();
            console.log('Setting delivery_time to:', updateData.delivery_time);

            // Update associated package
            const package = await Package.findByPk(delivery.package_id, { transaction });
            if (!package) {
                console.log('No associated package found for delivery:', delivery.id);
                await transaction.rollback();
                return res.status(400).json({ error: 'No associated package found' });
            }
            await package.update({ status: 'delivered' }, { transaction });
            console.log('Updated package to delivered for package_id:', package.id);
        }

        await delivery.update(updateData, { transaction });
        console.log('Delivery updated:', delivery.toJSON());

        const updatedDelivery = await Delivery.findByPk(req.params.id, {
            include: [
                {
                    model: Package,
                    as: 'package',
                    include: [
                        { model: Address, as: 'pickupAddress' },
                        { model: Address, as: 'dropoffAddress' },
                    ],
                },
                {
                    model: Courier,
                    as: 'courier',
                    required: false, // Make optional
                },
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
            transaction,
        });

        await transaction.commit();

        const transformedDelivery = {
            ...updatedDelivery.toJSON(),
            pickupAddress: {
                ...updatedDelivery.pickupAddress.toJSON(),
                city: updatedDelivery.pickupAddress.postalCodeDetails?.city || null,
                country: updatedDelivery.pickupAddress.postalCodeDetails?.country || null,
            },
            dropoffAddress: {
                ...updatedDelivery.dropoffAddress.toJSON(),
                city: updatedDelivery.dropoffAddress.postalCodeDetails?.city || null,
                country: updatedDelivery.dropoffAddress.postalCodeDetails?.country || null,
            },
        };

        delete transformedDelivery.pickupAddress.postalCodeDetails;
        delete transformedDelivery.dropoffAddress.postalCodeDetails;

        console.log('Update successful, returning:', transformedDelivery);
        res.json(transformedDelivery);
    } catch (err) {
        await transaction.rollback();
        console.error('Error updating delivery:', err.message, err.stack);
        res.status(500).json({ error: 'Error updating delivery', details: err.message });
    }
};

exports.cancelDelivery = async (req, res) => {
    const transaction = await sequelize.transaction();
    try {
        console.log(`Canceling delivery with ID: ${req.params.id}`);
        const delivery = await Delivery.findByPk(req.params.id, { transaction });
        if (!delivery) {
            console.log(`Delivery with ID ${req.params.id} not found`);
            await transaction.rollback();
            return res.status(404).json({ error: 'Delivery not found' });
        }

        // Update associated package to pending
        const package = await Package.findByPk(delivery.package_id, { transaction });
        if (package) {
            await package.update({ status: 'pending' }, { transaction });
            console.log('Updated package to pending for package_id:', package.id);
        }

        await Delivery.destroy({ where: { id: req.params.id }, transaction });
        console.log('Delivery destroyed:', req.params.id);

        await transaction.commit();
        res.status(204).send();
    } catch (err) {
        await transaction.rollback();
        console.error('Error canceling delivery:', err.message, err.stack);
        res.status(500).json({ error: 'Error canceling delivery', details: err.message });
    }
};

exports.getDeliveryHistory = async (req, res) => {
    const userId = req.params.userId;
    console.log(`Fetching delivery history for user_id: ${userId}`);

    try {
        const deliveries = await Delivery.findAll({
            include: [
                {
                    model: Package,
                    as: 'package',
                    where: { user_id: userId },
                    required: true,
                    include: [
                        { model: Address, as: 'pickupAddress' },
                        { model: Address, as: 'dropoffAddress' },
                    ],
                },
                {
                    model: Courier,
                    as: 'courier',
                    required: false, // Make optional
                },
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

        console.log(`Found ${deliveries.length} deliveries for user_id: ${userId}`);

        const transformedDeliveries = deliveries.map(delivery => {
            const deliveryJson = delivery.toJSON();
            return {
                ...deliveryJson,
                pickupAddress: {
                    ...deliveryJson.pickupAddress,
                    city: deliveryJson.pickupAddress.postalCodeDetails?.city || null,
                    country: deliveryJson.pickupAddress.postalCodeDetails?.country || null,
                },
                dropoffAddress: {
                    ...deliveryJson.dropoffAddress,
                    city: deliveryJson.dropoffAddress.postalCodeDetails?.city || null,
                    country: deliveryJson.dropoffAddress.postalCodeDetails?.country || null,
                },
            };
        });

        transformedDeliveries.forEach(delivery => {
            delete delivery.pickupAddress.postalCodeDetails;
            delete delivery.dropoffAddress.postalCodeDetails;
        });

        res.json(transformedDeliveries);
    } catch (err) {
        console.error('Error fetching delivery history:', err.message, err.stack);
        res.status(500).json({ error: 'Error fetching delivery history', details: err.message });
    }
};

exports.getCourierDeliveries = async (req, res) => {
    const userId = req.params.userId;
    console.log(`Fetching deliveries for courier with user_id: ${userId}`);

    try {
        const courier = await Courier.findOne({ where: { user_id: userId } });
        if (!courier) {
            console.log(`Courier not found for user_id: ${userId}`);
            return res.status(404).json({ error: 'Courier not found for this user' });
        }

        const deliveries = await Delivery.findAll({
            where: { courier_id: courier.id },
            include: [
                {
                    model: Package,
                    as: 'package',
                    include: [
                        { model: Address, as: 'pickupAddress' },
                        { model: Address, as: 'dropoffAddress' },
                    ],
                },
                {
                    model: Courier,
                    as: 'courier',
                    required: false, // Make optional
                },
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

        console.log(`Found ${deliveries.length} deliveries for courier user_id: ${userId}`);

        const transformedDeliveries = deliveries.map(delivery => {
            const deliveryJson = delivery.toJSON();
            return {
                ...deliveryJson,
                pickupAddress: {
                    ...deliveryJson.pickupAddress,
                    city: deliveryJson.pickupAddress.postalCodeDetails?.city || null,
                    country: deliveryJson.pickupAddress.postalCodeDetails?.country || null,
                },
                dropoffAddress: {
                    ...deliveryJson.dropoffAddress,
                    city: deliveryJson.dropoffAddress.postalCodeDetails?.city || null,
                    country: deliveryJson.dropoffAddress.postalCodeDetails?.country || null,
                },
            };
        });

        transformedDeliveries.forEach(delivery => {
            delete delivery.pickupAddress.postalCodeDetails;
            delete delivery.dropoffAddress.postalCodeDetails;
        });

        res.json(transformedDeliveries);
    } catch (err) {
        console.error('Error fetching courier deliveries:', err.message, err.stack);
        res.status(500).json({ error: 'Error fetching courier deliveries', details: err.message });
    }
};

exports.getDeliveryStats = async (req, res) => {
    const userId = req.params.userId;
    console.log(`Fetching delivery stats for user_id: ${userId}`);

    try {
        const courier = await Courier.findOne({ where: { user_id: userId } });
        if (!courier) {
            console.log(`Courier not found for user_id: ${userId}`);
            return res.status(404).json({ error: 'Courier not found' });
        }

        const totalDeliveries = await Delivery.count({ where: { courier_id: courier.id } });
        const statusCounts = await Delivery.findAll({
            attributes: ['status', [sequelize.fn('COUNT', sequelize.col('status')), 'count']],
            where: { courier_id: courier.id },
            group: ['status'],
            raw: true,
        });
        const deliveriesPerMonth = await Delivery.findAll({
            attributes: [
                [sequelize.fn('YEAR', sequelize.col('pickup_time')), 'year'],
                [sequelize.fn('MONTH', sequelize.col('pickup_time')), 'month'],
                [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
            ],
            where: { courier_id: courier.id },
            group: [sequelize.fn('YEAR', sequelize.col('pickup_time')), sequelize.fn('MONTH', sequelize.col('pickup_time'))],
            order: [[sequelize.fn('YEAR', sequelize.col('pickup_time')), 'ASC'], [sequelize.fn('MONTH', sequelize.col('pickup_time')), 'ASC']],
            raw: true,
        });

        res.json({
            totalDeliveries,
            statusCounts: statusCounts.map(item => ({ status: item.status, count: item.count })),
            deliveriesPerMonth: deliveriesPerMonth.map(item => ({
                year: item.year,
                month: item.month,
                count: item.count,
            })),
        });
    } catch (err) {
        console.error('Error fetching delivery stats:', err.message, err.stack);
        res.status(500).json({ error: 'Error fetching delivery stats', details: err.message });
    }
};

exports.trackDelivery = async (req, res) => {
    const deliveryId = req.params.id;
    console.log(`Tracking delivery with ID: ${deliveryId}`);

    try {
        const deliveryItem = await Delivery.findByPk(deliveryId, {
            include: [
                {
                    model: Package,
                    as: 'package',
                    include: [
                        { model: Address, as: 'pickupAddress' },
                        { model: Address, as: 'dropoffAddress' },
                    ],
                },
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

        if (!deliveryItem) {
            console.log(`Delivery with ID ${deliveryId} not found`);
            return res.status(404).json({ error: 'Delivery not found' });
        }

        let currentLocation;

        if (deliveryItem.status === 'assigned') {
            currentLocation = {
                lat: deliveryItem.pickupAddress.lat,
                lng: deliveryItem.pickupAddress.lng,
            };
        } else if (deliveryItem.status === 'picked_up' || deliveryItem.status === 'delivered') {
            currentLocation = {
                lat: deliveryItem.dropoffAddress.lat,
                lng: deliveryItem.dropoffAddress.lng,
            };
        } else {
            console.log(`Invalid delivery status for tracking: ${deliveryItem.status}`);
            return res.status(400).json({ error: 'Invalid delivery status for tracking' });
        }

        const transformedDelivery = {
            deliveryId: deliveryItem.id,
            status: deliveryItem.status,
            currentLocation,
            pickupAddress: {
                ...deliveryItem.pickupAddress.toJSON(),
                city: deliveryItem.pickupAddress.postalCodeDetails?.city || null,
                country: deliveryItem.pickupAddress.postalCodeDetails?.country || null,
            },
            dropoffAddress: {
                ...deliveryItem.dropoffAddress.toJSON(),
                city: deliveryItem.dropoffAddress.postalCodeDetails?.city || null,
                country: deliveryItem.dropoffAddress.postalCodeDetails?.country || null,
            },
            estimatedDelivery: 'Niet beschikbaar',
        };

        delete transformedDelivery.pickupAddress.postalCodeDetails;
        delete transformedDelivery.dropoffAddress.postalCodeDetails;

        res.json(transformedDelivery);
    } catch (err) {
        console.error('Error tracking delivery:', err.message, err.stack);
        res.status(500).json({ error: 'Error tracking delivery', details: err.message });
    }
};

module.exports = exports;