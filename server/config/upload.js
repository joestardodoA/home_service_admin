/**
 * server/config/upload.js — 文件上传配置
 *
 * ⚙️ 存储模式切换:
 *   当前: provider = 'local'（存储到 server/public/uploads/）
 *   未来: provider = 'cloud'（上传到阿里云 OSS / 腾讯云 COS 等）
 *
 *   切换方式:
 *   1. 设置环境变量 UPLOAD_PROVIDER=cloud
 *   2. 配置对应云服务的秘钥环境变量
 *   3. 安装对应 SDK（ali-oss / cos-nodejs-sdk-v5 等）
 */
module.exports = {
  // 存储模式: 'local' 或 'cloud'
  provider: process.env.UPLOAD_PROVIDER || 'local',

  // 云存储配置（provider='cloud' 时生效）
  cloud: {
    // 云服务类型: 'oss'(阿里云) / 'cos'(腾讯云) / 's3'(AWS)
    type: process.env.CLOUD_TYPE || 'oss',
    bucket: process.env.CLOUD_BUCKET || '',
    region: process.env.CLOUD_REGION || '',
    accessKeyId: process.env.CLOUD_ACCESS_KEY || '',
    accessKeySecret: process.env.CLOUD_SECRET_KEY || '',
    // 自定义域名（CDN 加速域名，无则用默认域名）
    customDomain: process.env.CLOUD_CUSTOM_DOMAIN || '',
    // 上传目录前缀（如 'coconut-platform/'）
    prefix: process.env.CLOUD_PREFIX || 'uploads/'
  },

  // 本地存储配置
  local: {
    // 存储目录（相对于 server 根目录）
    uploadDir: 'public/uploads',
    // 外部访问 URL 前缀
    urlPrefix: '/uploads'
  },

  // 通用限制
  maxFileSize: 5 * 1024 * 1024,  // 5MB
  allowedMimeTypes: [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml'
  ]
};
