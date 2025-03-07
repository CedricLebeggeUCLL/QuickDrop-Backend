const { sequelize } = require('../db');
const { DataTypes } = require('sequelize');
const User = require('./user');

const Courier = sequelize.define('Courier', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    unique: true,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  current_location: {
    type: DataTypes.JSON,
    allowNull: true
  },
  destination: {
    type: DataTypes.JSON,
    allowNull: true
  },
  pickup_radius: {
    type: DataTypes.FLOAT,
    defaultValue: 5.0
  },
  dropoff_radius: {
    type: DataTypes.FLOAT,
    defaultValue: 5.0
  },
  availability: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  itsme_code: {
    type: DataTypes.STRING(50),
    allowNull: true // Nullable, maar kan verplicht worden in controller
  },
  license_number: {
    type: DataTypes.STRING(50),
    allowNull: true // Optioneel
  }
}, {
  tableName: 'couriers',
  timestamps: false
});

Courier.belongsTo(User, { foreignKey: 'user_id' });

module.exports = Courier;