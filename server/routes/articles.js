// server/routes/articles.js — 文章 CRUD
const express = require('express');
const { Article } = require('../models');
const { authMiddleware } = require('../middleware/auth');
const { success, fail, paginate } = require('../utils/response');
const { Op } = require('sequelize');

const router = express.Router();
router.use(authMiddleware);

router.get('/', async function(req, res) {
  try {
    var page = parseInt(req.query.page) || 1;
    var pageSize = parseInt(req.query.pageSize) || 10;
    var where = {};
    if (req.query.status) where.status = req.query.status;
    if (req.query.category) where.category = req.query.category;
    if (req.query.keyword) where.title = { [Op.like]: '%' + req.query.keyword + '%' };
    var result = await Article.findAndCountAll({
      where: where, order: [['sortOrder', 'DESC'], ['createdAt', 'DESC']],
      limit: pageSize, offset: (page - 1) * pageSize
    });
    return paginate(res, result.rows, result.count, page, pageSize);
  } catch (err) { return fail(res, '查询失败: ' + err.message, 500); }
});

router.get('/:id', async function(req, res) {
  try {
    var article = await Article.findByPk(req.params.id);
    if (!article) return fail(res, '文章不存在', 404);
    return success(res, article);
  } catch (err) { return fail(res, '查询失败', 500); }
});

router.post('/', async function(req, res) {
  try {
    if (!req.body.title) return fail(res, '标题不能为空');
    var article = await Article.create(req.body);
    return success(res, article, '创建成功');
  } catch (err) { return fail(res, '创建失败: ' + err.message, 500); }
});

router.put('/:id', async function(req, res) {
  try {
    var article = await Article.findByPk(req.params.id);
    if (!article) return fail(res, '文章不存在', 404);
    await article.update(req.body);
    return success(res, article, '更新成功');
  } catch (err) { return fail(res, '更新失败', 500); }
});

router.delete('/:id', async function(req, res) {
  try {
    var article = await Article.findByPk(req.params.id);
    if (!article) return fail(res, '文章不存在', 404);
    await article.destroy();
    return success(res, null, '删除成功');
  } catch (err) { return fail(res, '删除失败', 500); }
});

// 发布/下架
router.put('/:id/status', async function(req, res) {
  try {
    var article = await Article.findByPk(req.params.id);
    if (!article) return fail(res, '文章不存在', 404);
    var status = req.body.status;
    var update = { status: status };
    if (status === 'published' && !article.publishedAt) update.publishedAt = new Date();
    await article.update(update);
    return success(res, article, '状态更新成功');
  } catch (err) { return fail(res, '操作失败', 500); }
});

module.exports = router;
