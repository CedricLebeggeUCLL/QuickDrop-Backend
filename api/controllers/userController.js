const { sequelize } = require('../db');
const User = require('../models/user');

exports.getUsers = async (req, res) => {
  try {
    const users = await User.findAll();
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: 'Fout bij ophalen van gebruikers', details: err.message });
  }
};

exports.getUserById = async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
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
    const updatedUser = await User.findByPk(req.params.id);
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

// Nieuwe methoden voor login en registratie (zonder bcrypt/JWT)
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
    const user = await User.findOne({ where: { email } });
    if (!user) return res.status(404).json({ error: 'Gebruiker niet gevonden' });
    if (user.password !== password) return res.status(401).json({ error: 'Ongeldig wachtwoord' });
    res.status(200).json(user); // Retourneer de volledige gebruiker, inclusief password (tijdelijk)
  } catch (err) {
    res.status(500).json({ error: 'Fout bij login', details: err.message });
  }
};