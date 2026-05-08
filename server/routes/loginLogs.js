// server/routes/loginLogs.js — 登录日志查询 API
const express = require('express');
const { LoginLog, Admin } = require('../models');
const { authMiddleware, requirePermission } = require('../middleware/auth');
const { success, fail, paginate } = require('../utils/response');
const { Op } = require('sequelize');

const router = express.Router();
router.use(authMiddleware);

// 查询登录日志列表
router.get('/', requirePermission('login_logs:view'), async function(req, res) {
  try {
    var page = parseInt(req.query.page) || 1;
    var pageSize = parseInt(req.query.pageSize) || 20;
    var where = {};

    if (req.query.username) where.username = { [Op.like]: '%' + req.query.username + '%' };
    if (req.query.status) where.status = req.query.status;
    if (req.query.ip) where.ip = { [Op.like]: '%' + req.query.ip + '%' };
    if (req.query.startDate && req.query.endDate) {
      where.createdAt = { [Op.between]: [req.query.startDate, req.query.endDate + ' 23:59:59'] };
    }

    var result = await LoginLog.findAndCountAll({
      where: where,
      include: [{ model: Admin, as: 'admin', attributes: ['id', 'username', 'realName', 'role'] }],
      order: [['createdAt', 'DESC']],
      limit: pageSize,
      offset: (page - 1) * pageSize
    });

    return paginate(res, result.rows, result.count, page, pageSize);
  } catch (err) { return fail(res, '查询失败: ' + err.message, 500); }
});

// 清空登录日志
router.delete('/clear', requirePermission('login_logs:clear'), async function(req, res) {
  try {
    await LoginLog.destroy({ where: {}, truncate: true });
    return success(res, null, '登录日志已清空');
  } catch (err) { return fail(res, '清空失败: ' + err.message, 500); }
});

module.exports = router;
