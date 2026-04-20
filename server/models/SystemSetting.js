// server/models/SystemSetting.js — 系统配置模型（海南椰嫂综合平台）
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const SystemSetting = sequelize.define('SystemSetting', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  key: { type: DataTypes.STRING(50), unique: true, allowNull: false },   // 配置键
  value: { type: DataTypes.TEXT, defaultValue: '' },                     // 配置值
  label: { type: DataTypes.STRING(100), defaultValue: '' },              // 中文说明
  group: { type: DataTypes.STRING(50), defaultValue: 'general' }         // 分组
}, { tableName: 'system_settings' });

module.exports = SystemSetting;
