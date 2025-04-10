const { sequelize } = require('../db');
const { Sequelize } = require('sequelize');
const Op = Sequelize.Op;
const User = require('../models/user');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { sendPasswordResetEmail } = require('../../utils/emailService');

const JWT_SECRET = process.env.JWT_SECRET || 'jouw_geheime_sleutel';
const REFRESH_TOKEN_EXPIRY = 7 * 24 * 60 * 60 * 1000; // 7 dagen in milliseconden

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

    const accessToken = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '1h' });
    const refreshToken = crypto.randomBytes(32).toString('hex');
    user.refreshToken = refreshToken;
    user.refreshTokenExpiry = new Date(Date.now() + REFRESH_TOKEN_EXPIRY);
    await user.save();

    res.status(200).json({ userId: user.id, accessToken, refreshToken });
  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({ error: 'Fout bij login', details: err.message });
  }
};

exports.refreshToken = async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
      console.log('Geen refresh token meegegeven');
      return res.status(401).json({ error: 'Refresh token vereist' });
  }

  try {
      console.log('Ontvangen refreshToken:', refreshToken);
      const user = await User.findOne({
          where: {
              refreshToken,
              refreshTokenExpiry: { [Op.gt]: new Date() }
          }
      });
      if (!user) {
          console.log('Geen gebruiker gevonden met deze refresh token of token verlopen');
          return res.status(403).json({ error: 'Ongeldig of verlopen refresh token' });
      }

      const accessToken = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '1h' });
      const newRefreshToken = crypto.randomBytes(32).toString('hex');
      user.refreshToken = newRefreshToken;
      user.refreshTokenExpiry = new Date(Date.now() + REFRESH_TOKEN_EXPIRY);
      await user.save();

      const response = { accessToken, refreshToken: newRefreshToken };
      console.log('Refresh token response:', response);
      res.status(200).json(response);
  } catch (err) {
      console.error('Refresh token error:', err.message);
      res.status(500).json({ error: 'Fout bij het vernieuwen van token', details: err.message });
  }
};

exports.forgotPassword = async (req, res) => {
  const { email } = req.body;
  try {
    const user = await User.findOne({ where: { email } });
    if (!user) {
      return res.status(404).json({ error: 'Geen gebruiker gevonden met dit e-mailadres' });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 uur
    user.resetToken = resetToken;
    user.resetTokenExpiry = resetTokenExpiry;
    await user.save();

    await sendPasswordResetEmail(email, resetToken);
    res.status(200).json({ message: 'Wachtwoordherstel-e-mail verzonden' });
  } catch (err) {
    res.status(500).json({ error: 'Fout bij het aanvragen van wachtwoordherstel', details: err.message });
  }
};

exports.resetPassword = async (req, res) => {
  const { token } = req.params;
  const { newPassword } = req.body;
  try {
    const user = await User.findOne({
      where: {
        resetToken: token,
        resetTokenExpiry: { [Op.gt]: new Date() }
      }
    });

    if (!user) {
      return res.status(400).json({ error: 'Ongeldige of verlopen reset-token' });
    }

    user.password = newPassword;
    user.resetToken = null;
    user.resetTokenExpiry = null;
    await user.save();

    res.status(200).json({ message: 'Wachtwoord succesvol gereset' });
  } catch (err) {
    res.status(500).json({ error: 'Fout bij het resetten van wachtwoord', details: err.message });
  }
};