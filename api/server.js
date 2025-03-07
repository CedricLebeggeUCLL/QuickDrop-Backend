const express = require('express');
const dotenv = require('dotenv');
const { sequelize, testConnection } = require('./db');

dotenv.config({ path: '../.env' });

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
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

app.listen(port, '0.0.0.0', () => {
  console.log(`Server luistert op poort ${port}`);
});