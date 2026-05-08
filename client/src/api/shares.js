/**
 * src/api/shares.js — 推广分享管理 API（海南椰嫂综合平台）
 *
 * 接口:
 *   GET  /api/shares                     — 分享记录列表
 *   GET  /api/shares/:id                 — 分享详情
 *   GET  /api/system/referral-stats      — 推荐统计概览
 *   GET  /api/system/referral-chain/:uid — 推荐关系链
 */
import request from './request.js'

// 分享记录
export function getShareRecords(params) { return request.get('/shares', { params }) }
export function getShareDetail(id) { return request.get('/shares/' + id) }

// 推荐关系
export function getReferralStats() { return request.get('/system/referral-stats') }
export function getReferralChain(userId) { return request.get('/system/referral-chain/' + userId) }
