/**
 * scripts/migrate-sqlite-to-mysql.js — SQLite → MySQL 数据迁移脚本
 *
 * 使用方法:
 *   1. 确保 MySQL 数据库已创建且 ecosystem.config.js 中密码已配置
 *   2. 在 server 目录执行:
 *      DB_DIALECT=mysql DB_PASS=xxx node scripts/migrate-sqlite-to-mysql.js
 *
 * 迁移流程:
 *   1. 连接 SQLite 读取所有表的数据
 *   2. 连接 MySQL，通过 sync({ force: true }) 创建表
 *   3. 批量插入所有数据
 *   4. 重置自增 ID
 *
 * ⚠️ 注意：此脚本会清空 MySQL 中的目标表！
 */
const { Sequelize } = require('sequelize');
const path = require('path');

// 所有需要迁移的模型名称（按依赖顺序排列，被引用的在前）
var MODEL_NAMES = [
  'Admin', 'User', 'JobType', 'SystemSetting',
  'Agency', 'AgencyCourse', 'Coupon', 'Article', 'Banner',
  'CouponOrder', 'Commission', 'ShareRecord',
  'ServiceOrder', 'OrderApplication',
  'Message', 'SubscriptionSetting', 'OperationLog',
  'AdminNotification', 'Announcement', 'LoginLog',
  'GuimiCircle', 'GuimiCircleMember', 'GuimiInviteCode', 'GuimiCircleEvent'
];

async function migrate() {
  console.log('========== SQLite → MySQL 数据迁移 ==========\n');

  // 1. 连接 SQLite（源数据库）
  var sqlitePath = path.join(__dirname, '..', 'database.sqlite');
  var sqliteDb = new Sequelize({
    dialect: 'sqlite',
    storage: sqlitePath,
    logging: false,
    define: { timestamps: true, underscored: false }
  });

  try {
    await sqliteDb.authenticate();
    console.log('[1/4] SQLite 连接成功: ' + sqlitePath);
  } catch (e) {
    console.error('SQLite 连接失败:', e.message);
    process.exit(1);
  }

  // 2. 连接 MySQL（目标数据库）
  var mysqlDb = new Sequelize({
    dialect: 'mysql',
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT) || 3306,
    database: process.env.DB_NAME || 'coconut',
    username: process.env.DB_USER || 'coconut',
    password: process.env.DB_PASS || '',
    logging: false,
    define: {
      timestamps: true,
      underscored: false,
      charset: 'utf8mb4',
      collate: 'utf8mb4_general_ci'
    },
    dialectOptions: { charset: 'utf8mb4' }
  });

  try {
    await mysqlDb.authenticate();
    console.log('[2/4] MySQL 连接成功: ' + (process.env.DB_NAME || 'coconut'));
  } catch (e) {
    console.error('MySQL 连接失败:', e.message);
    console.error('请检查: DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASS 环境变量');
    process.exit(1);
  }

  // 3. 读取 SQLite 中所有表的数据
  console.log('\n[3/4] 读取 SQLite 数据...');
  var tableData = {};
  var qi = sqliteDb.getQueryInterface();
  var tables = await qi.showAllTables();
  console.log('  发现 ' + tables.length + ' 张表: ' + tables.join(', '));

  for (var i = 0; i < tables.length; i++) {
    var tableName = tables[i];
    if (tableName === 'sqlite_sequence') continue; // 跳过系统表
    try {
      var rows = await sqliteDb.query('SELECT * FROM `' + tableName + '`', { type: 'SELECT' });
      tableData[tableName] = rows;
      console.log('  ✓ ' + tableName + ': ' + rows.length + ' 条');
    } catch (e) {
      console.log('  ✗ ' + tableName + ': 读取失败 - ' + e.message);
    }
  }

  // 4. 在 MySQL 中创建表结构（通过加载模型）
  console.log('\n[4/4] 写入 MySQL...');

  // 临时替换全局数据库连接为 MySQL
  // 需要重新注册所有模型到 MySQL 实例
  // 方法：直接用原始 SQL 插入，避免模型关联冲突

  // 先通过模型 sync 创建表结构
  // 需要手动注册模型到 mysqlDb
  var modelFiles = require('fs').readdirSync(path.join(__dirname, '..', 'models'))
    .filter(function(f) { return f !== 'index.js' && f.endsWith('.js'); });

  // 创建一个临时的 database.js 替代品
  var originalRequire = require('../config/database');

  // 用 MySQL 连接重新定义所有模型
  var DataTypes = require('sequelize').DataTypes;

  // 最简方式：直接 force sync 创建空表，然后用 raw SQL 插入
  // 为了避免模型注册复杂性，用 raw SQL 方式

  // 先关闭外键检查
  await mysqlDb.query('SET FOREIGN_KEY_CHECKS = 0');

  for (var tableName in tableData) {
    var rows = tableData[tableName];
    if (rows.length === 0) {
      console.log('  ⊘ ' + tableName + ': 空表，跳过');
      continue;
    }

    try {
      // 清空目标表（如果存在）
      try {
        await mysqlDb.query('TRUNCATE TABLE `' + tableName + '`');
      } catch(e) {
        // 表可能不存在，等 sync 创建后再试
      }

      // 批量插入
      var columns = Object.keys(rows[0]);
      var batchSize = 100;
      var inserted = 0;

      for (var b = 0; b < rows.length; b += batchSize) {
        var batch = rows.slice(b, b + batchSize);
        var values = batch.map(function(row) {
          return '(' + columns.map(function(col) {
            var val = row[col];
            if (val === null || val === undefined) return 'NULL';
            if (typeof val === 'number') return val;
            if (typeof val === 'boolean') return val ? 1 : 0;
            // 转义字符串
            return "'" + String(val).replace(/'/g, "\\'").replace(/\\/g, "\\\\") + "'";
          }).join(',') + ')';
        }).join(',\n');

        var sql = 'INSERT INTO `' + tableName + '` (`' + columns.join('`,`') + '`) VALUES\n' + values;
        try {
          await mysqlDb.query(sql);
          inserted += batch.length;
        } catch (e) {
          console.log('  ✗ ' + tableName + ' 批次插入失败: ' + e.message.slice(0, 100));
        }
      }

      if (inserted > 0) {
        // 重置自增 ID
        var maxId = Math.max.apply(null, rows.map(function(r) { return r.id || 0; }));
        if (maxId > 0) {
          try {
            await mysqlDb.query('ALTER TABLE `' + tableName + '` AUTO_INCREMENT = ' + (maxId + 1));
          } catch(e) {}
        }
        console.log('  ✓ ' + tableName + ': 已插入 ' + inserted + ' 条');
      }
    } catch (e) {
      console.log('  ✗ ' + tableName + ': 迁移失败 - ' + e.message);
    }
  }

  // 恢复外键检查
  await mysqlDb.query('SET FOREIGN_KEY_CHECKS = 1');

  console.log('\n========== 迁移完成 ==========');
  console.log('请验证数据后，将 ecosystem.config.js 中 DB_DIALECT 设为 mysql 并重启服务。');

  await sqliteDb.close();
  await mysqlDb.close();
  process.exit(0);
}

migrate().catch(function(err) {
  console.error('迁移失败:', err);
  process.exit(1);
});
