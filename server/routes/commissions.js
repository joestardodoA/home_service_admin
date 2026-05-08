/**
 * server/routes/commissions.js — 后台佣金积分管理（海南椰嫂综合平台）
 *
 * 功能说明:
 *   管理员可查看佣金记录、搜索用户、手动增减积分。
 *   所有积分操作均带强制备注和操作日志审计。
 *
 * 业务规则:
 *   - 积分不能扣为负数
 *   - 每次操作必须填写备注（最多200字）
 *   - 增加积分记为 manual_add，扣减记为 manual_deduct
 *   - 兑换流程：用户点击"提现" → 显示线下兑换地点/电话 → 管理员确认后扣减积分
 *
 * 接口清单（挂载在 /api/commissions 下，需 JWT 认证）:
 *   GET  /                — 佣金记录列表（分页+筛选：来源/用户/状态）
 *   GET  /search-user     — 搜索用户（按手机号/昵称/真名模糊搜索）
 *   PUT  /adjust          — 手动增减积分（必填 userId, amount, remark）
 */
const express = require('express');
const { Commission, User } = require('../models');
const { authMiddleware, requirePermission } = require('../middleware/auth');
const { success, fail, paginate } = require('../utils/response');
const { logAction } = require('../utils/logger');
const { Op } = require('sequelize');

const router = express.Router();
router.use(authMiddleware);

// 佣金记录列表（分页 + 筛选）
router.get('/', requirePermission('users:view'), async function(req, res) {
  try {
    var page = parseInt(req.query.page) || 1;
    var pageSize = parseInt(req.query.pageSize) || 10;
    var where = {};

    // 按来源筛选
    if (req.query.source) where.source = req.query.source;
    // 按用户筛选
    if (req.query.userId) where.userId = parseInt(req.query.userId);
    // 按状态筛选
    if (req.query.status) where.status = req.query.status;

    var result = await Commission.findAndCountAll({
      where: where,
      include: [
        { model: User, as: 'user', attributes: ['id', 'nickname', 'avatar', 'phone', 'points'] },
        { model: User, as: 'referUser', attributes: ['id', 'nickname'], required: false }
      ],
      order: [['createdAt', 'DESC']],
      limit: pageSize,
      offset: (page - 1) * pageSize
    });

    return paginate(res, result.rows, result.count, page, pageSize);
  } catch (err) { return fail(res, '查询失败: ' + err.message, 500); }
});

// 搜索用户（用于积分管理）
router.get('/search-user', requirePermission('users:view'), async function(req, res) {
  try {
    var keyword = (req.query.keyword || '').trim();
    if (!keyword || keyword.length < 1) return fail(res, '请输入搜索关键词');

    var where = {
      [Op.or]: [
        { phone: { [Op.like]: '%' + keyword + '%' } },
        { nickname: { [Op.like]: '%' + keyword + '%' } },
        { realName: { [Op.like]: '%' + keyword + '%' } }
      ]
    };

    var users = await User.findAll({
      where: where,
      attributes: ['id', 'nickname', 'avatar', 'phone', 'realName', 'points', 'totalEarning', 'balance', 'isRealAuth'],
      limit: 20
    });

    return success(res, users);
  } catch (err) { return fail(res, '搜索失败: ' + err.message, 500); }
});

// 手动增减积分
router.put('/adjust', requirePermission('users:edit'), async function(req, res) {
  try {
    var userId = parseInt(req.body.userId);
    var amount = parseInt(req.body.amount);
    var remark = (req.body.remark || '').trim();

    if (!userId) return fail(res, '请指定用户');
    if (!amount || amount === 0) return fail(res, '请输入积分数额');
    if (!remark) return fail(res, '请输入操作备注');
    if (remark.length > 200) return fail(res, '备注不能超过200字');

    var user = await User.findByPk(userId);
    if (!user) return fail(res, '用户不存在', 404);

    // 检查扣减后是否为负
    if (amount < 0 && user.points + amount < 0) {
      return fail(res, '积分不足，当前积分: ' + user.points + '，扣减: ' + Math.abs(amount));
    }

    await user.increment('points', { by: amount });
    await user.reload();

    // 记录佣金
    await Commission.create({
      userId: userId,
      source: amount > 0 ? 'manual_add' : 'manual_deduct',
      amount: Math.abs(amount),
      status: 'settled',
      settledAt: new Date(),
      remark: (amount > 0 ? '管理员手动增加积分' : '管理员手动扣减积分（线下兑换）') + ': ' + remark
    });

    await logAction(req, 'commission', amount > 0 ? 'add_points' : 'deduct_points',
      'User', userId,
      '积分' + (amount > 0 ? '增加' : '扣减') + ': ' + Math.abs(amount) + ', 备注: ' + remark + ', 操作后余额: ' + user.points);

    return success(res, {
      userId: user.id,
      nickname: user.nickname,
      points: user.points,
      adjustAmount: amount
    }, '积分' + (amount > 0 ? '增加' : '扣减') + '成功');
  } catch (err) { return fail(res, '操作失败: ' + err.message, 500); }
});

module.exports = router;
