// server/models/OperationLog.js — 操作日志模型
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const OperationLog = sequelize.define('OperationLog', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  adminId: { type: DataTypes.INTEGER },
  adminName: { type: DataTypes.STRING(50), defaultValue: '' },
  module: { type: DataTypes.STRING(50), defaultValue: '' },
  action: { type: DataTypes.STRING(50), defaultValue: '' },
  targetType: { type: DataTypes.STRING(50), defaultValue: '' },
  targetId: { type: DataTypes.INTEGER },
  detail: { type: DataTypes.TEXT, defaultValue: '' },
  ip: { type: DataTypes.STRING(45), defaultValue: '' }
}, { tableName: 'operation_logs', updatedAt: false });

module.exports = OperationLog;
