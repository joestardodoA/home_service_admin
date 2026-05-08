/**
 * src/router/index.js — 管理后台路由配置（含权限守卫）
 */
import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  { path: '/login', name: 'Login', component: () => import('../views/login/Login.vue'), meta: { title: '登录' } },
  {
    path: '/', component: () => import('../layout/AdminLayout.vue'), redirect: '/dashboard',
    children: [
      { path: 'dashboard', name: 'Dashboard', component: () => import('../views/dashboard/Index.vue'), meta: { title: '数据看板', permission: 'dashboard:view' } },
      // 业务管理
      { path: 'coupons', name: 'CouponList', component: () => import('../views/coupon/List.vue'), meta: { title: '优惠券管理', permission: 'coupons:view' } },
      { path: 'coupons/create', name: 'CouponCreate', component: () => import('../views/coupon/Form.vue'), meta: { title: '创建优惠券', permission: 'coupons:create' } },
      { path: 'coupons/edit/:id', name: 'CouponEdit', component: () => import('../views/coupon/Form.vue'), meta: { title: '编辑优惠券', permission: 'coupons:edit' } },
      { path: 'agencies', name: 'AgencyList', component: () => import('../views/agency/List.vue'), meta: { title: '机构管理', permission: 'agencies:view' } },
      { path: 'agencies/create', name: 'AgencyCreate', component: () => import('../views/agency/Form.vue'), meta: { title: '创建机构', permission: 'agencies:create' } },
      { path: 'agencies/edit/:id', name: 'AgencyEdit', component: () => import('../views/agency/Form.vue'), meta: { title: '编辑机构', permission: 'agencies:edit' } },
      { path: 'orders', name: 'OrderList', component: () => import('../views/order/List.vue'), meta: { title: '券核销记录', permission: 'coupon_orders:view' } },
      { path: 'verify', name: 'VerifyPage', component: () => import('../views/order/Verify.vue'), meta: { title: '核销', permission: 'coupon_orders:verify' } },
      { path: 'service-orders', name: 'ServiceOrderList', component: () => import('../views/order/ServiceList.vue'), meta: { title: '服务订单', permission: ['service_orders:view_all', 'service_orders:view_own', 'service_orders:view_pool'] } },
      // 内容管理
      { path: 'articles', name: 'ArticleList', component: () => import('../views/article/List.vue'), meta: { title: '文章管理', permission: 'articles:view' } },
      { path: 'articles/create', name: 'ArticleCreate', component: () => import('../views/article/Form.vue'), meta: { title: '创建文章', permission: 'articles:create' } },
      { path: 'articles/edit/:id', name: 'ArticleEdit', component: () => import('../views/article/Form.vue'), meta: { title: '编辑文章', permission: 'articles:edit' } },
      { path: 'banners', name: 'BannerList', component: () => import('../views/banner/List.vue'), meta: { title: 'Banner 管理', permission: 'banners:view' } },
      // 用户管理
      { path: 'users', name: 'UserList', component: () => import('../views/user/List.vue'), meta: { title: '用户管理', permission: 'users:view' } },
      // 闺蜜圈管理
      { path: 'guimi-circles', name: 'GuimiCircleList', component: () => import('../views/guimi/List.vue'), meta: { title: '闺蜜圈管理', permission: 'users:view' } },
      // 佣金管理
      { path: 'commissions', name: 'CommissionList', component: () => import('../views/commission/List.vue'), meta: { title: '佣金管理', permission: 'users:view' } },
      // 系统设置（管理员管理仅 super 可见）
      { path: 'system/admins', name: 'AdminList', component: () => import('../views/system/AdminList.vue'), meta: { title: '管理员管理', requireSuper: true } },
      { path: 'system/job-types', name: 'JobTypeList', component: () => import('../views/system/JobTypeList.vue'), meta: { title: '工种管理', permission: 'system:jobtypes' } },
      { path: 'system/logs', name: 'LogList', component: () => import('../views/system/LogList.vue'), meta: { title: '操作日志', permission: 'system:logs' } },
      { path: 'system/settings', name: 'SystemSettings', component: () => import('../views/system/Settings.vue'), meta: { title: '系统配置', permission: 'system:settings' } },
      { path: 'system/messages', name: 'MessageCenter', component: () => import('../views/system/Messages.vue'), meta: { title: '消息管理', permission: 'system:settings' } },
      // 推广管理
      { path: 'shares', name: 'ShareList', component: () => import('../views/system/ShareList.vue'), meta: { title: '推广管理', permission: 'shares:view' } },
      // 系统监控
      { path: 'system/login-logs', name: 'LoginLog', component: () => import('../views/system/LoginLog.vue'), meta: { title: '登录日志', permission: 'login_logs:view' } },
      { path: 'system/online-users', name: 'OnlineUsers', component: () => import('../views/system/OnlineUsers.vue'), meta: { title: '在线用户', permission: 'online:view' } },
      // 内部公告
      { path: 'system/announcements', name: 'Announcements', component: () => import('../views/system/Announcements.vue'), meta: { title: '内部公告', permission: 'announcements:view' } },
      // AI 运营报告
      { path: 'reports', name: 'ReportList', component: () => import('../views/report/List.vue'), meta: { title: '运营报告', permission: 'ai:report' } }
    ]
  }
]

const router = createRouter({ history: createWebHistory(), routes })

router.beforeEach((to, from, next) => {
  document.title = (to.meta.title || '管理后台') + ' - 海南椰嫂综合平台'
  const token = localStorage.getItem('token')
  if (to.path !== '/login' && !token) return next('/login')
  if (to.path === '/login' && token) return next('/dashboard')

  // Dashboard 对所有已登录用户放行（防止无限重定向）
  if (to.path === '/dashboard') return next()

  // 权限检查
  if (token && to.meta.requireSuper) {
    var admin = JSON.parse(localStorage.getItem('admin') || '{}')
    if (admin.role !== 'super') return next('/dashboard')
  }
  if (token && to.meta.permission) {
    var admin2 = JSON.parse(localStorage.getItem('admin') || '{}')
    if (admin2.role !== 'super') {
      var perms = admin2.permissions || []
      var required = to.meta.permission
      if (Array.isArray(required)) {
        var hasAny = required.some(function(p) { return perms.indexOf(p) !== -1 })
        if (!hasAny) return next('/dashboard')
      } else {
        if (perms.indexOf(required) === -1) return next('/dashboard')
      }
    }
  }
  next()
})

export default router
