const { Sequelize } = require('sequelize');
require('dotenv').config();

const sequelize = new Sequelize(process.env.DB_NAME, process.env.DB_USER, process.env.DB_PASSWORD, {
  host: process.env.DB_HOST,
  dialect: 'mysql',
  logging: false // Zet dit op true als je de SQL queries in de console wilt zien
});

// Test de verbinding
async function testConnection() {
  try {
    await sequelize.authenticate();
    console.log('Verbinding met de database is succesvol tot stand gebracht.');
  } catch (error) {
    console.error('Kan geen verbinding maken met de database:', error);
  }
}

// Exporteer de Sequelize instance
module.exports = {
  sequelize,
  testConnection
};