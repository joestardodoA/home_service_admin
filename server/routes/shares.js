// server/routes/shares.js — 后台分享追溯管理（海南椰嫂综合平台）
const express = require('express');
const { ShareRecord, User, Coupon, ServiceOrder, CouponOrder } = require('../models');
const { authMiddleware, requirePermission } = require('../middleware/auth');
const { success, fail, paginate } = require('../utils/response');
const { Op } = require('sequelize');

const router = express.Router();
router.use(authMiddleware);
router.use(requirePermission('shares:view'));

// 分享记录列表
router.get('/', async function(req, res) {
  try {
    var page = parseInt(req.query.page) || 1;
    var pageSize = parseInt(req.query.pageSize) || 10;
    var where = {};
    if (req.query.shareType) where.shareType = req.query.shareType;
    if (req.query.sharerId) where.sharerId = parseInt(req.query.sharerId);
    if (req.query.startDate && req.query.endDate) {
      where.createdAt = { [Op.between]: [req.query.startDate, req.query.endDate + ' 23:59:59'] };
    }

    var result = await ShareRecord.findAndCountAll({
      where: where,
      include: [
        { model: User, as: 'sharer', attributes: ['id', 'nickname', 'phone', 'avatar', 'memberLevel'] }
      ],
      order: [['createdAt', 'DESC']],
      limit: pageSize,
      offset: (page - 1) * pageSize
    });
    return paginate(res, result.rows, result.count, page, pageSize);
  } catch (err) { return fail(res, '查询失败: ' + err.message, 500); }
});

// 分享详情（含统计）
router.get('/:id', async function(req, res) {
  try {
    var record = await ShareRecord.findByPk(req.params.id, {
      include: [
        { model: User, as: 'sharer', attributes: ['id', 'nickname', 'phone', 'avatar', 'memberLevel'] }
      ]
    });
    if (!record) return fail(res, '分享记录不存在', 404);

    var result = record.toJSON();

    // 根据分享类型，获取目标信息
    if (record.shareType === 'coupon' && record.targetId) {
      var coupon = await Coupon.findByPk(record.targetId, { attributes: ['id', 'title', 'valueText'] });
      result.target = coupon;
      // 通过此分享产生的领取
      var claimOrders = await CouponOrder.findAll({
        where: { shareRecordId: record.id },
        include: [{ model: User, as: 'user', attributes: ['id', 'nickname'] }],
        attributes: ['id', 'orderNo', 'status', 'createdAt']
      });
      result.claimDetails = claimOrders;
    } else if (record.shareType === 'service_order' && record.targetId) {
      var order = await ServiceOrder.findByPk(record.targetId, { attributes: ['id', 'orderNo', 'status'] });
      result.target = order;
    }

    return success(res, result);
  } catch (err) { return fail(res, '查询失败: ' + err.message, 500); }
});

// 某用户的所有分享记录
router.get('/user/:userId', async function(req, res) {
  try {
    var page = parseInt(req.query.page) || 1;
    var pageSize = parseInt(req.query.pageSize) || 10;
    var result = await ShareRecord.findAndCountAll({
      where: { sharerId: req.params.userId },
      order: [['createdAt', 'DESC']],
      limit: pageSize,
      offset: (page - 1) * pageSize
    });
    return paginate(res, result.rows, result.count, page, pageSize);
  } catch (err) { return fail(res, '查询失败: ' + err.message, 500); }
});

module.exports = router;
