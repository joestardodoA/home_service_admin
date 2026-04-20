/**
 * server/app.js — 服务端入口（海南椰嫂综合平台）
 *
 * ⚙️ 手动配置项:
 *   PORT — 服务端口，默认 3001，可通过环境变量 PORT 设置
 *   生产部署: PORT=80 node app.js 或使用 PM2/Docker
 *
 * 📋 路由结构:
 *   /api/public  — 小程序公开 API（X-User-Token 认证）
 *   /api/auth    — 管理后台登录（JWT 认证）
 *   /api/*       — 管理后台 CRUD（JWT 认证）
 *
 * 🚀 启动方式:
 *   开发: node app.js
 *   生产: pm2 start app.js --name coconut-api
 *   初始化: node seeders/init.js（会清除数据库重建！）
 */
const express = require('express');
const cors = require('cors');
const path = require('path');
const { sequelize } = require('./models');

const app = express();
// 【可改】服务端口，生产环境通过环境变量 PORT 设置
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API 路由
app.use('/api/auth', require('./routes/auth'));
app.use('/api/coupons', require('./routes/coupons'));
app.use('/api/agencies', require('./routes/agencies'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/articles', require('./routes/articles'));
app.use('/api/banners', require('./routes/banners'));
app.use('/api/users', require('./routes/users'));
// 系统管理
app.use('/api/system', require('./routes/system'));
app.use('/api/logs', require('./routes/logs'));
// 服务订单管理
app.use('/api/service-orders', require('./routes/serviceOrders'));
// 分享追溯管理
app.use('/api/shares', require('./routes/shares'));
// 文件上传
app.use('/api/upload', require('./routes/upload'));
// 小程序公开 API（免 JWT 认证）
app.use('/api/public', require('./routes/public'));

app.use(express.static(path.join(__dirname, 'public')));

app.use(function(err, req, res, next) {
  console.error('服务器错误:', err);
  res.status(500).json({ code: 500, msg: '服务器内部错误', data: null });
});

async function start() {
  try {
    await sequelize.sync();
    console.log('数据库同步完成');
    app.listen(PORT, function() {
      console.log('海南椰嫂综合平台后台 API: http://localhost:' + PORT);
    });
  } catch (err) { console.error('启动失败:', err); }
}
start();
