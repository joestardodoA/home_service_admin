// server/routes/auth.js — 认证路由（海南椰嫂综合平台）
const express = require('express');
const bcrypt = require('bcryptjs');
const { Admin } = require('../models');
const { generateToken, authMiddleware } = require('../middleware/auth');
const { success, fail } = require('../utils/response');

const router = express.Router();

// 登录
router.post('/login', async function(req, res) {
  try {
    var { username, password } = req.body;
    if (!username || !password) {
      return fail(res, '请输入用户名和密码');
    }
    var admin = await Admin.findOne({ where: { username: username } });
    if (!admin) {
      return fail(res, '用户名或密码错误');
    }
    if (admin.status === 'disabled') {
      return fail(res, '账号已被禁用');
    }
    var isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) {
      return fail(res, '用户名或密码错误');
    }
    // 更新登录时间
    await admin.update({ lastLoginAt: new Date() });
    var token = generateToken({
      id: admin.id,
      username: admin.username,
      role: admin.role,
      realName: admin.realName,
      permissions: admin.permissions || '[]'
    });
    return success(res, {
      token: token,
      admin: {
        id: admin.id,
        username: admin.username,
        realName: admin.realName,
        role: admin.role,
        permissions: admin.permissions || '[]'
      }
    }, '登录成功');
  } catch (err) {
    return fail(res, '服务器错误: ' + err.message, 500);
  }
});

// 获取当前管理员信息
router.get('/profile', authMiddleware, async function(req, res) {
  try {
    var admin = await Admin.findByPk(req.admin.id, {
      attributes: ['id', 'username', 'realName', 'role', 'permissions', 'lastLoginAt']
    });
    return success(res, admin);
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
