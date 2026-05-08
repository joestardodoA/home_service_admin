// server/routes/agencies.js — 机构 CRUD + 课程
const express = require('express');
const { Agency, AgencyCourse } = require('../models');
const { authMiddleware, requirePermission } = require('../middleware/auth');
const { success, fail, paginate } = require('../utils/response');
const { Op } = require('sequelize');

const router = express.Router();
router.use(authMiddleware);

// 机构列表
router.get('/', requirePermission('agencies:view'), async function(req, res) {
  try {
    var page = parseInt(req.query.page) || 1;
    var pageSize = parseInt(req.query.pageSize) || 10;
    var where = {};
    if (req.query.status) { where.status = req.query.status; }
    if (req.query.keyword) {
      where.name = { [Op.like]: '%' + req.query.keyword + '%' };
    }
    var result = await Agency.findAndCountAll({
      where: where,
      include: [{ model: AgencyCourse, as: 'courses' }],
      order: [['sortOrder', 'DESC'], ['createdAt', 'DESC']],
      limit: pageSize,
      offset: (page - 1) * pageSize
    });
    return paginate(res, result.rows, result.count, page, pageSize);
  } catch (err) {
    return fail(res, '查询失败: ' + err.message, 500);
  }
});

// 全部机构（下拉选择用，不分页）
router.get('/all', async function(req, res) {
  try {
    var list = await Agency.findAll({
      attributes: ['id', 'name'],
      where: { status: 'active' },
      order: [['name', 'ASC']]
    });
    return success(res, list);
  } catch (err) {
    return fail(res, '查询失败', 500);
  }
});

// 机构详情
router.get('/:id', async function(req, res) {
  try {
    var agency = await Agency.findByPk(req.params.id, {
      include: [{ model: AgencyCourse, as: 'courses', order: [['sortOrder', 'ASC']] }]
    });
    if (!agency) return fail(res, '机构不存在', 404);
    return success(res, agency);
  } catch (err) {
    return fail(res, '查询失败', 500);
  }
});

// 创建机构
router.post('/', requirePermission('agencies:create'), async function(req, res) {
  try {
    if (!req.body.name) return fail(res, '机构名称不能为空');
    var agency = await Agency.create(req.body);
    return success(res, agency, '创建成功');
  } catch (err) {
    return fail(res, '创建失败: ' + err.message, 500);
  }
});

// 编辑机构
router.put('/:id', requirePermission('agencies:edit'), async function(req, res) {
  try {
    var agency = await Agency.findByPk(req.params.id);
    if (!agency) return fail(res, '机构不存在', 404);
    var updates = Object.assign({}, req.body);
    delete updates.id;
    delete updates.createdAt;
    delete updates.updatedAt;
    await agency.update(updates);
    return success(res, agency, '更新成功');
  } catch (err) {
    return fail(res, '更新失败', 500);
  }
});

// 删除机构
router.delete('/:id', requirePermission('agencies:delete'), async function(req, res) {
  try {
    var agency = await Agency.findByPk(req.params.id);
    if (!agency) return fail(res, '机构不存在', 404);
    await agency.destroy();
    return success(res, null, '删除成功');
  } catch (err) {
    return fail(res, '删除失败', 500);
  }
});

// ---- 课程子路由 ----
router.post('/:id/courses', requirePermission('agencies:edit'), async function(req, res) {
  try {
    var agency = await Agency.findByPk(req.params.id);
    if (!agency) return fail(res, '机构不存在', 404);
    req.body.agencyId = agency.id;
    var course = await AgencyCourse.create(req.body);
    return success(res, course, '课程添加成功');
  } catch (err) {
    return fail(res, '添加失败', 500);
  }
});

router.put('/:id/courses/:cid', requirePermission('agencies:edit'), async function(req, res) {
  try {
    var course = await AgencyCourse.findOne({ where: { id: req.params.cid, agencyId: req.params.id } });
    if (!course) return fail(res, '课程不存在', 404);
    await course.update(req.body);
    return success(res, course, '课程更新成功');
  } catch (err) {
    return fail(res, '更新失败', 500);
  }
});

router.delete('/:id/courses/:cid', requirePermission('agencies:edit'), async function(req, res) {
  try {
    var course = await AgencyCourse.findOne({ where: { id: req.params.cid, agencyId: req.params.id } });
    if (!course) return fail(res, '课程不存在', 404);
    await course.destroy();
    return success(res, null, '课程删除成功');
  } catch (err) {
    return fail(res, '删除失败', 500);
  }
});

module.exports = router;
