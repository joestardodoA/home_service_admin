<template>
  <div class="login-page">
    <!-- 装饰背景元素 -->
    <div class="bg-orb bg-orb-1"></div>
    <div class="bg-orb bg-orb-2"></div>
    <div class="bg-orb bg-orb-3"></div>

    <div class="login-card">
      <div class="login-header">
        <div class="login-logo-wrap">
          <svg class="login-logo-svg" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M3 9.5L12 3L21 9.5V20C21 20.55 20.55 21 20 21H4C3.45 21 3 20.55 3 20V9.5Z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M9 21V12H15V21" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        <h1>海南椰嫂综合平台</h1>
        <p>管理后台</p>
      </div>
      <el-form ref="formRef" :model="form" :rules="rules" @submit.prevent="handleLogin">
        <el-form-item prop="username">
          <el-input v-model="form.username" prefix-icon="User" placeholder="用户名" size="large" />
        </el-form-item>
        <el-form-item prop="password">
          <el-input v-model="form.password" prefix-icon="Lock" type="password" placeholder="密码" size="large" show-password @keyup.enter="handleLogin" />
        </el-form-item>
        <el-button type="primary" size="large" class="login-btn" :loading="loading" @click="handleLogin">
          登 录
        </el-button>
      </el-form>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '../../store/user.js'
import { login } from '../../api/auth.js'
import { ElMessage } from 'element-plus'

const router = useRouter()
const userStore = useUserStore()
const formRef = ref(null)
const loading = ref(false)
const form = reactive({ username: '', password: '' })
const rules = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }]
}

async function handleLogin() {
  if (!formRef.value) return
  await formRef.value.validate()
  loading.value = true
  try {
    const res = await login(form)
    userStore.setLogin(res.data.token, res.data.admin)
    ElMessage.success('登录成功')
    router.push('/dashboard')
  } catch (e) {
    // 错误已被拦截器处理
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #0A0A1A;
  position: relative;
  overflow: hidden;
}

/* 装饰性发光球 */
.bg-orb {
  position: absolute;
  border-radius: 50%;
  filter: blur(80px);
  opacity: 0.5;
  animation: float 8s ease-in-out infinite;
}
.bg-orb-1 {
  width: 500px;
  height: 500px;
  background: radial-gradient(circle, rgba(94, 159, 255, 0.4) 0%, transparent 70%);
  top: -15%;
  left: -10%;
  animation-delay: 0s;
}
.bg-orb-2 {
  width: 400px;
  height: 400px;
  background: radial-gradient(circle, rgba(255, 107, 107, 0.35) 0%, transparent 70%);
  bottom: -10%;
  right: -5%;
  animation-delay: -3s;
}
.bg-orb-3 {
  width: 300px;
  height: 300px;
  background: radial-gradient(circle, rgba(175, 82, 222, 0.3) 0%, transparent 70%);
  top: 40%;
  right: 20%;
  animation-delay: -5s;
}

@keyframes float {
  0%, 100% { transform: translate(0, 0) scale(1); }
  33% { transform: translate(30px, -20px) scale(1.05); }
  66% { transform: translate(-20px, 15px) scale(0.95); }
}

/* 登录卡片 — 毛玻璃效果 */
.login-card {
  width: 420px;
  background: rgba(255, 255, 255, 0.06);
  backdrop-filter: blur(40px) saturate(150%);
  -webkit-backdrop-filter: blur(40px) saturate(150%);
  border-radius: var(--radius-xl);
  padding: 48px 40px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 30px 80px rgba(0, 0, 0, 0.4);
  position: relative;
  z-index: 2;
  animation: cardIn 0.6s var(--ease-out);
}

@keyframes cardIn {
  from {
    opacity: 0;
    transform: translateY(20px) scale(0.96);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.login-header {
  text-align: center;
  margin-bottom: 40px;
}
.login-logo-wrap {
  width: 64px;
  height: 64px;
  border-radius: 18px;
  background: linear-gradient(135deg, var(--apple-blue), #4A8BEE);
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 16px;
  box-shadow: 0 8px 24px rgba(94, 159, 255, 0.3);
}
.login-logo-svg {
  width: 32px;
  height: 32px;
  color: #fff;
}
.login-header h1 {
  font-size: 22px;
  color: #fff;
  margin: 0 0 6px;
  font-weight: 600;
  letter-spacing: 0.02em;
}
.login-header p {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.45);
  margin: 0;
  font-weight: 400;
}

/* 输入框在深色背景的覆写 */
.login-card :deep(.el-input__wrapper) {
  background: rgba(255, 255, 255, 0.08) !important;
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.12) inset !important;
  border-radius: 12px !important;
}
.login-card :deep(.el-input__wrapper:hover) {
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.2) inset !important;
}
.login-card :deep(.el-input__wrapper.is-focus) {
  box-shadow: 0 0 0 2px var(--apple-blue) inset,
              0 0 0 4px rgba(94, 159, 255, 0.2) !important;
}
.login-card :deep(.el-input__inner) {
  color: #fff !important;
}
.login-card :deep(.el-input__inner::placeholder) {
  color: rgba(255, 255, 255, 0.35) !important;
}
.login-card :deep(.el-input__prefix .el-icon) {
  color: rgba(255, 255, 255, 0.4) !important;
}
.login-card :deep(.el-input__suffix .el-icon) {
  color: rgba(255, 255, 255, 0.4) !important;
}

.login-btn {
  width: 100%;
  font-size: 15px !important;
  height: 48px !important;
  border-radius: 12px !important;
  background: linear-gradient(135deg, var(--apple-blue), #4A8BEE) !important;
  border: none !important;
  font-weight: 600 !important;
  letter-spacing: 0.08em;
  margin-top: 8px;
  box-shadow: 0 4px 16px rgba(94, 159, 255, 0.3);
  transition: all 0.25s var(--ease-out) !important;
}
.login-btn:hover {
  transform: translateY(-2px) !important;
  box-shadow: 0 8px 28px rgba(94, 159, 255, 0.4) !important;
}
.login-btn:active {
  transform: translateY(0) scale(0.98) !important;
}

/* 响应式适配 */
@media (max-width: 480px) {
  .login-card {
    width: calc(100vw - 32px);
    padding: 36px 24px;
    border-radius: 20px;
  }
  .login-header { margin-bottom: 30px; }
  .login-header h1 { font-size: 18px; }
  .login-logo-wrap { width: 52px; height: 52px; }
  .login-logo-svg { width: 26px; height: 26px; }
  .bg-orb-1 { width: 300px; height: 300px; }
  .bg-orb-2 { width: 250px; height: 250px; }
  .bg-orb-3 { width: 200px; height: 200px; }
}
@media (max-width: 768px) and (min-width: 481px) {
  .login-card {
    width: 380px;
    padding: 40px 32px;
  }
}
</style>
