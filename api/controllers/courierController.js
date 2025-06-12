const { sequelize, models } = require('../db');
const { geocodeAddress } = require('../../utils/geocode');
const Courier = models.Courier;
const CourierDetails = models.CourierDetails;
const User = models.User;
const Address = models.Address;
const PostalCode = models.PostalCode;
const crypto = require('crypto-js');
const axios = require('axios');
const jwt = require('jsonwebtoken');

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
    console.log('Received /api/couriers/become request:', req.body);

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
    if (!user_id) {
        console.log('Validation failed: Missing user_id');
        return res.status(400).json({ error: 'Missing user_id in request body' });
    }
    if (user_id <= 0) {
        console.log('Validation failed: Invalid user_id value:', user_id);
        return res.status(400).json({ error: 'user_id must be a positive integer' });
    }
    if (!first_name || !last_name) {
        console.log('Validation failed: Missing first_name or last_name', { first_name, last_name });
        return res.status(400).json({ error: 'First name and last name are required' });
    }
    if (!birth_date || !validateBirthDate(birth_date)) {
        console.log('Validation failed: Invalid birth_date:', birth_date);
        return res.status(400).json({ error: 'Invalid birth date (format: dd/mm/yyyy)' });
    }
    if (!phone_number || !/^\+\d{10,15}$/.test(phone_number)) {
        console.log('Validation failed: Invalid phone_number:', phone_number);
        return res.status(400).json({ error: 'Invalid phone number' });
    }
    if (!address || !city || !postal_code || !country) {
        console.log('Validation failed: Incomplete address', { address, city, postal_code, country });
        return res.status(400).json({ error: 'Complete address is required' });
    }
    if (!national_number || !validateNationalNumber(national_number)) {
        console.log('Validation failed: Invalid national_number:', national_number);
        return res.status(400).json({ error: 'Invalid Belgian national number' });
    }
    if (!nationality) {
        console.log('Validation failed: Missing nationality');
        return res.status(400).json({ error: 'Nationality is required' });
    }

    const transaction = await sequelize.transaction();
    try {
        // Controleer JWT token
        console.log('Verifying JWT token');
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            console.log('No Authorization token provided');
            await transaction.rollback();
            return res.status(401).json({ error: 'Authorization token missing' });
        }
        let decoded;
        try {
            decoded = jwt.verify(token, process.env.JWT_SECRET);
            console.log('JWT decoded:', decoded);
            if (decoded.id !== user_id) {
                console.log(`Token ID ${decoded.id} does not match user_id ${user_id}`);
                await transaction.rollback();
                return res.status(403).json({ error: `User ID ${user_id} does not match authenticated user ID ${decoded.id}` });
            }
        } catch (err) {
            console.log('Invalid token:', err.message);
            await transaction.rollback();
            return res.status(401).json({ error: `Invalid token: ${err.message}` });
        }

        // Controleer of gebruiker bestaat
        console.log(`Checking user with ID ${user_id}`);
        const user = await User.findByPk(user_id, { transaction });
        if (!user) {
            console.log(`User with ID ${user_id} not found`);
            await transaction.rollback();
            return res.status(404).json({ error: `User with ID ${user_id} does not exist` });
        }

        // Controleer of gebruiker al een koerier is
        console.log(`Checking if user ID ${user_id} is already a courier`);
        const existingCourier = await Courier.findOne({ where: { user_id }, transaction });
        if (existingCourier) {
            console.log(`User ID ${user_id} is already a courier`);
            await transaction.rollback();
            return res.status(400).json({ error: `User with ID ${user_id} is already a courier` });
        }

        // Encrypt rijksregisternummer
        console.log('Encrypting national number');
        const encryptedNationalNumber = crypto.AES.encrypt(national_number, ENCRYPTION_KEY).toString();

        // Maak of vind postcode (alleen op basis van code, omdat dit de PRIMARY key is)
        console.log('Finding or creating postal code:', { code: postal_code });
        let postalCode = await PostalCode.findOne({
            where: { code: postal_code },
            transaction,
        });
        if (!postalCode) {
            console.log('Postal code not found, creating new:', { code: postal_code, city, country });
            postalCode = await PostalCode.create({
                code: postal_code,
                city,
                country,
            }, { transaction });
        } else {
            console.log('Postal code already exists:', postalCode);
        }

        // Maak of vind adres
        console.log('Finding or creating address:', { street_name: address, house_number: '1', postal_code });
        let addressRecord = await Address.findOne({
            where: {
                street_name: address,
                house_number: '1',
                postal_code: postal_code,
            },
            transaction,
        });
        if (!addressRecord) {
            console.log('Address not found, creating new:', { street_name: address, house_number: '1', postal_code });
            addressRecord = await Address.create({
                street_name: address,
                house_number: '1',
                postal_code: postal_code,
            }, { transaction });
        } else {
            console.log('Address already exists:', addressRecord);
        }

        // Geocode adres indien nodig
        if (!addressRecord.lat || !addressRecord.lng) {
            console.log('Geocoding address:', { street_name: address, house_number: '1', postal_code, city, country });
            const coords = await geocodeAddress({ street_name: address, house_number: '1', postal_code, city, country });
            if (!coords || !coords.lat || !coords.lng) {
                console.error('Geocoding failed');
                throw new Error('Failed to geocode address');
            }
            console.log('Updating address with coordinates:', coords);
            await addressRecord.update({ lat: coords.lat, lng: coords.lng }, { transaction });
        }

        // Maak courier_details
        console.log('Creating courier details:', {
            user_id,
            first_name,
            last_name,
            birth_date: convertBirthDate(birth_date),
            phone_number,
            encrypted_national_number: encryptedNationalNumber,
            nationality,
            itsme_verified: false,
        });
        const courierDetails = await CourierDetails.create({
            user_id,
            first_name,
            last_name,
            birth_date: convertBirthDate(birth_date),
            phone_number,
            encrypted_national_number: encryptedNationalNumber,
            nationality,
            itsme_verified: false,
        }, { transaction });
        console.log('Courier details created:', courierDetails);

        // Maak koerier
        console.log('Creating courier:', {
            user_id,
            pickup_radius: 5.0,
            dropoff_radius: 5.0,
            availability: true,
            current_lat: null,
            current_lng: null,
        });
        const courier = await Courier.create({
            user_id,
            pickup_radius: 5.0,
            dropoff_radius: 5.0,
            availability: true,
            current_lat: null,
            current_lng: null,
        }, { transaction });
        console.log('Courier created:', courier);

        // Update gebruikersrol
        console.log('Updating user role to courier for user_id:', user_id);
        const [updated] = await User.update(
            { role: 'courier' },
            { where: { id: user_id }, transaction }
        );
        if (updated === 0) {
            console.error('Failed to update user role for user_id:', user_id);
            await transaction.rollback();
            return res.status(500).json({ error: `Failed to update role for user ID ${user_id}` });
        }
        console.log('User role updated');

        await transaction.commit();
        console.log('Courier registration successful, courierId:', courier.id);
        res.status(201).json({ message: 'Courier created successfully', courierId: courier.id });
    } catch (err) {
        console.error('Error in becomeCourier:', err);
        await transaction.rollback();
        if (err.name === 'SequelizeValidationError') {
            return res.status(400).json({
                error: 'Validation error during courier creation',
                details: err.errors.map(e => e.message).join(', ')
            });
        }
        if (err.name === 'SequelizeUniqueConstraintError') {
            return res.status(400).json({
                error: 'Duplicate entry error',
                details: `A record with the provided key already exists: ${err.message}`
            });
        }
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
            // Ensure postal code exists or create it
            await PostalCode.findOrCreate({
                where: { code: start_address.postal_code },
                defaults: {
                    code: start_address.postal_code,
                    city: start_address.city || 'Unknown', // Use city from request or fallback
                    country: start_address.country || 'Belgium' // Use country from request or fallback
                },
                transaction
            });

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
            // Ensure postal code exists or create it
            await PostalCode.findOrCreate({
                where: { code: destination_address.postal_code },
                defaults: {
                    code: destination_address.postal_code,
                    city: destination_address.city || 'Unknown', // Use city from request or fallback
                    country: destination_address.country || 'Belgium' // Use country from request or fallback
                },
                transaction
            });

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