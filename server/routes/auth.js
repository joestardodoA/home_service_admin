// server/routes/auth.js — 认证路由（海南椰嫂综合平台）
const express = require('express');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const { Admin, LoginLog } = require('../models');
const { generateToken, authMiddleware, getEffectivePermissions, ALL_PERMISSIONS } = require('../middleware/auth');
const { success, fail } = require('../utils/response');

const router = express.Router();

// 登录速率限制：15分钟内最多5次尝试
var loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  // express-rate-limit v7+ 使用 message 选项返回 JSON
  message: { code: 429, msg: '登录尝试过多，请15分钟后重试', data: null }
});

// 提取客户端 IP
function getClientIp(req) {
  return req.headers['x-forwarded-for'] || req.connection.remoteAddress || req.ip || '';
}

// 登录
router.post('/login', loginLimiter, async function(req, res) {
  try {
    var { username, password } = req.body;
    var ip = getClientIp(req);
    var ua = (req.headers['user-agent'] || '').substring(0, 500);

    if (!username || !password) {
      return fail(res, '请输入用户名和密码');
    }
    var admin = await Admin.findOne({ where: { username: username } });
    if (!admin) {
      // 记录失败日志
      await LoginLog.create({ username: username, ip: ip, userAgent: ua, status: 'fail', message: '用户名不存在' });
      return fail(res, '用户名或密码错误');
    }
    if (admin.status === 'disabled') {
      await LoginLog.create({ adminId: admin.id, username: username, ip: ip, userAgent: ua, status: 'fail', message: '账号已被禁用' });
      return fail(res, '账号已被禁用');
    }
    var isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) {
      await LoginLog.create({ adminId: admin.id, username: username, ip: ip, userAgent: ua, status: 'fail', message: '密码错误' });
      return fail(res, '用户名或密码错误');
    }
    // 更新登录时间
    await admin.update({ lastLoginAt: new Date() });

    // 获取有效权限列表
    var effectivePerms = getEffectivePermissions(admin);

    var token = generateToken({
      id: admin.id,
      username: admin.username,
      role: admin.role,
      realName: admin.realName,
      permissions: effectivePerms
    });

    // 记录成功日志
    await LoginLog.create({ adminId: admin.id, username: username, ip: ip, userAgent: ua, status: 'success', message: '登录成功' });

    // 记录到在线用户表（内存）
    var onlineMap = global._onlineMap || (global._onlineMap = {});
    onlineMap[token] = { adminId: admin.id, username: admin.username, realName: admin.realName, role: admin.role, ip: ip, loginAt: new Date().toISOString() };

    return success(res, {
      token: token,
      admin: {
        id: admin.id,
        username: admin.username,
        realName: admin.realName,
        role: admin.role,
        permissions: effectivePerms
      }
    }, '登录成功');
  } catch (err) {
    return fail(res, '服务器错误: ' + err.message, 500);
  }
});

// 获取当前管理员信息（含最新权限）
router.get('/profile', authMiddleware, async function(req, res) {
  try {
    var admin = await Admin.findByPk(req.admin.id, {
      attributes: ['id', 'username', 'realName', 'role', 'permissions', 'lastLoginAt']
    });
    var result = admin.toJSON();
    result.permissions = getEffectivePermissions(admin);
    result.allPermissions = ALL_PERMISSIONS;
    return success(res, result);
  } catch (err) {
    return fail(res, '服务器错误', 500);
  }
});

// 修改密码
router.put('/password', authMiddleware, async function(req, res) {
  try {
    var { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword) {
      return fail(res, '请输入原密码和新密码');
    }
    if (newPassword.length < 6) {
      return fail(res, '新密码长度不能少于6位');
    }
    var admin = await Admin.findByPk(req.admin.id);
    var isMatch = await bcrypt.compare(oldPassword, admin.password);
    if (!isMatch) {
      return fail(res, '原密码错误');
    }
    var hashed = await bcrypt.hash(newPassword, 10);
    await admin.update({ password: hashed });
    return success(res, null, '密码修改成功');
  } catch (err) {
    return fail(res, '服务器错误', 500);
  }
});

module.exports = router;
