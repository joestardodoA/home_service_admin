/**
 * server/routes/upload.js — 文件上传 API
 *
 * ⚙️ 当前使用本地存储，文件保存到 server/public/uploads/
 *    切换云存储: 修改 config/upload.js 的 provider 为 'cloud'
 *
 * 接口:
 *   POST /api/upload        — 单文件上传
 *   POST /api/upload/multi  — 多文件上传（最多9张）
 *   DELETE /api/upload       — 删除文件
 */
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { authMiddleware } = require('../middleware/auth');
const { success, fail } = require('../utils/response');
const uploadConfig = require('../config/upload');

const router = express.Router();
router.use(authMiddleware);

// 确保上传目录存在
var uploadDir = path.join(__dirname, '..', uploadConfig.local.uploadDir);
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// 生成唯一文件名
function generateFilename(originalname) {
  var ext = path.extname(originalname).toLowerCase();
  var timestamp = Date.now();
  var random = crypto.randomBytes(6).toString('hex');
  return timestamp + '_' + random + ext;
}

// multer 存储配置
var storage = multer.diskStorage({
  destination: function(req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function(req, file, cb) {
    cb(null, generateFilename(file.originalname));
  }
});

// 文件类型过滤
function fileFilter(req, file, cb) {
  if (uploadConfig.allowedMimeTypes.indexOf(file.mimetype) !== -1) {
    cb(null, true);
  } else {
    cb(new Error('不支持的文件类型: ' + file.mimetype), false);
  }
}

var upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: uploadConfig.maxFileSize }
});

/**
 * 根据存储模式生成文件的访问 URL
 * 本地模式: 返回相对路径 /uploads/xxx.jpg
 * 云模式: 返回完整 URL https://xxx.com/uploads/xxx.jpg
 */
function getFileUrl(filename) {
  if (uploadConfig.provider === 'cloud') {
    // 云存储模式 — 预留，需实现 uploadToCloud 逻辑
    var domain = uploadConfig.cloud.customDomain || (uploadConfig.cloud.bucket + '.' + uploadConfig.cloud.region + '.aliyuncs.com');
    return 'https://' + domain + '/' + uploadConfig.cloud.prefix + filename;
  }
  // 本地模式
  return uploadConfig.local.urlPrefix + '/' + filename;
}

/**
 * 云存储上传（预留）
 * 当 UPLOAD_PROVIDER=cloud 时，先用 multer 暂存到本地，再上传到云，最后删除本地临时文件
 */
async function uploadToCloud(filePath, filename) {
  var cloudType = uploadConfig.cloud.type;

  if (cloudType === 'oss') {
    // 阿里云 OSS 示例（需 npm install ali-oss）
    // const OSS = require('ali-oss');
    // const client = new OSS({
    //   region: uploadConfig.cloud.region,
    //   accessKeyId: uploadConfig.cloud.accessKeyId,
    //   accessKeySecret: uploadConfig.cloud.accessKeySecret,
    //   bucket: uploadConfig.cloud.bucket
    // });
    // await client.put(uploadConfig.cloud.prefix + filename, filePath);
    console.log('[云上传预留] OSS 上传: ' + filename);
  } else if (cloudType === 'cos') {
    // 腾讯云 COS 示例（需 npm install cos-nodejs-sdk-v5）
    // const COS = require('cos-nodejs-sdk-v5');
    // const client = new COS({ SecretId: ..., SecretKey: ... });
    // await client.putObject({ Bucket: ..., Region: ..., Key: ..., Body: fs.createReadStream(filePath) });
    console.log('[云上传预留] COS 上传: ' + filename);
  }

  // 上传完成后删除本地临时文件
  // fs.unlinkSync(filePath);
}

// ==================== 单文件上传 ====================
router.post('/', function(req, res) {
  upload.single('file')(req, res, async function(err) {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return fail(res, '文件大小不能超过 ' + Math.round(uploadConfig.maxFileSize / 1024 / 1024) + 'MB');
      }
      return fail(res, '上传失败: ' + err.message);
    }
    if (!req.file) {
      return fail(res, '请选择要上传的文件');
    }

    try {
      // 云存储模式下先上传到云
      if (uploadConfig.provider === 'cloud') {
        await uploadToCloud(req.file.path, req.file.filename);
      }

      var fileUrl = getFileUrl(req.file.filename);
      return success(res, {
        url: fileUrl,
        filename: req.file.filename,
        originalName: req.file.originalname,
        size: req.file.size,
        mimetype: req.file.mimetype
      }, '上传成功');
    } catch (uploadErr) {
      return fail(res, '上传失败: ' + uploadErr.message, 500);
    }
  });
});

// ==================== 多文件上传（最多9张） ====================
router.post('/multi', function(req, res) {
  upload.array('files', 9)(req, res, async function(err) {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return fail(res, '单个文件不能超过 ' + Math.round(uploadConfig.maxFileSize / 1024 / 1024) + 'MB');
      }
      if (err.code === 'LIMIT_UNEXPECTED_FILE') {
        return fail(res, '最多上传 9 张图片');
      }
      return fail(res, '上传失败: ' + err.message);
    }
    if (!req.files || req.files.length === 0) {
      return fail(res, '请选择要上传的文件');
    }

    try {
      var results = [];
      for (var i = 0; i < req.files.length; i++) {
        var f = req.files[i];
        if (uploadConfig.provider === 'cloud') {
          await uploadToCloud(f.path, f.filename);
        }
        results.push({
          url: getFileUrl(f.filename),
          filename: f.filename,
          originalName: f.originalname,
          size: f.size
        });
      }
      return success(res, results, '上传成功');
    } catch (uploadErr) {
      return fail(res, '上传失败: ' + uploadErr.message, 500);
    }
  });
});

// ==================== 删除文件 ====================
router.delete('/', async function(req, res) {
  try {
    var fileUrl = req.body.url || '';
    if (!fileUrl) return fail(res, '请提供文件 URL');

    if (uploadConfig.provider === 'local') {
      // 本地模式：从 URL 中提取文件名，删除本地文件
      var filename = fileUrl.replace(uploadConfig.local.urlPrefix + '/', '');
      // 防止目录穿越攻击
      if (filename.indexOf('..') !== -1 || filename.indexOf('/') !== -1) {
        return fail(res, '无效的文件路径');
      }
      var filePath = path.join(uploadDir, filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } else {
      // 云存储模式：调用云 SDK 删除（预留）
      console.log('[云删除预留] 删除文件: ' + fileUrl);
    }

    return success(res, null, '删除成功');
  } catch (err) {
    return fail(res, '删除失败: ' + err.message, 500);
  }
});

module.exports = router;
