const { sequelize, models } = require('../db');
const Address = models.Address;
const PostalCode = models.PostalCode;
const { geocodeAddress } = require('../../utils/geocode');

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
  const { street_name, house_number, extra_info, postal_code, city, country } = req.body;

  if (!street_name || !house_number || !postal_code) {
    return res.status(400).json({ error: 'Street name, house number, and postal code are required' });
  }

  const transaction = await sequelize.transaction();
  try {
    // Controleer of de postcode bestaat, anders maak een nieuwe aan
    let postalCodeRecord = await PostalCode.findByPk(postal_code);
    if (!postalCodeRecord) {
      postalCodeRecord = await PostalCode.create({
        code: postal_code,
        city: city || 'Unknown',
        country: country || 'Unknown',
      }, { transaction });
    }

    // Geocode het adres om coördinaten te krijgen
    const coordinates = await geocodeAddress({
      street_name,
      house_number,
      extra_info: extra_info || null,
      postal_code,
      city: postalCodeRecord.city,
      country: postalCodeRecord.country,
    });

    // Maak het adres aan met coördinaten
    const address = await Address.create({
      street_name,
      house_number,
      extra_info: extra_info || null,
      postal_code,
      lat: coordinates.lat,
      lng: coordinates.lng,
    }, { transaction });

    await transaction.commit();
    res.status(201).json({ message: 'Address created successfully', addressId: address.id, lat: coordinates.lat, lng: coordinates.lng });
  } catch (err) {
    await transaction.rollback();
    res.status(500).json({ error: 'Error creating address', details: err.message });
  }
};

exports.updateAddress = async (req, res) => {
  const { street_name, house_number, extra_info, postal_code, city, country } = req.body;
  const transaction = await sequelize.transaction();
  try {
    const address = await Address.findByPk(req.params.id, { transaction });
    if (!address) {
      await transaction.rollback();
      return res.status(404).json({ error: 'Address not found' });
    }

    // Update postcode als deze verandert
    if (postal_code && address.postal_code !== postal_code) {
      let postalCodeRecord = await PostalCode.findByPk(postal_code);
      if (!postalCodeRecord) {
        postalCodeRecord = await PostalCode.create({
          code: postal_code,
          city: city || 'Unknown',
          country: country || 'Unknown',
        }, { transaction });
      }
    }

    // Geocode opnieuw als het adres verandert
    const coordinates = await geocodeAddress({
      street_name: street_name || address.street_name,
      house_number: house_number || address.house_number,
      extra_info: extra_info || address.extra_info || null,
      postal_code: postal_code || address.postal_code,
      city: (await PostalCode.findByPk(postal_code || address.postal_code)).city,
      country: (await PostalCode.findByPk(postal_code || address.postal_code)).country,
    });

    const [updated] = await Address.update(
      {
        street_name: street_name || address.street_name,
        house_number: house_number || address.house_number,
        extra_info: extra_info || address.extra_info || null,
        postal_code: postal_code || address.postal_code,
        lat: coordinates.lat,
        lng: coordinates.lng,
      },
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