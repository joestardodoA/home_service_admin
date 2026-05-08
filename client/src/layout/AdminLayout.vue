<template>
  <el-container class="admin-layout">
    <!-- 手机端遮罩 -->
    <div v-if="isMobile && sidebarOpen" class="mobile-overlay" @click="sidebarOpen = false"></div>
    <el-aside :width="isCollapse ? '72px' : '240px'" class="sidebar" :class="{ 'sidebar-mobile-open': isMobile && sidebarOpen, 'sidebar-mobile-hidden': isMobile && !sidebarOpen }">

      <!-- Logo 区域 -->
      <div class="logo" @click="$router.push('/dashboard')">
        <div class="logo-icon-wrap">
          <svg class="logo-svg" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M3 9.5L12 3L21 9.5V20C21 20.55 20.55 21 20 21H4C3.45 21 3 20.55 3 20V9.5Z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M9 21V12H15V21" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        <transition name="fade">
          <span v-if="!isCollapse" class="logo-text">椰嫂管理平台</span>
        </transition>
      </div>

      <!-- 导航菜单（根据权限动态显示） -->
      <el-menu :default-active="activeMenu" :collapse="isCollapse" router background-color="transparent" text-color="rgba(255,255,255,0.55)" active-text-color="#5E9FFF" class="sidebar-menu">
        <el-menu-item v-if="can('dashboard:view') || userStore.isSuper" index="/dashboard">
          <el-icon><DataAnalysis /></el-icon>
          <template #title>数据看板</template>
        </el-menu-item>

        <!-- 订单管理（核心业务） -->
        <el-sub-menu v-if="canAny('service_orders:view_all','service_orders:view_own','service_orders:view_pool','service_orders:audit','service_orders:assign','service_orders:dispatch') || userStore.isSuper" index="order-mgmt">
          <template #title><el-icon><List /></el-icon><span>订单管理</span></template>
          <el-menu-item v-if="canAny('service_orders:view_all','service_orders:view_own','service_orders:view_pool') || userStore.isSuper" index="/service-orders"><el-icon><Tickets /></el-icon>全部订单</el-menu-item>
          <el-menu-item v-if="can('service_orders:audit') || userStore.isSuper" index="order-pending" @click="router.push({ path: '/service-orders', query: { status: 'pending' } })"><el-icon><Stamp /></el-icon>待审核 <el-badge v-if="menuBadges.pending > 0" :value="menuBadges.pending" :max="99" style="margin-left:4px;" /></el-menu-item>
          <el-menu-item v-if="can('service_orders:assign') || userStore.isSuper" index="order-approved" @click="router.push({ path: '/service-orders', query: { status: 'approved' } })"><el-icon><Avatar /></el-icon>待分配 <el-badge v-if="menuBadges.approved > 0" :value="menuBadges.approved" :max="99" style="margin-left:4px;" /></el-menu-item>
          <el-menu-item v-if="can('service_orders:dispatch') || userStore.isSuper" index="order-dispatch" @click="router.push({ path: '/service-orders', query: { status: 'assigned' } })"><el-icon><Promotion /></el-icon>待派单</el-menu-item>
          <el-menu-item v-if="canAny('service_orders:view_all','service_orders:view_own','service_orders:dispatch') || userStore.isSuper" index="order-matched" @click="router.push({ path: '/service-orders', query: { status: 'matched' } })"><el-icon><CircleCheck /></el-icon>已派单</el-menu-item>
        </el-sub-menu>

        <!-- 营销管理（优惠券/机构/核销） -->
        <el-sub-menu v-if="canAny('coupons:view','agencies:view','coupon_orders:view') || userStore.isSuper" index="marketing">
          <template #title><el-icon><Goods /></el-icon><span>营销管理</span></template>
          <el-menu-item v-if="can('coupons:view') || userStore.isSuper" index="/coupons"><el-icon><Ticket /></el-icon>优惠券</el-menu-item>
          <el-menu-item v-if="can('agencies:view') || userStore.isSuper" index="/agencies"><el-icon><OfficeBuilding /></el-icon>合作机构</el-menu-item>
          <el-menu-item v-if="can('coupon_orders:verify') || userStore.isSuper" index="/verify"><el-icon><CircleCheck /></el-icon>核销</el-menu-item>
          <el-menu-item v-if="can('coupon_orders:view') || userStore.isSuper" index="/orders"><el-icon><Ticket /></el-icon>券核销记录</el-menu-item>
        </el-sub-menu>

        <!-- 内容管理 -->
        <el-sub-menu v-if="canAny('articles:view','banners:view') || userStore.isSuper" index="content">
          <template #title><el-icon><Document /></el-icon><span>内容管理</span></template>
          <el-menu-item v-if="can('articles:view') || userStore.isSuper" index="/articles"><el-icon><Reading /></el-icon>文章</el-menu-item>
          <el-menu-item v-if="can('banners:view') || userStore.isSuper" index="/banners"><el-icon><Picture /></el-icon>Banner</el-menu-item>
        </el-sub-menu>

        <!-- 用户管理 -->
        <el-sub-menu v-if="can('users:view') || canAny('shares:view') || userStore.isSuper" index="user-mgmt">
          <template #title><el-icon><User /></el-icon><span>用户管理</span></template>
          <el-menu-item v-if="can('users:view') || userStore.isSuper" index="/users"><el-icon><UserFilled /></el-icon>用户列表</el-menu-item>
          <el-menu-item v-if="can('users:view') || userStore.isSuper" index="/guimi-circles"><el-icon><Connection /></el-icon>闺蜜圈管理</el-menu-item>
          <el-menu-item v-if="can('users:view') || userStore.isSuper" index="/commissions"><el-icon><Coin /></el-icon>佣金管理</el-menu-item>
          <el-menu-item v-if="canAny('shares:view') || userStore.isSuper" index="/shares"><el-icon><Share /></el-icon>推广管理</el-menu-item>
        </el-sub-menu>

        <!-- 系统设置 -->
        <el-sub-menu v-if="canAny('system:admins','system:jobtypes','system:logs','system:settings') || userStore.isSuper" index="system">
          <template #title><el-icon><Tools /></el-icon><span>系统设置</span></template>
          <el-menu-item v-if="userStore.isSuper" index="/system/admins"><el-icon><Avatar /></el-icon>管理员</el-menu-item>
          <el-menu-item v-if="can('system:jobtypes') || userStore.isSuper" index="/system/job-types"><el-icon><Grid /></el-icon>工种管理</el-menu-item>
          <el-menu-item v-if="can('system:settings') || userStore.isSuper" index="/system/settings"><el-icon><Setting /></el-icon>系统配置</el-menu-item>
          <el-menu-item v-if="can('system:settings') || userStore.isSuper" index="/system/messages"><el-icon><ChatDotRound /></el-icon>消息管理</el-menu-item>
          <el-menu-item v-if="can('system:logs') || userStore.isSuper" index="/system/logs"><el-icon><Notebook /></el-icon>操作日志</el-menu-item>
        </el-sub-menu>

        <!-- 系统监控 -->
        <el-sub-menu v-if="canAny('login_logs:view','online:view') || userStore.isSuper" index="monitor">
          <template #title><el-icon><Monitor /></el-icon><span>系统监控</span></template>
          <el-menu-item v-if="can('login_logs:view') || userStore.isSuper" index="/system/login-logs"><el-icon><Tickets /></el-icon>登录日志</el-menu-item>
          <el-menu-item v-if="can('online:view') || userStore.isSuper" index="/system/online-users"><el-icon><UserFilled /></el-icon>在线用户</el-menu-item>
        </el-sub-menu>

        <!-- 内部公告 -->
        <el-menu-item v-if="can('announcements:view') || userStore.isSuper" index="/system/announcements"><el-icon><Bell /></el-icon><template #title>内部公告</template></el-menu-item>
      </el-menu>
    </el-aside>

    <el-container>
      <!-- 毛玻璃顶栏 -->
      <el-header class="topbar">
        <div class="topbar-left">
          <div class="collapse-btn" @click="toggleSidebar">
            <el-icon :size="18"><Fold v-if="!isCollapse && !isMobile" /><Expand v-else /></el-icon>
          </div>
          <el-breadcrumb separator="/">
            <el-breadcrumb-item :to="{ path: '/dashboard' }">首页</el-breadcrumb-item>
            <el-breadcrumb-item v-if="breadcrumbParent">{{ breadcrumbParent }}</el-breadcrumb-item>
            <el-breadcrumb-item>{{ $route.meta.title }}</el-breadcrumb-item>
          </el-breadcrumb>
        </div>
        <div class="topbar-right">
          <!-- 通知铃铛 -->
          <el-popover placement="bottom-end" :width="360" trigger="click" @show="loadNotifications">
            <template #reference>
              <el-badge :value="unreadCount" :hidden="unreadCount === 0" :max="99">
                <div class="notify-btn">
                  <el-icon :size="18"><Bell /></el-icon>
                </div>
              </el-badge>
            </template>
            <div class="notify-panel">
              <div class="np-header">
                <span class="np-title">通知</span>
                <el-button link type="primary" size="small" @click="markAllRead" v-if="unreadCount > 0">全部已读</el-button>
              </div>
              <div class="np-list" v-if="notifications.length > 0">
                <div class="np-item" v-for="n in notifications" :key="n.id" :class="{ unread: !n.isRead }" @click="handleNotifyClick(n)">
                  <div class="np-dot" v-if="!n.isRead"></div>
                  <div class="np-content">
                    <div class="np-item-title">{{ n.title }}</div>
                    <div class="np-item-desc">{{ n.content }}</div>
                    <div class="np-item-time">{{ formatTime(n.createdAt) }}</div>
                  </div>
                </div>
              </div>
              <div class="np-empty" v-else>暂无通知</div>
              <div class="np-footer" style="text-align:center;padding:8px;border-top:1px solid #f0f0f0;">
                <el-button link type="primary" size="small" @click="router.push('/system/messages')">查看全部通知</el-button>
              </div>
            </div>
          </el-popover>

          <span class="admin-name">{{ userStore.admin.realName || userStore.admin.username }}</span>
          <el-tag size="small" effect="plain" class="role-tag">{{ userStore.admin.role }}</el-tag>
          <el-dropdown trigger="click">
            <div class="avatar-btn">
              <el-icon :size="16"><UserFilled /></el-icon>
            </div>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item @click="showPasswordDialog"><el-icon><Lock /></el-icon>修改密码</el-dropdown-item>
                <el-dropdown-item divided @click="handleLogout"><el-icon><SwitchButton /></el-icon>退出登录</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </el-header>
      <el-main class="main-content"><router-view /></el-main>
    </el-container>

    <!-- AI 助手浮窗（需 ai:chat 权限 / 超级管理员） -->
    <AiFloat v-if="can('ai:chat') || userStore.isSuper" />

    <!-- 修改密码弹窗 -->
    <el-dialog v-model="pwdDialogVisible" title="修改密码" width="420px" :close-on-click-modal="false">
      <el-form :model="pwdForm" label-width="90px" ref="pwdFormRef">
        <el-form-item label="旧密码" required>
          <el-input v-model="pwdForm.oldPassword" type="password" show-password placeholder="请输入当前密码" />
        </el-form-item>
        <el-form-item label="新密码" required>
          <el-input v-model="pwdForm.newPassword" type="password" show-password placeholder="至少 6 位" />
        </el-form-item>
        <el-form-item label="确认密码" required>
          <el-input v-model="pwdForm.confirmPassword" type="password" show-password placeholder="再次输入新密码" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="pwdDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="pwdSubmitting" @click="handleChangePassword">确认修改</el-button>
      </template>
    </el-dialog>
  </el-container>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useUserStore, hasPermission } from '../store/user.js'
import { ElMessageBox, ElMessage } from 'element-plus'
import request from '../api/request.js'
import AiFloat from '../components/AiFloat.vue'

const router = useRouter()
const route = useRoute()
const userStore = useUserStore()
const isCollapse = ref(false)
const isMobile = ref(false)
const sidebarOpen = ref(false)

function toggleSidebar() {
  if (isMobile.value) {
    sidebarOpen.value = !sidebarOpen.value
  } else {
    isCollapse.value = !isCollapse.value
  }
}

// 动态计算菜单激活项（支持 query 参数匹配待审核/待派单）
const activeMenu = computed(() => {
  if (route.path === '/service-orders') {
    if (route.query.status === 'pending') return 'order-pending'
    if (route.query.status === 'approved') return 'order-approved'
    if (route.query.status === 'assigned' || route.query.status === 'matching') {
      return 'order-dispatch'
    }
    if (route.query.status === 'matched') {
      return 'order-matched'
    }
    return '/service-orders'
  }
  return route.path
})

// 面包屑父级菜单映射
const breadcrumbParent = computed(() => {
  var p = route.path
  if (p === '/dashboard') return ''
  if (p.startsWith('/service-orders') || p.startsWith('/orders')) return '订单管理'
  if (p.startsWith('/coupons') || p.startsWith('/agencies')) return '营销管理'
  if (p.startsWith('/articles') || p.startsWith('/banners')) return '内容管理'
  if (p.startsWith('/users')) return '用户管理'
  if (p.startsWith('/guimi-circles')) return '闺蜜圈'
  if (p.startsWith('/commissions') || p.startsWith('/shares')) return '推广管理'
  if (p.startsWith('/system')) return '系统设置'
  return ''
})
const unreadCount = ref(0)
const notifications = ref([])
const menuBadges = ref({ pending: 0, approved: 0 })
var pollTimer = null

// 权限判断
function can(code) { 
  return hasPermission(userStore, code) 
}
function canAny() {
  for (var i = 0; i < arguments.length; i++) {
    if (can(arguments[i])) return true
  }
  return false
}

// 通知相关
async function fetchUnreadCount() {
  try {
    var res = await request.get('/notifications/unread-count')
    unreadCount.value = res.data.count || 0
  } catch (e) {}
}

// 菜单角标：待审核/待分配数量
async function fetchMenuBadges() {
  try {
    var res = await request.get('/dashboard/stats')
    menuBadges.value = {
      pending: res.data.pendingServiceOrders || 0,
      approved: res.data.approvedServiceOrders || 0
    }
  } catch (e) {}
}

async function loadNotifications() {
  try {
    var res = await request.get('/notifications', { params: { pageSize: 20 } })
    notifications.value = res.data.list || []
  } catch (e) {}
}

async function markAllRead() {
  try {
    await request.put('/notifications/read-all')
    unreadCount.value = 0
    notifications.value.forEach(function(n) { n.isRead = true })
  } catch (e) {}
}

async function handleNotifyClick(n) {
  if (!n.isRead) {
    try {
      await request.put('/notifications/' + n.id + '/read')
      n.isRead = true
      unreadCount.value = Math.max(0, unreadCount.value - 1)
    } catch (e) {}
  }
  if (n.linkType === 'service_order') {
    router.push('/service-orders')
  }
}

function formatTime(d) {
  if (!d) return ''
  var dt = new Date(d)
  var now = new Date()
  var diff = (now - dt) / 60000
  if (diff < 1) return '刚刚'
  if (diff < 60) return Math.floor(diff) + '分钟前'
  if (diff < 1440) return Math.floor(diff / 60) + '小时前'
  return dt.getMonth() + 1 + '/' + dt.getDate() + ' ' + String(dt.getHours()).padStart(2, '0') + ':' + String(dt.getMinutes()).padStart(2, '0')
}

function handleLogout() {
  ElMessageBox.confirm('确认退出登录？', '提示', { type: 'warning' }).then(() => {
    userStore.logout()
    router.push('/login')
  }).catch(() => {})
}

// 修改密码
const pwdDialogVisible = ref(false)
const pwdSubmitting = ref(false)
const pwdForm = ref({ oldPassword: '', newPassword: '', confirmPassword: '' })

function showPasswordDialog() {
  pwdForm.value = { oldPassword: '', newPassword: '', confirmPassword: '' }
  pwdDialogVisible.value = true
}

async function handleChangePassword() {
  if (!pwdForm.value.oldPassword) return ElMessage.warning('请输入旧密码')
  if (!pwdForm.value.newPassword || pwdForm.value.newPassword.length < 6) return ElMessage.warning('新密码至少 6 位')
  if (pwdForm.value.newPassword !== pwdForm.value.confirmPassword) return ElMessage.warning('两次输入的密码不一致')
  pwdSubmitting.value = true
  try {
    await request.put('/auth/password', {
      oldPassword: pwdForm.value.oldPassword,
      newPassword: pwdForm.value.newPassword
    })
    ElMessage.success('密码修改成功，请重新登录')
    pwdDialogVisible.value = false
    setTimeout(function() {
      userStore.logout()
      router.push('/login')
    }, 1500)
  } catch (e) {
    ElMessage.error(e?.response?.data?.msg || '修改失败')
  } finally { pwdSubmitting.value = false }
}

// 根据屏幕宽度自动折叠侧边栏
function checkScreenWidth() {
  var w = window.innerWidth
  isMobile.value = w <= 768
  if (isMobile.value) {
    isCollapse.value = false
    sidebarOpen.value = false
  } else if (w <= 1200) {
    isCollapse.value = true
  }
}

// 路由变化时关闭移动端侧边栏
router.afterEach(() => {
  if (isMobile.value) sidebarOpen.value = false
})

onMounted(() => {
  fetchUnreadCount()
  fetchMenuBadges()
  pollTimer = setInterval(function() {
    fetchUnreadCount()
    fetchMenuBadges()
  }, 30000)
  checkScreenWidth()
  window.addEventListener('resize', checkScreenWidth)
})

onBeforeUnmount(() => {
  if (pollTimer) clearInterval(pollTimer)
  window.removeEventListener('resize', checkScreenWidth)
})
</script>

<style scoped>
.admin-layout { height: 100vh; }

/* ===== 侧边栏 ===== */
.sidebar {
  background: var(--sidebar-bg);
  transition: width 0.3s var(--ease-out);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  border-right: 1px solid rgba(255, 255, 255, 0.04);
}
.logo {
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 0 16px;
  gap: 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  transition: all var(--transition-normal);
}
.logo:hover { background: rgba(255, 255, 255, 0.03); }
.logo-icon-wrap {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: linear-gradient(135deg, var(--apple-blue), #4A8BEE);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.logo-svg { width: 20px; height: 20px; color: #fff; }
.logo-text {
  color: #fff;
  font-size: 15px;
  font-weight: 600;
  white-space: nowrap;
  letter-spacing: 0.01em;
}
.sidebar-menu {
  border-right: none !important;
  flex: 1;
  padding: 8px;
  overflow-y: auto;
  overflow-x: hidden;
}
/* 隐藏滚动条但保持可滚动 */
.sidebar-menu::-webkit-scrollbar { width: 0; background: transparent; }
.sidebar-menu { scrollbar-width: none; -ms-overflow-style: none; }
.sidebar-menu:not(.el-menu--collapse) { width: 240px; }
.sidebar-menu .el-menu-item {
  border-radius: 8px !important;
  margin: 2px 0;
  height: 42px !important;
  line-height: 42px !important;
  transition: all var(--transition-fast);
}
.sidebar-menu .el-menu-item:hover { background: var(--sidebar-hover) !important; }
.sidebar-menu .el-menu-item.is-active { background: var(--sidebar-active) !important; color: var(--sidebar-text-active) !important; }
.sidebar-menu .el-sub-menu__title {
  border-radius: 8px !important;
  height: 42px !important;
  line-height: 42px !important;
  margin: 2px 0;
}
.sidebar-menu .el-sub-menu__title:hover { background: var(--sidebar-hover) !important; }
.fade-enter-active, .fade-leave-active { transition: opacity 0.2s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

/* ===== 毛玻璃顶栏 ===== */
.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: rgba(255, 255, 255, 0.72);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
  padding: 0 24px;
  height: 64px !important;
  position: sticky;
  top: 0;
  z-index: 10;
}
.topbar-left { display: flex; align-items: center; gap: 16px; }
.collapse-btn {
  width: 36px; height: 36px; border-radius: 10px;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; color: var(--gray-500);
  transition: all var(--transition-fast);
}
.collapse-btn:hover { background: var(--gray-100); color: var(--gray-900); }
.topbar-right { display: flex; align-items: center; gap: 16px; }
.admin-name { font-size: 13px; color: var(--gray-600); font-weight: 500; }
.role-tag { font-size: 11px !important; }
.notify-btn {
  width: 36px; height: 36px; border-radius: 50%;
  background: var(--gray-100);
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; color: var(--gray-500);
  transition: all var(--transition-fast);
}
.notify-btn:hover { background: var(--gray-200); color: var(--gray-700); }
.avatar-btn {
  width: 36px; height: 36px; border-radius: 50%;
  background: var(--gray-100);
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; color: var(--gray-500);
  transition: all var(--transition-fast);
}
.avatar-btn:hover { background: var(--gray-200); color: var(--gray-700); }

/* ===== 通知面板 ===== */
.np-header { display: flex; justify-content: space-between; align-items: center; padding-bottom: 12px; border-bottom: 1px solid var(--gray-100); }
.np-title { font-weight: 600; font-size: 15px; }
.np-list { max-height: 400px; overflow-y: auto; }
.np-item { display: flex; gap: 10px; padding: 12px 0; border-bottom: 1px solid var(--gray-100); cursor: pointer; transition: background 0.15s; position: relative; }
.np-item:hover { background: var(--gray-50); margin: 0 -12px; padding: 12px; border-radius: 8px; }
.np-item.unread { background: rgba(94, 159, 255, 0.04); }
.np-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--apple-blue); flex-shrink: 0; margin-top: 6px; }
.np-content { flex: 1; min-width: 0; }
.np-item-title { font-size: 13px; font-weight: 600; color: var(--gray-900); margin-bottom: 4px; }
.np-item-desc { font-size: 12px; color: var(--gray-500); line-height: 1.4; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
.np-item-time { font-size: 11px; color: var(--gray-400); margin-top: 4px; }
.np-empty { text-align: center; padding: 40px 0; color: var(--gray-400); font-size: 13px; }

/* ===== 主内容区 ===== */
.main-content { background: var(--bg-page); padding: 24px; overflow-y: auto; }

/* ===== 响应式适配 ===== */

/* ≤1440px 标准笔记本 */
@media (max-width: 1440px) {
  .main-content { padding: 20px; }
  .topbar { padding: 0 16px; }
  .topbar-right { gap: 10px; }
}

/* ≤1200px 小笔记本 — 自动收起侧边栏 */
@media (max-width: 1200px) {
  .main-content { padding: 16px; }
  .topbar { height: 56px !important; }
  .logo { height: 56px; }
  .admin-name { display: none; }
}

/* ≤1024px 平板 */
@media (max-width: 1024px) {
  .main-content { padding: 12px; }
  .topbar-right { gap: 8px; }
  .role-tag { display: none; }
}

/* ≤768px 手机/小平板 */
@media (max-width: 768px) {
  .main-content { padding: 8px; }
  .topbar { padding: 0 12px; height: 50px !important; }
  .logo { height: 50px; }
  .sidebar {
    position: fixed !important;
    top: 0; left: 0; bottom: 0;
    z-index: 1001;
    width: 240px !important;
    transform: translateX(-100%);
    transition: transform 0.3s ease;
  }
  .sidebar-mobile-open {
    transform: translateX(0) !important;
  }
  .sidebar-mobile-hidden {
    transform: translateX(-100%) !important;
  }
  .mobile-overlay {
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(0, 0, 0, 0.45);
    z-index: 1000;
    transition: opacity 0.3s;
  }
  .collapse-btn { margin-right: 4px; }
  .topbar-right .admin-name { display: none; }
  .topbar-right .role-tag { display: none; }
}
</style>
