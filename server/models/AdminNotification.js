// server/models/AdminNotification.js — 后台管理员通知模型
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const AdminNotification = sequelize.define('AdminNotification', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  adminId: { type: DataTypes.INTEGER, allowNull: false },   // 目标管理员
  type: {
    type: DataTypes.STRING(30),
    defaultValue: 'system'
    // new_order=新订单, new_application=新接单申请, order_assigned=订单被分配, order_update=订单状态变更, system=系统通知
  },
  title: { type: DataTypes.STRING(100), defaultValue: '' },
  content: { type: DataTypes.TEXT, defaultValue: '' },
  linkType: { type: DataTypes.STRING(30), defaultValue: '' },  // service_order / coupon_order
  linkId: { type: DataTypes.INTEGER },
  isRead: { type: DataTypes.BOOLEAN, defaultValue: false },
  readAt: { type: DataTypes.DATE }
}, { tableName: 'admin_notifications' });

module.exports = AdminNotification;
