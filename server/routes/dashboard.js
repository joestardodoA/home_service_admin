// server/routes/dashboard.js — 看板统计（海南椰嫂综合平台）
const express = require('express');
const { Coupon, Agency, CouponOrder, User, Commission } = require('../models');
const { authMiddleware } = require('../middleware/auth');
const { success, fail } = require('../utils/response');
const { Op, fn, col, literal } = require('sequelize');

const router = express.Router();
router.use(authMiddleware);

// 核心指标
router.get('/stats', async function(req, res) {
  try {
    var today = new Date();
    today.setHours(0, 0, 0, 0);
    var monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    var totalUsers = await User.count();
    var todayUsers = await User.count({ where: { createdAt: { [Op.gte]: today } } });
    var totalCoupons = await Coupon.count({ where: { status: 'online' } });
    var totalAgencies = await Agency.count({ where: { status: 'active' } });
    var totalOrders = await CouponOrder.count();
    var unusedOrders = await CouponOrder.count({ where: { status: 'unused' } });
    var usedOrders = await CouponOrder.count({ where: { status: 'used' } });
    var todayClaimed = await CouponOrder.count({ where: { createdAt: { [Op.gte]: today } } });
    var todayVerified = await CouponOrder.count({ where: { status: 'used', useDate: { [Op.gte]: today } } });
    // 推广员数 = 高级会员 + 合伙人（替代已废弃的 Recommender 模型）
    var totalPromoters = await User.count({ where: { memberLevel: { [Op.in]: ['senior', 'partner'] } } });
    var monthCommission = await Commission.sum('amount', { where: { createdAt: { [Op.gte]: monthStart } } }) || 0;

    return success(res, {
      totalUsers: totalUsers,
      todayUsers: todayUsers,
      totalCoupons: totalCoupons,
      totalAgencies: totalAgencies,
      totalOrders: totalOrders,
      unusedOrders: unusedOrders,
      usedOrders: usedOrders,
      todayClaimed: todayClaimed,
      todayVerified: todayVerified,
      totalPromoters: totalPromoters,
      monthCommission: parseFloat(monthCommission)
    });
  } catch (err) {
    return fail(res, '统计失败: ' + err.message, 500);
  }
});

// 趋势数据
router.get('/trends', async function(req, res) {
  try {
    var days = parseInt(req.query.days) || 7;
    var userTrends = [];
    var orderTrends = [];

    for (var i = days - 1; i >= 0; i--) {
      var d = new Date();
      d.setDate(d.getDate() - i);
      var dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      var dayEnd = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
      var label = (d.getMonth() + 1) + '/' + d.getDate();

      var userCount = await User.count({ where: { createdAt: { [Op.gte]: dayStart, [Op.lt]: dayEnd } } });
      var orderCount = await CouponOrder.count({ where: { createdAt: { [Op.gte]: dayStart, [Op.lt]: dayEnd } } });

      userTrends.push({ date: label, count: userCount });
      orderTrends.push({ date: label, count: orderCount });
    }

    // 优惠券类型分布
    var freeCount = await Coupon.count({ where: { type: 'free' } });
    var discountCount = await Coupon.count({ where: { type: 'discount' } });
    var cashCount = await Coupon.count({ where: { type: 'cash' } });

    return success(res, {
      userTrends: userTrends,
      orderTrends: orderTrends,
      couponTypes: [
        { name: '免费券', value: freeCount },
        { name: '折扣券', value: discountCount },
        { name: '现金券', value: cashCount }
      ]
    });
  } catch (err) {
    return fail(res, '趋势查询失败: ' + err.message, 500);
  }
});

// 机构核销排行
router.get('/rankings', async function(req, res) {
  try {
    var agencies = await Agency.findAll({ where: { status: 'active' }, attributes: ['id', 'name'] });
    var rankings = [];
    for (var i = 0; i < agencies.length; i++) {
      var count = await CouponOrder.count({ where: { agencyId: agencies[i].id, status: 'used' } });
      rankings.push({ name: agencies[i].name, count: count });
    }
    // 按核销量排序取 TOP 5
    rankings.sort(function(a, b) { return b.count - a.count; });
    rankings = rankings.slice(0, 5);
    return success(res, rankings);
  } catch (err) {
    return fail(res, '排行查询失败: ' + err.message, 500);
  }
});

module.exports = router;
