// server/routes/onlineUsers.js — 在线用户监控 API
const express = require('express');
const { authMiddleware, requirePermission } = require('../middleware/auth');
const { success, fail } = require('../utils/response');

const router = express.Router();
router.use(authMiddleware);

// 内存存储在线 Token（进程级，重启清空）
// 格式: { token: { adminId, username, realName, role, ip, loginAt } }
var onlineMap = global._onlineMap || (global._onlineMap = {});

// 查询在线用户列表
router.get('/', requirePermission('online:view'), async function(req, res) {
  try {
    var list = Object.keys(onlineMap).map(function(token) {
      var u = onlineMap[token];
      return {
        tokenKey: token.substring(0, 8) + '...',
        adminId: u.adminId,
        username: u.username,
        realName: u.realName,
        role: u.role,
        ip: u.ip,
        loginAt: u.loginAt
      };
    });
    // 按登录时间倒序
    list.sort(function(a, b) { return new Date(b.loginAt) - new Date(a.loginAt); });
    return success(res, { list: list, total: list.length });
  } catch (err) { return fail(res, '查询失败: ' + err.message, 500); }
});

// 强制下线
router.delete('/:tokenKey', requirePermission('online:kickout'), async function(req, res) {
  try {
    var tokenKey = req.params.tokenKey;
    var found = false;
    Object.keys(onlineMap).forEach(function(token) {
      if (token.substring(0, 8) === tokenKey) {
        delete onlineMap[token];
        found = true;
      }
    });
    if (!found) return fail(res, '用户已离线');
    return success(res, null, '已强制下线');
  } catch (err) { return fail(res, '操作失败: ' + err.message, 500); }
});

module.exports = router;
