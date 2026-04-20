// server/models/ServiceOrder.js — 服务订单模型（海南椰嫂综合平台）
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ServiceOrder = sequelize.define('ServiceOrder', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  orderNo: { type: DataTypes.STRING(30), unique: true },       // 自动生成

  userId: { type: DataTypes.INTEGER, allowNull: false },        // 发单人
  jobTypeId: { type: DataTypes.INTEGER, allowNull: false },     // 工种
  // 订单类型：employer=雇主发单, worker=阿姨求职
  type: { type: DataTypes.STRING(20), defaultValue: 'employer' },

  // 订单信息
  serviceDate: { type: DataTypes.DATEONLY },                    // 服务日期
  serviceDuration: { type: DataTypes.STRING(50), defaultValue: '' },  // 时长
  location: { type: DataTypes.STRING(200), defaultValue: '' },         // 详细地点
  city: { type: DataTypes.STRING(50), defaultValue: '' },              // 城市

  // 薪资
  salaryType: { type: DataTypes.ENUM('daily', 'monthly'), defaultValue: 'monthly' },
  salaryMin: { type: DataTypes.INTEGER, defaultValue: 0 },
  salaryMax: { type: DataTypes.INTEGER, defaultValue: 0 },

  // 联系方式（仅后台可见，小程序端脱敏）
  contactName: { type: DataTypes.STRING(50), defaultValue: '' },
  contactPhone: { type: DataTypes.STRING(20), defaultValue: '' },

  // 状态
  status: {
    type: DataTypes.ENUM('pending', 'approved', 'matching', 'matched', 'completed', 'cancelled', 'rejected'),
    defaultValue: 'pending'
  },

  // 确认接单
  acceptedApplicationId: { type: DataTypes.INTEGER },  // 最终确认的接单申请
  acceptedUserId: { type: DataTypes.INTEGER },          // 最终确认的接单阿姨

  remark: { type: DataTypes.TEXT, defaultValue: '' },
  adminNote: { type: DataTypes.TEXT, defaultValue: '' },
  rejectReason: { type: DataTypes.STRING(200), defaultValue: '' },

  // 分享来源
  shareRecordId: { type: DataTypes.INTEGER },
  sharerId: { type: DataTypes.INTEGER },

  // 分享设置
  shareable: { type: DataTypes.BOOLEAN, defaultValue: true }
}, { tableName: 'service_orders' });

module.exports = ServiceOrder;
