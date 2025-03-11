const { sequelize } = require('../db');
const { DataTypes } = require('sequelize');
const User = require('./user');

const Package = sequelize.define('Package', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  description: {
    type: DataTypes.TEXT
  },
  pickup_location: {
    type: DataTypes.JSON,
    allowNull: false
  },
  dropoff_location: {
    type: DataTypes.JSON,
    allowNull: false
  },
  pickup_address: {
    type: DataTypes.STRING(255)
  },
  dropoff_address: {
    type: DataTypes.STRING(255)
  },
  status: {
    type: DataTypes.ENUM('pending', 'assigned', 'in_transit', 'delivered'),
    defaultValue: 'pending'
  }
}, {
  tableName: 'packages',
  timestamps: false
});

// Define association
Package.belongsTo(User, { foreignKey: 'user_id' });

module.exports = Package;