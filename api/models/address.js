const { DataTypes } = require('sequelize');
const { sequelize } = require('../db');
const PostalCode = require('./postalcode');

const Address = sequelize.define('Address', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  street_name: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  house_number: {
    type: DataTypes.STRING(20),
    allowNull: false,
  },
  extra_info: {
    type: DataTypes.STRING(50), // Optioneel veld voor appartementnr/bus
  },
  postal_code: {
    type: DataTypes.STRING(20),
    allowNull: false,
    references: {
      model: PostalCode,
      key: 'code',
    },
  },
}, {
  tableName: 'addresses',
  timestamps: false,
});

Address.belongsTo(PostalCode, { foreignKey: 'postal_code' });

module.exports = Address;