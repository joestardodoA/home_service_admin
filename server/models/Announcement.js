// server/models/Announcement.js — 内部公告模型
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Announcement = sequelize.define('Announcement', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  title: { type: DataTypes.STRING(200), allowNull: false, comment: '公告标题' },
  content: { type: DataTypes.TEXT, allowNull: false, comment: '公告内容' },
  type: { type: DataTypes.ENUM('notice', 'announcement', 'urgent'), defaultValue: 'notice', comment: '类型：通知/公告/紧急' },
  status: { type: DataTypes.ENUM('draft', 'published'), defaultValue: 'draft', comment: '状态' },
  adminId: { type: DataTypes.INTEGER, allowNull: false, comment: '发布者ID' },
  topFlag: { type: DataTypes.BOOLEAN, defaultValue: false, comment: '是否置顶' }
}, {
  tableName: 'announcements'
});

module.exports = Announcement;
