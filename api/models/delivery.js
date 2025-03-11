const { sequelize } = require('../db');
const { DataTypes } = require('sequelize');
const Package = require('./package');
const Courier = require('./courier');

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
  pickup_location: {
    type: DataTypes.JSON,
    allowNull: false
  },
  dropoff_location: {
    type: DataTypes.JSON,
    allowNull: false
  },
  pickup_time: {
    type: DataTypes.DATE,
    allowNull: true
  },
  delivery_time: {
    type: DataTypes.DATE,
    allowNull: true
  },
  status: {
    type: DataTypes.ENUM('assigned', 'picked_up', 'delivered'),
    allowNull: false,
    defaultValue: 'assigned'
  }
}, {
  tableName: 'deliveries',
  timestamps: false
});

// Define associations
Delivery.belongsTo(Package, { foreignKey: 'package_id' });
Delivery.belongsTo(Courier, { foreignKey: 'courier_id' });

module.exports = Delivery;