const { DataTypes, Sequelize } = require('sequelize');

module.exports = (sequelize) => {
  const Package = sequelize.define('Package', {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
    },
    pickup_address_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    dropoff_address_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
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

  // Definieer associaties
  Package.associate = (models) => {
    Package.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
    Package.belongsTo(models.Address, { foreignKey: 'pickup_address_id', as: 'pickupAddress' });
    Package.belongsTo(models.Address, { foreignKey: 'dropoff_address_id', as: 'dropoffAddress' });
    Package.hasOne(models.Delivery, { foreignKey: 'package_id', as: 'delivery' });
  };

  return Package;
};