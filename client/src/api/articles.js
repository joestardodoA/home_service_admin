// src/api/articles.js
import request from './request.js'
export const getArticles = (params) => request.get('/articles', { params })
export const getArticle = (id) => request.get('/articles/' + id)
export const createArticle = (data) => request.post('/articles', data)
export const updateArticle = (id, data) => request.put('/articles/' + id, data)
export const deleteArticle = (id) => request.delete('/articles/' + id)
export const updateArticleStatus = (id, status) => request.put('/articles/' + id + '/status', { status })
// AI 生成
export const generateArticle = (data) => request.post('/articles/ai-generate', data)

