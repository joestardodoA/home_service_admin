// server/models/Banner.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Banner = sequelize.define('Banner', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  title: { type: DataTypes.STRING(100), defaultValue: '' },
  subtitle: { type: DataTypes.STRING(200), defaultValue: '' },
  linkType: { type: DataTypes.ENUM('coupon', 'agency', 'article', 'url', 'none'), defaultValue: 'none' },
  linkValue: { type: DataTypes.STRING(300), defaultValue: '' },
  imageUrl: { type: DataTypes.STRING(500), defaultValue: '' },
  status: { type: DataTypes.ENUM('active', 'inactive'), defaultValue: 'active' },
  sortOrder: { type: DataTypes.INTEGER, defaultValue: 0 },
  // 展示位置：all=所有页面, home=仅首页, orders=仅订单页
  position: { type: DataTypes.STRING(20), defaultValue: 'all' }
}, { tableName: 'banners' });

module.exports = Banner;
