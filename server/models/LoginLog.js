// server/models/LoginLog.js — 登录日志模型
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const LoginLog = sequelize.define('LoginLog', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  adminId: { type: DataTypes.INTEGER, allowNull: true, comment: '管理员ID（登录成功时记录）' },
  username: { type: DataTypes.STRING(50), allowNull: false, comment: '登录用户名' },
  ip: { type: DataTypes.STRING(50), defaultValue: '', comment: '登录IP' },
  userAgent: { type: DataTypes.STRING(500), defaultValue: '', comment: '浏览器UA' },
  status: { type: DataTypes.ENUM('success', 'fail'), defaultValue: 'fail', comment: '登录状态' },
  message: { type: DataTypes.STRING(200), defaultValue: '', comment: '提示信息' }
}, {
  tableName: 'login_logs',
  updatedAt: false // 登录日志不需要 updatedAt
});

module.exports = LoginLog;
