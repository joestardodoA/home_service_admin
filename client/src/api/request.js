/**
 * src/api/request.js — Axios 封装（管理后台）
 *
 * ⚙️ 手动配置项:
 *   baseURL — 当前为 '/api'，由 Vite 代理转发到后端
 *   → 开发时在 vite.config.js 中配置 proxy 转发到 localhost:3001
 *   → 生产时改为后端实际地址或使用 Nginx 反向代理
 *
 * 🛡️ 内置保护:
 *   1. 防重复提交 — 同一 URL+数据在 1.5 秒内重复 POST/PUT 自动拦截
 *   2. 401 单次弹窗 — Token 过期全局只弹一次提示，避免并发请求弹 N 个弹窗
 */
import axios from 'axios'
import { ElMessage, ElMessageBox } from 'element-plus'

const request = axios.create({
  // 【可改】API 基础路径，开发走 Vite proxy，生产直接改为后端地址
  baseURL: '/api',
  timeout: 15000
})

// ==================== 防重复提交 ====================
var lastRequest = { url: '', data: '', time: 0 }
var REPEAT_INTERVAL = 1500 // 间隔 1.5 秒内视为重复

// ==================== 401 单次弹窗守卫 ====================
var isReloginShowing = false

// 请求拦截：注入 Token + 防重复提交
request.interceptors.request.use(function(config) {
  // 注入 Token
  var token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = 'Bearer ' + token
  }

  // 防重复提交（仅拦截 POST/PUT，GET/DELETE 不受影响）
  if (config.method === 'post' || config.method === 'put') {
    var dataStr = typeof config.data === 'object' ? JSON.stringify(config.data) : (config.data || '')
    var now = Date.now()
    if (config.url === lastRequest.url &&
        dataStr === lastRequest.data &&
        now - lastRequest.time < REPEAT_INTERVAL) {
      console.warn('[防重复提交] 拦截: ' + config.url)
      return Promise.reject(new Error('操作过于频繁，请勿重复提交'))
    }
    lastRequest = { url: config.url, data: dataStr, time: now }
  }

  return config
})

// 响应拦截：统一错误处理 + 401 单次弹窗
request.interceptors.response.use(
  function(response) {
    var res = response.data
    if (res.code !== 200) {
      // 401 过期处理 — 全局只弹一次
      if (res.code === 401) {
        if (!isReloginShowing) {
          isReloginShowing = true
          ElMessageBox.confirm(
            '登录状态已过期，请重新登录。',
            '会话过期',
            {
              confirmButtonText: '重新登录',
              cancelButtonText: '留在当前页',
              type: 'warning'
            }
          ).then(function() {
            isReloginShowing = false
            localStorage.removeItem('token')
            window.location.href = '/login'
          }).catch(function() {
            isReloginShowing = false
          })
        }
        return Promise.reject(new Error('会话已过期'))
      }
      ElMessage.error(res.msg || '请求失败')
      return Promise.reject(new Error(res.msg))
    }
    return res
  },
  function(error) {
    // HTTP 层面的 401（后端直接返回 401 状态码）
    if (error.response && error.response.status === 401) {
      if (!isReloginShowing) {
        isReloginShowing = true
        ElMessageBox.confirm(
          '登录状态已过期，请重新登录。',
          '会话过期',
          {
            confirmButtonText: '重新登录',
            cancelButtonText: '留在当前页',
            type: 'warning'
          }
        ).then(function() {
          isReloginShowing = false
          localStorage.removeItem('token')
          window.location.href = '/login'
        }).catch(function() {
          isReloginShowing = false
        })
      }
      return Promise.reject(new Error('会话已过期'))
    }

    // HTTP 状态码 → 中文提示映射
    var status = error.response ? error.response.status : 0
    var statusMessages = {
      400: '请求参数错误',
      403: '没有操作权限',
      404: '请求的资源不存在',
      408: '请求超时',
      429: '操作过于频繁，请稍后再试',
      500: '服务器内部错误',
      502: '网关错误',
      503: '服务暂时不可用'
    }

    // 优先使用后端返回的中文 msg，其次用映射表，最后兜底
    var message = ''
    if (error.response && error.response.data && error.response.data.msg) {
      message = error.response.data.msg
    } else if (statusMessages[status]) {
      message = statusMessages[status]
    } else if (!error.response) {
      // 无响应：网络层面的错误
      message = error.message || '网络错误'
      if (message === 'Network Error') {
        message = '后端服务连接失败'
      } else if (message.includes('timeout')) {
        message = '请求超时，请稍后重试'
      }
    } else {
      message = '请求失败（' + status + '）'
    }
    ElMessage.error(message)
    return Promise.reject(error)
  }
)

export default request

