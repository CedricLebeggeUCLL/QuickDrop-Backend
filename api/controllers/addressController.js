const { sequelize } = require('../db');
const Address = require('../models/address');
const PostalCode = require('../models/postalcode');

exports.getAddresses = async (req, res) => {
  try {
    const addresses = await Address.findAll({
      include: [PostalCode],
    });
    res.json(addresses);
  } catch (err) {
    res.status(500).json({ error: 'Error fetching addresses', details: err.message });
  }
};

exports.getAddressById = async (req, res) => {
  try {
    const address = await Address.findByPk(req.params.id, {
      include: [PostalCode],
    });
    if (!address) return res.status(404).json({ error: 'Address not found' });
    res.json(address);
  } catch (err) {
    res.status(500).json({ error: 'Error fetching address', details: err.message });
  }
};

exports.createAddress = async (req, res) => {
  const { street_name, house_number, extra_info, postal_code } = req.body;

  if (!street_name || !house_number || !postal_code) {
    return res.status(400).json({ error: 'Street name, house number, and postal code are required' });
  }

  const transaction = await sequelize.transaction();
  try {
    const postalCodeRecord = await PostalCode.findByPk(postal_code);
    if (!postalCodeRecord) {
      await PostalCode.create({
        code: postal_code,
        city: req.body.city || 'Unknown',
        country: req.body.country || 'Unknown',
      }, { transaction });
    }

    const address = await Address.create({
      street_name,
      house_number,
      extra_info: extra_info || null,
      postal_code,
    }, { transaction });

    await transaction.commit();
    res.status(201).json({ message: 'Address created successfully', addressId: address.id });
  } catch (err) {
    await transaction.rollback();
    res.status(500).json({ error: 'Error creating address', details: err.message });
  }
};

exports.updateAddress = async (req, res) => {
  const { street_name, house_number, extra_info, postal_code } = req.body;
  const transaction = await sequelize.transaction();
  try {
    const [updated] = await Address.update(
      { street_name, house_number, extra_info: extra_info || null, postal_code },
      { where: { id: req.params.id }, transaction }
    );
    if (updated === 0) {
      await transaction.rollback();
      return res.status(404).json({ error: 'Address not found' });
    }

    const updatedAddress = await Address.findByPk(req.params.id, {
      include: [PostalCode],
      transaction,
    });

    await transaction.commit();
    res.json(updatedAddress);
  } catch (err) {
    await transaction.rollback();
    res.status(500).json({ error: 'Error updating address', details: err.message });
  }
};

exports.deleteAddress = async (req, res) => {
  try {
    const deleted = await Address.destroy({ where: { id: req.params.id } });
    if (deleted === 0) return res.status(404).json({ error: 'Address not found' });
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: 'Error deleting address', details: err.message });
  }
};