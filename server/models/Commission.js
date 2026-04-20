// server/models/Commission.js — 佣金明细模型（海南椰嫂综合平台）
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Commission = sequelize.define('Commission', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  // 推广人（阿姨）— 原 recommenderId 改为 userId
  userId: { type: DataTypes.INTEGER, allowNull: false },
  // 被推荐人
  referUserId: { type: DataTypes.INTEGER },
  // 关联的优惠券订单（核销时触发）
  couponOrderId: { type: DataTypes.INTEGER },
  // 关联的服务订单（接单成功时触发）
  serviceOrderId: { type: DataTypes.INTEGER },
  // 佣金来源
  source: {
    type: DataTypes.ENUM('coupon_share', 'order_accept', 'invite'),
    defaultValue: 'invite'
  },
  amount: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
  status: { type: DataTypes.ENUM('pending', 'settled', 'withdrawn'), defaultValue: 'pending' },
  settledAt: { type: DataTypes.DATE },
  remark: { type: DataTypes.STRING(200), defaultValue: '' }
}, { tableName: 'commissions' });

module.exports = Commission;
