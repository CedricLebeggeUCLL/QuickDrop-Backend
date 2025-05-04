const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
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
      type: DataTypes.STRING(10),
      allowNull: false,
    },
    extra_info: {
      type: DataTypes.STRING(100),
    },
    postal_code: {
      type: DataTypes.STRING(20),
      allowNull: false,
    },
    lat: {
      type: DataTypes.FLOAT,
    },
    lng: {
      type: DataTypes.FLOAT,
    },
  }, {
    tableName: 'addresses',
    timestamps: false,
  });

  // Definieer de relatie met PostalCode
  Address.associate = (models) => {
    Address.belongsTo(models.PostalCode, { foreignKey: 'postal_code', targetKey: 'code', as: 'postalCodeDetails' });
    // Andere relaties
    Address.hasMany(models.Courier, { foreignKey: 'start_address_id', as: 'startCouriers' });
    Address.hasMany(models.Courier, { foreignKey: 'destination_address_id', as: 'destinationCouriers' });
    Address.hasMany(models.Package, { foreignKey: 'pickup_address_id', as: 'pickupPackages' });
    Address.hasMany(models.Package, { foreignKey: 'dropoff_address_id', as: 'dropoffPackages' });
  };

  return Address;
};