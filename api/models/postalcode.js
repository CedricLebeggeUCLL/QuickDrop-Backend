const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
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

  // Definieer associaties
  PostalCode.associate = (models) => {
    PostalCode.hasMany(models.Address, { foreignKey: 'postal_code', sourceKey: 'code', as: 'addresses' });
  };

  return PostalCode;
};