// src/api/dashboard.js — 看板 API（Phase 3 增强）
import request from './request.js'

export function getStats() { return request.get('/dashboard/stats') }
export function getTrends(days) { return request.get('/dashboard/trends', { params: { days } }) }
export function getRankings() { return request.get('/dashboard/rankings') }
