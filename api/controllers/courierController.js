const { sequelize, models } = require('../db');
const { geocodeAddress } = require('../../utils/geocode');
const Courier = models.Courier;
const CourierDetails = models.CourierDetails;
const User = models.User;
const Address = models.Address;
const PostalCode = models.PostalCode;
const crypto = require('crypto-js');
const axios = require('axios');

// itsme client credentials (store in .env)
const ITSME_CLIENT_ID = process.env.ITSME_CLIENT_ID || 'mock_client_id_123';
const ITSME_CLIENT_SECRET = process.env.ITSME_CLIENT_SECRET || 'mock_client_secret_456';
const ITSME_REDIRECT_URI = process.env.ITSME_REDIRECT_URI || 'com.example.quickdropapp://oauth/callback';
const IS_MOCK = process.env.NODE_ENV === 'mock'; // Gebruik mock endpoints in mock-modus
const ITSME_TOKEN_URL = IS_MOCK ? 'http://localhost:3000/itsme/mock/token' : 'https://e2e.itsme.be/oauth/token';
const ITSME_USERINFO_URL = IS_MOCK ? 'http://localhost:3000/itsme/mock/userinfo' : 'https://e2e.itsme.be/oidc/userinfo';

// Encryptie sleutel (moet veilig worden opgeslagen in omgevingvariabelen)
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'your-secure-encryption-key';

// Valideer Belgisch rijksregisternummer (simpele check, pas aan voor exacte regels)
const validateNationalNumber = (nationalNumber) => {
  return /^\d{11}$/.test(nationalNumber); // Voorbeeld: 11 cijfers
};

// Valideer geboortedatum (dd/mm/yyyy formaat, moet in het verleden liggen)
const validateBirthDate = (birthDate) => {
  const regex = /^(\d{2})\/(\d{2})\/(\d{4})$/;
  if (!regex.test(birthDate)) return false;
  const [, day, month, year] = birthDate.match(regex);
  const date = new Date(`${year}-${month}-${day}`);
  return date < new Date() && !isNaN(date.getTime());
};

// Converteer dd/mm/yyyy naar YYYY-MM-DD
const convertBirthDate = (birthDate) => {
  const [, day, month, year] = birthDate.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return `${year}-${month}-${day}`;
};

// Valideer itsme token en haal gebruikersinformatie op
const verifyItsmeToken = async (code) => {
  try {
    // Wissel autorisatiecode in voor access token
    const tokenResponse = await axios.post(ITSME_TOKEN_URL, new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: ITSME_CLIENT_ID,
      client_secret: ITSME_CLIENT_SECRET,
      redirect_uri: ITSME_REDIRECT_URI,
    }), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });

    const accessToken = tokenResponse.data.access_token;

    // Haal gebruikersinformatie op
    const userInfoResponse = await axios.get(ITSME_USERINFO_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    console.log('itsme userinfo:', userInfoResponse.data);

    return {
      verified: true,
      userInfo: userInfoResponse.data,
    };
  } catch (err) {
    console.error('Error verifying itsme token:', err.response ? err.response.data : err.message);
    return { verified: false, error: err.message };
  }
};

exports.getCouriers = async (req, res) => {
  try {
    const couriers = await Courier.findAll({
      include: [
        { model: Address, as: 'startAddress' },
        { model: Address, as: 'destinationAddress' },
        { model: CourierDetails, as: 'details' },
      ],
    });
    res.json(couriers);
  } catch (err) {
    console.error('Error fetching couriers:', err);
    res.status(500).json({ error: 'Error fetching couriers', details: err.message });
  }
};

exports.getCourierById = async (req, res) => {
  try {
    const courier = await Courier.findByPk(req.params.id, {
      include: [
        { model: Address, as: 'startAddress' },
        { model: Address, as: 'destinationAddress' },
        { model: CourierDetails, as: 'details' },
      ],
    });
    if (!courier) return res.status(404).json({ error: 'Courier not found' });
    res.json(courier);
  } catch (err) {
    console.error('Error fetching courier:', err);
    res.status(500).json({ error: 'Error fetching courier', details: err.message });
  }
};

exports.getCourierByUserId = async (req, res) => {
  try {
    const courier = await Courier.findOne({
      where: { user_id: req.params.userId },
      include: [
        { model: Address, as: 'startAddress' },
        { model: Address, as: 'destinationAddress' },
        { model: CourierDetails, as: 'details' },
      ],
    });
    if (!courier) return res.status(404).json({ error: 'Courier not found for this user' });
    res.json(courier);
  } catch (err) {
    console.error('Error fetching courier by user ID:', err);
    res.status(500).json({ error: 'Error fetching courier by user ID', details: err.message });
  }
};

exports.handleItsmeCallback = async (req, res) => {
  const { code, user_id } = req.body;

  if (!code || !user_id) {
    return res.status(400).json({ error: 'Missing code or user_id' });
  }

  const transaction = await sequelize.transaction();
  try {
    // Controleer of gebruiker bestaat
    const user = await User.findByPk(user_id, { transaction });
    if (!user) {
      await transaction.rollback();
      return res.status(404).json({ error: 'User does not exist' });
    }

    // Valideer itsme token (of mock)
    const itsmeResult = await verifyItsmeToken(code);
    if (!itsmeResult.verified) {
      await transaction.rollback();
      return res.status(400).json({ error: 'Invalid itsme verification', details: itsmeResult.error });
    }

    // Update courier_details met itsme_verified status
    const [courierDetails, created] = await CourierDetails.findOrCreate({
      where: { user_id },
      defaults: { user_id, itsme_verified: true },
      transaction,
    });

    if (!created) {
      await courierDetails.update({ itsme_verified: true }, { transaction });
    }

    await transaction.commit();
    res.json({ message: IS_MOCK ? 'Mock itsme verification successful' : 'itsme verification successful' });
  } catch (err) {
    await transaction.rollback();
    console.error('Error in handleItsmeCallback:', err);
    res.status(500).json({ error: 'Error processing itsme callback', details: err.message });
  }
};

exports.becomeCourier = async (req, res) => {
  const {
    user_id,
    first_name,
    last_name,
    birth_date,
    phone_number,
    address,
    city,
    postal_code,
    country,
    national_number,
    nationality,
  } = req.body;

  // Validaties
  if (!user_id || user_id <= 0) {
    return res.status(400).json({ error: 'Invalid user_id' });
  }
  if (!first_name || !last_name) {
    return res.status(400).json({ error: 'First name and last name are required' });
  }
  if (!birth_date || !validateBirthDate(birth_date)) {
    return res.status(400).json({ error: 'Invalid birth date (format: dd/mm/yyyy)' });
  }
  if (!phone_number || !/^\+\d{10,15}$/.test(phone_number)) {
    return res.status(400).json({ error: 'Invalid phone number' });
  }
  if (!address || !city || !postal_code || !country) {
    return res.status(400).json({ error: 'Complete address is required' });
  }
  if (!national_number || !validateNationalNumber(national_number)) {
    return res.status(400).json({ error: 'Invalid Belgian national number' });
  }
  if (!nationality) {
    return res.status(400).json({ error: 'Nationality is required' });
  }

  const transaction = await sequelize.transaction();
  try {
    // Controleer of gebruiker bestaat
    const user = await User.findByPk(user_id, { transaction });
    if (!user) {
      await transaction.rollback();
      return res.status(404).json({ error: 'User does not exist' });
    }

    // Controleer of gebruiker al een koerier is
    const existingCourier = await Courier.findOne({ where: { user_id }, transaction });
    if (existingCourier) {
      await transaction.rollback();
      return res.status(400).json({ error: 'User is already a courier' });
    }

    // Encrypt rijksregisternummer
    const encryptedNationalNumber = crypto.AES.encrypt(national_number, ENCRYPTION_KEY).toString();

    // Maak of vind postcode
    const [postalCode, postalCreated] = await PostalCode.findOrCreate({
      where: { code: postal_code, city, country },
      defaults: { code: postal_code, city, country },
      transaction,
    });

    // Maak adres
    const [addressRecord, addressCreated] = await Address.findOrCreate({
      where: {
        street_name: address,
        house_number: '1', // Aanname, pas aan indien nodig
        postal_code,
      },
      defaults: {
        street_name: address,
        house_number: '1',
        postal_code,
      },
      transaction,
    });

    // Geocode adres indien nodig
    if (!addressRecord.lat || !addressRecord.lng) {
      const coords = await geocodeAddress({ street_name: address, house_number: '1', postal_code, city, country });
      if (!coords || !coords.lat || !coords.lng) {
        throw new Error('Failed to geocode address');
      }
      await addressRecord.update({ lat: coords.lat, lng: coords.lng }, { transaction });
    }

    // Maak courier_details
    const courierDetails = await CourierDetails.create({
      user_id,
      first_name,
      last_name,
      birth_date: convertBirthDate(birth_date),
      phone_number,
      encrypted_national_number: encryptedNationalNumber,
      nationality,
      itsme_verified: false, // Wordt later bijgewerkt via itsme callback
    }, { transaction });

    // Maak koerier
    const courier = await Courier.create({
      user_id,
      pickup_radius: 5.0,
      dropoff_radius: 5.0,
      availability: true,
      current_lat: null,
      current_lng: null,
    }, { transaction });

    // Update gebruikersrol
    const [updated] = await User.update(
      { role: 'courier' },
      { where: { id: user_id }, transaction }
    );

    if (updated === 0) {
      await transaction.rollback();
      return res.status(500).json({ error: 'Failed to update user role' });
    }

    await transaction.commit();
    res.status(201).json({ message: 'Courier created successfully', courierId: courier.id });
  } catch (err) {
    await transaction.rollback();
    console.error('Error in becomeCourier:', err);
    res.status(500).json({ error: 'Error creating courier', details: err.message });
  }
};

exports.updateCourier = async (req, res) => {
  const { start_address, destination_address, pickup_radius, dropoff_radius, availability } = req.body;
  const transaction = await sequelize.transaction();

  try {
    const courier = await Courier.findByPk(req.params.id, { transaction });
    if (!courier) {
      await transaction.rollback();
      return res.status(404).json({ error: 'Courier not found' });
    }

    let startAddressId, destAddressId;

    if (start_address) {
      const [startAddress, created] = await Address.findOrCreate({
        where: {
          street_name: start_address.street_name,
          house_number: start_address.house_number,
          extra_info: start_address.extra_info || null,
          postal_code: start_address.postal_code,
        },
        defaults: {
          street_name: start_address.street_name,
          house_number: start_address.house_number,
          extra_info: start_address.extra_info || null,
          postal_code: start_address.postal_code,
        },
        transaction,
      });

      if (!startAddress.lat || !startAddress.lng) {
        const coords = await geocodeAddress(start_address);
        if (!coords || !coords.lat || !coords.lng) {
          throw new Error('Failed to geocode start address');
        }
        await startAddress.update({ lat: coords.lat, lng: coords.lng }, { transaction });
      }

      startAddressId = startAddress.id;
    }

    if (destination_address) {
      const [destAddress, created] = await Address.findOrCreate({
        where: {
          street_name: destination_address.street_name,
          house_number: destination_address.house_number,
          extra_info: destination_address.extra_info || null,
          postal_code: destination_address.postal_code,
        },
        defaults: {
          street_name: destination_address.street_name,
          house_number: destination_address.house_number,
          extra_info: destination_address.extra_info || null,
          postal_code: destination_address.postal_code,
        },
        transaction,
      });

      if (!destAddress.lat || !destAddress.lng) {
        const coords = await geocodeAddress(destination_address);
        if (!coords || !coords.lat || !coords.lng) {
          throw new Error('Failed to geocode destination address');
        }
        await destAddress.update({ lat: coords.lat, lng: coords.lng }, { transaction });
      }

      destAddressId = destAddress.id;
    }

    const updateData = {
      ...(startAddressId && { start_address_id: startAddressId }),
      ...(destAddressId && { destination_address_id: destAddressId }),
      pickup_radius: pickup_radius || courier.pickup_radius,
      dropoff_radius: dropoff_radius || courier.dropoff_radius,
      availability: availability !== undefined ? availability : courier.availability,
    };

    await courier.update(updateData, { transaction });

    const updatedCourier = await Courier.findByPk(req.params.id, {
      include: [
        { model: Address, as: 'startAddress' },
        { model: Address, as: 'destinationAddress' },
        { model: CourierDetails, as: 'details' },
      ],
      transaction,
    });

    await transaction.commit();
    res.json(updatedCourier);
  } catch (err) {
    await transaction.rollback();
    console.error('Error updating courier:', err);
    res.status(500).json({ error: 'Error updating courier', details: err.message });
  }
};

exports.deleteCourier = async (req, res) => {
  try {
    const deleted = await Courier.destroy({ where: { id: req.params.id } });
    if (deleted === 0) return res.status(404).json({ error: 'Courier not found' });
    res.status(204).send();
  } catch (err) {
    console.error('Error deleting courier:', err);
    res.status(500).json({ error: 'Error deleting courier', details: err.message });
  }
};

exports.updateCourierLocation = async (req, res) => {
  const id = req.params.id;
  const { lat, lng } = req.body;
  try {
    const courier = await Courier.findByPk(id);
    if (!courier) return res.status(404).json({ error: 'Courier not found' });
    await courier.update({ current_lat: lat, current_lng: lng });
    res.json({ message: 'Location updated' });
  } catch (err) {
    console.error('Error updating location:', err);
    res.status(500).json({ error: 'Error updating location', details: err.message });
  }
};