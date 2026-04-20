<template>
  <div class="login-page">
    <div class="login-card">
      <div class="login-header">
        <span class="login-logo">🏠</span>
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
.login-page { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, #1d1e3a 0%, #2d3a8c 50%, #E53935 100%); }
.login-card { width: 400px; background: #fff; border-radius: 16px; padding: 48px 40px; box-shadow: 0 20px 60px rgba(0,0,0,0.3); }
.login-header { text-align: center; margin-bottom: 36px; }
.login-logo { font-size: 48px; display: block; margin-bottom: 8px; }
.login-header h1 { font-size: 24px; color: #1d1e3a; margin: 0 0 4px; }
.login-header p { font-size: 14px; color: #999; margin: 0; }
.login-btn { width: 100%; font-size: 16px; height: 44px; border-radius: 8px; }
</style>
