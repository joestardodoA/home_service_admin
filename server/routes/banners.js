// server/routes/banners.js — Banner 管理
const express = require('express');
const { Banner } = require('../models');
const { authMiddleware } = require('../middleware/auth');
const { success, fail } = require('../utils/response');

const router = express.Router();
router.use(authMiddleware);

router.get('/', async function(req, res) {
  try {
    var list = await Banner.findAll({ order: [['sortOrder', 'DESC'], ['createdAt', 'DESC']] });
    return success(res, list);
  } catch (err) { return fail(res, '查询失败', 500); }
});

router.post('/', async function(req, res) {
  try {
    if (!req.body.title) return fail(res, '标题不能为空');
    var banner = await Banner.create(req.body);
    return success(res, banner, '创建成功');
  } catch (err) { return fail(res, '创建失败', 500); }
});

router.put('/:id', async function(req, res) {
  try {
    var banner = await Banner.findByPk(req.params.id);
    if (!banner) return fail(res, 'Banner 不存在', 404);
    await banner.update(req.body);
    return success(res, banner, '更新成功');
  } catch (err) { return fail(res, '更新失败', 500); }
});

router.delete('/:id', async function(req, res) {
  try {
    var banner = await Banner.findByPk(req.params.id);
    if (!banner) return fail(res, 'Banner 不存在', 404);
    await banner.destroy();
    return success(res, null, '删除成功');
  } catch (err) { return fail(res, '删除失败', 500); }
});

module.exports = router;
