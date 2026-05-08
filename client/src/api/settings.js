/**
 * src/api/settings.js — 系统配置管理 API（海南椰嫂综合平台）
 *
 * 接口:
 *   GET  /api/system/settings       — 获取全部系统配置
 *   PUT  /api/system/settings       — 批量更新配置
 */
import request from './request.js'

// 获取全部配置
export function getSettings() { return request.get('/system/settings') }

// 批量更新配置
export function updateSettings(settings) { return request.put('/system/settings', { settings }) }
