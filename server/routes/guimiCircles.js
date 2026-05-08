/**
 * server/routes/guimiCircles.js — 后台闺蜜圈管理（海南椰嫂综合平台）
 *
 * 功能说明:
 *   管理员可查看所有闺蜜圈列表、详情（含成员），并可强制解散。
 *   解散时同步清除成员关系和作废未使用的邀请码。
 *
 * 接口清单（挂载在 /api/guimi-circles 下，需 JWT 认证）:
 *   GET    /     — 闺蜜圈列表（分页，可按状态/工种/圈主名筛选）
 *   GET    /:id  — 闺蜜圈详情（含分页成员列表）
 *   DELETE /:id  — 管理员强制解散（需 users:edit 权限）
 */
const express = require('express');
const { GuimiCircle, GuimiCircleMember, GuimiInviteCode, GuimiCircleEvent, User, JobType } = require('../models');
const { authMiddleware, requirePermission } = require('../middleware/auth');
const { success, fail, paginate } = require('../utils/response');
const { logAction } = require('../utils/logger');
const { Op } = require('sequelize');

const router = express.Router();
router.use(authMiddleware);

// 闺蜜圈列表（分页 + 筛选）
router.get('/', requirePermission('users:view'), async function(req, res) {
  try {
    var page = parseInt(req.query.page) || 1;
    var pageSize = parseInt(req.query.pageSize) || 10;
    var where = {};

    // 按状态筛选
    if (req.query.status) where.status = req.query.status;
    else where.status = 'active';

    // 按工种筛选
    if (req.query.jobTypeId) where.jobTypeId = parseInt(req.query.jobTypeId);

    // 按圈主搜索
    var ownerWhere = {};
    if (req.query.ownerName) {
      ownerWhere.nickname = { [Op.like]: '%' + req.query.ownerName + '%' };
    }

    var result = await GuimiCircle.findAndCountAll({
      where: where,
      include: [
        { model: User, as: 'owner', attributes: ['id', 'nickname', 'avatar', 'phone'], where: ownerWhere, required: !!req.query.ownerName },
        { model: JobType, as: 'jobType', attributes: ['id', 'name', 'icon'] }
      ],
      order: [['createdAt', 'DESC']],
      limit: pageSize,
      offset: (page - 1) * pageSize
    });

    return paginate(res, result.rows, result.count, page, pageSize);
  } catch (err) { return fail(res, '查询失败: ' + err.message, 500); }
});

// 闺蜜圈详情 + 成员列表
router.get('/:id', requirePermission('users:view'), async function(req, res) {
  try {
    var circle = await GuimiCircle.findByPk(req.params.id, {
      include: [
        { model: User, as: 'owner', attributes: ['id', 'nickname', 'avatar', 'phone'] },
        { model: JobType, as: 'jobType' }
      ]
    });
    if (!circle) return fail(res, '闺蜜圈不存在', 404);

    // 成员列表
    var page = parseInt(req.query.page) || 1;
    var pageSize = parseInt(req.query.pageSize) || 20;
    var members = await GuimiCircleMember.findAndCountAll({
      where: { circleId: circle.id },
      include: [{ model: User, as: 'user', attributes: ['id', 'nickname', 'avatar', 'phone', 'city', 'isRealAuth', 'points'] }],
      order: [['role', 'ASC'], ['joinedAt', 'ASC']],
      limit: pageSize,
      offset: (page - 1) * pageSize
    });

    var result = circle.toJSON();
    result.members = {
      list: members.rows,
      total: members.count,
      page: page,
      pageSize: pageSize
    };

    return success(res, result);
  } catch (err) { return fail(res, '查询失败: ' + err.message, 500); }
});

// 管理员强制解散
router.delete('/:id', requirePermission('users:edit'), async function(req, res) {
  try {
    var circle = await GuimiCircle.findByPk(req.params.id);
    if (!circle) return fail(res, '闺蜜圈不存在', 404);
    if (circle.status === 'disbanded') return fail(res, '已经解散了');

    await circle.update({ status: 'disbanded' });
    await GuimiCircleMember.destroy({ where: { circleId: circle.id } });
    // 作废所有未使用的临时邀请码
    await GuimiInviteCode.update({ used: true }, { where: { circleId: circle.id, used: false } });

    await logAction(req, 'guimi_circle', 'disband', 'GuimiCircle', circle.id,
      '管理员强制解散闺蜜圈: ' + circle.name);

    return success(res, null, '闺蜜圈已解散');
  } catch (err) { return fail(res, '操作失败: ' + err.message, 500); }
});

// 管理员查看圈子事件流
router.get('/:id/events', requirePermission('users:view'), async function(req, res) {
  try {
    var circleId = parseInt(req.params.id);
    var circle = await GuimiCircle.findByPk(circleId);
    if (!circle) return fail(res, '闺蜜圈不存在', 404);

    var page = parseInt(req.query.page) || 1;
    var pageSize = parseInt(req.query.pageSize) || 20;
    var where = { circleId: circleId };
    if (req.query.eventType) where.eventType = req.query.eventType;

    var result = await GuimiCircleEvent.findAndCountAll({
      where: where,
      include: [{ model: User, as: 'user', attributes: ['id', 'nickname', 'avatar', 'phone'] }],
      order: [['createdAt', 'DESC']],
      limit: pageSize,
      offset: (page - 1) * pageSize
    });

    return paginate(res, result.rows, result.count, page, pageSize);
  } catch (err) { return fail(res, '查询失败: ' + err.message, 500); }
});

// 管理员查看退出中成员
router.get('/:id/leaving-members', requirePermission('users:view'), async function(req, res) {
  try {
    var circleId = parseInt(req.params.id);
    var members = await GuimiCircleMember.findAll({
      where: { circleId: circleId, status: 'leaving' },
      include: [{ model: User, as: 'user', attributes: ['id', 'nickname', 'avatar', 'phone', 'city'] }],
      order: [['leaveRequestAt', 'ASC']]
    });

    // 计算剩余冷静期天数
    var result = members.map(function(m) {
      var data = m.toJSON();
      var passed = (Date.now() - new Date(m.leaveRequestAt).getTime()) / (24 * 60 * 60 * 1000);
      data.daysRemaining = Math.max(0, Math.ceil(7 - passed));
      return data;
    });

    return success(res, result);
  } catch (err) { return fail(res, '查询失败: ' + err.message, 500); }
});

// 管理员查看待审批成员
router.get('/:id/pending-members', requirePermission('users:view'), async function(req, res) {
  try {
    var circleId = parseInt(req.params.id);
    var members = await GuimiCircleMember.findAll({
      where: { circleId: circleId, status: 'pending' },
      include: [{ model: User, as: 'user', attributes: ['id', 'nickname', 'avatar', 'phone', 'city', 'isRealAuth'] }],
      order: [['createdAt', 'ASC']]
    });
    return success(res, members);
  } catch (err) { return fail(res, '查询失败: ' + err.message, 500); }
});

module.exports = router;
