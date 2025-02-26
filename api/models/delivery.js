const { sequelize } = require('../db');
const { DataTypes } = require('sequelize');

const Delivery = sequelize.define('Delivery', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  package_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'packages',
      key: 'id'
    }
  },
  courier_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'couriers',
      key: 'id'
    }
  },
  pickup_time: {
    type: DataTypes.DATE,
    allowNull: true
  },
  delivery_time: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  tableName: 'deliveries',
  timestamps: false
});

module.exports = Delivery;