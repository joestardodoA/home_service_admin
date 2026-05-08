// server/routes/system.js — 系统管理 API（海南椰嫂综合平台）
const express = require('express');
const bcrypt = require('bcryptjs');
const { Admin, JobType, ServiceOrder, SystemSetting, Message, User } = require('../models');
const { authMiddleware, requirePermission, requireSuper, ALL_PERMISSIONS } = require('../middleware/auth');
const { success, fail, paginate } = require('../utils/response');
const { logAction } = require('../utils/logger');
const { Op } = require('sequelize');

const router = express.Router();
router.use(authMiddleware);

// ==================== 管理员管理（仅超级管理员） ====================

router.get('/admins', requireSuper, async function(req, res) {
  try {
    var page = parseInt(req.query.page) || 1;
    var pageSize = parseInt(req.query.pageSize) || 10;
    var where = {};
    if (req.query.role) where.role = req.query.role;
    if (req.query.keyword) {
      where[Op.or] = [
        { username: { [Op.like]: '%' + req.query.keyword + '%' } },
        { realName: { [Op.like]: '%' + req.query.keyword + '%' } }
      ];
    }
    var result = await Admin.findAndCountAll({
      where: where,
      attributes: { exclude: ['password'] },
      order: [['createdAt', 'DESC']],
      limit: pageSize,
      offset: (page - 1) * pageSize
    });

    // 解析 permissions 为数组
    var rows = result.rows.map(function(r) {
      var item = r.toJSON();
      if (typeof item.permissions === 'string') {
        try { item.permissions = JSON.parse(item.permissions); } catch(e) { item.permissions = []; }
      }
      return item;
    });

    return paginate(res, rows, result.count, page, pageSize);
  } catch (err) { return fail(res, '查询失败: ' + err.message, 500); }
});

// 创建管理员（自定义角色名 + 权限数组）
router.post('/admins', requireSuper, async function(req, res) {
  try {
    var { username, password, realName, role, permissions } = req.body;
    if (!username || !password) return fail(res, '用户名和密码不能为空');
    var exists = await Admin.findOne({ where: { username: username } });
    if (exists) return fail(res, '用户名已存在');
    var hashed = await bcrypt.hash(password, 10);
    var admin = await Admin.create({
      username: username,
      password: hashed,
      realName: realName || '',
      role: role || '运营',
      permissions: permissions || []
    });
    var result = admin.toJSON();
    delete result.password;
    if (typeof result.permissions === 'string') {
      try { result.permissions = JSON.parse(result.permissions); } catch(e) { result.permissions = []; }
    }
    await logAction(req, 'system', 'create', 'Admin', admin.id, '创建管理员: ' + username + ' (角色: ' + admin.role + ')');
    return success(res, result, '创建成功');
  } catch (err) { return fail(res, '创建失败: ' + err.message, 500); }
});

// 编辑管理员（角色名 + 权限数组）
router.put('/admins/:id', requireSuper, async function(req, res) {
  try {
    var admin = await Admin.findByPk(req.params.id);
    if (!admin) return fail(res, '管理员不存在', 404);
    // 不能修改超管自身的角色
    if (admin.role === 'super' && req.body.role && req.body.role !== 'super') {
      return fail(res, '不能更改超级管理员的角色');
    }
    var updates = {};
    if (req.body.realName !== undefined) updates.realName = req.body.realName;
    if (req.body.role !== undefined) updates.role = req.body.role;
    if (req.body.permissions !== undefined) updates.permissions = req.body.permissions;
    await admin.update(updates);
    var result = admin.toJSON();
    delete result.password;
    if (typeof result.permissions === 'string') {
      try { result.permissions = JSON.parse(result.permissions); } catch(e) { result.permissions = []; }
    }
    await logAction(req, 'system', 'update', 'Admin', admin.id, '编辑管理员: ' + admin.username);
    return success(res, result, '更新成功');
  } catch (err) { return fail(res, '更新失败', 500); }
});

// 获取所有可用权限列表（分组）
router.get('/permissions', requireSuper, function(req, res) {
  // 按 group 分组返回
  var grouped = {};
  ALL_PERMISSIONS.forEach(function(p) {
    if (!grouped[p.group]) grouped[p.group] = [];
    grouped[p.group].push({ code: p.code, name: p.name });
  });
  return success(res, { list: ALL_PERMISSIONS, grouped: grouped });
});

// 启用/禁用管理员
router.put('/admins/:id/status', requireSuper, async function(req, res) {
  try {
    var admin = await Admin.findByPk(req.params.id);
    if (!admin) return fail(res, '管理员不存在', 404);
    if (admin.id === req.admin.id) return fail(res, '不能禁用自己');
    if (admin.role === 'super' && admin.id !== req.admin.id) return fail(res, '不能禁用其他超级管理员');
    var newStatus = admin.status === 'active' ? 'disabled' : 'active';
    await admin.update({ status: newStatus });
    var actionWord = newStatus === 'disabled' ? '禁用' : '启用';
    await logAction(req, 'system', 'status', 'Admin', admin.id, actionWord + '管理员: ' + admin.username);
    return success(res, { status: newStatus }, actionWord + '成功');
  } catch (err) { return fail(res, '操作失败', 500); }
});

// 删除管理员
router.delete('/admins/:id', requireSuper, async function(req, res) {
  try {
    var admin = await Admin.findByPk(req.params.id);
    if (!admin) return fail(res, '管理员不存在', 404);
    if (admin.id === req.admin.id) return fail(res, '不能删除自己');
    if (admin.role === 'super') return fail(res, '不能删除超级管理员');
    var username = admin.username;
    await admin.destroy();
    await logAction(req, 'system', 'delete', 'Admin', parseInt(req.params.id), '删除管理员: ' + username);
    return success(res, null, '删除成功');
  } catch (err) { return fail(res, '删除失败', 500); }
});

// 重置密码
router.put('/admins/:id/reset-password', requireSuper, async function(req, res) {
  try {
    var admin = await Admin.findByPk(req.params.id);
    if (!admin) return fail(res, '管理员不存在', 404);
    var newPwd = req.body.password || '123456';
    var hashed = await bcrypt.hash(newPwd, 10);
    await admin.update({ password: hashed });
    await logAction(req, 'system', 'reset-password', 'Admin', admin.id, '重置密码: ' + admin.username);
    return success(res, null, '密码已重置成功，请通知该管理员');
  } catch (err) { return fail(res, '重置失败', 500); }
});

// 获取所有可分配管理员（用于订单分配下拉选择）
router.get('/sales-admins', async function(req, res) {
  try {
    var admins = await Admin.findAll({
      where: { status: 'active' },
      attributes: ['id', 'username', 'realName', 'role']
    });
    var result = admins.map(function(a) {
      return { id: a.id, username: a.username, realName: a.realName, role: a.role };
    });
    return success(res, result);
  } catch (err) { return fail(res, '查询失败', 500); }
});

// ==================== 工种管理 ====================

router.get('/job-types', requirePermission('system:jobtypes'), async function(req, res) {
  try {
    var where = {};
    if (req.query.status) where.status = req.query.status;
    var list = await JobType.findAll({
      where: where,
      order: [['sortOrder', 'DESC'], ['createdAt', 'ASC']]
    });
    return success(res, list);
  } catch (err) { return fail(res, '查询失败: ' + err.message, 500); }
});

router.post('/job-types', requirePermission('system:jobtypes'), async function(req, res) {
  try {
    var { code, name, icon, description, sortOrder } = req.body;
    if (!name) return fail(res, '工种名称不能为空');
    if (code) {
      var exists = await JobType.findOne({ where: { code: code } });
      if (exists) return fail(res, '工种编码已存在');
    }
    var jobType = await JobType.create({
      code: code || name,
      name: name,
      icon: icon || '',
      description: description || '',
      sortOrder: sortOrder || 0
    });
    await logAction(req, 'system', 'create', 'JobType', jobType.id, '新增工种: ' + name);
    return success(res, jobType, '创建成功');
  } catch (err) { return fail(res, '创建失败: ' + err.message, 500); }
});

router.put('/job-types/:id', requirePermission('system:jobtypes'), async function(req, res) {
  try {
    var jobType = await JobType.findByPk(req.params.id);
    if (!jobType) return fail(res, '工种不存在', 404);
    var updates = {};
    if (req.body.name !== undefined) updates.name = req.body.name;
    if (req.body.code !== undefined) updates.code = req.body.code;
    if (req.body.icon !== undefined) updates.icon = req.body.icon;
    if (req.body.description !== undefined) updates.description = req.body.description;
    if (req.body.sortOrder !== undefined) updates.sortOrder = req.body.sortOrder;
    if (req.body.status !== undefined) updates.status = req.body.status;
    await jobType.update(updates);
    await logAction(req, 'system', 'update', 'JobType', jobType.id, '编辑工种: ' + jobType.name);
    return success(res, jobType, '更新成功');
  } catch (err) { return fail(res, '更新失败: ' + err.message, 500); }
});

router.delete('/job-types/:id', requirePermission('system:jobtypes'), async function(req, res) {
  try {
    var jobType = await JobType.findByPk(req.params.id);
    if (!jobType) return fail(res, '工种不存在', 404);
    var orderCount = await ServiceOrder.count({ where: { jobTypeId: jobType.id } });
    if (orderCount > 0) {
      return fail(res, '该工种下有 ' + orderCount + ' 个订单，无法删除。请先禁用该工种。');
    }
    var name = jobType.name;
    await jobType.destroy();
    await logAction(req, 'system', 'delete', 'JobType', parseInt(req.params.id), '删除工种: ' + name);
    return success(res, null, '删除成功');
  } catch (err) { return fail(res, '删除失败', 500); }
});

// ==================== 系统设置 ====================

router.get('/settings', requirePermission('system:settings'), async function(req, res) {
  try {
    var list = await SystemSetting.findAll({ order: [['group', 'ASC'], ['id', 'ASC']] });
    return success(res, list);
  } catch (err) { return fail(res, '查询失败: ' + err.message, 500); }
});

router.put('/settings', requirePermission('system:settings'), async function(req, res) {
  try {
    var settings = req.body.settings || [];
    for (var i = 0; i < settings.length; i++) {
      var item = settings[i];
      if (!item.key) continue;
      var existing = await SystemSetting.findOne({ where: { key: item.key } });
      if (existing) {
        await existing.update({ value: item.value });
      } else {
        await SystemSetting.create({
          key: item.key,
          value: item.value,
          label: item.label || item.key,
          group: item.group || 'general'
        });
      }
    }
    await logAction(req, 'system', 'update_settings', 'SystemSetting', 0,
      '更新系统设置: ' + settings.map(function(s) { return s.key; }).join(', '));
    var list = await SystemSetting.findAll({ order: [['group', 'ASC'], ['id', 'ASC']] });
    return success(res, list, '设置已保存');
  } catch (err) { return fail(res, '保存失败: ' + err.message, 500); }
});
// ==================== 系统公告（向用户推送消息） ====================

// 发送系统公告
router.post('/broadcast', requirePermission('system:settings'), async function(req, res) {
  try {
    var title = req.body.title;
    var content = req.body.content;
    var targetType = req.body.targetType || 'all'; // all / specific
    var targetUserIds = req.body.targetUserIds || [];

    if (!title || !content) return fail(res, '标题和内容不能为空');

    // 查找目标用户
    var where = {};
    if (targetType === 'specific' && targetUserIds.length > 0) {
      where.id = { [Op.in]: targetUserIds };
    }
    var users = await User.findAll({ where: where, attributes: ['id'] });
    if (users.length === 0) return fail(res, '没有符合条件的用户');

    // 批量创建消息
    var messages = users.map(function(u) {
      return { userId: u.id, type: 'system', title: title, content: content, linkType: 'none', linkId: null };
    });
    await Message.bulkCreate(messages);

    await logAction(req, 'system', 'broadcast', 'Message', 0,
      '发送系统公告: ' + title + ' (目标: ' + users.length + ' 人)');
    return success(res, { sentCount: users.length }, '公告已发送给 ' + users.length + ' 位用户');
  } catch (err) { return fail(res, '发送失败: ' + err.message, 500); }
});

// 公告发送记录（从操作日志查询）
router.get('/broadcast-history', requirePermission('system:settings'), async function(req, res) {
  try {
    var { OperationLog } = require('../models');
    var page = parseInt(req.query.page) || 1;
    var pageSize = parseInt(req.query.pageSize) || 10;
    var result = await OperationLog.findAndCountAll({
      where: { module: 'system', action: 'broadcast' },
      order: [['createdAt', 'DESC']],
      limit: pageSize,
      offset: (page - 1) * pageSize
    });
    return paginate(res, result.rows, result.count, page, pageSize);
  } catch (err) { return fail(res, '查询失败: ' + err.message, 500); }
});

// ==================== 推荐关系链查看 ====================

// 获取某用户的推荐链（上线 → 用户 → 下线们）
router.get('/referral-chain/:userId', requirePermission('shares:view'), async function(req, res) {
  try {
    var userId = parseInt(req.params.userId);
    var user = await User.findByPk(userId, { attributes: ['id', 'nickname', 'phone', 'avatar', 'referrerId', 'memberLevel', 'createdAt'] });
    if (!user) return fail(res, '用户不存在', 404);

    // 上线
    var referrer = null;
    if (user.referrerId) {
      referrer = await User.findByPk(user.referrerId, { attributes: ['id', 'nickname', 'phone', 'avatar', 'memberLevel'] });
    }

    // 直推下线
    var referrals = await User.findAll({
      where: { referrerId: userId },
      attributes: ['id', 'nickname', 'phone', 'avatar', 'memberLevel', 'createdAt'],
      order: [['createdAt', 'DESC']]
    });

    return success(res, {
      user: user,
      referrer: referrer,
      referrals: referrals,
      totalReferrals: referrals.length
    });
  } catch (err) { return fail(res, '查询失败: ' + err.message, 500); }
});

// 推荐统计概览
router.get('/referral-stats', requirePermission('shares:view'), async function(req, res) {
  try {
    var { sequelize } = require('../models');
    // 有推荐关系的用户总数
    var [refResult] = await sequelize.query('SELECT COUNT(*) as count FROM users WHERE referrerId IS NOT NULL');
    var totalReferred = refResult[0] ? refResult[0].count : 0;

    // 推荐排行 TOP 10
    var [topResult] = await sequelize.query(
      'SELECT referrerId, COUNT(*) as count FROM users WHERE referrerId IS NOT NULL GROUP BY referrerId ORDER BY count DESC LIMIT 10'
    );
    var topReferrerIds = topResult.map(function(r) { return r.referrerId; });
    var topReferrers = [];
    if (topReferrerIds.length > 0) {
      var users = await User.findAll({
        where: { id: { [Op.in]: topReferrerIds } },
        attributes: ['id', 'nickname', 'phone', 'avatar']
      });
      var userMap = {};
      users.forEach(function(u) { userMap[u.id] = u; });
      topReferrers = topResult.map(function(r) {
        return { ...r, user: userMap[r.referrerId] || null };
      });
    }

    return success(res, {
      totalReferred: totalReferred,
      topReferrers: topReferrers
    });
  } catch (err) { return fail(res, '查询失败: ' + err.message, 500); }
});

module.exports = router;
