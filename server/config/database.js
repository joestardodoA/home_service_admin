/**
 * server/config/database.js — 数据库配置
 *
 * ┌─────────────────────────────────────────────────────────────┐
 * │  ⚙️ 手动配置项                                               │
 * │                                                             │
 * │  当前: SQLite（零配置，适合开发/小规模）                        │
 * │  生产: 建议切换为 MySQL / PostgreSQL                          │
 * │                                                             │
 * │  切换 MySQL 方法:                                            │
 * │  1. npm install mysql2                                      │
 * │  2. 修改下方配置:                                             │
 * │     dialect: 'mysql',                                       │
 * │     host: process.env.DB_HOST || 'localhost',                │
 * │     port: process.env.DB_PORT || 3306,                      │
 * │     database: process.env.DB_NAME || 'hainan_coconut',      │
 * │     username: process.env.DB_USER || 'root',                │
 * │     password: process.env.DB_PASS || '',                    │
 * │  3. 删除 storage 行                                          │
 * │  4. 重新运行种子: node seeders/init.js                        │
 * │                                                             │
 * │  环境变量（生产建议使用）:                                      │
 * │    DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASS              │
 * └─────────────────────────────────────────────────────────────┘
 */
const { Sequelize } = require('sequelize');
const path = require('path');

const sequelize = new Sequelize({
  // 【可改】数据库类型：sqlite / mysql / postgres
  dialect: 'sqlite',
  // 【SQLite专用】数据库文件路径
  storage: path.join(__dirname, '..', 'database.sqlite'),
  // 关闭 SQL 日志（生产建议开启审计日志）
  logging: false,
  define: {
    timestamps: true,
    underscored: false
  }
});

module.exports = sequelize;
