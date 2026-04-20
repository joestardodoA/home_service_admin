// server/utils/logger.js — 操作日志记录工具
const OperationLog = require('../models/OperationLog');

/**
 * 记录管理员操作日志
 * @param {Object} req - Express 请求对象（需包含 req.admin）
 * @param {string} module - 模块名称（coupon/agency/order/recommender/system）
 * @param {string} action - 操作类型（create/update/delete/approve/reject/verify）
 * @param {string} targetType - 目标类型（Coupon/Agency/Order/Recommender/Admin）
 * @param {number} targetId - 目标 ID
 * @param {string} detail - 操作详情描述
 */
async function logAction(req, module, action, targetType, targetId, detail) {
  try {
    var ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress || '';
    await OperationLog.create({
      adminId: req.admin ? req.admin.id : 0,
      adminName: req.admin ? (req.admin.realName || req.admin.username) : '未知',
      module: module,
      action: action,
      targetType: targetType,
      targetId: targetId || 0,
      detail: detail || '',
      ip: ip
    });
  } catch (err) {
    // 日志写入失败不阻塞业务
    console.error('操作日志写入失败:', err.message);
  }
}

module.exports = { logAction };
