<template>
  <el-container class="admin-layout">
    <el-aside :width="isCollapse ? '64px' : '220px'" class="sidebar">
      <div class="logo" @click="$router.push('/dashboard')">
        <span class="logo-icon">🏠</span>
        <span v-if="!isCollapse" class="logo-text">海南椰嫂综合平台</span>
      </div>
      <el-menu :default-active="$route.path" :collapse="isCollapse" router background-color="#1d1e3a" text-color="rgba(255,255,255,0.65)" active-text-color="#409eff" class="sidebar-menu">
        <el-menu-item index="/dashboard">
          <el-icon><DataAnalysis /></el-icon>
          <template #title>数据看板</template>
        </el-menu-item>

        <el-sub-menu index="business">
          <template #title><el-icon><Goods /></el-icon><span>业务管理</span></template>
          <el-menu-item index="/coupons"><el-icon><Ticket /></el-icon>优惠券</el-menu-item>
          <el-menu-item index="/agencies"><el-icon><OfficeBuilding /></el-icon>机构</el-menu-item>
          <el-menu-item index="/orders"><el-icon><Ticket /></el-icon>券核销记录</el-menu-item>
          <el-menu-item index="/service-orders"><el-icon><List /></el-icon>服务订单</el-menu-item>
        </el-sub-menu>

        <el-sub-menu index="content">
          <template #title><el-icon><Document /></el-icon><span>内容管理</span></template>
          <el-menu-item index="/articles"><el-icon><Reading /></el-icon>文章</el-menu-item>
          <el-menu-item index="/banners"><el-icon><Picture /></el-icon>Banner</el-menu-item>
        </el-sub-menu>

        <el-sub-menu index="user-mgmt">
          <template #title><el-icon><User /></el-icon><span>用户管理</span></template>
          <el-menu-item index="/users"><el-icon><UserFilled /></el-icon>用户列表</el-menu-item>
        </el-sub-menu>

        <el-sub-menu index="system">
          <template #title><el-icon><Tools /></el-icon><span>系统设置</span></template>
          <el-menu-item index="/system/admins"><el-icon><Avatar /></el-icon>管理员</el-menu-item>
          <el-menu-item index="/system/job-types"><el-icon><Grid /></el-icon>工种管理</el-menu-item>
          <el-menu-item index="/system/logs"><el-icon><Notebook /></el-icon>操作日志</el-menu-item>
        </el-sub-menu>
      </el-menu>
    </el-aside>

    <el-container>
      <el-header class="topbar">
        <div class="topbar-left">
          <el-icon class="collapse-btn" @click="isCollapse = !isCollapse"><Fold v-if="!isCollapse" /><Expand v-else /></el-icon>
          <el-breadcrumb separator="/"><el-breadcrumb-item>{{ $route.meta.title }}</el-breadcrumb-item></el-breadcrumb>
        </div>
        <div class="topbar-right">
          <span class="admin-name">{{ userStore.admin.realName || userStore.admin.username }}</span>
          <el-dropdown trigger="click">
            <el-icon class="avatar-icon"><UserFilled /></el-icon>
            <template #dropdown><el-dropdown-menu><el-dropdown-item @click="handleLogout">退出登录</el-dropdown-item></el-dropdown-menu></template>
          </el-dropdown>
        </div>
      </el-header>
      <el-main class="main-content"><router-view /></el-main>
    </el-container>
  </el-container>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '../store/user.js'
import { ElMessageBox } from 'element-plus'

const router = useRouter()
const userStore = useUserStore()
const isCollapse = ref(false)

function handleLogout() {
  ElMessageBox.confirm('确认退出登录？', '提示', { type: 'warning' }).then(() => {
    userStore.logout()
    router.push('/login')
  }).catch(() => {})
}
</script>

<style scoped>
.admin-layout { height: 100vh; }
.sidebar { background: #1d1e3a; transition: width 0.3s; overflow: hidden; }
.logo { height: 56px; display: flex; align-items: center; justify-content: center; cursor: pointer; border-bottom: 1px solid rgba(255,255,255,0.08); }
.logo-icon { font-size: 24px; }
.logo-text { color: #fff; font-size: 16px; font-weight: 700; margin-left: 8px; white-space: nowrap; }
.sidebar-menu { border-right: none; }
.sidebar-menu:not(.el-menu--collapse) { width: 220px; }
.topbar { display: flex; align-items: center; justify-content: space-between; background: #fff; border-bottom: 1px solid #eee; padding: 0 20px; height: 56px; }
.topbar-left { display: flex; align-items: center; gap: 16px; }
.collapse-btn { font-size: 20px; cursor: pointer; color: #666; }
.topbar-right { display: flex; align-items: center; gap: 12px; }
.admin-name { font-size: 14px; color: #333; }
.avatar-icon { font-size: 28px; cursor: pointer; color: #666; }
.main-content { background: #f0f2f5; padding: 20px; overflow-y: auto; }
</style>
