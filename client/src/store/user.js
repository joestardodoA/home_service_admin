// src/store/user.js — Pinia 用户状态（含权限判断）
import { defineStore } from 'pinia'

export const useUserStore = defineStore('user', {
  state: () => ({
    token: localStorage.getItem('token') || '',
    admin: JSON.parse(localStorage.getItem('admin') || '{}')
  }),
  actions: {
    setLogin(token, admin) {
      this.token = token
      this.admin = admin
      localStorage.setItem('token', token)
      localStorage.setItem('admin', JSON.stringify(admin))
    },
    logout() {
      this.token = ''
      this.admin = {}
      localStorage.removeItem('token')
      localStorage.removeItem('admin')
    }
  },
  getters: {
    isLoggedIn: (state) => !!state.token,
    role: (state) => state.admin.role || '',
    isSuper: (state) => state.admin.role === 'super',
    // 获取有效权限列表
    permissions: (state) => {
      if (state.admin.role === 'super') return '__ALL__'
      return state.admin.permissions || []
    }
  }
})

// 全局权限检查函数
export function hasPermission(store, code) {
  if (!store.isLoggedIn) return false
  if (store.isSuper) return true
  var perms = store.admin.permissions || []
  return perms.indexOf(code) !== -1
}
