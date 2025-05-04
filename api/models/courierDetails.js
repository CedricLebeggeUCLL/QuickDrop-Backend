const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const CourierDetails = sequelize.define('CourierDetails', {
    user_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
    },
    first_name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    last_name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    birth_date: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    phone_number: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    encrypted_national_number: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    nationality: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    itsme_verified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
  }, {
    tableName: 'courier_details',
    timestamps: false,
  });

  // Definieer associaties
  CourierDetails.associate = (models) => {
    // Relatie met Courier (1:1)
    CourierDetails.belongsTo(models.Courier, { foreignKey: 'user_id', as: 'courier' });
  };

  return CourierDetails;
};