// src/api/agencies.js
import request from './request.js'
export const getAgencies = (params) => request.get('/agencies', { params })
export const getAllAgencies = () => request.get('/agencies/all')
export const getAgency = (id) => request.get('/agencies/' + id)
export const createAgency = (data) => request.post('/agencies', data)
export const updateAgency = (id, data) => request.put('/agencies/' + id, data)
export const deleteAgency = (id) => request.delete('/agencies/' + id)
export const addCourse = (id, data) => request.post('/agencies/' + id + '/courses', data)
export const updateCourse = (id, cid, data) => request.put('/agencies/' + id + '/courses/' + cid, data)
export const deleteCourse = (id, cid) => request.delete('/agencies/' + id + '/courses/' + cid)
