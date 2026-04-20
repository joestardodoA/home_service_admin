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

module.exports = { success, fail, paginate };
