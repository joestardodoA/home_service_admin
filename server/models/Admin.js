// server/models/Admin.js — 管理员模型（海南椰嫂综合平台）
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Admin = sequelize.define('Admin', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  username: { type: DataTypes.STRING(50), allowNull: false, unique: true },
  password: { type: DataTypes.STRING(255), allowNull: false },
  realName: { type: DataTypes.STRING(50), defaultValue: '' },
  role: { type: DataTypes.ENUM('super', 'operator', 'auditor'), defaultValue: 'operator' },
  status: { type: DataTypes.ENUM('active', 'disabled'), defaultValue: 'active' },
  // 细粒度权限（JSON 数组，super 角色拥有所有权限）
  permissions: { type: DataTypes.TEXT, defaultValue: '[]' },
  lastLoginAt: { type: DataTypes.DATE }
}, { tableName: 'admins' });

module.exports = Admin;
