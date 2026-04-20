// server/models/Agency.js — 机构模型（对齐小程序字段）
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Agency = sequelize.define('Agency', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING(100), allowNull: false },
  logo: { type: DataTypes.STRING(500), defaultValue: '' },
  coverImage: { type: DataTypes.STRING(500), defaultValue: '' },
  address: { type: DataTypes.STRING(300), defaultValue: '' },
  lat: { type: DataTypes.DECIMAL(10, 6) },
  lng: { type: DataTypes.DECIMAL(10, 6) },
  phone: { type: DataTypes.STRING(20), defaultValue: '' },
  score: { type: DataTypes.DECIMAL(2, 1), defaultValue: 5.0 },
  reviewCount: { type: DataTypes.INTEGER, defaultValue: 0 },
  tags: { type: DataTypes.TEXT, defaultValue: '[]', get() { try { return JSON.parse(this.getDataValue('tags')); } catch(e) { return []; } }, set(val) { this.setDataValue('tags', JSON.stringify(val || [])); } },
  status: { type: DataTypes.ENUM('active', 'inactive'), defaultValue: 'active' },
  intro: { type: DataTypes.TEXT, defaultValue: '' },
  businessHours: { type: DataTypes.STRING(100), defaultValue: '' },
  bookingNote: { type: DataTypes.STRING(200), defaultValue: '' },
  qualification: { type: DataTypes.STRING(200), defaultValue: '' },
  gallery: { type: DataTypes.TEXT, defaultValue: '[]', get() { try { return JSON.parse(this.getDataValue('gallery')); } catch(e) { return []; } }, set(val) { this.setDataValue('gallery', JSON.stringify(val || [])); } },
  exchangeNotes: { type: DataTypes.TEXT, defaultValue: '[]', get() { try { return JSON.parse(this.getDataValue('exchangeNotes')); } catch(e) { return []; } }, set(val) { this.setDataValue('exchangeNotes', JSON.stringify(val || [])); } },
  sortOrder: { type: DataTypes.INTEGER, defaultValue: 0 }
}, { tableName: 'agencies' });

module.exports = Agency;
