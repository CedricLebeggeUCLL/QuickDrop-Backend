const { Sequelize, DataTypes } = require('sequelize');
const { sequelize } = require('../db');
const PostalCode = require('./postalcode');

const Address = sequelize.define('Address', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  street_name: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  house_number: {
    type: DataTypes.STRING(10),
    allowNull: false,
  },
  extra_info: {
    type: DataTypes.STRING(100),
  },
  postal_code: {
    type: DataTypes.STRING(20),
    allowNull: false,
  },
  lat: {
    type: DataTypes.FLOAT,
  },
  lng: {
    type: DataTypes.FLOAT,
  },
}, {
  tableName: 'addresses',
  timestamps: false,
});

// Definieer de relatie met PostalCode
Address.belongsTo(PostalCode, { foreignKey: 'postal_code', targetKey: 'code', as: 'postalCodeDetails' });

module.exports = Address;