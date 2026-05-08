// server/routes/serviceOrders.js — 后台服务订单管理（海南椰嫂综合平台）
const express = require('express');
const { ServiceOrder, OrderApplication, JobType, User, Admin, ShareRecord, Message, Commission, sequelize } = require('../models');
const { authMiddleware, requirePermission, requireAnyPermission, getEffectivePermissions } = require('../middleware/auth');
const { success, fail, paginate } = require('../utils/response');
const { logAction } = require('../utils/logger');
const { notifyAdmin, notifyAdminsWithPermission } = require('../utils/adminNotify');
const { Op } = require('sequelize');
var { recordEventByUser } = require('../utils/circleEvent');
const matchEngine = require('../services/matchEngine');

const router = express.Router();
router.use(authMiddleware);

// ==================== 订单列表（根据权限过滤） ====================
router.get('/', requireAnyPermission('service_orders:view_all', 'service_orders:view_own', 'service_orders:view_pool', 'service_orders:assign', 'service_orders:dispatch', 'service_orders:audit'), async function(req, res) {
  try {
    var page = parseInt(req.query.page) || 1;
    var pageSize = parseInt(req.query.pageSize) || 10;
    var perms = getEffectivePermissions(req.admin);
    var where = {};

    // 权限过滤逻辑
    if (perms.indexOf('service_orders:view_all') !== -1 || req.admin.role === 'super') {
      // 可看全部订单，不加额外过滤
    } else {
      // 动态构建可见订单范围
      var orConditions = [];
      // 自己被分配的订单
      if (perms.indexOf('service_orders:view_own') !== -1) {
        orConditions.push({ assignedAdminId: req.admin.id });
      }
      // 公域池订单（已审核但未分配）
      if (perms.indexOf('service_orders:view_pool') !== -1) {
        orConditions.push({ status: 'approved', assignedAdminId: null });
      }
      // 拥有分配权限 → 可看全部待分配订单（审核通过待分配给销售）
      if (perms.indexOf('service_orders:assign') !== -1) {
        orConditions.push({ status: 'approved' });
      }
      // 拥有派单权限 → 可看全部待派单订单（已分配给销售，待匹配阿姨）
      if (perms.indexOf('service_orders:dispatch') !== -1) {
        orConditions.push({ status: { [Op.in]: ['assigned', 'matching'] } });
      }
      // 拥有审核权限 → 可看全部待审核订单
      if (perms.indexOf('service_orders:audit') !== -1) {
        orConditions.push({ status: 'pending' });
      }
      if (orConditions.length > 0) {
        where[Op.or] = orConditions;
      } else {
        // 无任何订单权限，返回空
        where.id = 0;
      }
    }

    // 筛选条件
    if (req.query.status) {
      if (where[Op.or]) {
        // 已有 OR 条件时，添加 status 作为额外过滤
        where[Op.and] = where[Op.and] || [];
        where[Op.and].push({ status: req.query.status });
      } else {
        where.status = req.query.status;
      }
    }
    if (req.query.type) where.type = req.query.type;
    if (req.query.jobTypeId) where.jobTypeId = parseInt(req.query.jobTypeId);
    if (req.query.city) where.city = { [Op.like]: '%' + req.query.city + '%' };
    if (req.query.assignedAdminId) where.assignedAdminId = parseInt(req.query.assignedAdminId);
    if (req.query.keyword) {
      var kw = '%' + req.query.keyword + '%';
      var kwCond = {
        [Op.or]: [
          { orderNo: { [Op.like]: kw } },
          { contactName: { [Op.like]: kw } },
          { contactPhone: { [Op.like]: kw } }
        ]
      };
      if (where[Op.and]) { where[Op.and].push(kwCond); }
      else { where[Op.and] = [kwCond]; }
    }
    if (req.query.startDate && req.query.endDate) {
      var dateCond = { createdAt: { [Op.between]: [req.query.startDate, req.query.endDate + ' 23:59:59'] } };
      if (where[Op.and]) { where[Op.and].push(dateCond); }
      else { where[Op.and] = [dateCond]; }
    }

    var result = await ServiceOrder.findAndCountAll({
      where: where,
      include: [
        { model: User, as: 'publisher', attributes: ['id', 'nickname', 'phone', 'avatar'] },
        { model: JobType, as: 'jobType', attributes: ['id', 'name', 'code', 'icon'] },
        { model: User, as: 'acceptedUser', attributes: ['id', 'nickname', 'phone', 'avatar'] },
        { model: Admin, as: 'assignedAdmin', attributes: ['id', 'username', 'realName', 'role'] }
      ],
      order: [['createdAt', 'DESC']],
      limit: pageSize,
      offset: (page - 1) * pageSize
    });

    var rows = await Promise.all(result.rows.map(async function(row) {
      var item = row.toJSON();
      item.applicationCount = await OrderApplication.count({ where: { orderId: row.id } });
      return item;
    }));

    return paginate(res, rows, result.count, page, pageSize);
  } catch (err) { return fail(res, '查询失败: ' + err.message, 500); }
});

// ==================== CSV 数据导出 ====================
router.get('/export/csv', requirePermission('service_orders:view_all'), async function(req, res) {
  try {
    var where = {};
    if (req.query.status) where.status = req.query.status;
    if (req.query.type) where.type = req.query.type;

    var orders = await ServiceOrder.findAll({
      where: where,
      include: [
        { model: JobType, as: 'jobType', attributes: ['name'] },
        { model: User, as: 'publisher', attributes: ['nickname', 'phone'] },
        { model: Admin, as: 'assignedAdmin', attributes: ['username', 'realName'] }
      ],
      order: [['createdAt', 'DESC']],
      limit: 5000
    });

    // 生成 CSV 内容（UTF-8 BOM 头确保 Excel 正确识别中文）
    var BOM = '\uFEFF';
    var header = '订单号,类型,工种,发布人,联系人,联系电话,城市,薪资范围,状态,负责销售,创建时间,完成时间,实际金额\n';
    var rows = orders.map(function(o) {
      var typeText = o.type === 'worker' ? '阿姨求职' : '雇主发单';
      var jobName = o.jobType ? o.jobType.name : '';
      var publisher = o.publisher ? o.publisher.nickname : '';
      var admin = o.assignedAdmin ? (o.assignedAdmin.realName || o.assignedAdmin.username) : '';
      var statusMap = { pending: '待审核', approved: '公域池', assigned: '已分配', matching: '匹配中', matched: '已派单', completed: '已完成', rejected: '已拒绝' };
      return [
        o.orderNo, typeText, jobName, publisher, o.contactName || '', o.contactPhone || '',
        o.city || '', o.salaryMin + '-' + o.salaryMax, statusMap[o.status] || o.status,
        admin, o.createdAt ? o.createdAt.toISOString().slice(0, 19).replace('T', ' ') : '',
        o.completedAt ? o.completedAt.toISOString().slice(0, 19).replace('T', ' ') : '',
        o.actualAmount || 0
      ].map(function(v) {
        var safe = String(v).replace(/"/g, '""');
        // CSV 注入防御：以 =+-@ 开头的值添加前缀
        if (/^[=+\-@]/.test(safe)) safe = '\t' + safe;
        return '"' + safe + '"';
      }).join(',');
    }).join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="service_orders_' + Date.now() + '.csv"');
    return res.send(BOM + header + rows);
  } catch (err) { return fail(res, '导出失败: ' + err.message, 500); }
});

// ==================== 销售业绩统计（必须在 /:id 之前声明） ====================
router.get('/stats/my-performance', async function(req, res) {
  try {
    var adminId = req.query.adminId ? parseInt(req.query.adminId) : req.admin.id;
    if (req.admin.role !== 'super' && adminId !== req.admin.id) {
      return fail(res, '无权查看他人业绩', 403);
    }

    var where = { assignedAdminId: adminId, status: 'completed' };
    var monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    var monthWhere = Object.assign({}, where, { completedAt: { [Op.gte]: monthStart } });

    var totalCompleted = await ServiceOrder.count({ where: where });
    var monthCompleted = await ServiceOrder.count({ where: monthWhere });
    var totalAmount = await ServiceOrder.sum('actualAmount', { where: where }) || 0;
    var monthAmount = await ServiceOrder.sum('actualAmount', { where: monthWhere }) || 0;
    var totalAssigned = await ServiceOrder.count({ where: { assignedAdminId: adminId } });
    var activeOrders = await ServiceOrder.count({
      where: { assignedAdminId: adminId, status: { [Op.in]: ['assigned', 'matching', 'matched'] } }
    });

    return success(res, {
      adminId: adminId,
      totalAssigned: totalAssigned,
      totalCompleted: totalCompleted,
      totalAmount: parseFloat(totalAmount),
      monthCompleted: monthCompleted,
      monthAmount: parseFloat(monthAmount),
      activeOrders: activeOrders
    });
  } catch (err) { return fail(res, '查询失败: ' + err.message, 500); }
});

// ==================== AI 智能推荐候选人（必须在 /:id 之前声明） ====================
router.get('/:id/recommendations', requireAnyPermission('service_orders:dispatch', 'service_orders:view_all', 'service_orders:view_own'), async function(req, res) {
  try {
    var orderId = parseInt(req.params.id);
    var topN = parseInt(req.query.topN) || 15;
    var result = await matchEngine.getRecommendations(orderId, topN);
    if (result.error) {
      return fail(res, result.error, 404);
    }
    return success(res, result);
  } catch (err) { return fail(res, 'AI 推荐失败: ' + err.message, 500); }
});

// ==================== 订单详情 ====================
router.get('/:id', requireAnyPermission('service_orders:view_all', 'service_orders:view_own', 'service_orders:view_pool'), async function(req, res) {
  try {
    var order = await ServiceOrder.findByPk(req.params.id, {
      include: [
        { model: User, as: 'publisher', attributes: ['id', 'nickname', 'phone', 'avatar', 'realName'] },
        { model: JobType, as: 'jobType' },
        { model: User, as: 'acceptedUser', attributes: ['id', 'nickname', 'phone', 'avatar', 'realName', 'memberLevel'] },
        { model: Admin, as: 'assignedAdmin', attributes: ['id', 'username', 'realName', 'role'] },
        { model: ShareRecord, as: 'shareRecord', include: [{ model: User, as: 'sharer', attributes: ['id', 'nickname'] }] }
      ]
    });
    if (!order) return fail(res, '订单不存在', 404);

    var result = order.toJSON();
    result.applicationCount = await OrderApplication.count({ where: { orderId: order.id } });
    return success(res, result);
  } catch (err) { return fail(res, '查询失败: ' + err.message, 500); }
});

// ==================== 审核通过（进入公域池） ====================
router.put('/:id/approve', requirePermission('service_orders:audit'), async function(req, res) {
  try {
    var order = await ServiceOrder.findByPk(req.params.id, {
      include: [{ model: JobType, as: 'jobType' }]
    });
    if (!order) return fail(res, '订单不存在', 404);
    if (order.status !== 'pending') return fail(res, '该订单状态无法审核');

    await order.update({ status: 'approved', adminNote: req.body.adminNote || '' });

    // 通知发单人
    await Message.create({
      userId: order.userId,
      type: 'order_status',
      title: '订单审核通过',
      content: '您发布的' + (order.jobType ? order.jobType.name : '') + '订单已通过审核，正在为您匹配合适的阿姨。',
      linkType: 'service_order',
      linkId: order.id
    });

    // 通知有分配权限的管理员
    await notifyAdminsWithPermission('notifications:receive_order', {
      type: 'new_order',
      title: '新订单待分配',
      content: '订单 ' + order.orderNo + '（' + (order.jobType ? order.jobType.name : '') + '）已审核通过，请分配给销售跟进。',
      linkType: 'service_order',
      linkId: order.id
    });

    await logAction(req, 'service_order', 'approve', 'ServiceOrder', order.id, '审核通过订单: ' + order.orderNo);
    return success(res, order, '审核通过，已进入公域池');
  } catch (err) { return fail(res, '操作失败: ' + err.message, 500); }
});

// ==================== 审核拒绝 ====================
router.put('/:id/reject', requirePermission('service_orders:cancel'), async function(req, res) {
  try {
    var order = await ServiceOrder.findByPk(req.params.id);
    if (!order) return fail(res, '订单不存在', 404);
    if (order.status !== 'pending') return fail(res, '该订单状态无法拒绝');

    await order.update({
      status: 'rejected',
      rejectReason: req.body.reason || '不符合发布要求',
      adminNote: req.body.adminNote || ''
    });

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

// ==================== 分配订单给销售 ====================
router.put('/:id/assign', requirePermission('service_orders:assign'), async function(req, res) {
  try {
    var order = await ServiceOrder.findByPk(req.params.id, {
      include: [{ model: JobType, as: 'jobType' }]
    });
    if (!order) return fail(res, '订单不存在', 404);
    if (order.status !== 'approved' && order.status !== 'assigned') {
      return fail(res, '该订单状态无法分配（需先审核通过）');
    }

    var targetAdminId = parseInt(req.body.adminId);
    if (!targetAdminId) return fail(res, '请选择要分配的销售');
    var targetAdmin = await Admin.findByPk(targetAdminId);
    if (!targetAdmin || targetAdmin.status !== 'active') return fail(res, '目标管理员不存在或已禁用');

    await order.update({
      status: 'assigned',
      assignedAdminId: targetAdminId,
      assignedAt: new Date()
    });

    // 通知被分配的销售
    await notifyAdmin(targetAdminId, {
      type: 'order_assigned',
      title: '新订单分配给您',
      content: '订单 ' + order.orderNo + '（' + (order.jobType ? order.jobType.name : '') + '）已分配给您，请尽快跟进匹配阿姨。',
      linkType: 'service_order',
      linkId: order.id
    });

    await logAction(req, 'service_order', 'assign', 'ServiceOrder', order.id,
      '分配订单: ' + order.orderNo + ' → ' + (targetAdmin.realName || targetAdmin.username));
    return success(res, order, '分配成功');
  } catch (err) { return fail(res, '操作失败: ' + err.message, 500); }
});

// ==================== 接单申请列表 ====================
router.get('/:id/applications', requireAnyPermission('service_orders:dispatch', 'service_orders:view_all', 'service_orders:view_own'), async function(req, res) {
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

// ==================== 确认派单（接受申请） ====================
router.put('/applications/:id/accept', requirePermission('service_orders:dispatch'), async function(req, res) {
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

    // 权限校验：只有被分配的销售或超管可派单
    if (req.admin.role !== 'super' && order.assignedAdminId && order.assignedAdminId !== req.admin.id) {
      return fail(res, '此订单未分配给您，无法操作', 403);
    }

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

    // 6. 佣金结算
    if (application.sharerId) {
      var rewardAmount = parseFloat(req.body.rewardAmount || 0);
      if (rewardAmount > 0) {
        await Commission.create({
          userId: application.sharerId,
          referUserId: application.userId,
          serviceOrderId: order.id,
          source: 'order_accept',
          amount: rewardAmount,
          status: 'settled',
          settledAt: new Date(),
          remark: '订单推荐奖励: ' + order.orderNo + ' → ' + (application.applicant ? application.applicant.nickname : '')
        });
        var sharer = await User.findByPk(application.sharerId);
        if (sharer) {
          await sharer.increment({ totalEarning: rewardAmount, balance: rewardAmount });
        }
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
      '确认派单: ' + order.orderNo + ' → ' + (application.applicant ? application.applicant.nickname : '未知') +
      ' (销售: ' + (req.admin.realName || req.admin.username) + ')');

    // 闺蜜圈事件埋点：成员接单
    recordEventByUser(application.userId, 'order_accepted', order.id,
      '接到了' + (order.jobType ? order.jobType.name : '') + '订单 ' + order.orderNo, order.jobTypeId);

    return success(res, result, '派单确认成功');
  } catch (err) { return fail(res, '操作失败: ' + err.message, 500); }
});

// ==================== 拒绝申请 ====================
router.put('/applications/:id/reject', requirePermission('service_orders:dispatch'), async function(req, res) {
  try {
    var application = await OrderApplication.findByPk(req.params.id);
    if (!application) return fail(res, '申请不存在', 404);
    if (application.status !== 'pending') return fail(res, '该申请已被处理');

    await application.update({
      status: 'rejected',
      processedAt: new Date(),
      adminNote: req.body.adminNote || ''
    });

    var order = await ServiceOrder.findByPk(application.orderId);
    await Message.create({
      userId: application.userId,
      type: 'order_rejected',
      title: '接单申请未通过',
      content: '您对订单 ' + (order ? order.orderNo : '') + ' 的接单申请未通过。' + (req.body.adminNote ? '备注：' + req.body.adminNote : ''),
      linkType: 'service_order',
      linkId: application.orderId
    });

    await logAction(req, 'service_order', 'reject_application', 'OrderApplication', application.id, '拒绝接单申请');
    return success(res, application, '已拒绝');
  } catch (err) { return fail(res, '操作失败: ' + err.message, 500); }
});

// ==================== 标记完成（含实际金额 → 计入业绩） ====================
router.put('/:id/complete', requirePermission('service_orders:complete'), async function(req, res) {
  try {
    var order = await ServiceOrder.findByPk(req.params.id);
    if (!order) return fail(res, '订单不存在', 404);
    if (order.status !== 'matched') return fail(res, '该订单状态无法标记完成');

    var actualAmount = parseFloat(req.body.actualAmount || 0);
    await order.update({
      status: 'completed',
      actualAmount: actualAmount,
      completedAt: new Date(),
      adminNote: req.body.adminNote || ''
    });

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

    await logAction(req, 'service_order', 'complete', 'ServiceOrder', order.id,
      '完成订单: ' + order.orderNo + ' (实际金额: ' + actualAmount + ')');
    return success(res, order, '已完成');
  } catch (err) { return fail(res, '操作失败: ' + err.message, 500); }
});

// ==================== 订单编辑（审核前/审核后均可修改基本信息） ====================
router.put('/:id/edit', requireAnyPermission('service_orders:view_all', 'service_orders:audit'), async function(req, res) {
  try {
    var order = await ServiceOrder.findByPk(req.params.id);
    if (!order) return fail(res, '订单不存在', 404);
    if (order.status === 'completed' || order.status === 'cancelled') {
      return fail(res, '已完成或已取消的订单不可编辑');
    }
    // 允许修改的字段
    var allowedFields = ['contactName', 'contactPhone', 'city', 'district', 'address',
      'salaryMin', 'salaryMax', 'salaryType', 'serviceDate', 'remark', 'jobTypeId'];
    var updates = {};
    allowedFields.forEach(function(f) {
      if (req.body[f] !== undefined) updates[f] = req.body[f];
    });
    // 薪资非负校验
    if (updates.salaryMin !== undefined && Number(updates.salaryMin) < 0) return fail(res, '最低薪资不能为负数');
    if (updates.salaryMax !== undefined && Number(updates.salaryMax) < 0) return fail(res, '最高薪资不能为负数');
    if (updates.salaryMin !== undefined && updates.salaryMax !== undefined &&
        Number(updates.salaryMin) > Number(updates.salaryMax) && Number(updates.salaryMax) > 0) {
      return fail(res, '最低薪资不能高于最高薪资');
    }
    await order.update(updates);
    await logAction(req, 'service_order', 'edit', 'ServiceOrder', order.id,
      '编辑订单: ' + order.orderNo + ' (' + Object.keys(updates).join(',') + ')');
    return success(res, order, '订单已更新');
  } catch (err) { return fail(res, '编辑失败: ' + err.message, 500); }
});

// ==================== 订单取消/作废（任意状态均可取消） ====================
router.put('/:id/cancel', requireAnyPermission('service_orders:cancel', 'service_orders:view_all'), async function(req, res) {
  try {
    var order = await ServiceOrder.findByPk(req.params.id);
    if (!order) return fail(res, '订单不存在', 404);
    if (order.status === 'completed') return fail(res, '已完成的订单不可取消');
    if (order.status === 'cancelled') return fail(res, '订单已取消');

    var reason = req.body.reason || '管理员取消';
    await order.update({ status: 'cancelled', adminNote: reason });

    // 通知发布者
    if (order.userId) {
      await Message.create({
        userId: order.userId,
        type: 'order_status',
        title: '订单已取消',
        content: '您的订单 ' + order.orderNo + ' 已被取消。原因: ' + reason,
        linkType: 'service_order',
        linkId: order.id
      });
    }
    // 如已匹配阿姨，也通知阿姨
    if (order.acceptedUserId) {
      await Message.create({
        userId: order.acceptedUserId,
        type: 'order_status',
        title: '服务订单已取消',
        content: '订单 ' + order.orderNo + ' 已取消。原因: ' + reason,
        linkType: 'service_order',
        linkId: order.id
      });
    }

    await logAction(req, 'service_order', 'cancel', 'ServiceOrder', order.id,
      '取消订单: ' + order.orderNo + ' 原因: ' + reason);
    return success(res, order, '订单已取消');
  } catch (err) { return fail(res, '取消失败: ' + err.message, 500); }
});

// ==================== 管理员备注修改 ====================
router.put('/:id/note', requireAnyPermission('service_orders:view_all', 'service_orders:view_own'), async function(req, res) {
  try {
    var order = await ServiceOrder.findByPk(req.params.id);
    if (!order) return fail(res, '订单不存在', 404);
    await order.update({ adminNote: req.body.adminNote || '' });
    await logAction(req, 'service_order', 'update_note', 'ServiceOrder', order.id,
      '更新备注: ' + order.orderNo);
    return success(res, order, '备注已更新');
  } catch (err) { return fail(res, '操作失败: ' + err.message, 500); }
});

// ==================== AI 推荐直接派单（后台创建申请 + 自动接受） ====================
router.post('/:id/quick-dispatch', requirePermission('service_orders:dispatch'), async function(req, res) {
  try {
    var order = await ServiceOrder.findByPk(req.params.id);
    if (!order) return fail(res, '订单不存在', 404);
    if (order.status === 'completed' || order.status === 'cancelled' || order.status === 'matched') {
      return fail(res, '该订单状态不可派单');
    }

    var userId = parseInt(req.body.userId);
    if (!userId) return fail(res, '请指定派单目标用户');

    var user = await User.findByPk(userId);
    if (!user) return fail(res, '用户不存在', 404);

    // 检查是否已有该用户的申请
    var existing = await OrderApplication.findOne({
      where: { orderId: order.id, userId: userId }
    });
    var application;
    if (existing) {
      application = existing;
    } else {
      // 后台代为创建申请
      application = await OrderApplication.create({
        orderId: order.id,
        userId: userId,
        status: 'pending',
        message: '由后台 AI 推荐派单'
      });
    }

    // 自动接受该申请（复用 accept 逻辑）
    await application.update({ status: 'accepted' });

    // 拒绝同订单其他申请
    await OrderApplication.update(
      { status: 'rejected' },
      { where: { orderId: order.id, id: { [Op.ne]: application.id }, status: 'pending' } }
    );

    // 更新订单状态（与正常派单流程字段一致）
    await order.update({
      status: 'matched',
      acceptedApplicationId: application.id,
      acceptedUserId: userId,
      completedAt: null
    });

    // 通知被派单的阿姨
    await Message.create({
      userId: userId,
      type: 'order_match',
      title: '您有新的派单',
      content: '平台已将订单 ' + order.orderNo + ' 派给您，请及时确认。',
      linkType: 'service_order',
      linkId: order.id
    });

    await logAction(req, 'service_order', 'quick_dispatch', 'ServiceOrder', order.id,
      'AI派单: ' + order.orderNo + ' → ' + (user.nickname || user.phone));
    return success(res, { order: order, application: application }, 'AI 派单成功');
  } catch (err) { return fail(res, '派单失败: ' + err.message, 500); }
});

// ==================== 批量审核通过 ====================
router.put('/batch/approve', requirePermission('service_orders:audit'), async function(req, res) {
  try {
    var ids = req.body.ids || [];
    if (ids.length === 0) return fail(res, '请选择要审核的订单');
    var count = await ServiceOrder.update(
      { status: 'approved' },
      { where: { id: { [Op.in]: ids }, status: 'pending' } }
    );
    await logAction(req, 'service_order', 'batch_approve', 'ServiceOrder', 0,
      '批量审核通过: ' + ids.length + ' 条');
    return success(res, { affected: count[0] }, '批量审核完成');
  } catch (err) { return fail(res, '操作失败: ' + err.message, 500); }
});

// ==================== 批量拒绝 ====================
router.put('/batch/reject', requirePermission('service_orders:cancel'), async function(req, res) {
  try {
    var ids = req.body.ids || [];
    var reason = req.body.reason || '批量拒绝';
    if (ids.length === 0) return fail(res, '请选择要拒绝的订单');
    var count = await ServiceOrder.update(
      { status: 'rejected', adminNote: reason },
      { where: { id: { [Op.in]: ids }, status: 'pending' } }
    );
    await logAction(req, 'service_order', 'batch_reject', 'ServiceOrder', 0,
      '批量拒绝: ' + ids.length + ' 条, 原因: ' + reason);
    return success(res, { affected: count[0] }, '批量拒绝完成');
  } catch (err) { return fail(res, '操作失败: ' + err.message, 500); }
});

// ==================== 跟进记录（销售可添加文字+附件） ====================

// 获取某订单的跟进记录
router.get('/:id/follow-ups', requireAnyPermission('service_orders:view_all', 'service_orders:view_own', 'service_orders:dispatch'), async function(req, res) {
  try {
    var { OperationLog } = require('../models');
    var orderId = parseInt(req.params.id);
    var logs = await OperationLog.findAll({
      where: { targetType: 'ServiceOrder', targetId: orderId, action: 'follow_up' },
      order: [['createdAt', 'DESC']]
    });
    // 解析 detail 字段中的 JSON 数据
    var result = logs.map(function(l) {
      var parsed = {};
      try { parsed = JSON.parse(l.detail || '{}'); } catch(e) {}
      return {
        id: l.id,
        adminId: l.adminId,
        adminName: l.adminName || '',
        content: parsed.content || l.detail || '',
        attachments: parsed.attachments || [],
        createdAt: l.createdAt
      };
    });
    return success(res, result);
  } catch (err) { return fail(res, '查询失败: ' + err.message, 500); }
});

// 添加跟进记录
router.post('/:id/follow-ups', requireAnyPermission('service_orders:view_own', 'service_orders:dispatch', 'service_orders:view_all'), async function(req, res) {
  try {
    var orderId = parseInt(req.params.id);
    var order = await ServiceOrder.findByPk(orderId);
    if (!order) return fail(res, '订单不存在', 404);

    var content = req.body.content;
    if (!content || !content.trim()) return fail(res, '跟进内容不能为空');
    var attachments = req.body.attachments || []; // 附件 URL 数组

    // 权限校验：只有被分配的销售或超管可添加
    if (req.admin.role !== 'super' && order.assignedAdminId && order.assignedAdminId !== req.admin.id) {
      // 允许有 view_all 权限的管理员也添加
      var perms = getEffectivePermissions(req.admin);
      if (perms.indexOf('service_orders:view_all') === -1) {
        return fail(res, '此订单未分配给您，无法添加跟进', 403);
      }
    }

    // 存入 OperationLog（复用现有表，action 为 follow_up）
    await logAction(req, 'service_order', 'follow_up', 'ServiceOrder', orderId,
      JSON.stringify({ content: content.trim(), attachments: attachments }));

    return success(res, null, '跟进记录已添加');
  } catch (err) { return fail(res, '添加失败: ' + err.message, 500); }
});

module.exports = router;
