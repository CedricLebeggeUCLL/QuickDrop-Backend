const express = require('express');
const router = express.Router();

// Simuleer itsme autorisatie-URL (opent een eenvoudige inlogpagina)
router.get('/authorize', (req, res) => {
  const { client_id, redirect_uri, state, scope } = req.query;
  if (!client_id || !redirect_uri) {
    return res.status(400).json({ error: 'Missing client_id or redirect_uri' });
  }
  // Simuleer een inlogpagina (voor prototype, direct redirect)
  const mockCode = 'mock_auth_code_123';
  const redirectUrl = `${redirect_uri}?code=${mockCode}&state=${state || ''}`;
  console.log(`Redirecting to: ${redirectUrl}`);
  res.redirect(redirectUrl);
});

// Simuleer itsme token endpoint
router.post('/token', (req, res) => {
  const { grant_type, code, client_id, client_secret, redirect_uri } = req.body;
  if (grant_type !== 'authorization_code' || !code || !client_id || !client_secret) {
    return res.status(400).json({ error: 'Invalid request' });
  }
  // Simuleer token response
  console.log('Token request received:', { code, client_id });
  res.json({
    access_token: 'mock_access_token_456',
    token_type: 'Bearer',
    expires_in: 3600,
  });
});

// Simuleer itsme userinfo endpoint
router.get('/userinfo', (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer mock_access_token_456')) {
    return res.status(401).json({ error: 'Invalid or missing token' });
  }
  // Simuleer gebruikersgegevens
  console.log('Userinfo request received');
  res.json({
    sub: 'mock_user_789',
    name: 'Mock User',
    email: 'mock.user@example.com',
    phone_number: '+32412345678',
  });
});

module.exports = router;