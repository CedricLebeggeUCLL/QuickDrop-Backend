const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Delivery = sequelize.define('Delivery', {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    package_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    courier_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    pickup_address_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    dropoff_address_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
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

  // Definieer associaties
  Delivery.associate = (models) => {
    Delivery.belongsTo(models.Package, { foreignKey: 'package_id', as: 'package' });
    Delivery.belongsTo(models.Courier, { foreignKey: 'courier_id', as: 'courier' });
    Delivery.belongsTo(models.Address, { foreignKey: 'pickup_address_id', as: 'pickupAddress' });
    Delivery.belongsTo(models.Address, { foreignKey: 'dropoff_address_id', as: 'dropoffAddress' });
  };

  return Delivery;
};