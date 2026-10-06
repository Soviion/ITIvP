'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class User extends Model {
    // Служебные и секретные поля никогда не попадают в JSON-ответы API
    toJSON() {
      const {
        passwordHash,
        emailVerificationTokenHash,
        emailVerificationExpires,
        twoFactorSecret,
        twoFactorLastStep,
        tokenVersion,
        ...publicFields
      } = super.toJSON();
      return publicFields;
    }
  }

  User.init({
    email: {
      type: DataTypes.STRING(120),
      allowNull: false,
      unique: true,
      set(value) {
        this.setDataValue('email', typeof value === 'string' ? value.trim().toLowerCase() : value);
      },
      validate: {
        notNull: { msg: 'Поле «E-mail» обязательно' },
        isEmail: { msg: 'Некорректный e-mail' },
        len: { args: [3, 120], msg: 'Поле «E-mail» должно содержать не более 120 символов' },
      },
    },
    passwordHash: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    isVerified: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    emailVerificationTokenHash: DataTypes.STRING(64),
    emailVerificationExpires: DataTypes.DATE,
    twoFactorEnabled: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    twoFactorSecret: DataTypes.TEXT,
    twoFactorLastStep: DataTypes.INTEGER,
    tokenVersion: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
  }, {
    sequelize,
    modelName: 'User',
    tableName: 'users',
    underscored: true,
  });

  return User;
};
