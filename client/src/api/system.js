// src/api/system.js — 系统管理 API
import request from './request.js'

export function getAdmins(params) { return request.get('/system/admins', { params }) }
export function createAdmin(data) { return request.post('/system/admins', data) }
export function updateAdmin(id, data) { return request.put('/system/admins/' + id, data) }
export function toggleAdminStatus(id) { return request.put('/system/admins/' + id + '/status') }
export function deleteAdmin(id) { return request.delete('/system/admins/' + id) }
export function resetAdminPassword(id, password) { return request.put('/system/admins/' + id + '/reset-password', { password }) }
