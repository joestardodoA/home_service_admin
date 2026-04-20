// server/routes/logs.js — 操作日志查询 API
const express = require('express');
const { OperationLog } = require('../models');
const { authMiddleware } = require('../middleware/auth');
const { success, fail, paginate } = require('../utils/response');
const { Op } = require('sequelize');

const router = express.Router();
router.use(authMiddleware);

// 操作日志列表
router.get('/', async function(req, res) {
  try {
    var page = parseInt(req.query.page) || 1;
    var pageSize = parseInt(req.query.pageSize) || 20;
    var where = {};

    // 按模块筛选
    if (req.query.module) where.module = req.query.module;
    // 按操作人筛选
    if (req.query.adminName) where.adminName = { [Op.like]: '%' + req.query.adminName + '%' };
    // 按时间范围筛选
    if (req.query.startDate && req.query.endDate) {
      where.createdAt = {
        [Op.between]: [new Date(req.query.startDate), new Date(req.query.endDate + ' 23:59:59')]
      };
    } else if (req.query.startDate) {
      where.createdAt = { [Op.gte]: new Date(req.query.startDate) };
    } else if (req.query.endDate) {
      where.createdAt = { [Op.lte]: new Date(req.query.endDate + ' 23:59:59') };
    }

    var result = await OperationLog.findAndCountAll({
      where: where,
      order: [['createdAt', 'DESC']],
      limit: pageSize,
      offset: (page - 1) * pageSize
    });
    return paginate(res, result.rows, result.count, page, pageSize);
  } catch (err) { return fail(res, '查询失败: ' + err.message, 500); }
});

module.exports = router;
