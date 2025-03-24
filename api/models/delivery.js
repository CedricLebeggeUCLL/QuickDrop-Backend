const { DataTypes } = require('sequelize');
const { sequelize } = require('../db');
const Package = require('./package');
const Courier = require('./courier');
const Address = require('./address');

const Delivery = sequelize.define('Delivery', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  package_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: Package,
      key: 'id',
    },
  },
  courier_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: Courier,
      key: 'id',
    },
  },
  pickup_address_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: Address,
      key: 'id',
    },
  },
  dropoff_address_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: Address,
      key: 'id',
    },
  },
  pickup_time: {
    type: DataTypes.DATE,
  },
  delivery_time: {
    type: DataTypes.DATE,
  },
  status: {
    type: DataTypes.ENUM('assigned', 'picked_up', 'delivered'),
    defaultValue: 'assigned',
  },
}, {
  tableName: 'deliveries',
  timestamps: false,
});

Delivery.belongsTo(Package, { foreignKey: 'package_id' });
Delivery.belongsTo(Courier, { foreignKey: 'courier_id' });
Delivery.belongsTo(Address, { foreignKey: 'pickup_address_id', as: 'pickupAddress' });
Delivery.belongsTo(Address, { foreignKey: 'dropoff_address_id', as: 'dropoffAddress' });

module.exports = Delivery;