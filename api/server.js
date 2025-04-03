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

app.use('/api/users', userRoutes);
app.use('/api/packages', authMiddleware, packageRoutes); // Beschermde route
app.use('/api/couriers', authMiddleware, courierRoutes); // Beschermde route
app.use('/api/deliveries', authMiddleware, deliveryRoutes); // Beschermde route
app.use('/api/addresses', authMiddleware, addressRoutes); // Nu ook beschermd

app.listen(port, '0.0.0.0', () => {
  console.log(`Server luistert op poort ${port}`);
});