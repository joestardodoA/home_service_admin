/**
 * src/router/index.js — 管理后台路由配置
 */
import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  { path: '/login', name: 'Login', component: () => import('../views/login/Login.vue'), meta: { title: '登录' } },
  {
    path: '/', component: () => import('../layout/AdminLayout.vue'), redirect: '/dashboard',
    children: [
      { path: 'dashboard', name: 'Dashboard', component: () => import('../views/dashboard/Index.vue'), meta: { title: '数据看板' } },
      // 业务管理
      { path: 'coupons', name: 'CouponList', component: () => import('../views/coupon/List.vue'), meta: { title: '优惠券管理' } },
      { path: 'coupons/create', name: 'CouponCreate', component: () => import('../views/coupon/Form.vue'), meta: { title: '创建优惠券' } },
      { path: 'coupons/edit/:id', name: 'CouponEdit', component: () => import('../views/coupon/Form.vue'), meta: { title: '编辑优惠券' } },
      { path: 'agencies', name: 'AgencyList', component: () => import('../views/agency/List.vue'), meta: { title: '机构管理' } },
      { path: 'agencies/create', name: 'AgencyCreate', component: () => import('../views/agency/Form.vue'), meta: { title: '创建机构' } },
      { path: 'agencies/edit/:id', name: 'AgencyEdit', component: () => import('../views/agency/Form.vue'), meta: { title: '编辑机构' } },
      { path: 'orders', name: 'OrderList', component: () => import('../views/order/List.vue'), meta: { title: '券核销记录' } },
      { path: 'service-orders', name: 'ServiceOrderList', component: () => import('../views/order/ServiceList.vue'), meta: { title: '服务订单' } },
      // 内容管理
      { path: 'articles', name: 'ArticleList', component: () => import('../views/article/List.vue'), meta: { title: '文章管理' } },
      { path: 'articles/create', name: 'ArticleCreate', component: () => import('../views/article/Form.vue'), meta: { title: '创建文章' } },
      { path: 'articles/edit/:id', name: 'ArticleEdit', component: () => import('../views/article/Form.vue'), meta: { title: '编辑文章' } },
      { path: 'banners', name: 'BannerList', component: () => import('../views/banner/List.vue'), meta: { title: 'Banner 管理' } },
      // 用户管理
      { path: 'users', name: 'UserList', component: () => import('../views/user/List.vue'), meta: { title: '用户管理' } },
      // 系统设置
      { path: 'system/admins', name: 'AdminList', component: () => import('../views/system/AdminList.vue'), meta: { title: '管理员管理' } },
      { path: 'system/job-types', name: 'JobTypeList', component: () => import('../views/system/JobTypeList.vue'), meta: { title: '工种管理' } },
      { path: 'system/logs', name: 'LogList', component: () => import('../views/system/LogList.vue'), meta: { title: '操作日志' } }
    ]
  }
]

const router = createRouter({ history: createWebHistory(), routes })

router.beforeEach((to, from, next) => {
  document.title = (to.meta.title || '管理后台') + ' - 海南椰嫂综合平台'
  const token = localStorage.getItem('token')
  if (to.path !== '/login' && !token) next('/login')
  else if (to.path === '/login' && token) next('/dashboard')
  else next()
})

export default router
