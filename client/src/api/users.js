// src/api/users.js — 用户管理 API（海南椰嫂综合平台）
import request from './request.js'
export const getUsers = (params) => request.get('/users', { params })
export const getUser = (id) => request.get('/users/' + id)
export const approveUser = (id) => request.put('/users/' + id + '/approve')
export const rejectUser = (id, reason) => request.put('/users/' + id + '/reject', { reason })
// 禁用/启用用户
export const toggleUserStatus = (id) => request.put('/users/' + id + '/toggle-status')
// 设置后台管理评分
export const setAdminScore = (id, score) => request.put('/users/' + id + '/admin-score', { score })
// 用户画像聚合（详情多 Tab）
export const getUserProfileSummary = (id) => request.get('/users/' + id + '/profile-summary')
// 批量导入用户
export const importUsers = (users) => request.post('/users/import/batch', { users })
