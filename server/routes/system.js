// server/routes/system.js — 系统管理 API（海南椰嫂综合平台）
const express = require('express');
const bcrypt = require('bcryptjs');
const { Admin, JobType, ServiceOrder } = require('../models');
const { authMiddleware, requireRole, requirePermission, ALL_PERMISSIONS } = require('../middleware/auth');
const { success, fail, paginate } = require('../utils/response');
const { logAction } = require('../utils/logger');
const { Op } = require('sequelize');

const router = express.Router();
router.use(authMiddleware);

// ==================== 管理员管理 ====================
// 仅 super 可操作
router.get('/admins', requireRole('super'), async function(req, res) {
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
    return paginate(res, result.rows, result.count, page, pageSize);
  } catch (err) { return fail(res, '查询失败: ' + err.message, 500); }
});

// 创建管理员
router.post('/admins', requireRole('super'), async function(req, res) {
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
      role: role || 'operator',
      permissions: JSON.stringify(permissions || [])
    });
    var result = admin.toJSON();
    delete result.password;
    await logAction(req, 'system', 'create', 'Admin', admin.id, '创建管理员: ' + username);
    return success(res, result, '创建成功');
  } catch (err) { return fail(res, '创建失败: ' + err.message, 500); }
});

// 编辑管理员
router.put('/admins/:id', requireRole('super'), async function(req, res) {
  try {
    var admin = await Admin.findByPk(req.params.id);
    if (!admin) return fail(res, '管理员不存在', 404);
    var updates = {};
    if (req.body.realName !== undefined) updates.realName = req.body.realName;
    if (req.body.role) updates.role = req.body.role;
    if (req.body.permissions !== undefined) updates.permissions = JSON.stringify(req.body.permissions);
    await admin.update(updates);
    var result = admin.toJSON();
    delete result.password;
    await logAction(req, 'system', 'update', 'Admin', admin.id, '编辑管理员: ' + admin.username);
    return success(res, result, '更新成功');
  } catch (err) { return fail(res, '更新失败', 500); }
});

// 设置管理员权限
router.put('/admins/:id/permissions', requireRole('super'), async function(req, res) {
  try {
    var admin = await Admin.findByPk(req.params.id);
    if (!admin) return fail(res, '管理员不存在', 404);
    if (admin.role === 'super') return fail(res, '超级管理员无需设置权限');
    var perms = req.body.permissions || [];
    await admin.update({ permissions: JSON.stringify(perms) });
    var result = admin.toJSON();
    delete result.password;
    await logAction(req, 'system', 'permissions', 'Admin', admin.id,
      '设置权限: ' + admin.username + ' -> ' + perms.join(', '));
    return success(res, result, '权限设置成功');
  } catch (err) { return fail(res, '设置失败', 500); }
});

// 获取所有可用权限列表
router.get('/permissions', requireRole('super'), function(req, res) {
  return success(res, ALL_PERMISSIONS);
});

// 启用/禁用管理员
router.put('/admins/:id/status', requireRole('super'), async function(req, res) {
  try {
    var admin = await Admin.findByPk(req.params.id);
    if (!admin) return fail(res, '管理员不存在', 404);
    if (admin.id === req.admin.id) return fail(res, '不能禁用自己');
    var newStatus = admin.status === 'active' ? 'disabled' : 'active';
    await admin.update({ status: newStatus });
    var actionWord = newStatus === 'disabled' ? '禁用' : '启用';
    await logAction(req, 'system', 'status', 'Admin', admin.id, actionWord + '管理员: ' + admin.username);
    return success(res, { status: newStatus }, actionWord + '成功');
  } catch (err) { return fail(res, '操作失败', 500); }
});

// 删除管理员
router.delete('/admins/:id', requireRole('super'), async function(req, res) {
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
router.put('/admins/:id/reset-password', requireRole('super'), async function(req, res) {
  try {
    var admin = await Admin.findByPk(req.params.id);
    if (!admin) return fail(res, '管理员不存在', 404);
    var newPwd = req.body.password || '123456';
    var hashed = await bcrypt.hash(newPwd, 10);
    await admin.update({ password: hashed });
    await logAction(req, 'system', 'reset-password', 'Admin', admin.id, '重置密码: ' + admin.username);
    return success(res, null, '密码已重置为: ' + newPwd);
  } catch (err) { return fail(res, '重置失败', 500); }
});

// ==================== 工种管理 ====================

// 工种列表
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

// 新增工种
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

// 编辑工种
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

// 删除工种（仅无引用时）
router.delete('/job-types/:id', requirePermission('system:jobtypes'), async function(req, res) {
  try {
    var jobType = await JobType.findByPk(req.params.id);
    if (!jobType) return fail(res, '工种不存在', 404);
    // 检查是否有关联的服务订单
    var orderCount = await ServiceOrder.count({ where: { jobTypeId: jobType.id } });
    if (orderCount > 0) {
      return fail(res, '该工种下有 ' + orderCount + ' 个订单，无法删除。请先禁用该工种。');
    }
    var name = jobType.name;
    await jobType.destroy();
    await logAction(req, 'system', 'delete', 'JobType', parseInt(req.params.id), '删除工种: ' + name);
    return success(res, null, '删除成功');
  } catch (err) { return fail(res, '删除失败: ' + err.message, 500); }
});

// ==================== 系统设置 ====================

// 获取所有系统设置
router.get('/settings', requireRole('super'), async function(req, res) {
  try {
    var { SystemSetting } = require('../models');
    var list = await SystemSetting.findAll({ order: [['group', 'ASC'], ['id', 'ASC']] });
    return success(res, list);
  } catch (err) { return fail(res, '查询失败: ' + err.message, 500); }
});

// 更新系统设置（批量）
router.put('/settings', requireRole('super'), async function(req, res) {
  try {
    var { SystemSetting } = require('../models');
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

module.exports = router;

