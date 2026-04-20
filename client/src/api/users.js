// src/api/users.js
import request from './request.js'
export const getUsers = (params) => request.get('/users', { params })
export const getUser = (id) => request.get('/users/' + id)
export const approveUser = (id) => request.put('/users/' + id + '/approve')
export const rejectUser = (id, reason) => request.put('/users/' + id + '/reject', { reason })
