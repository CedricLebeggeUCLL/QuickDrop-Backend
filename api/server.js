const express = require('express');
const dotenv = require('dotenv');
const { sequelize, testConnection } = require('./db');

dotenv.config({ path: '../.env' }); // Specificeer pad naar .env in root of project

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

// Voeg routes toe (testConnection() wordt al aangeroepen in db.js)
const userRoutes = require('./routes/userRoutes');
const packageRoutes = require('./routes/packageRoutes');
const courierRoutes = require('./routes/courierRoutes');
const deliveryRoutes = require('./routes/deliveryRoutes');

app.use('/api/users', userRoutes);
app.use('/api/packages', packageRoutes);
app.use('/api/couriers', courierRoutes);
app.use('/api/deliveries', deliveryRoutes);

app.listen(port, '0.0.0.0', () => { // Luister op 0.0.0.0 voor toegang vanuit netwerk/emulator
  console.log(`Server luistert op poort ${port}`);
});