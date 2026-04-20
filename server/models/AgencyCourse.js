// server/models/AgencyCourse.js — 课程模型（补全 exchangeCount）
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const AgencyCourse = sequelize.define('AgencyCourse', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  agencyId: { type: DataTypes.INTEGER, allowNull: false },
  name: { type: DataTypes.STRING(100), allowNull: false },
  desc: { type: DataTypes.TEXT, defaultValue: '' },
  duration: { type: DataTypes.STRING(50), defaultValue: '' },
  discount: { type: DataTypes.STRING(50), defaultValue: '' },
  exchangeCount: { type: DataTypes.INTEGER, defaultValue: 0 },
  sortOrder: { type: DataTypes.INTEGER, defaultValue: 0 }
}, { tableName: 'agency_courses', updatedAt: false });

module.exports = AgencyCourse;
