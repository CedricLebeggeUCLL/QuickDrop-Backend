const { sequelize } = require('../db');
const Courier = require('../models/courier');
const User = require('../models/user');

// Helperfunctie om JSON naar object met lat/lng te converteren (optioneel, voor respons)
function parseLocation(location) {
  if (!location) return null;
  if (Array.isArray(location)) {
    return {
      lat: parseFloat(location[0]),
      lng: parseFloat(location[1])
    };
  }
  if (typeof location === 'string') {
    const coords = location.split(',').map(coord => parseFloat(coord.trim()));
    return {
      lat: coords[0],
      lng: coords[1]
    };
  }
  return null;
}

exports.getCouriers = async (req, res) => {
  try {
    const couriers = await Courier.findAll();
    // Formatteer de JSON-data naar een object met lat/lng
    const formattedCouriers = couriers.map(courier => ({
      id: courier.id,
      user_id: courier.user_id,
      current_location: parseLocation(courier.current_location),
      destination: parseLocation(courier.destination),
      availability: courier.availability
    }));
    res.json(formattedCouriers);
  } catch (err) {
    res.status(500).json({ error: 'Fout bij ophalen van koeriers', details: err.message });
  }
};

exports.getCourierById = async (req, res) => {
  try {
    const courier = await Courier.findByPk(req.params.id);
    if (!courier) return res.status(404).json({ error: 'Koerier niet gevonden' });
    // Formatteer de JSON-data naar een object met lat/lng
    const formattedCourier = {
      id: courier.id,
      user_id: courier.user_id,
      current_location: parseLocation(courier.current_location),
      destination: parseLocation(courier.destination),
      availability: courier.availability
    };
    res.json(formattedCourier);
  } catch (err) {
    res.status(500).json({ error: 'Fout bij ophalen van koerier', details: err.message });
  }
};

exports.createCourier = async (req, res) => {
  const { user_id, current_location, destination, availability } = req.body;
  try {
    // Controleer of de user_id bestaat in de users-tabel
    const user = await User.findByPk(user_id);
    if (!user) {
      return res.status(400).json({ error: 'Ongeldige user_id: gebruiker bestaat niet' });
    }

    // Valideer en formateer current_location en destination als JSON-arrays of strings
    let formattedCurrentLocation = current_location;
    let formattedDestination = destination;

    if (current_location && typeof current_location === 'string') {
      // Als het een string is (bijv. "50.8503, 4.3517"), converteer naar array
      formattedCurrentLocation = current_location.split(',').map(coord => parseFloat(coord.trim()));
    }
    if (destination && typeof destination === 'string') {
      formattedDestination = destination.split(',').map(coord => parseFloat(coord.trim()));
    }

    const courier = await Courier.create({
      user_id,
      current_location: formattedCurrentLocation,
      destination: formattedDestination,
      availability: availability || true
    });
    // Formatteer de respons naar lat/lng voor consistentie
    const formattedCourier = {
      id: courier.id,
      user_id: courier.user_id,
      current_location: parseLocation(courier.current_location),
      destination: parseLocation(courier.destination),
      availability: courier.availability
    };
    res.status(201).json(formattedCourier);
  } catch (err) {
    res.status(500).json({ error: 'Fout bij aanmaken koerier', details: err.message });
  }
};

exports.updateCourier = async (req, res) => {
  try {
    const { current_location, destination, availability } = req.body;
    let formattedCurrentLocation = current_location;
    let formattedDestination = destination;

    if (current_location && typeof current_location === 'string') {
      formattedCurrentLocation = current_location.split(',').map(coord => parseFloat(coord.trim()));
    }
    if (destination && typeof destination === 'string') {
      formattedDestination = destination.split(',').map(coord => parseFloat(coord.trim()));
    }

    const [updated] = await Courier.update(
      { current_location: formattedCurrentLocation, destination: formattedDestination, availability },
      { where: { id: req.params.id } }
    );
    if (updated === 0) return res.status(404).json({ error: 'Koerier niet gevonden' });
    const updatedCourier = await Courier.findByPk(req.params.id);
    // Formatteer de respons naar lat/lng
    const formattedCourier = {
      id: updatedCourier.id,
      user_id: updatedCourier.user_id,
      current_location: parseLocation(updatedCourier.current_location),
      destination: parseLocation(updatedCourier.destination),
      availability: updatedCourier.availability
    };
    res.json(formattedCourier);
  } catch (err) {
    res.status(500).json({ error: 'Fout bij updaten van koerier', details: err.message });
  }
};

exports.deleteCourier = async (req, res) => {
  try {
    const deleted = await Courier.destroy({ where: { id: req.params.id } });
    if (deleted === 0) return res.status(404).json({ error: 'Koerier niet gevonden' });
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: 'Fout bij verwijderen van koerier', details: err.message });
  }
};