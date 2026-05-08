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

  // 状态流转：pending → approved → assigned → matching → matched → completed
  status: {
    type: DataTypes.STRING(20),
    defaultValue: 'pending'
    // pending=待审核, approved=已审核(公域池), assigned=已分配给销售
    // matching=销售匹配中, matched=已派单, completed=已完成, cancelled=已取消, rejected=已拒绝
  },

  // 分配给销售
  assignedAdminId: { type: DataTypes.INTEGER },   // 分配给哪个销售管理员
  assignedAt: { type: DataTypes.DATE },            // 分配时间

  // 确认接单
  acceptedApplicationId: { type: DataTypes.INTEGER },  // 最终确认的接单申请
  acceptedUserId: { type: DataTypes.INTEGER },          // 最终确认的接单阿姨

  // 实际金额（订单完成时填写，用于业绩统计）
  actualAmount: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
  completedAt: { type: DataTypes.DATE },           // 完成时间

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
