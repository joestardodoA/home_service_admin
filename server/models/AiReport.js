// server/models/AiReport.js — AI 运营报告存档模型
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const AiReport = sequelize.define('AiReport', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  // 生成者（管理员 ID）
  adminId: { type: DataTypes.INTEGER, allowNull: false },
  // 报告类型
  type: {
    type: DataTypes.ENUM('weekly', 'monthly'),
    allowNull: false,
    defaultValue: 'weekly'
  },
  // 报告范围
  scope: {
    type: DataTypes.ENUM('all', 'personal'),
    allowNull: false,
    defaultValue: 'all'
  },
  // 周期标签（人类可读，如 "5/1 - 5/7"）
  periodLabel: { type: DataTypes.STRING(100), defaultValue: '' },
  // 周期起止时间
  periodStart: { type: DataTypes.DATE },
  periodEnd: { type: DataTypes.DATE },
  // 报告正文（Markdown 格式）
  content: { type: DataTypes.TEXT('long'), defaultValue: '' },
  // 原始聚合数据（JSON 字符串，便于日后重新生成或对比）
  rawData: {
    type: DataTypes.TEXT('long'),
    defaultValue: '{}',
    get() {
      try { return JSON.parse(this.getDataValue('rawData')); }
      catch(e) { return {}; }
    },
    set(val) {
      this.setDataValue('rawData', JSON.stringify(val || {}));
    }
  }
}, {
  tableName: 'ai_reports',
  indexes: [
    { fields: ['adminId'] },
    { fields: ['type'] },
    { fields: ['createdAt'] }
  ]
});

module.exports = AiReport;
