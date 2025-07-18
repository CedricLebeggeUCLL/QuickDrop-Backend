const { DataTypes } = require('sequelize');
const bcrypt = require('bcryptjs');

module.exports = (sequelize) => {
  const User = sequelize.define('User', {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    username: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true
    },
    email: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true
    },
    password: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    role: {
      type: DataTypes.ENUM('user', 'courier', 'admin'),
      defaultValue: 'user'
    },
    refreshToken: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    refreshTokenExpiry: {
      type: DataTypes.DATE,
      allowNull: true
    },
    resetToken: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    resetTokenExpiry: {
      type: DataTypes.DATE,
      allowNull: true
    }
  }, {
    tableName: 'users',
    timestamps: false,
    hooks: {
      beforeCreate: async (user) => {
        user.password = await bcrypt.hash(user.password, 10);
      },
      beforeUpdate: async (user) => {
        if (user.changed('password')) {
          user.password = await bcrypt.hash(user.password, 10);
        }
      }
    }
  });

  // Definieer associaties
  User.associate = (models) => {
    // Een User heeft één Courier
    User.hasOne(models.Courier, { foreignKey: 'user_id', as: 'courier' });
  };

  return User;
};