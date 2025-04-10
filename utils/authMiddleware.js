const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'jouw_geheime_sleutel';

const authMiddleware = (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  if (!token) {
    console.error('Geen token meegegeven');
    return res.status(401).json({ error: 'Toegang geweigerd', details: 'Geen token meegegeven' });
  }

  try {
    const verified = jwt.verify(token, JWT_SECRET);
    req.user = verified;
    next();
  } catch (err) {
    console.error('Token verificatie mislukt:', err.message);
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token verlopen', details: 'De access token is verlopen, gebruik een refresh token' });
    } else if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Ongeldig token', details: err.message });
    } else {
      return res.status(401).json({ error: 'Authenticatie mislukt', details: err.message });
    }
  }
};

module.exports = authMiddleware;