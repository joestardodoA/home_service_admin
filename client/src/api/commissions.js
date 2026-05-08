/**
 * 佣金积分管理 API（后台管理端）
 *
 * 接口:
 *   getCommissions(params)  — 佣金记录列表（支持 source/userId/status/page/pageSize 筛选）
 *   searchUser(keyword)     — 搜索用户（按手机号/昵称/真名模糊搜索，最多返回20条）
 *   adjustPoints(data)      — 手动增减积分（必填 userId, amount, remark；不能扣为负数）
 */
import request from './request'

// 佣金记录列表（分页+筛选）
export const getCommissions = (params) => request.get('/commissions', { params })

// 搜索用户（用于积分管理时选择目标用户）
export const searchUser = (keyword) => request.get('/commissions/search-user', { params: { keyword } })

// 手动增减积分（正数增加，负数扣减，必须填写备注）
export const adjustPoints = (data) => request.put('/commissions/adjust', data)
