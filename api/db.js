const { Sequelize } = require('sequelize');
require('dotenv').config({ path: '../.env' }); // Specificeer pad naar .env in root van project

const sequelize = new Sequelize(process.env.DB_NAME, process.env.DB_USER, process.env.DB_PASSWORD, {
  host: process.env.DB_HOST,
  dialect: 'mysql',
  logging: false // Gebruik console.log voor logging, or set to false
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

// Synchroniseer de modellen met de database (voor ontwikkeling)
async function syncModels() {
  try {
    await sequelize.sync({ force: true }); // Gebruik force: false in productie
    console.log('Tabellen gesynced.');
  } catch (error) {
    console.error('Fout bij synchroniseren van tabellen:', error);
  }
}

// Roep de test en sync aan wanneer het bestand wordt geladen
testConnection();
syncModels();

// Exporteer de Sequelize instance
module.exports = {
  sequelize,
  testConnection
};