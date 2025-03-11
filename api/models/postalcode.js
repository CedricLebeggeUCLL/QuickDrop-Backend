const { DataTypes } = require('sequelize');
const { sequelize } = require('../db');

const PostalCode = sequelize.define('PostalCode', {
  code: {
    type: DataTypes.STRING(20),
    primaryKey: true,
  },
  city: {
    type: DataTypes.STRING(50),
    allowNull: false,
  },
  country: {
    type: DataTypes.STRING(50),
    allowNull: false,
  },
}, {
  tableName: 'postal_codes',
  timestamps: false,
});

module.exports = PostalCode;