// server/routes/orders.js — 优惠券订单管理（核销增强版）
const express = require('express');
const { CouponOrder, Coupon, Agency, User, Commission } = require('../models');
const { authMiddleware } = require('../middleware/auth');
const { success, fail, paginate } = require('../utils/response');
const { logAction } = require('../utils/logger');
const { Op } = require('sequelize');

const router = express.Router();
router.use(authMiddleware);

// 订单列表
router.get('/', async function(req, res) {
  try {
    var page = parseInt(req.query.page) || 1;
    var pageSize = parseInt(req.query.pageSize) || 10;
    var where = {};
    if (req.query.status) { where.status = req.query.status; }
    if (req.query.keyword) {
      where[Op.or] = [
        { orderNo: { [Op.like]: '%' + req.query.keyword + '%' } },
        { verifyCode: { [Op.like]: '%' + req.query.keyword + '%' } }
      ];
    }
    if (req.query.startDate && req.query.endDate) {
      where.claimDate = { [Op.between]: [req.query.startDate, req.query.endDate + ' 23:59:59'] };
    }
    var result = await CouponOrder.findAndCountAll({
      where: where,
      include: [
        { model: Coupon, as: 'coupon', attributes: ['id', 'title', 'valueText', 'type', 'shareRewardAmount'] },
        { model: Agency, as: 'agency', attributes: ['id', 'name'] },
        { model: User, as: 'user', attributes: ['id', 'nickname', 'phone'] },
        { model: User, as: 'sharer', attributes: ['id', 'nickname', 'phone', 'memberLevel'] }
      ],
      order: [['createdAt', 'DESC']],
      limit: pageSize,
      offset: (page - 1) * pageSize
    });
    return paginate(res, result.rows, result.count, page, pageSize);
  } catch (err) {
    return fail(res, '查询失败: ' + err.message, 500);
  }
});

// 订单详情
router.get('/:id', async function(req, res) {
  try {
    var order = await CouponOrder.findByPk(req.params.id, {
      include: [
        { model: Coupon, as: 'coupon' },
        { model: Agency, as: 'agency' },
        { model: User, as: 'user' },
        { model: User, as: 'sharer', attributes: ['id', 'nickname', 'phone', 'memberLevel'] }
      ]
    });
    if (!order) return fail(res, '订单不存在', 404);
    return success(res, order);
  } catch (err) {
    return fail(res, '查询失败', 500);
  }
});

// 核销（增强版：核销时自动触发分享奖励金）
router.put('/:id/verify', async function(req, res) {
  try {
    var order = await CouponOrder.findByPk(req.params.id, {
      include: [{ model: Coupon, as: 'coupon' }]
    });
    if (!order) return fail(res, '订单不存在', 404);
    if (order.status !== 'unused') return fail(res, '该订单状态无法核销');

    // 1. 更新核销状态
    await order.update({
      status: 'used',
      useDate: new Date(),
      operatorId: req.admin.id,
      agencyId: req.body.agencyId || order.agencyId
    });

    var rewardInfo = null;

    // 2. 检查是否需要触发分享奖励金
    if (order.sharerId && !order.rewardSettled && order.coupon && order.coupon.shareRewardAmount > 0) {
      var sharer = await User.findByPk(order.sharerId);
      if (sharer && (sharer.memberLevel === 'senior' || sharer.memberLevel === 'partner')) {
        // 创建佣金记录
        await Commission.create({
          userId: sharer.id,
          referUserId: order.userId,
          couponOrderId: order.id,
          source: 'coupon_share',
          amount: order.coupon.shareRewardAmount,
          status: 'pending'
        });
        // 更新推广统计
        await sharer.increment({
          totalEarning: parseFloat(order.coupon.shareRewardAmount),
          totalRefer: 1
        });
        // 标记奖励已结算
        await order.update({ rewardSettled: true });

        rewardInfo = {
          sharerId: sharer.id,
          sharerName: sharer.nickname,
          rewardAmount: order.coupon.shareRewardAmount
        };
      }
    }

    await logAction(req, 'order', 'verify', 'CouponOrder', order.id,
      '核销订单: ' + order.orderNo + (rewardInfo ? '，触发分享奖励 ¥' + rewardInfo.rewardAmount + ' 给 ' + rewardInfo.sharerName : ''));

    return success(res, { order: order, rewardInfo: rewardInfo }, '核销成功');
  } catch (err) {
    return fail(res, '核销失败: ' + err.message, 500);
  }
});

// 作废
router.put('/:id/cancel', async function(req, res) {
  try {
    var order = await CouponOrder.findByPk(req.params.id);
    if (!order) return fail(res, '订单不存在', 404);
    if (order.status !== 'unused') return fail(res, '该订单状态无法作废');
    await order.update({ status: 'cancelled' });
    await logAction(req, 'order', 'cancel', 'CouponOrder', order.id, '作废订单: ' + order.orderNo);
    return success(res, order, '已作废');
  } catch (err) {
    return fail(res, '操作失败', 500);
  }
});

module.exports = router;
