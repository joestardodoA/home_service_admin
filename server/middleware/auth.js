// server/middleware/auth.js — JWT 认证与权限中间件（海南椰嫂综合平台）
const jwt = require('jsonwebtoken');
const { fail } = require('../utils/response');

const JWT_SECRET = process.env.JWT_SECRET || 'home_service_admin_secret_2026';

// 生成 Token
function generateToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });
}

// 验证 Token 中间件
function authMiddleware(req, res, next) {
  var token = req.headers.authorization;
  if (!token) {
    return fail(res, '请先登录', 401);
  }
  // 支持 "Bearer xxx" 和 "xxx" 两种格式
  if (token.startsWith('Bearer ')) {
    token = token.slice(7);
  }
  try {
    var decoded = jwt.verify(token, JWT_SECRET);
    req.admin = decoded;
    next();
  } catch (err) {
    return fail(res, 'Token 已过期，请重新登录', 401);
  }
}

// 角色权限检查
function requireRole() {
  var roles = Array.prototype.slice.call(arguments);
  return function(req, res, next) {
    if (!req.admin) {
      return fail(res, '请先登录', 401);
    }
    if (roles.length > 0 && roles.indexOf(req.admin.role) === -1) {
      return fail(res, '权限不足', 403);
    }
    next();
  };
}

// 细粒度权限检查（super 角色自动拥有所有权限）
function requirePermission(permission) {
  return function(req, res, next) {
    if (!req.admin) {
      return fail(res, '请先登录', 401);
    }
    // super 角色拥有所有权限
    if (req.admin.role === 'super') return next();
    var perms = [];
    try { perms = JSON.parse(req.admin.permissions || '[]'); } catch(e) {}
    if (perms.indexOf(permission) === -1) {
      return fail(res, '权限不足：缺少 ' + permission + ' 权限', 403);
    }
    next();
  };
}

// 所有可用权限列表
var ALL_PERMISSIONS = [
  { code: 'coupons:manage', name: '优惠券管理' },
  { code: 'agencies:manage', name: '机构管理' },
  { code: 'orders:manage', name: '优惠券订单管理' },
  { code: 'service_orders:manage', name: '服务订单管理' },
  { code: 'users:manage', name: '用户管理' },
  { code: 'users:level', name: '会员等级调整' },
  { code: 'users:points', name: '积分管理' },
  { code: 'articles:manage', name: '文章管理' },
  { code: 'banners:manage', name: 'Banner管理' },
  { code: 'commissions:manage', name: '佣金结算' },
  { code: 'shares:view', name: '分享追溯查看' },
  { code: 'system:admins', name: '管理员账号管理' },
  { code: 'system:jobtypes', name: '工种管理' },
  { code: 'system:logs', name: '操作日志' }
];

module.exports = { generateToken, authMiddleware, requireRole, requirePermission, ALL_PERMISSIONS, JWT_SECRET };
