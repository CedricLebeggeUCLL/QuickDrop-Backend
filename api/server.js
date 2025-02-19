const express = require('express');
const dotenv = require('dotenv');
const { sequelize, testConnection } = require('./db');

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

// Test de database connectie wanneer de server start
testConnection();

// Hier kun je je routes toevoegen
// Bijvoorbeeld:
// const userRoutes = require('./routes/userRoutes');
// app.use('/api/users', userRoutes);

app.listen(port, () => {
  console.log(`Server luistert op poort ${port}`);
});