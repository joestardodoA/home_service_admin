// server/models/Message.js — 站内消息模型（海南椰嫂综合平台）
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Message = sequelize.define('Message', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  userId: { type: DataTypes.INTEGER, allowNull: false },

  type: {
    type: DataTypes.ENUM(
      'order_match',     // 订单匹配通知
      'order_status',    // 订单状态变更
      'order_accepted',  // 你的接单申请被接受
      'order_rejected',  // 你的接单申请被拒绝
      'coupon_reward',   // 优惠券分享奖励
      'points_reward',   // 积分奖励通知
      'system'           // 系统通知
    ),
    defaultValue: 'system'
  },
  title: { type: DataTypes.STRING(100), defaultValue: '' },
  content: { type: DataTypes.TEXT, defaultValue: '' },

  // 跳转
  linkType: { type: DataTypes.STRING(20), defaultValue: '' },  // service_order / coupon / points
  linkId: { type: DataTypes.INTEGER },

  isRead: { type: DataTypes.BOOLEAN, defaultValue: false },
  readAt: { type: DataTypes.DATE }
}, { tableName: 'messages' });

module.exports = Message;
