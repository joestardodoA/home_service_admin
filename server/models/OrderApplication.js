// server/models/OrderApplication.js — 接单申请模型（海南椰嫂综合平台）
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const OrderApplication = sequelize.define('OrderApplication', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  orderId: { type: DataTypes.INTEGER, allowNull: false },       // 服务订单 ID
  userId: { type: DataTypes.INTEGER, allowNull: false },        // 申请人（阿姨）

  status: {
    type: DataTypes.ENUM('pending', 'accepted', 'rejected', 'cancelled'),
    defaultValue: 'pending'
  },
  message: { type: DataTypes.TEXT, defaultValue: '' },          // 申请留言
  adminNote: { type: DataTypes.TEXT, defaultValue: '' },
  processedAt: { type: DataTypes.DATE },

  // 分享来源
  shareRecordId: { type: DataTypes.INTEGER },
  sharerId: { type: DataTypes.INTEGER }
}, { tableName: 'order_applications' });

module.exports = OrderApplication;
