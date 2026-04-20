// server/models/Article.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Article = sequelize.define('Article', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  title: { type: DataTypes.STRING(200), allowNull: false },
  summary: { type: DataTypes.STRING(500), defaultValue: '' },
  content: { type: DataTypes.TEXT, defaultValue: '' },
  category: { type: DataTypes.STRING(50), defaultValue: '保洁' },
  tags: { type: DataTypes.TEXT, defaultValue: '[]', get() { try { return JSON.parse(this.getDataValue('tags')); } catch(e) { return []; } }, set(val) { this.setDataValue('tags', JSON.stringify(val || [])); } },
  coverImage: { type: DataTypes.STRING(500), defaultValue: '' },
  status: { type: DataTypes.ENUM('draft', 'published', 'archived'), defaultValue: 'draft' },
  reads: { type: DataTypes.INTEGER, defaultValue: 0 },
  sortOrder: { type: DataTypes.INTEGER, defaultValue: 0 },
  publishedAt: { type: DataTypes.DATE }
}, { tableName: 'articles' });

module.exports = Article;
