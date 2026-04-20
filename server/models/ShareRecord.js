// server/models/ShareRecord.js — 分享记录模型（海南椰嫂综合平台）
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ShareRecord = sequelize.define('ShareRecord', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },

  // 分享人
  sharerId: { type: DataTypes.INTEGER, allowNull: false },

  // 分享类型 & 目标
  shareType: {
    type: DataTypes.ENUM('coupon', 'service_order', 'invite', 'article'),
    allowNull: false
  },
  targetId: { type: DataTypes.INTEGER },  // 分享目标的 ID（couponId / orderId 等）

  // 分享码（唯一标识，用于追溯）
  shareCode: { type: DataTypes.STRING(32), unique: true },

  // 统计
  viewCount: { type: DataTypes.INTEGER, defaultValue: 0 },     // 被查看次数
  claimCount: { type: DataTypes.INTEGER, defaultValue: 0 },    // 被领取/接单次数

  // 被分享人（触达后回填）
  receiverIds: { type: DataTypes.TEXT, defaultValue: '[]' }     // JSON 数组
}, { tableName: 'share_records' });

module.exports = ShareRecord;
