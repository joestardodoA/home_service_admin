// server/models/Admin.js — 管理员模型（海南椰嫂综合平台）
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Admin = sequelize.define('Admin', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  username: { type: DataTypes.STRING(50), allowNull: false, unique: true },
  password: { type: DataTypes.STRING(255), allowNull: false },
  realName: { type: DataTypes.STRING(50), defaultValue: '' },
  // 角色：super 为内置超管（拥有所有权限），其余由超管自定义（如 销售总监、销售、审核员、运营 等）
  role: { type: DataTypes.STRING(50), defaultValue: '运营' },
  status: { type: DataTypes.ENUM('active', 'disabled'), defaultValue: 'active' },
  // 细粒度权限（JSON 数组），super 角色自动拥有所有权限
  permissions: {
    type: DataTypes.TEXT,
    defaultValue: '[]',
    get() { try { return JSON.parse(this.getDataValue('permissions')); } catch(e) { return []; } },
    set(val) { this.setDataValue('permissions', JSON.stringify(val || [])); }
  },
  lastLoginAt: { type: DataTypes.DATE }
}, { tableName: 'admins' });

module.exports = Admin;
