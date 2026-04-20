// src/api/logs.js — 操作日志 API
import request from './request.js'

export function getLogs(params) { return request.get('/logs', { params }) }
