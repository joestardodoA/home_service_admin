// server/models/User.js — 用户模型（海南椰嫂综合平台）
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const User = sequelize.define('User', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  openid: { type: DataTypes.STRING(100), defaultValue: '' },
  unionid: { type: DataTypes.STRING(100), defaultValue: '' },
  nickname: { type: DataTypes.STRING(50), defaultValue: '' },
  avatar: { type: DataTypes.STRING(500), defaultValue: '' },
  phone: { type: DataTypes.STRING(20), defaultValue: '' },
  gender: { type: DataTypes.INTEGER, defaultValue: 0 },
  birthday: { type: DataTypes.DATEONLY },
  city: { type: DataTypes.STRING(50), defaultValue: '' },
  isRealAuth: { type: DataTypes.BOOLEAN, defaultValue: false },
  realName: { type: DataTypes.STRING(50), defaultValue: '' },
  idCard: { type: DataTypes.STRING(50), defaultValue: '' },
  idCardFront: { type: DataTypes.STRING(500), defaultValue: '' },
  idCardBack: { type: DataTypes.STRING(500), defaultValue: '' },
  authStatus: { type: DataTypes.ENUM('none', 'pending', 'approved', 'rejected'), defaultValue: 'none' },
  authRejectReason: { type: DataTypes.STRING(200), defaultValue: '' },
  inviterId: { type: DataTypes.INTEGER },

  // 会员等级（后台设定）
  memberLevel: {
    type: DataTypes.ENUM('normal', 'senior', 'partner'),
    defaultValue: 'normal'
    // normal=普通会员, senior=高级会员, partner=合伙人
  },

  // 推广统计（所有阿姨都有推广能力）
  totalRefer: { type: DataTypes.INTEGER, defaultValue: 0 },
  totalEarning: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
  withdrawnAmount: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
  balance: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },

  // 积分（后台手动增减）
  points: { type: DataTypes.INTEGER, defaultValue: 0 },

  // 意向工种（JSON 数组，用于订单推送匹配）
  preferredJobTypes: {
    type: DataTypes.TEXT,
    defaultValue: '[]',
    get() { try { return JSON.parse(this.getDataValue('preferredJobTypes')); } catch(e) { return []; } },
    set(val) { this.setDataValue('preferredJobTypes', JSON.stringify(val || [])); }
  }
}, { tableName: 'users' });

module.exports = User;
