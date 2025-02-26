const { sequelize } = require('../db');
const { DataTypes } = require('sequelize');

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
    type: DataTypes.JSON, // Sla op als array [latitude, longitude], bijv. [50.8503, 4.3517]
    allowNull: true
  },
  destination: {
    type: DataTypes.JSON, // Sla op als array [latitude, longitude]
    allowNull: true
  },
  availability: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  }
}, {
  tableName: 'couriers',
  timestamps: false
});

module.exports = Courier;