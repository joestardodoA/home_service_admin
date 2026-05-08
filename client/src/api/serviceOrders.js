// src/api/serviceOrders.js — 后台服务订单 API（海南椰嫂综合平台）
import request from './request.js'

export const getServiceOrders = (params) => request({ url: '/service-orders', method: 'get', params })
export const getServiceOrder = (id) => request({ url: '/service-orders/' + id, method: 'get' })
export const approveServiceOrder = (id, data) => request({ url: '/service-orders/' + id + '/approve', method: 'put', data })
export const rejectServiceOrder = (id, data) => request({ url: '/service-orders/' + id + '/reject', method: 'put', data })
export const completeServiceOrder = (id, data) => request({ url: '/service-orders/' + id + '/complete', method: 'put', data })
export const assignServiceOrder = (id, data) => request({ url: '/service-orders/' + id + '/assign', method: 'put', data })
export const getApplications = (id, params) => request({ url: '/service-orders/' + id + '/applications', method: 'get', params })
export const acceptApplication = (id, data) => request({ url: '/service-orders/applications/' + id + '/accept', method: 'put', data })
export const rejectApplication = (id, data) => request({ url: '/service-orders/applications/' + id + '/reject', method: 'put', data })
export const getMyPerformance = (params) => request({ url: '/service-orders/stats/my-performance', method: 'get', params })
// AI 智能推荐
export const getRecommendations = (id, params) => request({ url: '/service-orders/' + id + '/recommendations', method: 'get', params })
// 订单编辑
export const editServiceOrder = (id, data) => request({ url: '/service-orders/' + id + '/edit', method: 'put', data })
// 订单取消
export const cancelServiceOrder = (id, data) => request({ url: '/service-orders/' + id + '/cancel', method: 'put', data })
// 管理员备注
export const updateOrderNote = (id, data) => request({ url: '/service-orders/' + id + '/note', method: 'put', data })
// AI 直接派单
export const quickDispatch = (id, data) => request({ url: '/service-orders/' + id + '/quick-dispatch', method: 'post', data })
// 批量操作
export const batchApprove = (data) => request({ url: '/service-orders/batch/approve', method: 'put', data })
export const batchReject = (data) => request({ url: '/service-orders/batch/reject', method: 'put', data })
// 跟进记录
export const getFollowUps = (id) => request({ url: '/service-orders/' + id + '/follow-ups', method: 'get' })
export const addFollowUp = (id, data) => request({ url: '/service-orders/' + id + '/follow-ups', method: 'post', data })
