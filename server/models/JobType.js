// server/models/JobType.js — 工种管理模型（海南椰嫂综合平台）
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const JobType = sequelize.define('JobType', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  code: { type: DataTypes.STRING(20), unique: true },          // 如 'yuesao'
  name: { type: DataTypes.STRING(20), allowNull: false },      // 如 '月嫂'
  icon: { type: DataTypes.STRING(500), defaultValue: '' },     // 图标 URL
  description: { type: DataTypes.STRING(200), defaultValue: '' },
  sortOrder: { type: DataTypes.INTEGER, defaultValue: 0 },
  status: { type: DataTypes.ENUM('active', 'disabled'), defaultValue: 'active' }
}, { tableName: 'job_types' });

module.exports = JobType;
