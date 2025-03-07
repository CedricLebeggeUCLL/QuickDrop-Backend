const express = require('express');
const dotenv = require('dotenv');
const { sequelize, testConnection } = require('./db');
const cors = require('cors'); // Voeg CORS toe

dotenv.config({ path: '../.env' });

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(cors()); // Sta CORS toe voor alle origins (pas aan voor productie)

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

app.use('/api/users', userRoutes);
app.use('/api/packages', packageRoutes);
app.use('/api/couriers', courierRoutes);
app.use('/api/deliveries', deliveryRoutes);

// Start de server
app.listen(port, '0.0.0.0', () => {
  console.log(`Server luistert op poort ${port}`);
});