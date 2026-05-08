/**
 * 闺蜜圈管理 API（后台管理端）
 *
 * 接口:
 *   getGuimiCircles(params)         — 获取闺蜜圈列表
 *   getGuimiCircle(id, params)      — 获取闺蜜圈详情（含成员列表）
 *   disbandGuimiCircle(id)          — 管理员强制解散
 *   getCircleEvents(id, params)     — 查看圈子事件流
 *   getLeavingMembers(id)           — 查看退出中成员
 *   getPendingMembers(id)           — 查看待审批成员
 */
import request from './request'

// 闺蜜圈列表（分页+筛选）
export const getGuimiCircles = (params) => request.get('/guimi-circles', { params })

// 闺蜜圈详情（含成员列表）
export const getGuimiCircle = (id, params) => request.get('/guimi-circles/' + id, { params })

// 管理员强制解散
export const disbandGuimiCircle = (id) => request.delete('/guimi-circles/' + id)

// 圈子事件流
export const getCircleEvents = (id, params) => request.get('/guimi-circles/' + id + '/events', { params })

// 退出中成员
export const getLeavingMembers = (id) => request.get('/guimi-circles/' + id + '/leaving-members')

// 待审批成员
export const getPendingMembers = (id) => request.get('/guimi-circles/' + id + '/pending-members')
