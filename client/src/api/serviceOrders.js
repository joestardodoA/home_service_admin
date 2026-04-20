// src/api/serviceOrders.js — 后台服务订单 API（海南椰嫂综合平台）
import request from './request.js'

export const getServiceOrders = (params) => request({ url: '/service-orders', method: 'get', params })
export const getServiceOrder = (id) => request({ url: '/service-orders/' + id, method: 'get' })
export const approveServiceOrder = (id, data) => request({ url: '/service-orders/' + id + '/approve', method: 'put', data })
export const rejectServiceOrder = (id, data) => request({ url: '/service-orders/' + id + '/reject', method: 'put', data })
export const completeServiceOrder = (id, data) => request({ url: '/service-orders/' + id + '/complete', method: 'put', data })
export const getApplications = (id, params) => request({ url: '/service-orders/' + id + '/applications', method: 'get', params })
export const acceptApplication = (id, data) => request({ url: '/service-orders/applications/' + id + '/accept', method: 'put', data })
export const rejectApplication = (id, data) => request({ url: '/service-orders/applications/' + id + '/reject', method: 'put', data })
