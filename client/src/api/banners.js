// src/api/banners.js
import request from './request.js'
export const getBanners = () => request.get('/banners')
export const createBanner = (data) => request.post('/banners', data)
export const updateBanner = (id, data) => request.put('/banners/' + id, data)
export const deleteBanner = (id) => request.delete('/banners/' + id)
