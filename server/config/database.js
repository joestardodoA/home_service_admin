/**
 * server/config/database.js — 数据库配置（海南椰嫂综合平台）
 *
 * 通过环境变量 DB_DIALECT 控制数据库类型：
 *   DB_DIALECT=mysql   → MySQL（生产环境推荐）
 *   DB_DIALECT=sqlite  → SQLite（开发/测试）
 *
 * MySQL 环境变量：
 *   DB_HOST     — 数据库主机（默认 127.0.0.1）
 *   DB_PORT     — 端口（默认 3306）
 *   DB_NAME     — 数据库名（默认 coconut）
 *   DB_USER     — 用户名（默认 coconut）
 *   DB_PASS     — 密码（必填）
 */
const { Sequelize } = require('sequelize');
const path = require('path');

var dialect = process.env.DB_DIALECT || 'mysql';

var dbConfig = {
  logging: false,
  define: {
    timestamps: true,
    underscored: false,
    charset: 'utf8mb4',
    collate: 'utf8mb4_general_ci'
  }
};

if (dialect === 'sqlite') {
  // SQLite 模式（本地开发用）
  dbConfig.dialect = 'sqlite';
  dbConfig.storage = path.join(__dirname, '..', 'database.sqlite');
} else {
  // MySQL 模式（生产环境）
  dbConfig.dialect = 'mysql';
  dbConfig.host = process.env.DB_HOST || '127.0.0.1';
  dbConfig.port = parseInt(process.env.DB_PORT) || 3306;
  dbConfig.database = process.env.DB_NAME || 'coconut';
  dbConfig.username = process.env.DB_USER || 'coconut';
  dbConfig.password = process.env.DB_PASS || '';
  dbConfig.pool = {
    max: 10,      // 最大连接数
    min: 2,       // 最小连接数
    acquire: 30000,
    idle: 10000
  };
  // MySQL 会话级别设置
  dbConfig.dialectOptions = {
    charset: 'utf8mb4',
    // 时区对齐服务器
    dateStrings: true,
    typeCast: true
  };
}

const sequelize = new Sequelize(dbConfig);

module.exports = sequelize;
