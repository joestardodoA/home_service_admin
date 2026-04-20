// server/models/SubscriptionSetting.js — 订阅推送设置模型（海南椰嫂综合平台）
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const SubscriptionSetting = sequelize.define('SubscriptionSetting', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  userId: { type: DataTypes.INTEGER, allowNull: false, unique: true },

  // 推送开关
  enabled: { type: DataTypes.BOOLEAN, defaultValue: true },

  // 推送频率
  frequency: {
    type: DataTypes.ENUM('realtime', 'daily', 'weekly', 'monthly'),
    defaultValue: 'daily'
  },

  // 关注的工种（JSON 数组）
  jobTypeIds: { type: DataTypes.TEXT, defaultValue: '[]' },

  // 最后推送时间
  lastPushAt: { type: DataTypes.DATE }
}, { tableName: 'subscription_settings' });

module.exports = SubscriptionSetting;
