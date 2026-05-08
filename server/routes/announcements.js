// server/routes/announcements.js — 内部公告 CRUD API
const express = require('express');
const { Announcement, Admin } = require('../models');
const { authMiddleware, requirePermission, requireAnyPermission } = require('../middleware/auth');
const { success, fail, paginate } = require('../utils/response');
const { Op } = require('sequelize');

const router = express.Router();
router.use(authMiddleware);

// 查询公告列表
router.get('/', requirePermission('announcements:view'), async function(req, res) {
  try {
    var page = parseInt(req.query.page) || 1;
    var pageSize = parseInt(req.query.pageSize) || 10;
    var where = {};

    if (req.query.status) where.status = req.query.status;
    if (req.query.type) where.type = req.query.type;
    if (req.query.keyword) {
      where.title = { [Op.like]: '%' + req.query.keyword + '%' };
    }

    var result = await Announcement.findAndCountAll({
      where: where,
      include: [{ model: Admin, as: 'publisher', attributes: ['id', 'username', 'realName'] }],
      order: [['topFlag', 'DESC'], ['createdAt', 'DESC']],
      limit: pageSize,
      offset: (page - 1) * pageSize
    });

    return paginate(res, result.rows, result.count, page, pageSize);
  } catch (err) { return fail(res, '查询失败: ' + err.message, 500); }
});

// 获取最新已发布公告（Dashboard 滚动条用，无需特殊权限）
router.get('/latest', async function(req, res) {
  try {
    var list = await Announcement.findAll({
      where: { status: 'published' },
      order: [['topFlag', 'DESC'], ['createdAt', 'DESC']],
      limit: 5,
      attributes: ['id', 'title', 'type', 'topFlag', 'createdAt']
    });
    return success(res, list);
  } catch (err) { return fail(res, '查询失败', 500); }
});

// 获取单条公告
router.get('/:id', requirePermission('announcements:view'), async function(req, res) {
  try {
    var item = await Announcement.findByPk(req.params.id, {
      include: [{ model: Admin, as: 'publisher', attributes: ['id', 'username', 'realName'] }]
    });
    if (!item) return fail(res, '公告不存在', 404);
    return success(res, item);
  } catch (err) { return fail(res, '查询失败', 500); }
});

// 创建公告
router.post('/', requirePermission('announcements:create'), async function(req, res) {
  try {
    var { title, content, type, status, topFlag } = req.body;
    if (!title || !content) return fail(res, '标题和内容不能为空');
    var item = await Announcement.create({
      title: title,
      content: content,
      type: type || 'notice',
      status: status || 'draft',
      topFlag: topFlag || false,
      adminId: req.admin.id
    });
    return success(res, item, '创建成功');
  } catch (err) { return fail(res, '创建失败: ' + err.message, 500); }
});

// 编辑公告
router.put('/:id', requirePermission('announcements:edit'), async function(req, res) {
  try {
    var item = await Announcement.findByPk(req.params.id);
    if (!item) return fail(res, '公告不存在', 404);
    var { title, content, type, status, topFlag } = req.body;
    await item.update({ title: title, content: content, type: type, status: status, topFlag: topFlag });
    return success(res, item, '更新成功');
  } catch (err) { return fail(res, '更新失败: ' + err.message, 500); }
});

// 删除公告
router.delete('/:id', requirePermission('announcements:delete'), async function(req, res) {
  try {
    var item = await Announcement.findByPk(req.params.id);
    if (!item) return fail(res, '公告不存在', 404);
    await item.destroy();
    return success(res, null, '删除成功');
  } catch (err) { return fail(res, '删除失败: ' + err.message, 500); }
});

module.exports = router;
