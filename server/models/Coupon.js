// server/models/Coupon.js — 优惠券模型（海南椰嫂综合平台）
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Coupon = sequelize.define('Coupon', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  title: { type: DataTypes.STRING(100), allowNull: false },
  type: { type: DataTypes.ENUM('free', 'discount', 'cash'), defaultValue: 'free' },
  value: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
  valueText: { type: DataTypes.STRING(20), defaultValue: '' },
  condition: { type: DataTypes.STRING(200), defaultValue: '' },
  description: { type: DataTypes.TEXT, defaultValue: '' },
  // 以下为小程序详情页所需字段
  icon: { type: DataTypes.STRING(500), defaultValue: '' },
  subtitle: { type: DataTypes.TEXT, defaultValue: '' },
  coverImage: { type: DataTypes.STRING(500), defaultValue: '' },
  courseName: { type: DataTypes.STRING(100), defaultValue: '' },
  limitTag: { type: DataTypes.STRING(20), defaultValue: '' },
  highlights: { type: DataTypes.TEXT, defaultValue: '[]', get() { try { return JSON.parse(this.getDataValue('highlights')); } catch(e) { return []; } }, set(val) { this.setDataValue('highlights', JSON.stringify(val || [])); } },
  benefits: { type: DataTypes.TEXT, defaultValue: '[]', get() { try { return JSON.parse(this.getDataValue('benefits')); } catch(e) { return []; } }, set(val) { this.setDataValue('benefits', JSON.stringify(val || [])); } },
  conditions: { type: DataTypes.TEXT, defaultValue: '[]', get() { try { return JSON.parse(this.getDataValue('conditions')); } catch(e) { return []; } }, set(val) { this.setDataValue('conditions', JSON.stringify(val || [])); } },
  agencyIds: { type: DataTypes.TEXT, defaultValue: '[]', get() { try { return JSON.parse(this.getDataValue('agencyIds')); } catch(e) { return []; } }, set(val) { this.setDataValue('agencyIds', JSON.stringify(val || [])); } },
  tags: { type: DataTypes.TEXT, defaultValue: '[]', get() { try { return JSON.parse(this.getDataValue('tags')); } catch(e) { return []; } }, set(val) { this.setDataValue('tags', JSON.stringify(val || [])); } },
  status: { type: DataTypes.ENUM('draft', 'online', 'offline'), defaultValue: 'draft' },
  totalCount: { type: DataTypes.INTEGER, defaultValue: 0 },
  remainCount: { type: DataTypes.INTEGER, defaultValue: 0 },
  claimedCount: { type: DataTypes.INTEGER, defaultValue: 0 },
  limitPerUser: { type: DataTypes.INTEGER, defaultValue: 1 },
  startDate: { type: DataTypes.DATEONLY },
  expireDate: { type: DataTypes.DATEONLY },
  sortOrder: { type: DataTypes.INTEGER, defaultValue: 0 },
  // 分享设置
  shareable: { type: DataTypes.BOOLEAN, defaultValue: true },
  // 分享奖励金（元，核销后触发）
  shareRewardAmount: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
  // 分享核销积分（分享人获得的积分奖励）
  shareRewardPoints: { type: DataTypes.INTEGER, defaultValue: 0 }
}, { tableName: 'coupons' });

module.exports = Coupon;
