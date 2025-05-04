const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Courier = sequelize.define('Courier', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    start_address_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    destination_address_id: {
      type: DataTypes.INTEGER,
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
    current_lat: {
      type: DataTypes.DOUBLE,
      allowNull: true,
    },
    current_lng: {
      type: DataTypes.DOUBLE,
      allowNull: true,
    },
  }, {
    tableName: 'couriers',
    timestamps: false,
  });

  // Definieer associaties
  Courier.associate = (models) => {
    // Relatie met Address (startAddress en destinationAddress)
    Courier.belongsTo(models.Address, { foreignKey: 'start_address_id', as: 'startAddress' });
    Courier.belongsTo(models.Address, { foreignKey: 'destination_address_id', as: 'destinationAddress' });

    // Relatie met User
    Courier.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });

    // Relatie met CourierDetails (1:1)
    Courier.hasOne(models.CourierDetails, { foreignKey: 'user_id', as: 'details' });

    // Relatie met Delivery
    Courier.hasMany(models.Delivery, { foreignKey: 'courier_id', as: 'deliveries' });
  };

  return Courier;
};