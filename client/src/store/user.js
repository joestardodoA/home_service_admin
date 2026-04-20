// src/store/user.js — Pinia 用户状态
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
    role: (state) => state.admin.role || ''
  }
})
