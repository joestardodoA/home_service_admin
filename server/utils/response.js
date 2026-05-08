// server/utils/response.js — 统一响应格式
function success(res, data, msg) {
  return res.json({ code: 200, msg: msg || 'success', data: data || null });
}

function fail(res, msg, code) {
  return res.status(code || 400).json({ code: code || 400, msg: msg || 'error', data: null });
}

function paginate(res, rows, count, page, pageSize) {
  return res.json({
    code: 200,
    msg: 'success',
    data: {
      list: rows,
      total: count,
      page: page,
      pageSize: pageSize,
      totalPages: Math.ceil(count / pageSize)
    }
  });
}
// 安全分页参数解析（防止过大 pageSize 拖库或负数）
function safePageParams(query) {
  var page = parseInt(query.page) || 1;
  var pageSize = parseInt(query.pageSize) || 10;
  if (page < 1) page = 1;
  if (pageSize < 1) pageSize = 10;
  if (pageSize > 100) pageSize = 100;
  return { page: page, pageSize: pageSize };
}

module.exports = { success, fail, paginate, safePageParams };
