// src/api/auth.js
import request from './request.js'
export const login = (data) => request.post('/auth/login', data)
export const getProfile = () => request.get('/auth/profile')
export const changePassword = (data) => request.put('/auth/password', data)
