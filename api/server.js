const express = require('express');
const dotenv = require('dotenv');
const { sequelize, testConnection } = require('./db');
const cors = require('cors');
const authMiddleware = require('../utils/authMiddleware');

dotenv.config({ path: '../.env' });

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(cors());
app.use(express.urlencoded({ extended: true })); // Voor form-encoded data (itsme token endpoint)

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Fout opgetreden:', err.stack);
  res.status(500).json({ error: 'Something went wrong!', details: err.message });
});

// Mount routes
const userRoutes = require('./routes/userRoutes');
const packageRoutes = require('./routes/packageRoutes');
const courierRoutes = require('./routes/courierRoutes');
const deliveryRoutes = require('./routes/deliveryRoutes');
const addressRoutes = require('./routes/addressRoutes');
const mockItsmeRoutes = require('./routes/mockItsme'); // Nieuwe mock itsme routes

app.use('/api/users', userRoutes);
app.use('/api/packages', authMiddleware, packageRoutes); // Beschermde route
app.use('/api/couriers', authMiddleware, courierRoutes); // Beschermde route
app.use('/api/deliveries', authMiddleware, deliveryRoutes); // Beschermde route
app.use('/api/addresses', authMiddleware, addressRoutes); // Beschermde route
app.use('/itsme/mock', mockItsmeRoutes); // Mock itsme endpoints

// Start server
app.listen(port, '0.0.0.0', async () => {
  console.log(`Server luistert op poort ${port}`);
  try {
    await testConnection();
    console.log('Databaseverbinding succesvol');
  } catch (err) {
    console.error('Databaseverbinding mislukt:', err);
  }
});