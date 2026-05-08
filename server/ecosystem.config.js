/**
 * ecosystem.config.js — PM2 进程配置（海南椰嫂综合平台）
 *
 * 使用方法:
 *   pm2 start ecosystem.config.js          — 启动
 *   pm2 restart coconut-api                — 重启
 *   pm2 logs coconut-api                   — 查看日志
 *
 * ⚠️ 首次启动前请修改下方环境变量：
 *   DB_PASS    — MySQL 数据库密码
 *   JWT_SECRET — 管理后台 JWT 密钥
 */
module.exports = {
  apps: [{
    name: 'coconut-api',
    script: 'app.js',
    instances: 1,
    exec_mode: 'fork',
    watch: false,
    max_memory_restart: '300M',
    env: {
      NODE_ENV: 'production',
      PORT: 3001,
      // === 数据库配置 ===
      DB_DIALECT: 'mysql',
      DB_HOST: '127.0.0.1',
      DB_PORT: 3306,
      DB_NAME: 'coconut',
      DB_USER: 'coconut',
      DB_PASS: 'CHANGE_ME',        // ⚠️ 修改为实际密码
      // === JWT 密钥 ===
      JWT_SECRET: 'CHANGE_ME',     // ⚠️ 修改为安全密钥
      WX_JWT_SECRET: '',           // 小程序 JWT（留空使用默认开发密钥）
      // === 微信小程序（椰嫂） ===
      WX_APPID: '',
      WX_SECRET: '',
      // === 微信小程序（小围栏） ===
      WX_APPID_XWL: '',             // ⚠️ 填入小围栏的 AppID
      WX_SECRET_XWL: '',            // ⚠️ 填入小围栏的 AppSecret
      // === AI 服务（DeepSeek V4） ===
      AI_PROVIDER: 'deepseek',
      AI_API_KEY: 'sk-ce92e7c9e5da4177ba9106eb41308e07',
      AI_BASE_URL: 'https://api.deepseek.com',
      AI_MODEL: 'deepseek-v4-pro',
      // === OpenClaw Gateway（GenmaClaw Phase B）===
      OPENCLAW_URL: 'https://genmaclaw.yesao.net',
      OPENCLAW_TOKEN: 'genmaclaw_token_2026_secure',
      // === CORS ===
      CORS_ORIGINS: 'https://genma.yesao.net,http://localhost:5173'
    }
  }]
};
