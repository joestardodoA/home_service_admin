/**
 * server/app.js — 服务端入口（海南椰嫂综合平台）
 *
 * ⚙️ 环境变量配置项:
 *   PORT           — 服务端口，默认 3001
 *   NODE_ENV       — 运行环境，production 时启用安全策略
 *   JWT_SECRET     — 后台管理 JWT 密钥（生产环境必填，否则启动失败）
 *   WX_JWT_SECRET  — 小程序端 JWT 密钥（可选，默认开发密钥）
 *   CORS_ORIGINS   — CORS 白名单，逗号分隔（默认 localhost:5173,3000）
 *
 * 📋 路由结构:
 *   /api/public         — 小程序公开 API（X-User-Token JWT 认证）
 *   /api/auth           — 管理后台登录（JWT 认证 + 速率限制）
 *   /api/guimi-circles  — 后台闺蜜圈管理（JWT 认证）
 *   /api/commissions    — 后台佣金积分管理（JWT 认证）
 *   /api/*              — 其他管理后台 CRUD（JWT 认证）
 *
 * 🔒 安全特性:
 *   - helmet 安全头（防 XSS、点击劫持、MIME 嗅探）
 *   - CORS 白名单（仅允许指定域名跨域）
 *   - 登录/注册速率限制（防暴力破解和批量注册）
 *   - 全局分页保护（pageSize 最大 100）
 *   - 生产环境错误信息脱敏
 *
 * 🚀 启动方式:
 *   开发: node app.js
 *   生产: JWT_SECRET=xxx NODE_ENV=production pm2 start app.js --name coconut-api
 *   初始化: node seeders/init.js（会清除数据库重建！）
 */
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const { sequelize } = require('./models');

const app = express();
// 【可改】服务端口，生产环境通过环境变量 PORT 设置
const PORT = process.env.PORT || 3001;

// 安全头（防 XSS、点击劫持、MIME 嗅探等）
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }, // 允许跨域加载图片资源
  contentSecurityPolicy: false // 小程序 API 不需要 CSP
}));

// CORS 配置（限制允许的来源）
var allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:5173,http://localhost:3000').split(',');
app.use(cors({
  origin: function(origin, callback) {
    // 无 origin 的请求（小程序/服务端直连）或白名单内的允许通过
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('CORS 不允许的来源: ' + origin));
    }
  },
  credentials: true
}));

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// 全局分页参数安全限制（防止 pageSize 过大拖库或负数）
app.use(function(req, res, next) {
  if (req.query.page) {
    var p = parseInt(req.query.page);
    if (isNaN(p) || p < 1) req.query.page = '1';
  }
  if (req.query.pageSize) {
    var ps = parseInt(req.query.pageSize);
    if (isNaN(ps) || ps < 1) req.query.pageSize = '10';
    else if (ps > 100) req.query.pageSize = '100';
  }
  next();
});

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
// 后台通知
app.use('/api/notifications', require('./routes/notifications'));
// 闺蜜圈管理
app.use('/api/guimi-circles', require('./routes/guimiCircles'));
// 佣金积分管理
app.use('/api/commissions', require('./routes/commissions'));
// 登录日志
app.use('/api/login-logs', require('./routes/loginLogs'));
// 在线用户监控
app.use('/api/online-users', require('./routes/onlineUsers'));
// 内部公告
app.use('/api/announcements', require('./routes/announcements'));
// AI 对话代理（GenmaClaw Phase B）
app.use('/api/ai', require('./routes/ai'));
// AI 智能动作（GenmaClaw Phase C：文件分析、导入辅助、智能派单、运营报告）
app.use('/api/ai', require('./routes/aiBusiness'));
// 小程序公开 API（免 JWT 认证）
app.use('/api/public', require('./routes/public'));
// 小程序闺蜜圈 API（需小程序 JWT 认证，由 public.js 内的 requireWxAuth 中间件处理）
app.use('/api/public/guimi', require('./routes/guimiPublic'));

app.use(express.static(path.join(__dirname, 'public')));

// 全局错误处理（含 CORS 拦截错误）
app.use(function(err, req, res, next) {
  // CORS 拦截错误
  if (err.message && err.message.indexOf('CORS') !== -1) {
    return res.status(403).json({ code: 403, msg: '跨域请求被拒绝', data: null });
  }
  // 生产环境不泄露内部错误细节
  console.error('[服务器错误]', err.message || err);
  var msg = process.env.NODE_ENV === 'production' ? '服务器内部错误' : ('服务器错误: ' + (err.message || ''));
  res.status(500).json({ code: 500, msg: msg, data: null });
});

async function start() {
  try {
    // 1. 测试数据库连接
    await sequelize.authenticate();
    console.log('[数据库] 连接成功 (' + sequelize.getDialect() + ')');

    // 2. 同步表结构（alter: true 自动添加新列，不删除已有列）
    await sequelize.sync({ alter: true });
    console.log('[数据库] 表结构同步完成');

    // 3. 检查微信登录关键环境变量
    if (!process.env.WX_APPID || !process.env.WX_SECRET) {
      console.error('============================================');
      console.error('⚠️  警告: WX_APPID 或 WX_SECRET 未配置！');
      console.error('⚠️  椰嫂小程序用户将无法登录！');
      console.error('⚠️  请在 ecosystem.config.js 中配置后重启！');
      console.error('============================================');
    }
    if (!process.env.WX_APPID_XWL || !process.env.WX_SECRET_XWL) {
      console.error('============================================');
      console.error('⚠️  警告: WX_APPID_XWL 或 WX_SECRET_XWL 未配置！');
      console.error('⚠️  小围栏小程序用户将无法登录！');
      console.error('⚠️  请在 ecosystem.config.js 中配置后重启！');
      console.error('============================================');
    }

    app.listen(PORT, function() {
      console.log('海南椰嫂综合平台后台 API: http://localhost:' + PORT);
    });

    // 定时清理过期邀请码（每6小时执行一次）
    var { GuimiInviteCode } = require('./models');
    var { Op } = require('sequelize');
    setInterval(async function() {
      try {
        var deleted = await GuimiInviteCode.destroy({
          where: { expireAt: { [Op.lt]: new Date(Date.now() - 86400000) } }
        });
        if (deleted > 0) console.log('[定时清理] 已删除 ' + deleted + ' 条过期邀请码');
      } catch (e) { console.error('[定时清理失败]', e.message); }
    }, 6 * 60 * 60 * 1000);

    // 定时处理 7 天冷静期到期退出（每小时执行一次）
    var { processExpiredLeaving } = require('./utils/circleEvent');
    setInterval(async function() {
      try { await processExpiredLeaving(); } catch (e) { console.error('[冷静期处理失败]', e.message); }
    }, 60 * 60 * 1000); // 每小时检查
    // 启动时立即执行一次
    processExpiredLeaving().catch(function() {});
  } catch (err) { console.error('启动失败:', err); }
}
start();
