/**
 * src/api/request.js — Axios 封装（管理后台）
 *
 * ⚙️ 手动配置项:
 *   baseURL — 当前为 '/api'，由 Vite 代理转发到后端
 *   → 开发时在 vite.config.js 中配置 proxy 转发到 localhost:3001
 *   → 生产时改为后端实际地址或使用 Nginx 反向代理
 */
import axios from 'axios'
import { ElMessage } from 'element-plus'

const request = axios.create({
  // 【可改】API 基础路径，开发走 Vite proxy，生产直接改为后端地址
  baseURL: '/api',
  timeout: 15000
})

// 请求拦截：注入 Token
request.interceptors.request.use(function(config) {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = 'Bearer ' + token
  }
  return config
})

// 响应拦截：统一错误处理
request.interceptors.response.use(
  function(response) {
    const res = response.data
    if (res.code !== 200) {
      ElMessage.error(res.msg || '请求失败')
      if (res.code === 401) {
        localStorage.removeItem('token')
        window.location.href = '/login'
      }
      return Promise.reject(new Error(res.msg))
    }
    return res
  },
  function(error) {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('token')
      window.location.href = '/login'
    }
    ElMessage.error(error.message || '网络错误')
    return Promise.reject(error)
  }
)

export default request
