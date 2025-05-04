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
    const deliveries = await Delivery.findAll({
      include: [
        {
          model: Package,
          include: [
            { model: Address, as: 'pickupAddress' },
            { model: Address, as: 'dropoffAddress' },
          ],
        },
        {
          model: Courier,
          include: [
            { model: Address, as: 'currentAddress' },
            { model: Address, as: 'startAddress' },
            { model: Address, as: 'destinationAddress' },
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
    console.error('Error fetching deliveries:', err.message);
    res.status(500).json({ error: 'Error fetching deliveries', details: err.message });
  }
};

exports.getDeliveryById = async (req, res) => {
  try {
      const delivery = await Delivery.findByPk(req.params.id, {
          include: [
              {
                  model: Package,
                  include: [
                      { model: Address, as: 'pickupAddress' },
                      { model: Address, as: 'dropoffAddress' },
                  ],
              },
              {
                  model: Courier,
                  include: [
                      { model: Address, as: 'currentAddress' },
                      { model: Address, as: 'startAddress' },
                      { model: Address, as: 'destinationAddress' },
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

      if (!delivery) return res.status(404).json({ error: 'Delivery not found' });

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
      console.error('Error fetching delivery:', err.message);
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

    await transaction.commit();
    console.log('Transaction committed');
    res.status(201).json({ message: 'Delivery created successfully', deliveryId: delivery.id });
  } catch (err) {
    await transaction.rollback();
    console.error('Create delivery error:', err);
    res.status(500).json({ error: 'Error creating delivery', details: err.message });
  }
};

exports.updateDelivery = async (req, res) => {
  const { status, pickup_time, delivery_time } = req.body;
  const validDeliveryStatuses = ['assigned', 'picked_up', 'delivered'];

  if (!status || !validDeliveryStatuses.includes(status)) {
    return res.status(400).json({ error: 'Invalid delivery status value. Must be one of: assigned, picked_up, delivered' });
  }

  const transaction = await sequelize.transaction();
  try {
    const updateData = { status };

    if (status === 'picked_up') {
      updateData.pickup_time = pickup_time ? new Date(pickup_time) : new Date();
      console.log('Setting pickup_time to:', updateData.pickup_time);

      const delivery = await Delivery.findByPk(req.params.id, { transaction });
      if (!delivery || !delivery.package_id) {
        await transaction.rollback();
        return res.status(400).json({ error: 'No associated package found' });
      }
      const [packageUpdated] = await Package.update(
        { status: 'in_transit' },
        { where: { id: delivery.package_id }, transaction }
      );
      if (packageUpdated === 0) {
        await transaction.rollback();
        return res.status(404).json({ error: 'Failed to update package status to in_transit' });
      }
      console.log('Successfully updated package status to in_transit for package_id:', delivery.package_id);
    }

    if (status === 'delivered') {
      updateData.delivery_time = delivery_time ? new Date(delivery_time) : new Date();
      console.log('Setting delivery_time to:', updateData.delivery_time);

      const delivery = await Delivery.findByPk(req.params.id, { transaction });
      if (!delivery || !delivery.package_id) {
        await transaction.rollback();
        return res.status(400).json({ error: 'No associated package found' });
      }
      const [packageUpdated] = await Package.update(
        { status: 'delivered' },
        { where: { id: delivery.package_id }, transaction }
      );
      if (packageUpdated === 0) {
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
      include: [
        {
          model: Package,
          include: [
            { model: Address, as: 'pickupAddress' },
            { model: Address, as: 'dropoffAddress' },
          ],
        },
        {
          model: Courier,
          include: [
            { model: Address, as: 'currentAddress' },
            { model: Address, as: 'startAddress' },
            { model: Address, as: 'destinationAddress' },
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
    const delivery = await Delivery.findByPk(req.params.id, { transaction });
    if (!delivery) {
      await transaction.rollback();
      return res.status(404).json({ error: 'Delivery not found' });
    }

    await Package.update({ status: 'pending' }, { where: { id: delivery.package_id }, transaction });
    await Delivery.destroy({ where: { id: req.params.id }, transaction });
    await transaction.commit();
    res.status(204).send();
  } catch (err) {
    await transaction.rollback();
    console.error('Error canceling delivery:', err.message);
    res.status(500).json({ error: 'Error canceling delivery', details: err.message });
  }
};

exports.getDeliveryHistory = async (req, res) => {
  const userId = req.params.userId;

  try {
    const deliveries = await Delivery.findAll({
      include: [
        {
          model: Package,
          where: { user_id: userId },
          required: true,
          include: [
            { model: Address, as: 'pickupAddress' },
            { model: Address, as: 'dropoffAddress' },
          ],
        },
        {
          model: Courier,
          include: [
            { model: Address, as: 'currentAddress' },
            { model: Address, as: 'startAddress' },
            { model: Address, as: 'destinationAddress' },
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
    console.error('Error fetching delivery history:', err.message);
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
      include: [
        {
          model: Package,
          include: [
            { model: Address, as: 'pickupAddress' },
            { model: Address, as: 'dropoffAddress' },
          ],
        },
        {
          model: Courier,
          include: [
            { model: Address, as: 'currentAddress' },
            { model: Address, as: 'startAddress' },
            { model: Address, as: 'destinationAddress' },
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
    console.error('Error fetching courier deliveries:', err.message);
    res.status(500).json({ error: 'Error fetching courier deliveries', details: err.message });
  }
};

exports.getDeliveryStats = async (req, res) => {
  const userId = req.params.userId;
  try {
    const courier = await Courier.findOne({ where: { user_id: userId } });
    if (!courier) {
      return res.status(404).json({ error: 'Courier not found' });
    }
    const totalDeliveries = await Delivery.count({ where: { courier_id: courier.id } });
    const statusCounts = await Delivery.findAll({
      attributes: ['status', [sequelize.fn('COUNT', sequelize.col('status')), 'count']],
      where: { courier_id: courier.id },
      group: ['status'],
    });
    const deliveriesPerMonth = await Delivery.findAll({
      attributes: [
        [sequelize.fn('YEAR', sequelize.col('pickup_time')), 'year'],
        [sequelize.fn('MONTH', sequelize.col('pickup_time')), 'month'],
        [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
      ],
      where: { courier_id: courier.id },
      group: ['year', 'month'],
      order: [['year', 'ASC'], ['month', 'ASC']],
    });
    res.json({
      totalDeliveries,
      statusCounts: statusCounts.map(item => ({ status: item.status, count: item.get('count') })),
      deliveriesPerMonth: deliveriesPerMonth.map(item => ({
        year: item.get('year'),
        month: item.get('month'),
        count: item.get('count'),
      })),
    });
  } catch (err) {
    console.error('Error fetching delivery stats:', err.message);
    res.status(500).json({ error: 'Error fetching delivery stats', details: err.message });
  }
};

exports.trackDelivery = async (req, res) => {
  const deliveryId = req.params.id;

  try {
    const deliveryItem = await Delivery.findByPk(deliveryId, {
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

    if (!deliveryItem) {
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
    console.error('Error tracking delivery:', err.message);
    res.status(500).json({ error: 'Error tracking delivery', details: err.message });
  }
};

module.exports = exports;