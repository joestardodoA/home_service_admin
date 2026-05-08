// server/routes/coupons.js — 优惠券 CRUD
const express = require('express');
const { Coupon } = require('../models');
const { authMiddleware, requirePermission } = require('../middleware/auth');
const { success, fail, paginate } = require('../utils/response');
const { Op } = require('sequelize');

const router = express.Router();
router.use(authMiddleware);

// 列表（分页+搜索+状态筛选）
router.get('/', requirePermission('coupons:view'), async function(req, res) {
  try {
    var page = parseInt(req.query.page) || 1;
    var pageSize = parseInt(req.query.pageSize) || 10;
    var where = {};
    if (req.query.status) { where.status = req.query.status; }
    if (req.query.keyword) {
      where.title = { [Op.like]: '%' + req.query.keyword + '%' };
    }
    var result = await Coupon.findAndCountAll({
      where: where,
      order: [['sortOrder', 'DESC'], ['createdAt', 'DESC']],
      limit: pageSize,
      offset: (page - 1) * pageSize
    });
    return paginate(res, result.rows, result.count, page, pageSize);
  } catch (err) {
    return fail(res, '查询失败: ' + err.message, 500);
  }
});

// 详情
router.get('/:id', async function(req, res) {
  try {
    var coupon = await Coupon.findByPk(req.params.id);
    if (!coupon) return fail(res, '优惠券不存在', 404);
    return success(res, coupon);
  } catch (err) {
    return fail(res, '查询失败', 500);
  }
});

// 创建
router.post('/', requirePermission('coupons:create'), async function(req, res) {
  try {
    var data = req.body;
    if (!data.title) return fail(res, '券名称不能为空');
    // 设置剩余数量 = 总量
    data.remainCount = data.totalCount || 0;
    var coupon = await Coupon.create(data);
    return success(res, coupon, '创建成功');
  } catch (err) {
    return fail(res, '创建失败: ' + err.message, 500);
  }
});

// 编辑
router.put('/:id', requirePermission('coupons:edit'), async function(req, res) {
  try {
    var coupon = await Coupon.findByPk(req.params.id);
    if (!coupon) return fail(res, '优惠券不存在', 404);
    // 白名单：排除不可手动修改的统计字段
    var updates = Object.assign({}, req.body);
    delete updates.id;
    delete updates.claimedCount;
    delete updates.remainCount;
    delete updates.createdAt;
    delete updates.updatedAt;
    await coupon.update(updates);
    return success(res, coupon, '更新成功');
  } catch (err) {
    return fail(res, '更新失败: ' + err.message, 500);
  }
});

// 删除（仅草稿可删）
router.delete('/:id', requirePermission('coupons:delete'), async function(req, res) {
  try {
    var coupon = await Coupon.findByPk(req.params.id);
    if (!coupon) return fail(res, '优惠券不存在', 404);
    if (coupon.status !== 'draft') return fail(res, '仅草稿状态可删除');
    await coupon.destroy();
    return success(res, null, '删除成功');
  } catch (err) {
    return fail(res, '删除失败', 500);
  }
});

// 上架/下架
router.put('/:id/status', requirePermission('coupons:edit'), async function(req, res) {
  try {
    var coupon = await Coupon.findByPk(req.params.id);
    if (!coupon) return fail(res, '优惠券不存在', 404);
    var newStatus = req.body.status;
    if (['online', 'offline', 'draft'].indexOf(newStatus) === -1) {
      return fail(res, '无效状态');
    }
    await coupon.update({ status: newStatus });
    return success(res, coupon, '状态更新成功');
  } catch (err) {
    return fail(res, '操作失败', 500);
  }
});

module.exports = router;
