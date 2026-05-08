/**
 * server/routes/guimiPublic.js — 小程序端闺蜜圈 API（海南椰嫂综合平台）
 *
 * 挂载在 /api/public/guimi 下，需用户登录（miniapp JWT）
 *
 * 接口清单:
 *   POST   /apply/:inviteCode  — 申请加入圈子
 *   GET    /my-circles         — 获取我的圈子列表
 *   POST   /leave/:circleId    — 申请退出圈子
 *   POST   /cancel-leave/:circleId — 取消退出（冷静期内）
 *   GET    /events/:circleId   — 圈主查看圈子动态
 *   PUT    /events/:id/read    — 标记事件已读
 *   POST   /approve/:memberId  — 圈主审批通过
 *   POST   /reject/:memberId   — 圈主审批拒绝
 *   GET    /pending/:circleId  — 圈主查看待审批列表
 *   GET    /member-chain/:circleId/:userId — 成员链路还原
 */
const express = require('express');
const { GuimiCircle, GuimiCircleMember, GuimiCircleEvent, GuimiInviteCode, User, JobType } = require('../models');
const { success, fail } = require('../utils/response');
const { recordCircleEvent } = require('../utils/circleEvent');
const { Op } = require('sequelize');

const router = express.Router();

// 小程序 JWT 认证中间件（与 public.js 保持一致）
var wxJwt = require('jsonwebtoken');
var WX_JWT_SECRET = process.env.WX_JWT_SECRET || 'wx_dev_secret_coconut_2026';

router.use(async function(req, res, next) {
  var token = req.headers['x-user-token'] || '';
  if (!token) return fail(res, '请先登录', 401);
  try {
    var decoded = wxJwt.verify(token, WX_JWT_SECRET);
    if (decoded && decoded.userId) {
      req.wxUser = await User.findByPk(decoded.userId);
      req.wxUserId = decoded.userId;
      if (!req.wxUser) return fail(res, '用户不存在', 401);
      return next();
    }
    return fail(res, '登录已过期', 401);
  } catch (e) {
    return fail(res, '登录已过期', 401);
  }
});

// ==================== 申请加入圈子 ====================
router.post('/apply/:inviteCode', async function(req, res) {
  try {
    var userId = req.wxUserId;
    var inviteCode = req.params.inviteCode;

    // 查找圈子
    var circle = await GuimiCircle.findOne({ where: { inviteCode: inviteCode, status: 'active' } });
    if (!circle) return fail(res, '圈子不存在或已解散');
    if (circle.memberCount >= circle.maxMembers) return fail(res, '圈子已满');

    // 不能加入自己的圈子（已经是圈主）
    if (circle.ownerId === userId) return fail(res, '你已经是该圈子的圈主');

    // 同工种一圈限制：检查该用户在同一工种下是否已有活跃成员记录
    var existingActive = await GuimiCircleMember.findOne({
      where: { userId: userId, status: 'active' },
      include: [{ model: GuimiCircle, as: 'circle', where: { jobTypeId: circle.jobTypeId, status: 'active' } }]
    });
    if (existingActive) return fail(res, '你已加入该工种的圈子，每个工种只能加入一个圈子');

    // 检查是否在冷静期（7 天内退出过该圈子不能重新申请）
    var recentLeft = await GuimiCircleMember.findOne({
      where: {
        circleId: circle.id,
        userId: userId,
        status: { [Op.in]: ['leaving', 'left'] },
        leaveRequestAt: { [Op.gt]: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
      }
    });
    if (recentLeft) return fail(res, '退出冷静期内（7天）不能重新申请该圈子');

    // 检查是否已有待审批记录
    var existingPending = await GuimiCircleMember.findOne({
      where: { circleId: circle.id, userId: userId, status: 'pending' }
    });
    if (existingPending) return fail(res, '你已提交过申请，请等待圈主审批');

    // 如果之前有旧的 rejected/left 记录，先删除
    await GuimiCircleMember.destroy({
      where: { circleId: circle.id, userId: userId, status: { [Op.in]: ['rejected', 'left'] } }
    });

    // 创建待审批成员记录
    var member = await GuimiCircleMember.create({
      circleId: circle.id,
      userId: userId,
      role: 'member',
      status: 'pending',
      applyMessage: req.body.message || ''
    });

    // 记录事件
    var user = await User.findByPk(userId, { attributes: ['nickname', 'realName'] });
    var userName = user ? (user.realName || user.nickname) : '未知用户';
    await recordCircleEvent(circle.id, userId, 'member_apply', member.id,
      userName + ' 申请加入' + (req.body.message ? '，留言：' + req.body.message : ''));

    return success(res, { memberId: member.id }, '申请已提交，等待圈主审批');
  } catch (err) { return fail(res, '申请失败: ' + err.message, 500); }
});

// ==================== 获取我的圈子列表 ====================
router.get('/my-circles', async function(req, res) {
  try {
    var userId = req.wxUserId;

    // 查询用户所有活跃的成员关系
    var memberships = await GuimiCircleMember.findAll({
      where: { userId: userId, status: { [Op.in]: ['active', 'leaving', 'pending'] } },
      include: [{
        model: GuimiCircle, as: 'circle',
        where: { status: 'active' },
        include: [
          { model: User, as: 'owner', attributes: ['id', 'nickname', 'avatar'] },
          { model: JobType, as: 'jobType', attributes: ['id', 'name', 'icon'] }
        ]
      }],
      order: [['joinedAt', 'DESC']]
    });

    // 查询用户拥有的圈子
    var ownedCircles = await GuimiCircle.findAll({
      where: { ownerId: userId, status: 'active' },
      include: [{ model: JobType, as: 'jobType', attributes: ['id', 'name', 'icon'] }]
    });

    // 为每个拥有的圈子计算待审批数和未读事件数
    var owned = [];
    for (var i = 0; i < ownedCircles.length; i++) {
      var c = ownedCircles[i].toJSON();
      c.pendingCount = await GuimiCircleMember.count({ where: { circleId: c.id, status: 'pending' } });
      c.unreadEventCount = await GuimiCircleEvent.count({ where: { circleId: c.id, isRead: false } });
      c.isOwner = true;
      owned.push(c);
    }

    return success(res, {
      owned: owned,
      joined: memberships.map(function(m) {
        var data = m.toJSON();
        data.isOwner = false;
        return data;
      })
    });
  } catch (err) { return fail(res, '查询失败: ' + err.message, 500); }
});

// ==================== 申请退出圈子 ====================
router.post('/leave/:circleId', async function(req, res) {
  try {
    var userId = req.wxUserId;
    var circleId = parseInt(req.params.circleId);

    var member = await GuimiCircleMember.findOne({
      where: { circleId: circleId, userId: userId, status: 'active' }
    });
    if (!member) return fail(res, '你不是该圈子的成员');
    if (member.role === 'owner') return fail(res, '圈主不能退出自己的圈子，请先转让或解散');

    // 进入 7 天冷静期
    await member.update({ status: 'leaving', leaveRequestAt: new Date() });

    var user = await User.findByPk(userId, { attributes: ['nickname', 'realName'] });
    var userName = user ? (user.realName || user.nickname) : '未知用户';
    await recordCircleEvent(circleId, userId, 'member_leave_request', null,
      userName + ' 申请退出，进入 7 天冷静期');

    return success(res, null, '退出申请已提交，7天冷静期内可取消');
  } catch (err) { return fail(res, '操作失败: ' + err.message, 500); }
});

// ==================== 取消退出（冷静期内） ====================
router.post('/cancel-leave/:circleId', async function(req, res) {
  try {
    var userId = req.wxUserId;
    var circleId = parseInt(req.params.circleId);

    var member = await GuimiCircleMember.findOne({
      where: { circleId: circleId, userId: userId, status: 'leaving' }
    });
    if (!member) return fail(res, '没有待退出的记录');

    // 检查是否还在 7 天内
    var daysPassed = (Date.now() - new Date(member.leaveRequestAt).getTime()) / (24 * 60 * 60 * 1000);
    if (daysPassed >= 7) return fail(res, '冷静期已过，无法取消');

    await member.update({ status: 'active', leaveRequestAt: null });

    var user = await User.findByPk(userId, { attributes: ['nickname', 'realName'] });
    var userName = user ? (user.realName || user.nickname) : '未知用户';
    await recordCircleEvent(circleId, userId, 'member_retained', null, userName + ' 取消了退出');

    return success(res, null, '已取消退出');
  } catch (err) { return fail(res, '操作失败: ' + err.message, 500); }
});

// ==================== 圈主审批通过 ====================
router.post('/approve/:memberId', async function(req, res) {
  try {
    var ownerId = req.wxUserId;
    var memberId = parseInt(req.params.memberId);

    var member = await GuimiCircleMember.findByPk(memberId, {
      include: [{ model: GuimiCircle, as: 'circle' }]
    });
    if (!member || !member.circle) return fail(res, '记录不存在');
    if (member.circle.ownerId !== ownerId) return fail(res, '只有圈主才能审批');
    if (member.status !== 'pending') return fail(res, '该申请已处理');

    // 再次检查同工种一圈限制
    var existing = await GuimiCircleMember.findOne({
      where: { userId: member.userId, status: 'active' },
      include: [{ model: GuimiCircle, as: 'circle', where: { jobTypeId: member.circle.jobTypeId, status: 'active' } }]
    });
    if (existing) {
      await member.update({ status: 'rejected' });
      return fail(res, '该用户已加入同工种的其他圈子');
    }

    await member.update({ status: 'active', joinedAt: new Date() });
    await GuimiCircle.increment('memberCount', { where: { id: member.circleId } });

    var user = await User.findByPk(member.userId, { attributes: ['nickname', 'realName'] });
    var userName = user ? (user.realName || user.nickname) : '未知用户';
    await recordCircleEvent(member.circleId, member.userId, 'member_join', member.id, userName + ' 加入了圈子');

    return success(res, null, '已通过');
  } catch (err) { return fail(res, '操作失败: ' + err.message, 500); }
});

// ==================== 圈主审批拒绝 ====================
router.post('/reject/:memberId', async function(req, res) {
  try {
    var ownerId = req.wxUserId;
    var memberId = parseInt(req.params.memberId);

    var member = await GuimiCircleMember.findByPk(memberId, {
      include: [{ model: GuimiCircle, as: 'circle' }]
    });
    if (!member || !member.circle) return fail(res, '记录不存在');
    if (member.circle.ownerId !== ownerId) return fail(res, '只有圈主才能审批');
    if (member.status !== 'pending') return fail(res, '该申请已处理');

    await member.update({ status: 'rejected' });

    var user = await User.findByPk(member.userId, { attributes: ['nickname', 'realName'] });
    var userName = user ? (user.realName || user.nickname) : '未知用户';
    await recordCircleEvent(member.circleId, member.userId, 'member_rejected', member.id, userName + ' 的申请被拒绝');

    return success(res, null, '已拒绝');
  } catch (err) { return fail(res, '操作失败: ' + err.message, 500); }
});

// ==================== 待审批列表 ====================
router.get('/pending/:circleId', async function(req, res) {
  try {
    var ownerId = req.wxUserId;
    var circleId = parseInt(req.params.circleId);

    var circle = await GuimiCircle.findByPk(circleId);
    if (!circle) return fail(res, '圈子不存在');
    if (circle.ownerId !== ownerId) return fail(res, '只有圈主才能查看');

    var pending = await GuimiCircleMember.findAll({
      where: { circleId: circleId, status: 'pending' },
      include: [{ model: User, as: 'user', attributes: ['id', 'nickname', 'avatar', 'phone', 'city', 'isRealAuth'] }],
      order: [['createdAt', 'ASC']]
    });

    return success(res, pending);
  } catch (err) { return fail(res, '查询失败: ' + err.message, 500); }
});

// ==================== 圈主查看事件流 ====================
router.get('/events/:circleId', async function(req, res) {
  try {
    var ownerId = req.wxUserId;
    var circleId = parseInt(req.params.circleId);

    var circle = await GuimiCircle.findByPk(circleId);
    if (!circle) return fail(res, '圈子不存在');
    if (circle.ownerId !== ownerId) return fail(res, '只有圈主才能查看动态');

    var page = parseInt(req.query.page) || 1;
    var pageSize = parseInt(req.query.pageSize) || 20;

    var result = await GuimiCircleEvent.findAndCountAll({
      where: { circleId: circleId },
      include: [{ model: User, as: 'user', attributes: ['id', 'nickname', 'avatar'] }],
      order: [['createdAt', 'DESC']],
      limit: pageSize,
      offset: (page - 1) * pageSize
    });

    // 未读数
    var unreadCount = await GuimiCircleEvent.count({ where: { circleId: circleId, isRead: false } });

    return success(res, {
      list: result.rows,
      total: result.count,
      page: page,
      pageSize: pageSize,
      unreadCount: unreadCount
    });
  } catch (err) { return fail(res, '查询失败: ' + err.message, 500); }
});

// ==================== 标记事件已读 ====================
router.put('/events/:id/read', async function(req, res) {
  try {
    var eventId = parseInt(req.params.id);
    var evt = await GuimiCircleEvent.findByPk(eventId, {
      include: [{ model: GuimiCircle, as: 'circle' }]
    });
    if (!evt || !evt.circle) return fail(res, '事件不存在');
    if (evt.circle.ownerId !== req.wxUserId) return fail(res, '无权操作');

    await evt.update({ isRead: true });
    return success(res, null, '已标记已读');
  } catch (err) { return fail(res, '操作失败', 500); }
});

// ==================== 批量标记已读 ====================
router.put('/events/read-all/:circleId', async function(req, res) {
  try {
    var circleId = parseInt(req.params.circleId);
    var circle = await GuimiCircle.findByPk(circleId);
    if (!circle) return fail(res, '圈子不存在');
    if (circle.ownerId !== req.wxUserId) return fail(res, '无权操作');

    await GuimiCircleEvent.update({ isRead: true }, { where: { circleId: circleId, isRead: false } });
    return success(res, null, '已全部标记已读');
  } catch (err) { return fail(res, '操作失败', 500); }
});

// ==================== 成员链路还原 ====================
router.get('/member-chain/:circleId/:userId', async function(req, res) {
  try {
    var ownerId = req.wxUserId;
    var circleId = parseInt(req.params.circleId);
    var targetUserId = parseInt(req.params.userId);

    var circle = await GuimiCircle.findByPk(circleId);
    if (!circle) return fail(res, '圈子不存在');
    if (circle.ownerId !== ownerId) return fail(res, '只有圈主才能查看');

    // 查询该成员在此圈子的所有事件（按时间正序 = 行为链路）
    var events = await GuimiCircleEvent.findAll({
      where: { circleId: circleId, userId: targetUserId },
      order: [['createdAt', 'ASC']]
    });

    // 查询成员基本信息
    var user = await User.findByPk(targetUserId, {
      attributes: ['id', 'nickname', 'avatar', 'phone', 'city', 'isRealAuth', 'memberLevel']
    });

    // 查询成员记录
    var membership = await GuimiCircleMember.findOne({
      where: { circleId: circleId, userId: targetUserId }
    });

    return success(res, {
      user: user,
      membership: membership,
      timeline: events,
      summary: {
        totalEvents: events.length,
        ordersPublished: events.filter(function(e) { return e.eventType === 'order_published'; }).length,
        ordersAccepted: events.filter(function(e) { return e.eventType === 'order_accepted'; }).length,
        couponsClaimed: events.filter(function(e) { return e.eventType === 'coupon_claimed'; }).length,
        couponsVerified: events.filter(function(e) { return e.eventType === 'coupon_verified'; }).length
      }
    });
  } catch (err) { return fail(res, '查询失败: ' + err.message, 500); }
});

module.exports = router;
