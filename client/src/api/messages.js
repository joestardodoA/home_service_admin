/**
 * src/api/messages.js — 消息管理 API（海南椰嫂综合平台）
 *
 * 接口:
 *   GET  /api/notifications              — 后台通知列表
 *   GET  /api/notifications/unread-count  — 未读数量
 *   PUT  /api/notifications/:id/read      — 标记已读
 *   PUT  /api/notifications/read-all      — 全部已读
 *   POST /api/system/broadcast            — 发送系统公告（新增）
 *   GET  /api/system/broadcast-history     — 公告记录（新增）
 */
import request from './request.js'

// 后台通知
export function getNotifications(params) { return request.get('/notifications', { params }) }
export function getUnreadCount() { return request.get('/notifications/unread-count') }
export function markRead(id) { return request.put('/notifications/' + id + '/read') }
export function markAllRead() { return request.put('/notifications/read-all') }

// 系统公告
export function sendBroadcast(data) { return request.post('/system/broadcast', data) }
export function getBroadcastHistory(params) { return request.get('/system/broadcast-history', { params }) }
