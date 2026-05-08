// server/routes/users.js — 用户管理 + 认证审核 + 会员等级 + 积分 + 佣金（海南椰嫂综合平台）
const express = require('express');
const { User, Commission, CouponOrder, Message, ShareRecord } = require('../models');
const { authMiddleware, requirePermission, requireAnyPermission } = require('../middleware/auth');
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

// 用户数据导出 CSV（必须在 /:id 之前声明，否则 'export' 会被当作 ID）
router.get('/export/csv', requirePermission('users:view'), async function(req, res) {
  try {
    var users = await User.findAll({
      attributes: ['id', 'nickname', 'phone', 'gender', 'city', 'realName', 'authStatus', 'memberLevel', 'points', 'createdAt'],
      order: [['createdAt', 'DESC']],
      limit: 10000
    });
    var BOM = '\uFEFF';
    var header = 'ID,昵称,手机号,性别,城市,真实姓名,认证状态,会员等级,积分,注册时间\n';
    var genderMap = { male: '男', female: '女', unknown: '未知' };
    var authMap = { none: '未提交', pending: '待审核', approved: '已通过', rejected: '已拒绝' };
    var rows = users.map(function(u) {
      return [
        u.id, u.nickname || '', u.phone || '', genderMap[u.gender] || '未知',
        u.city || '', u.realName || '', authMap[u.authStatus] || u.authStatus,
        u.memberLevel || 'normal', u.points || 0,
        u.createdAt ? u.createdAt.toISOString().slice(0, 19).replace('T', ' ') : ''
      ].map(function(v) {
        var safe = String(v).replace(/"/g, '""');
        if (/^[=+\-@]/.test(safe)) safe = '\t' + safe;
        return '"' + safe + '"';
      }).join(',');
    }).join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="users_' + Date.now() + '.csv"');
    return res.send(BOM + header + rows);
  } catch (err) { return fail(res, '导出失败: ' + err.message, 500); }
});

// 批量导入用户（前端解析 Excel 后传 JSON）
router.post('/import/batch', requirePermission('users:view'), async function(req, res) {
  try {
    var rows = req.body.users;
    if (!Array.isArray(rows) || rows.length === 0) {
      return fail(res, '导入数据为空', 400);
    }
    if (rows.length > 500) {
      return fail(res, '单次最多导入 500 条', 400);
    }

    var imported = 0;
    var skipped = 0;
    var errors = [];

    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];
      try {
        // 必填字段检查
        if (!row.phone && !row.nickname) {
          errors.push('第 ' + (i + 1) + ' 行: 手机号和昵称至少填一个');
          skipped++;
          continue;
        }
        // 手机号去重
        if (row.phone) {
          var exists = await User.findOne({ where: { phone: row.phone } });
          if (exists) {
            skipped++;
            continue;
          }
        }
        // 性别映射
        var genderVal = 0;
        if (row.gender === '男' || row.gender === 'male' || row.gender === '1' || row.gender === 1) genderVal = 1;
        if (row.gender === '女' || row.gender === 'female' || row.gender === '2' || row.gender === 2) genderVal = 2;

        await User.create({
          nickname: row.nickname || '',
          phone: row.phone || '',
          gender: genderVal,
          city: row.city || '',
          realName: row.realName || '',
          idCard: row.idCard || '',
          authStatus: row.realName ? 'approved' : 'none',
          isRealAuth: !!row.realName,
          status: 'active'
        });
        imported++;
      } catch (rowErr) {
        errors.push('第 ' + (i + 1) + ' 行: ' + rowErr.message);
        skipped++;
      }
    }

    await logAction(req, 'user', 'batch_import', 'User', 0,
      '批量导入用户: 成功 ' + imported + ' 条, 跳过 ' + skipped + ' 条');

    return success(res, {
      imported: imported,
      skipped: skipped,
      total: rows.length,
      errors: errors.slice(0, 10) // 最多返回前 10 条错误
    });
  } catch (err) {
    return fail(res, '导入失败: ' + err.message, 500);
  }
});

// 下载导入模板
router.get('/import/template', async function(req, res) {
  var BOM = '\uFEFF';
  var header = '昵称,手机号,性别,城市,真实姓名,身份证号\n';
  var example = '张姐,13800138001,女,海口市,张三,460000199001011234\n';
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="user_import_template.csv"');
  return res.send(BOM + header + example);
});

// 用户详情
router.get('/:id', async function(req, res) {
  try {
    var user = await User.findByPk(req.params.id);
    if (!user) return fail(res, '用户不存在', 404);
    return success(res, user);
  } catch (err) { return fail(res, '查询失败', 500); }
});

// 用户画像聚合（用于详情多 Tab）
router.get('/:id/profile-summary', async function(req, res) {
  try {
    var userId = parseInt(req.params.id);
    var user = await User.findByPk(userId);
    if (!user) return fail(res, '用户不存在', 404);

    var { ServiceOrder, CouponOrder, GuimiCircleMember, GuimiCircle, JobType } = require('../models');

    // 并行查询所有维度数据
    var [orders, couponOrders, circleMemberships, shareCount, fansCount] = await Promise.all([
      // 发布的服务订单（最近 10 条）
      ServiceOrder.findAndCountAll({
        where: { userId: userId },
        include: [
          { model: JobType, as: 'jobType', attributes: ['name'] }
        ],
        attributes: ['id', 'orderNo', 'type', 'status', 'city', 'salaryMin', 'salaryMax', 'salaryType', 'createdAt', 'completedAt'],
        order: [['createdAt', 'DESC']],
        limit: 10
      }),
      // 领券记录（最近 10 条）
      CouponOrder.findAndCountAll({
        where: { userId: userId },
        include: [
          { model: require('../models/Coupon'), as: 'coupon', attributes: ['title', 'type'] }
        ],
        attributes: ['id', 'status', 'claimedAt', 'usedAt', 'createdAt'],
        order: [['createdAt', 'DESC']],
        limit: 10
      }),
      // 闺蜜圈成员关系
      GuimiCircleMember.findAll({
        where: { userId: userId },
        include: [
          { model: GuimiCircle, as: 'circle', attributes: ['id', 'name', 'status'] }
        ],
        attributes: ['id', 'role', 'status', 'joinedAt']
      }),
      // 分享推广数量
      ShareRecord.count({ where: { sharerId: userId } }),
      // 下级粉丝数量
      User.count({ where: { inviterId: userId } })
    ]);

    // 订单统计
    var orderStats = {
      publishedCount: orders.count,
      completedCount: 0
    };
    orders.rows.forEach(function(o) {
      if (o.status === 'completed') orderStats.completedCount++;
    });

    return success(res, {
      // 订单维度
      orders: { list: orders.rows, total: orders.count, stats: orderStats },
      // 领券维度
      coupons: { list: couponOrders.rows, total: couponOrders.count },
      // 闺蜜圈维度
      circles: circleMemberships,
      // 推广维度
      promotion: { shareCount: shareCount, fansCount: fansCount },
      // 用户基本信息
      user: user
    });
  } catch (err) { return fail(res, '查询失败: ' + err.message, 500); }
});

// 审核通过
router.put('/:id/approve', requirePermission('users:auth'), async function(req, res) {
  try {
    var user = await User.findByPk(req.params.id);
    if (!user) return fail(res, '用户不存在', 404);
    await user.update({ authStatus: 'approved', isRealAuth: true, authRejectReason: '' });
    await logAction(req, 'user', 'approve', 'User', user.id, '审核通过: ' + (user.realName || user.nickname));
    return success(res, user, '审核通过');
  } catch (err) { return fail(res, '操作失败', 500); }
});

// 审核拒绝
router.put('/:id/reject', requirePermission('users:auth'), async function(req, res) {
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

// 设置后台管理评分（人工回访好评加权，0-100）
router.put('/:id/admin-score', requirePermission('users:auth'), async function(req, res) {
  try {
    var user = await User.findByPk(req.params.id);
    if (!user) return fail(res, '用户不存在', 404);
    var score = parseInt(req.body.score);
    if (isNaN(score) || score < 0 || score > 100) {
      return fail(res, '评分范围必须在 0-100 之间');
    }
    await user.update({ adminScore: score });
    await logAction(req, 'user', 'admin_score', 'User', user.id, '设置管理评分: ' + score + '（' + (user.realName || user.nickname) + '）');
    return success(res, { adminScore: score }, '评分已更新');
  } catch (err) { return fail(res, '操作失败', 500); }
});

// 禁用/启用用户
router.put('/:id/toggle-status', requirePermission('users:auth'), async function(req, res) {
  try {
    var user = await User.findByPk(req.params.id);
    if (!user) return fail(res, '用户不存在', 404);
    var newStatus = user.status === 'disabled' ? 'active' : 'disabled';
    await user.update({ status: newStatus });
    var actionText = newStatus === 'disabled' ? '禁用' : '启用';
    await logAction(req, 'user', 'toggle_status', 'User', user.id,
      actionText + '用户: ' + (user.nickname || user.phone));
    return success(res, user, '已' + actionText);
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
router.get('/:id/commissions', requirePermission('commissions:view'), async function(req, res) {
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
router.get('/:id/fans', requirePermission('users:view'), async function(req, res) {
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
router.get('/:id/shares', requirePermission('shares:view'), async function(req, res) {
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
