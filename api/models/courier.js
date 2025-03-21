const { DataTypes } = require('sequelize');
const { sequelize } = require('../db');
const User = require('./user');
const Address = require('./address');

const Courier = sequelize.define('Courier', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    unique: true,
    references: {
      model: User,
      key: 'id',
    },
  },
  current_address_id: {
    type: DataTypes.INTEGER,
    references: {
      model: Address,
      key: 'id',
    },
    allowNull: true,
  },
  start_address_id: {
    type: DataTypes.INTEGER,
    references: {
      model: Address,
      key: 'id',
    },
    allowNull: true,
  },
  destination_address_id: {
    type: DataTypes.INTEGER,
    references: {
      model: Address,
      key: 'id',
    },
    allowNull: true,
  },
  pickup_radius: {
    type: DataTypes.FLOAT,
    defaultValue: 5.0,
  },
  dropoff_radius: {
    type: DataTypes.FLOAT,
    defaultValue: 5.0,
  },
  availability: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  itsme_code: {
    type: DataTypes.STRING(50),
  },
  license_number: {
    type: DataTypes.STRING(50),
  },
  current_lat: {
    type: DataTypes.DECIMAL(10, 7),
    allowNull: true,
  },
  current_lng: {
    type: DataTypes.DECIMAL(10, 7),
    allowNull: true,
  },
}, {
  tableName: 'couriers',
  timestamps: false,
});

Courier.belongsTo(User, { foreignKey: 'user_id' });
Courier.belongsTo(Address, { foreignKey: 'current_address_id', as: 'currentAddress' });
Courier.belongsTo(Address, { foreignKey: 'start_address_id', as: 'startAddress' });
Courier.belongsTo(Address, { foreignKey: 'destination_address_id', as: 'destinationAddress' });

module.exports = Courier;