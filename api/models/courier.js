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
    type: DataTypes.GEOMETRY('POINT'), // Gebruik GEOMETRY voor POINT (MySQL 5.7+)
    allowNull: true
  },
  destination: {
    type: DataTypes.GEOMETRY('POINT'), // Gebruik GEOMETRY voor POINT
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