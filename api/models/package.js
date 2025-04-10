const { Sequelize, DataTypes } = require('sequelize');
const { sequelize } = require('../db');
const User = require('./user');
const Address = require('./address');

const Package = sequelize.define('Package', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: User,
      key: 'id',
    },
  },
  description: {
    type: DataTypes.TEXT,
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
  action_type: {
    type: DataTypes.ENUM('send', 'receive'),
    allowNull: false,
  },
  category: {
    type: DataTypes.ENUM('package', 'food', 'drink'),
    defaultValue: 'package',
  },
  size: {
    type: DataTypes.ENUM('small', 'medium', 'large'),
    defaultValue: 'medium',
  },
  status: {
    type: DataTypes.ENUM('pending', 'assigned', 'in_transit', 'delivered'),
    defaultValue: 'pending',
  },
  created_at: {
    type: DataTypes.DATE,
    defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
  },
}, {
  tableName: 'packages',
  timestamps: false,
});

Package.belongsTo(User, { foreignKey: 'user_id' });
Package.belongsTo(Address, { foreignKey: 'pickup_address_id', as: 'pickupAddress' });
Package.belongsTo(Address, { foreignKey: 'dropoff_address_id', as: 'dropoffAddress' });

module.exports = Package;