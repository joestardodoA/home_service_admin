// server/models/GuimiCircleMember.js — 闺蜜圈成员模型（海南椰嫂综合平台）
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const GuimiCircleMember = sequelize.define('GuimiCircleMember', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },

  // 所属圈子
  circleId: { type: DataTypes.INTEGER, allowNull: false },

  // 用户 ID
  userId: { type: DataTypes.INTEGER, allowNull: false },

  // 角色
  role: {
    type: DataTypes.ENUM('owner', 'member'),
    defaultValue: 'member'
  },

  // 成员状态（审批制 + 退出冷静期）
  status: {
    type: DataTypes.ENUM('pending', 'active', 'leaving', 'left', 'rejected'),
    defaultValue: 'pending',
    comment: 'pending=待审批, active=正式成员, leaving=退出冷静期, left=已退出, rejected=审批拒绝'
  },

  // 申请加入时的留言
  applyMessage: { type: DataTypes.STRING(200), defaultValue: '' },

  // 申请退出时间（用于计算 7 天冷静期）
  leaveRequestAt: { type: DataTypes.DATE, allowNull: true },

  // 加入时间（审批通过时设置）
  joinedAt: { type: DataTypes.DATE, allowNull: true }
}, {
  tableName: 'guimi_circle_members',
  indexes: [
    // 同一用户不能在同一圈子有多条 active 记录
    { unique: true, fields: ['circleId', 'userId'] }
  ]
});

module.exports = GuimiCircleMember;
