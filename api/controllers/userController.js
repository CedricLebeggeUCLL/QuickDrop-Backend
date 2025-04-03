const { sequelize } = require('../db');
const User = require('../models/user');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto'); // For generating random refresh tokens
const { sendPasswordResetEmail } = require('../../utils/emailService');

const JWT_SECRET = process.env.JWT_SECRET || 'jouw_geheime_sleutel';
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET || 'your_refresh_token_secret';

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
    res.status(201).json(user);
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

exports.registerUser = async (req, res) => {
  const { username, email, password, role } = req.body;
  try {
    const user = await User.create({ username, email, password, role: role || 'user' });
    res.status(201).json(user);
  } catch (err) {
    res.status(500).json({ error: 'Fout bij registratie', details: err.message });
  }
};

exports.loginUser = async (req, res) => {
  const { identifier, password } = req.body;
  try {
    let user;
    if (identifier.includes('@')) {
      user = await User.findOne({ where: { email: identifier } });
    } else {
      user = await User.findOne({ where: { username: identifier } });
    }
    if (!user) return res.status(404).json({ error: 'Gebruiker niet gevonden' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ error: 'Ongeldig wachtwoord' });

    // Generate access token
    const accessToken = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '1h' });

    // Generate refresh token (random string)
    const refreshToken = crypto.randomBytes(32).toString('hex');
    user.refreshToken = refreshToken;
    await user.save();

    res.status(200).json({ userId: user.id, accessToken, refreshToken });
  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({ error: 'Fout bij login', details: err.message });
  }
};

exports.refreshToken = async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(401).json({ error: 'Refresh token vereist' });

  try {
    const user = await User.findOne({ where: { refreshToken } });
    if (!user) return res.status(403).json({ error: 'Ongeldig refresh token' });

    // Generate new access token
    const accessToken = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '1h' });

    res.status(200).json({ accessToken });
  } catch (err) {
    res.status(500).json({ error: 'Fout bij het vernieuwen van token', details: err.message });
  }
};

// Nieuwe functie: Wachtwoordherstel aanvragen
exports.forgotPassword = async (req, res) => {
  const { email } = req.body;
  try {
    const user = await User.findOne({ where: { email } });
    if (!user) {
      return res.status(404).json({ error: 'Geen gebruiker gevonden met dit e-mailadres' });
    }

    // Genereer een reset-token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = Date.now() + 3600000; // 1 uur geldig

    // Sla de token en vervaldatum op in de database
    user.resetToken = resetToken;
    user.resetTokenExpiry = resetTokenExpiry;
    await user.save();

    // Verstuur de e-mail
    await sendPasswordResetEmail(email, resetToken);

    res.status(200).json({ message: 'Wachtwoordherstel-e-mail verzonden' });
  } catch (err) {
    res.status(500).json({ error: 'Fout bij het aanvragen van wachtwoordherstel', details: err.message });
  }
};

// Nieuwe functie: Wachtwoord resetten
exports.resetPassword = async (req, res) => {
  const { token } = req.params;
  const { newPassword } = req.body;
  try {
    const user = await User.findOne({
      where: {
        resetToken: token,
        resetTokenExpiry: { [sequelize.Op.gt]: Date.now() }, // Controleer of token niet verlopen is
      },
    });

    if (!user) {
      return res.status(400).json({ error: 'Ongeldige of verlopen reset-token' });
    }

    // Update het wachtwoord
    user.password = newPassword; // bcrypt hash wordt automatisch toegepast via model hook
    user.resetToken = null;
    user.resetTokenExpiry = null;
    await user.save();

    res.status(200).json({ message: 'Wachtwoord succesvol gereset' });
  } catch (err) {
    res.status(500).json({ error: 'Fout bij het resetten van wachtwoord', details: err.message });
  }
};