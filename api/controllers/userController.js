const { sequelize } = require('../db');
const User = require('../models/user');
const Address = require('../models/address');

exports.getUsers = async (req, res) => {
  try {
    const users = await User.findAll({
      include: [{ model: Address, as: 'currentAddress' }], // Optioneel, afhankelijk van relaties
    });
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: 'Fout bij ophalen van gebruikers', details: err.message });
  }
};

exports.getUserById = async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id, {
      include: [{ model: Address, as: 'currentAddress' }],
    });
    if (!user) return res.status(404).json({ error: 'Gebruiker niet gevonden' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: 'Fout bij ophalen van gebruiker', details: err.message });
  }
};

exports.createUser = async (req, res) => {
  const { username, email, password, role } = req.body;
  try {
    const user = await User.create({ username, email, password, role: role || 'user' });
    res.status(201).json(user); // Retourneer de volledige gebruiker, inclusief password (tijdelijk, zonder hashing)
  } catch (err) {
    res.status(500).json({ error: 'Fout bij aanmaken gebruiker', details: err.message });
  }
};

exports.updateUser = async (req, res) => {
  try {
    const [updated] = await User.update(req.body, { where: { id: req.params.id } });
    if (updated === 0) return res.status(404).json({ error: 'Gebruiker niet gevonden' });
    const updatedUser = await User.findByPk(req.params.id, {
      include: [{ model: Address, as: 'currentAddress' }],
    });
    res.json(updatedUser);
  } catch (err) {
    res.status(500).json({ error: 'Fout bij updaten van gebruiker', details: err.message });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    const deleted = await User.destroy({ where: { id: req.params.id } });
    if (deleted === 0) return res.status(404).json({ error: 'Gebruiker niet gevonden' });
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: 'Fout bij verwijderen van gebruiker', details: err.message });
  }
};

exports.registerUser = async (req, res) => {
  const { username, email, password, role } = req.body;
  try {
    const user = await User.create({ username, email, password, role: role || 'user' });
    res.status(201).json(user); // Retourneer de volledige gebruiker, inclusief password (tijdelijk)
  } catch (err) {
    res.status(500).json({ error: 'Fout bij registratie', details: err.message });
  }
};

exports.loginUser = async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ where: { email } }); // Verwijder include: Address
    if (!user) return res.status(404).json({ error: 'Gebruiker niet gevonden' });
    if (user.password !== password) return res.status(401).json({ error: 'Ongeldig wachtwoord' });
    res.status(200).json({ userId: user.id, token: 'dummy-token' }); // Retourneer userId en token
  } catch (err) {
    console.error('Login error:', err.message); // Log de fout voor debugging
    res.status(500).json({ error: 'Fout bij login', details: err.message });
  }
};