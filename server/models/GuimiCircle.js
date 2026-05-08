// server/models/GuimiCircle.js — 闺蜜圈模型（海南椰嫂综合平台）
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const GuimiCircle = sequelize.define('GuimiCircle', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },

  // 圈主用户 ID
  ownerId: { type: DataTypes.INTEGER, allowNull: false },

  // 绑定工种 ID
  jobTypeId: { type: DataTypes.INTEGER, allowNull: false },

  // 圈名（可修改，默认"{昵称}的{工种}闺蜜圈"）
  name: { type: DataTypes.STRING(50), allowNull: false },

  // 永久邀请标识（用于链接分享和二维码，不过期）
  inviteCode: { type: DataTypes.STRING(10), unique: true, allowNull: false },

  // 成员统计
  memberCount: { type: DataTypes.INTEGER, defaultValue: 1 },
  maxMembers: { type: DataTypes.INTEGER, defaultValue: 1000 },

  // 状态
  status: {
    type: DataTypes.ENUM('active', 'disbanded'),
    defaultValue: 'active'
  }
}, {
  tableName: 'guimi_circles',
  indexes: [
    // 每人每工种只能创建一个圈子
    { unique: true, fields: ['ownerId', 'jobTypeId'], where: { status: 'active' } }
  ]
});

module.exports = GuimiCircle;
