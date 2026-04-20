// src/api/orders.js
import request from './request.js'
export const getOrders = (params) => request.get('/orders', { params })
export const getOrder = (id) => request.get('/orders/' + id)
export const verifyOrder = (id, data) => request.put('/orders/' + id + '/verify', data || {})
export const cancelOrder = (id) => request.put('/orders/' + id + '/cancel')
