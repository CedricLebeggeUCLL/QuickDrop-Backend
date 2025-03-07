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
    defaultValue: { lat: 0, lng: 0 }
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
  }
}, {
  tableName: 'couriers',
  timestamps: false
});

// Define association
Courier.belongsTo(User, { foreignKey: 'user_id' });

module.exports = Courier;