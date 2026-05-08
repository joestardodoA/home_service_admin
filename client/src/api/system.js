// src/api/system.js — 系统管理 API
import request from './request.js'

export function getAdmins(params) { return request.get('/system/admins', { params }) }
export function createAdmin(data) { return request.post('/system/admins', data) }
export function updateAdmin(id, data) { return request.put('/system/admins/' + id, data) }
export function toggleAdminStatus(id) { return request.put('/system/admins/' + id + '/status') }
export function deleteAdmin(id) { return request.delete('/system/admins/' + id) }
export function resetAdminPassword(id, password) { return request.put('/system/admins/' + id + '/reset-password', { password }) }
export function getPermissions() { return request.get('/system/permissions') }
export function getSalesAdmins() { return request.get('/system/sales-admins') }

// ==================== 登录日志 ====================
export function getLoginLogs(params) { return request.get('/login-logs', { params }) }
export function clearLoginLogs() { return request.delete('/login-logs/clear') }

// ==================== 在线用户 ====================
export function getOnlineUsers() { return request.get('/online-users') }
export function kickoutUser(tokenKey) { return request.delete('/online-users/' + tokenKey) }

// ==================== 内部公告 ====================
export function getAnnouncements(params) { return request.get('/announcements', { params }) }
export function getLatestAnnouncements() { return request.get('/announcements/latest') }
export function getAnnouncement(id) { return request.get('/announcements/' + id) }
export function createAnnouncement(data) { return request.post('/announcements', data) }
export function updateAnnouncement(id, data) { return request.put('/announcements/' + id, data) }
export function deleteAnnouncement(id) { return request.delete('/announcements/' + id) }
