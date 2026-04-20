// server/routes/users.js — 用户管理 + 认证审核 + 会员等级 + 积分 + 佣金（海南椰嫂综合平台）
const express = require('express');
const { User, Commission, CouponOrder, Message, ShareRecord } = require('../models');
const { authMiddleware, requirePermission } = require('../middleware/auth');
const { success, fail, paginate } = require('../utils/response');
const { logAction } = require('../utils/logger');
const { Op } = require('sequelize');

const router = express.Router();
router.use(authMiddleware);

// 用户列表
router.get('/', async function(req, res) {
  try {
    var page = parseInt(req.query.page) || 1;
    var pageSize = parseInt(req.query.pageSize) || 10;
    var where = {};
    if (req.query.authStatus) where.authStatus = req.query.authStatus;
    if (req.query.memberLevel) where.memberLevel = req.query.memberLevel;
    if (req.query.keyword) {
      where[Op.or] = [
        { nickname: { [Op.like]: '%' + req.query.keyword + '%' } },
        { phone: { [Op.like]: '%' + req.query.keyword + '%' } },
        { realName: { [Op.like]: '%' + req.query.keyword + '%' } }
      ];
    }
    var result = await User.findAndCountAll({
      where: where, order: [['createdAt', 'DESC']],
      limit: pageSize, offset: (page - 1) * pageSize
    });
    return paginate(res, result.rows, result.count, page, pageSize);
  } catch (err) { return fail(res, '查询失败: ' + err.message, 500); }
});

// 用户详情
router.get('/:id', async function(req, res) {
  try {
    var user = await User.findByPk(req.params.id);
    if (!user) return fail(res, '用户不存在', 404);
    return success(res, user);
  } catch (err) { return fail(res, '查询失败', 500); }
});

// 审核通过
router.put('/:id/approve', async function(req, res) {
  try {
    var user = await User.findByPk(req.params.id);
    if (!user) return fail(res, '用户不存在', 404);
    await user.update({ authStatus: 'approved', isRealAuth: true, authRejectReason: '' });
    await logAction(req, 'user', 'approve', 'User', user.id, '审核通过: ' + (user.realName || user.nickname));
    return success(res, user, '审核通过');
  } catch (err) { return fail(res, '操作失败', 500); }
});

// 审核拒绝
router.put('/:id/reject', async function(req, res) {
  try {
    var user = await User.findByPk(req.params.id);
    if (!user) return fail(res, '用户不存在', 404);
    await user.update({
      authStatus: 'rejected',
      isRealAuth: false,
      authRejectReason: req.body.reason || '信息不完整'
    });
    await logAction(req, 'user', 'reject', 'User', user.id, '审核拒绝: ' + (user.realName || user.nickname));
    return success(res, user, '已拒绝');
  } catch (err) { return fail(res, '操作失败', 500); }
});

// 设置会员等级
router.put('/:id/level', requirePermission('users:level'), async function(req, res) {
  try {
    var user = await User.findByPk(req.params.id);
    if (!user) return fail(res, '用户不存在', 404);
    var newLevel = req.body.memberLevel;
    if (['normal', 'senior', 'partner'].indexOf(newLevel) === -1) {
      return fail(res, '无效的会员等级');
    }
    var oldLevel = user.memberLevel;
    await user.update({ memberLevel: newLevel });
    await logAction(req, 'user', 'level', 'User', user.id,
      '会员等级变更: ' + oldLevel + ' → ' + newLevel + ' (' + (user.realName || user.nickname) + ')');
    return success(res, user, '会员等级已更新');
  } catch (err) { return fail(res, '操作失败', 500); }
});

// 积分管理（手动增减）
router.put('/:id/points', requirePermission('users:points'), async function(req, res) {
  try {
    var user = await User.findByPk(req.params.id);
    if (!user) return fail(res, '用户不存在', 404);
    var action = req.body.action; // 'add' 或 'subtract'
    var amount = parseInt(req.body.amount);
    var remark = req.body.remark || '';
    if (!action || !amount || amount <= 0) {
      return fail(res, '请填写正确的操作和数量');
    }
    if (action === 'subtract' && user.points < amount) {
      return fail(res, '积分不足');
    }
    var newPoints = action === 'add' ? user.points + amount : user.points - amount;
    await user.update({ points: newPoints });

    // 创建站内消息通知用户
    await Message.create({
      userId: user.id,
      type: 'points_reward',
      title: action === 'add' ? '获得积分奖励' : '积分扣除',
      content: (action === 'add' ? '获得 ' : '扣除 ') + amount + ' 积分。' + (remark ? '原因：' + remark : ''),
      linkType: 'points'
    });

    await logAction(req, 'user', 'points', 'User', user.id,
      (action === 'add' ? '增加' : '扣除') + amount + '积分 (' + (user.realName || user.nickname) + ')' +
      (remark ? ' 备注: ' + remark : ''));
    return success(res, { points: newPoints }, '积分操作成功');
  } catch (err) { return fail(res, '操作失败: ' + err.message, 500); }
});

// 查看用户佣金明细
router.get('/:id/commissions', async function(req, res) {
  try {
    var page = parseInt(req.query.page) || 1;
    var pageSize = parseInt(req.query.pageSize) || 10;
    var result = await Commission.findAndCountAll({
      where: { userId: req.params.id },
      include: [
        { model: User, as: 'referUser', attributes: ['id', 'nickname', 'phone'] }
      ],
      order: [['createdAt', 'DESC']],
      limit: pageSize, offset: (page - 1) * pageSize
    });
    return paginate(res, result.rows, result.count, page, pageSize);
  } catch (err) { return fail(res, '查询失败: ' + err.message, 500); }
});

// 查看用户锁粉列表（下级用户）
router.get('/:id/fans', async function(req, res) {
  try {
    var page = parseInt(req.query.page) || 1;
    var pageSize = parseInt(req.query.pageSize) || 10;
    var result = await User.findAndCountAll({
      where: { inviterId: req.params.id },
      attributes: ['id', 'nickname', 'phone', 'avatar', 'memberLevel', 'createdAt'],
      order: [['createdAt', 'DESC']],
      limit: pageSize, offset: (page - 1) * pageSize
    });
    return paginate(res, result.rows, result.count, page, pageSize);
  } catch (err) { return fail(res, '查询失败: ' + err.message, 500); }
});

// 查看用户分享记录
router.get('/:id/shares', async function(req, res) {
  try {
    var page = parseInt(req.query.page) || 1;
    var pageSize = parseInt(req.query.pageSize) || 10;
    var where = { sharerId: req.params.id };
    if (req.query.shareType) where.shareType = req.query.shareType;
    var result = await ShareRecord.findAndCountAll({
      where: where,
      order: [['createdAt', 'DESC']],
      limit: pageSize, offset: (page - 1) * pageSize
    });
    return paginate(res, result.rows, result.count, page, pageSize);
  } catch (err) { return fail(res, '查询失败: ' + err.message, 500); }
});

// 查看用户粉丝列表（被锁粉的下级用户）
router.get('/:id/fans', async function(req, res) {
  try {
    var page = parseInt(req.query.page) || 1;
    var pageSize = parseInt(req.query.pageSize) || 10;
    var result = await User.findAndCountAll({
      where: { inviterId: req.params.id },
      attributes: ['id', 'nickname', 'avatar', 'phone', 'city', 'memberLevel', 'authStatus', 'createdAt'],
      order: [['createdAt', 'DESC']],
      limit: pageSize, offset: (page - 1) * pageSize
    });
    return paginate(res, result.rows, result.count, page, pageSize);
  } catch (err) { return fail(res, '查询失败: ' + err.message, 500); }
});

// 查看积分变动记录（通过 Message 表的 points_reward 类型查询）
router.get('/:id/points-log', async function(req, res) {
  try {
    var page = parseInt(req.query.page) || 1;
    var pageSize = parseInt(req.query.pageSize) || 20;
    var result = await Message.findAndCountAll({
      where: { userId: req.params.id, type: 'points_reward' },
      order: [['createdAt', 'DESC']],
      limit: pageSize, offset: (page - 1) * pageSize
    });
    var logs = result.rows.map(function(m) {
      return {
        id: m.id,
        title: m.title,
        content: m.content,
        time: m.createdAt ? m.createdAt.toString().slice(0, 19).replace('T', ' ') : '',
        isRead: m.isRead
      };
    });
    return paginate(res, logs, result.count, page, pageSize);
  } catch (err) { return fail(res, '查询失败: ' + err.message, 500); }
});

module.exports = router;
