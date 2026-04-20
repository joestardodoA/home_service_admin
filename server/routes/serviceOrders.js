// server/routes/serviceOrders.js — 后台服务订单管理（海南椰嫂综合平台）
const express = require('express');
const { ServiceOrder, OrderApplication, JobType, User, ShareRecord, Message } = require('../models');
const { authMiddleware, requirePermission } = require('../middleware/auth');
const { success, fail, paginate } = require('../utils/response');
const { logAction } = require('../utils/logger');
const { Op } = require('sequelize');

const router = express.Router();
router.use(authMiddleware);

// 服务订单列表
router.get('/', requirePermission('service_orders:manage'), async function(req, res) {
  try {
    var page = parseInt(req.query.page) || 1;
    var pageSize = parseInt(req.query.pageSize) || 10;
    var where = {};
    if (req.query.status) where.status = req.query.status;
    if (req.query.type) where.type = req.query.type;
    if (req.query.jobTypeId) where.jobTypeId = parseInt(req.query.jobTypeId);
    if (req.query.city) where.city = { [Op.like]: '%' + req.query.city + '%' };
    if (req.query.keyword) {
      where[Op.or] = [
        { orderNo: { [Op.like]: '%' + req.query.keyword + '%' } },
        { contactName: { [Op.like]: '%' + req.query.keyword + '%' } },
        { contactPhone: { [Op.like]: '%' + req.query.keyword + '%' } }
      ];
    }
    if (req.query.startDate && req.query.endDate) {
      where.createdAt = { [Op.between]: [req.query.startDate, req.query.endDate + ' 23:59:59'] };
    }

    var result = await ServiceOrder.findAndCountAll({
      where: where,
      include: [
        { model: User, as: 'publisher', attributes: ['id', 'nickname', 'phone', 'avatar'] },
        { model: JobType, as: 'jobType', attributes: ['id', 'name', 'code', 'icon'] },
        { model: User, as: 'acceptedUser', attributes: ['id', 'nickname', 'phone', 'avatar'] }
      ],
      order: [['createdAt', 'DESC']],
      limit: pageSize,
      offset: (page - 1) * pageSize
    });

    // 附加每个订单的接单申请数
    var rows = await Promise.all(result.rows.map(async function(row) {
      var item = row.toJSON();
      item.applicationCount = await OrderApplication.count({ where: { orderId: row.id } });
      return item;
    }));

    return paginate(res, rows, result.count, page, pageSize);
  } catch (err) { return fail(res, '查询失败: ' + err.message, 500); }
});

// 服务订单详情
router.get('/:id', requirePermission('service_orders:manage'), async function(req, res) {
  try {
    var order = await ServiceOrder.findByPk(req.params.id, {
      include: [
        { model: User, as: 'publisher', attributes: ['id', 'nickname', 'phone', 'avatar', 'realName'] },
        { model: JobType, as: 'jobType' },
        { model: User, as: 'acceptedUser', attributes: ['id', 'nickname', 'phone', 'avatar', 'realName', 'memberLevel'] },
        { model: ShareRecord, as: 'shareRecord', include: [{ model: User, as: 'sharer', attributes: ['id', 'nickname'] }] }
      ]
    });
    if (!order) return fail(res, '订单不存在', 404);

    var result = order.toJSON();
    result.applicationCount = await OrderApplication.count({ where: { orderId: order.id } });
    return success(res, result);
  } catch (err) { return fail(res, '查询失败: ' + err.message, 500); }
});

// 审核通过
router.put('/:id/approve', requirePermission('service_orders:manage'), async function(req, res) {
  try {
    var order = await ServiceOrder.findByPk(req.params.id, {
      include: [{ model: JobType, as: 'jobType' }]
    });
    if (!order) return fail(res, '订单不存在', 404);
    if (order.status !== 'pending') return fail(res, '该订单状态无法审核');

    await order.update({ status: 'approved', adminNote: req.body.adminNote || '' });

    // 通知发单人审核通过
    await Message.create({
      userId: order.userId,
      type: 'order_status',
      title: '订单审核通过',
      content: '您发布的' + (order.jobType ? order.jobType.name : '') + '订单已通过审核，正在为您匹配合适的阿姨。',
      linkType: 'service_order',
      linkId: order.id
    });

    await logAction(req, 'service_order', 'approve', 'ServiceOrder', order.id, '审核通过订单: ' + order.orderNo);
    return success(res, order, '审核通过');
  } catch (err) { return fail(res, '操作失败: ' + err.message, 500); }
});

// 审核拒绝
router.put('/:id/reject', requirePermission('service_orders:manage'), async function(req, res) {
  try {
    var order = await ServiceOrder.findByPk(req.params.id);
    if (!order) return fail(res, '订单不存在', 404);
    if (order.status !== 'pending') return fail(res, '该订单状态无法拒绝');

    await order.update({
      status: 'rejected',
      rejectReason: req.body.reason || '不符合发布要求',
      adminNote: req.body.adminNote || ''
    });

    // 通知发单人
    await Message.create({
      userId: order.userId,
      type: 'order_status',
      title: '订单审核未通过',
      content: '您发布的订单未通过审核。原因：' + (req.body.reason || '不符合发布要求'),
      linkType: 'service_order',
      linkId: order.id
    });

    await logAction(req, 'service_order', 'reject', 'ServiceOrder', order.id, '拒绝订单: ' + order.orderNo);
    return success(res, order, '已拒绝');
  } catch (err) { return fail(res, '操作失败: ' + err.message, 500); }
});

// 标记完成
router.put('/:id/complete', requirePermission('service_orders:manage'), async function(req, res) {
  try {
    var order = await ServiceOrder.findByPk(req.params.id);
    if (!order) return fail(res, '订单不存在', 404);
    if (order.status !== 'matched') return fail(res, '该订单状态无法标记完成');

    await order.update({ status: 'completed', adminNote: req.body.adminNote || '' });

    // 通知接单阿姨
    if (order.acceptedUserId) {
      await Message.create({
        userId: order.acceptedUserId,
        type: 'order_status',
        title: '服务订单已完成',
        content: '订单 ' + order.orderNo + ' 已标记为完成，感谢您的服务！',
        linkType: 'service_order',
        linkId: order.id
      });
    }

    await logAction(req, 'service_order', 'complete', 'ServiceOrder', order.id, '完成订单: ' + order.orderNo);
    return success(res, order, '已完成');
  } catch (err) { return fail(res, '操作失败: ' + err.message, 500); }
});

// 查看接单申请列表
router.get('/:id/applications', requirePermission('service_orders:manage'), async function(req, res) {
  try {
    var page = parseInt(req.query.page) || 1;
    var pageSize = parseInt(req.query.pageSize) || 20;
    var where = { orderId: req.params.id };
    if (req.query.status) where.status = req.query.status;

    var result = await OrderApplication.findAndCountAll({
      where: where,
      include: [
        { model: User, as: 'applicant', attributes: ['id', 'nickname', 'phone', 'avatar', 'realName', 'memberLevel', 'isRealAuth', 'preferredJobTypes', 'city'] },
        { model: User, as: 'sharer', attributes: ['id', 'nickname', 'memberLevel'] },
        { model: ShareRecord, as: 'shareRecord', attributes: ['id', 'shareCode', 'shareType'] }
      ],
      order: [['createdAt', 'ASC']],
      limit: pageSize,
      offset: (page - 1) * pageSize
    });

    // 附加每个申请人的历史接单数
    var rows = await Promise.all(result.rows.map(async function(row) {
      var item = row.toJSON();
      item.historyAccepted = await OrderApplication.count({
        where: { userId: row.userId, status: 'accepted' }
      });
      return item;
    }));

    return paginate(res, rows, result.count, page, pageSize);
  } catch (err) { return fail(res, '查询失败: ' + err.message, 500); }
});

// 确认接单（其余申请自动拒绝）
router.put('/applications/:id/accept', requirePermission('service_orders:manage'), async function(req, res) {
  try {
    var application = await OrderApplication.findByPk(req.params.id, {
      include: [
        { model: User, as: 'applicant', attributes: ['id', 'nickname'] },
        { model: User, as: 'sharer', attributes: ['id', 'nickname', 'memberLevel'] }
      ]
    });
    if (!application) return fail(res, '申请不存在', 404);
    if (application.status !== 'pending') return fail(res, '该申请已被处理');

    var order = await ServiceOrder.findByPk(application.orderId, {
      include: [{ model: JobType, as: 'jobType' }]
    });
    if (!order) return fail(res, '关联订单不存在', 404);

    // 1. 接受该申请
    await application.update({ status: 'accepted', processedAt: new Date(), adminNote: req.body.adminNote || '' });

    // 2. 拒绝同一订单的其余申请
    await OrderApplication.update(
      { status: 'rejected', processedAt: new Date() },
      { where: { orderId: order.id, id: { [Op.ne]: application.id }, status: 'pending' } }
    );

    // 3. 更新订单状态
    await order.update({
      status: 'matched',
      acceptedApplicationId: application.id,
      acceptedUserId: application.userId
    });

    // 4. 通知接单阿姨
    await Message.create({
      userId: application.userId,
      type: 'order_accepted',
      title: '接单申请已通过',
      content: '恭喜！您对' + (order.jobType ? order.jobType.name : '') + '订单的接单申请已被确认。',
      linkType: 'service_order',
      linkId: order.id
    });

    // 5. 通知被拒绝的申请人
    var rejectedApps = await OrderApplication.findAll({
      where: { orderId: order.id, status: 'rejected', id: { [Op.ne]: application.id } }
    });
    for (var i = 0; i < rejectedApps.length; i++) {
      await Message.create({
        userId: rejectedApps[i].userId,
        type: 'order_rejected',
        title: '接单申请未通过',
        content: '很遗憾，您对订单 ' + order.orderNo + ' 的接单申请未被选中，请关注其他订单机会。',
        linkType: 'service_order',
        linkId: order.id
      });
    }

    // 6. 佣金结算：如果接单来自分享推荐，给推荐人创建佣金记录
    if (application.sharerId) {
      var { Commission } = require('../models');
      var rewardAmount = parseFloat(req.body.rewardAmount || 0); // 管理员可指定奖励金额
      if (rewardAmount > 0) {
        await Commission.create({
          userId: application.sharerId,
          referUserId: application.userId,
          serviceOrderId: order.id,
          source: 'order_accept',
          amount: rewardAmount,
          status: 'pending',
          remark: '订单推荐奖励: ' + order.orderNo + ' → ' + (application.applicant ? application.applicant.nickname : '')
        });
        // 更新推荐人余额和收入
        var sharer = await User.findByPk(application.sharerId);
        if (sharer) {
          await sharer.increment({
            totalEarning: rewardAmount,
            balance: rewardAmount
          });
        }
        // 通知推荐人
        await Message.create({
          userId: application.sharerId,
          type: 'coupon_reward',
          title: '订单推荐奖励',
          content: '您推荐的订单 ' + order.orderNo + ' 已成功匹配，获得推荐奖励 ' + rewardAmount + ' 元。',
          linkType: 'service_order',
          linkId: order.id
        });
      }
    }

    // 返回结果，含分享推荐来源信息
    var result = {
      application: application.toJSON(),
      order: order.toJSON(),
      sharerInfo: application.sharer ? {
        sharerId: application.sharer.id,
        sharerName: application.sharer.nickname,
        sharerLevel: application.sharer.memberLevel,
        hint: '该接单来自 ' + application.sharer.nickname + ' 的分享推荐'
      } : null
    };

    await logAction(req, 'service_order', 'accept_application', 'ServiceOrder', order.id,
      '确认接单: ' + order.orderNo + ' → ' + (application.applicant ? application.applicant.nickname : '未知') +
      (application.sharer ? '（推荐人: ' + application.sharer.nickname + '）' : ''));

    return success(res, result, '接单确认成功');
  } catch (err) { return fail(res, '操作失败: ' + err.message, 500); }
});

// 拒绝申请
router.put('/applications/:id/reject', requirePermission('service_orders:manage'), async function(req, res) {
  try {
    var application = await OrderApplication.findByPk(req.params.id);
    if (!application) return fail(res, '申请不存在', 404);
    if (application.status !== 'pending') return fail(res, '该申请已被处理');

    await application.update({
      status: 'rejected',
      processedAt: new Date(),
      adminNote: req.body.adminNote || ''
    });

    // 通知申请人
    var order = await ServiceOrder.findByPk(application.orderId);
    await Message.create({
      userId: application.userId,
      type: 'order_rejected',
      title: '接单申请未通过',
      content: '您对订单 ' + (order ? order.orderNo : '') + ' 的接单申请未通过。' + (req.body.adminNote ? '备注：' + req.body.adminNote : ''),
      linkType: 'service_order',
      linkId: application.orderId
    });

    await logAction(req, 'service_order', 'reject_application', 'OrderApplication', application.id,
      '拒绝接单申请');
    return success(res, application, '已拒绝');
  } catch (err) { return fail(res, '操作失败: ' + err.message, 500); }
});

module.exports = router;
