// server/routes/notifications.js — 后台通知 API
const express = require('express');
const { AdminNotification } = require('../models');
const { authMiddleware } = require('../middleware/auth');
const { success, fail, paginate } = require('../utils/response');
const { Op } = require('sequelize');

const router = express.Router();
router.use(authMiddleware);

// 我的通知列表
router.get('/', async function(req, res) {
  try {
    var page = parseInt(req.query.page) || 1;
    var pageSize = parseInt(req.query.pageSize) || 20;
    var where = { adminId: req.admin.id };
    if (req.query.isRead === 'true') where.isRead = true;
    if (req.query.isRead === 'false') where.isRead = false;

    var result = await AdminNotification.findAndCountAll({
      where: where,
      order: [['createdAt', 'DESC']],
      limit: pageSize,
      offset: (page - 1) * pageSize
    });
    return paginate(res, result.rows, result.count, page, pageSize);
  } catch (err) { return fail(res, '查询失败: ' + err.message, 500); }
});

// 未读数量
router.get('/unread-count', async function(req, res) {
  try {
    var count = await AdminNotification.count({
      where: { adminId: req.admin.id, isRead: false }
    });
    return success(res, { count: count });
  } catch (err) { return fail(res, '查询失败', 500); }
});

// 标记单条已读
router.put('/:id/read', async function(req, res) {
  try {
    var n = await AdminNotification.findOne({
      where: { id: req.params.id, adminId: req.admin.id }
    });
    if (!n) return fail(res, '通知不存在', 404);
    await n.update({ isRead: true, readAt: new Date() });
    return success(res, n, '已读');
  } catch (err) { return fail(res, '操作失败', 500); }
});

// 全部标记已读
router.put('/read-all', async function(req, res) {
  try {
    await AdminNotification.update(
      { isRead: true, readAt: new Date() },
      { where: { adminId: req.admin.id, isRead: false } }
    );
    return success(res, null, '已全部标记已读');
  } catch (err) { return fail(res, '操作失败', 500); }
});

module.exports = router;
