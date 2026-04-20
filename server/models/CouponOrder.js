// server/models/CouponOrder.js — 优惠券订单（海南椰嫂综合平台）
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const CouponOrder = sequelize.define('CouponOrder', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  orderNo: { type: DataTypes.STRING(30), unique: true, allowNull: false },
  userId: { type: DataTypes.INTEGER },
  couponId: { type: DataTypes.INTEGER },
  agencyId: { type: DataTypes.INTEGER },
  verifyCode: { type: DataTypes.STRING(20) },
  status: { type: DataTypes.ENUM('unused', 'used', 'expired', 'cancelled'), defaultValue: 'unused' },
  source: { type: DataTypes.STRING(50), defaultValue: '平台领取' },
  claimDate: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  useDate: { type: DataTypes.DATE },
  expireDate: { type: DataTypes.DATEONLY },
  operatorId: { type: DataTypes.INTEGER },
  // 分享来源追溯
  shareRecordId: { type: DataTypes.INTEGER },
  sharerId: { type: DataTypes.INTEGER },
  // 核销奖励是否已结算（防重复）
  rewardSettled: { type: DataTypes.BOOLEAN, defaultValue: false }
}, { tableName: 'coupon_orders' });

module.exports = CouponOrder;
