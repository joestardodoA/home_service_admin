// server/models/GuimiInviteCode.js — 闺蜜圈临时邀请码（5分钟有效）
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const GuimiInviteCode = sequelize.define('GuimiInviteCode', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },

  // 关联圈子
  circleId: { type: DataTypes.INTEGER, allowNull: false },

  // 6位字母数字混合码
  code: { type: DataTypes.STRING(6), unique: true, allowNull: false },

  // 过期时间（生成时 + 5分钟）
  expireAt: { type: DataTypes.DATE, allowNull: false },

  // 使用状态
  used: { type: DataTypes.BOOLEAN, defaultValue: false },
  usedBy: { type: DataTypes.INTEGER },    // 使用者 userId
  usedAt: { type: DataTypes.DATE }        // 使用时间
}, {
  tableName: 'guimi_invite_codes'
});

module.exports = GuimiInviteCode;
