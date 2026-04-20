// src/api/coupons.js
import request from './request.js'
export const getCoupons = (params) => request.get('/coupons', { params })
export const getCoupon = (id) => request.get('/coupons/' + id)
export const createCoupon = (data) => request.post('/coupons', data)
export const updateCoupon = (id, data) => request.put('/coupons/' + id, data)
export const deleteCoupon = (id) => request.delete('/coupons/' + id)
export const updateCouponStatus = (id, status) => request.put('/coupons/' + id + '/status', { status })
