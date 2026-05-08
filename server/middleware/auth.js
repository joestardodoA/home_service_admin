// server/middleware/auth.js — JWT 认证与权限中间件（海南椰嫂综合平台）
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { fail } = require('../utils/response');

// 安全密钥：生产环境必须设置 JWT_SECRET 环境变量
// 开发环境自动生成（每次重启会变化，仅限开发使用）
var JWT_SECRET = process.env.JWT_SECRET || '';
if (!JWT_SECRET) {
  if (process.env.NODE_ENV === 'production') {
    console.error('❌ 生产环境必须设置 JWT_SECRET 环境变量！');
    process.exit(1);
  }
  JWT_SECRET = 'dev_only_' + crypto.randomBytes(16).toString('hex');
  console.warn('⚠️ [开发模式] 使用临时 JWT 密钥，重启后 Token 将失效');
}

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

// 获取管理员的有效权限列表（合并角色和自定义权限）
function getEffectivePermissions(admin) {
  if (admin.role === 'super') return ALL_PERMISSIONS.map(function(p) { return p.code; });
  var perms = [];
  try { perms = typeof admin.permissions === 'string' ? JSON.parse(admin.permissions) : (admin.permissions || []); } catch(e) {}
  return perms;
}

// 细粒度权限检查（super 角色自动拥有所有权限）
function requirePermission(permission) {
  return function(req, res, next) {
    if (!req.admin) {
      return fail(res, '请先登录', 401);
    }
    // super 角色拥有所有权限
    if (req.admin.role === 'super') return next();
    var perms = getEffectivePermissions(req.admin);
    if (perms.indexOf(permission) === -1) {
      return fail(res, '权限不足：缺少「' + getPermissionName(permission) + '」权限', 403);
    }
    next();
  };
}

// 满足任一权限即可
function requireAnyPermission() {
  var permissions = Array.prototype.slice.call(arguments);
  return function(req, res, next) {
    if (!req.admin) {
      return fail(res, '请先登录', 401);
    }
    if (req.admin.role === 'super') return next();
    var perms = getEffectivePermissions(req.admin);
    var hasAny = permissions.some(function(p) { return perms.indexOf(p) !== -1; });
    if (!hasAny) {
      return fail(res, '权限不足', 403);
    }
    next();
  };
}

// 仅超级管理员
function requireSuper(req, res, next) {
  if (!req.admin) return fail(res, '请先登录', 401);
  if (req.admin.role !== 'super') return fail(res, '仅超级管理员可操作', 403);
  next();
}

// 根据权限码获取权限名称
function getPermissionName(code) {
  var found = ALL_PERMISSIONS.find(function(p) { return p.code === code; });
  return found ? found.name : code;
}

// ========== 所有可用权限列表（完整细粒度） ==========
var ALL_PERMISSIONS = [
  // 数据看板
  { code: 'dashboard:view', name: '查看数据看板', group: '数据看板' },

  // 优惠券管理
  { code: 'coupons:view', name: '查看优惠券', group: '优惠券管理' },
  { code: 'coupons:create', name: '创建优惠券', group: '优惠券管理' },
  { code: 'coupons:edit', name: '编辑优惠券', group: '优惠券管理' },
  { code: 'coupons:delete', name: '删除优惠券', group: '优惠券管理' },

  // 机构管理
  { code: 'agencies:view', name: '查看机构', group: '机构管理' },
  { code: 'agencies:create', name: '创建机构', group: '机构管理' },
  { code: 'agencies:edit', name: '编辑机构', group: '机构管理' },
  { code: 'agencies:delete', name: '删除机构', group: '机构管理' },

  // 券核销
  { code: 'coupon_orders:view', name: '查看核销记录', group: '券核销' },
  { code: 'coupon_orders:verify', name: '执行核销操作', group: '券核销' },

  // 服务订单
  { code: 'service_orders:view_own', name: '查看已分配给我的订单', group: '服务订单' },
  { code: 'service_orders:view_pool', name: '查看公域池订单', group: '服务订单' },
  { code: 'service_orders:view_all', name: '查看全部订单', group: '服务订单' },
  { code: 'service_orders:audit', name: '审核订单（通过/拒绝）', group: '服务订单' },
  { code: 'service_orders:assign', name: '分配订单给销售', group: '服务订单' },
  { code: 'service_orders:dispatch', name: '派单（匹配阿姨/确认接单）', group: '服务订单' },
  { code: 'service_orders:complete', name: '标记订单完成', group: '服务订单' },
  { code: 'service_orders:cancel', name: '取消/拒绝订单', group: '服务订单' },

  // 用户管理
  { code: 'users:view', name: '查看用户列表', group: '用户管理' },
  { code: 'users:edit', name: '编辑用户信息', group: '用户管理' },
  { code: 'users:level', name: '调整会员等级', group: '用户管理' },
  { code: 'users:points', name: '积分管理', group: '用户管理' },
  { code: 'users:auth', name: '实名认证审核', group: '用户管理' },

  // 内容管理
  { code: 'articles:view', name: '查看文章', group: '内容管理' },
  { code: 'articles:create', name: '创建文章', group: '内容管理' },
  { code: 'articles:edit', name: '编辑文章', group: '内容管理' },
  { code: 'articles:delete', name: '删除文章', group: '内容管理' },
  { code: 'banners:view', name: '查看Banner', group: '内容管理' },
  { code: 'banners:create', name: '创建Banner', group: '内容管理' },
  { code: 'banners:edit', name: '编辑Banner', group: '内容管理' },
  { code: 'banners:delete', name: '删除Banner', group: '内容管理' },

  // 佣金与推广
  { code: 'commissions:view', name: '查看佣金记录', group: '佣金推广' },
  { code: 'commissions:settle', name: '佣金结算操作', group: '佣金推广' },
  { code: 'shares:view', name: '查看分享追溯', group: '佣金推广' },

  // 系统设置
  { code: 'system:admins', name: '管理员账号管理', group: '系统设置' },
  { code: 'system:jobtypes', name: '工种管理', group: '系统设置' },
  { code: 'system:settings', name: '系统参数设置', group: '系统设置' },
  { code: 'system:logs', name: '操作日志查看', group: '系统设置' },

  // 后台通知
  { code: 'notifications:receive_order', name: '接收新订单通知', group: '通知' },
  { code: 'notifications:receive_application', name: '接收新接单申请通知', group: '通知' },

  // 系统监控
  { code: 'login_logs:view', name: '查看登录日志', group: '系统监控' },
  { code: 'login_logs:clear', name: '清空登录日志', group: '系统监控' },
  { code: 'online:view', name: '查看在线用户', group: '系统监控' },
  { code: 'online:kickout', name: '强制下线', group: '系统监控' },

  // 内部公告
  { code: 'announcements:view', name: '查看公告', group: '内部公告' },
  { code: 'announcements:create', name: '发布公告', group: '内部公告' },
  { code: 'announcements:edit', name: '编辑公告', group: '内部公告' },
  { code: 'announcements:delete', name: '删除公告', group: '内部公告' },

  // AI 助手（GenmaClaw Phase B + C）
  { code: 'ai:chat', name: 'AI 自由对话', group: 'AI 助手' },
  { code: 'ai:recommend', name: 'AI 智能派单推荐', group: 'AI 助手' },
  { code: 'ai:report', name: 'AI 运营报告生成', group: 'AI 助手' },
  { code: 'ai:import', name: 'AI 导入辅助分析', group: 'AI 助手' },
  { code: 'ai:analyze', name: 'AI 文件分析', group: 'AI 助手' },
  { code: 'ai:content', name: 'AI 内容生成', group: 'AI 助手' }
];

module.exports = {
  generateToken, authMiddleware, requirePermission,
  requireAnyPermission, requireSuper,
  getEffectivePermissions, ALL_PERMISSIONS, JWT_SECRET
};
