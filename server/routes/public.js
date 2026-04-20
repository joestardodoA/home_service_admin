// server/routes/public.js — 小程序公开 API（免认证）（海南椰嫂综合平台）
const express = require('express');
const {
  Coupon, Agency, AgencyCourse, Article, Banner,
  CouponOrder, User, Commission, ShareRecord,
  JobType, ServiceOrder, OrderApplication,
  Message, SubscriptionSetting
} = require('../models');
const { success, fail } = require('../utils/response');
const { Op } = require('sequelize');
const crypto = require('crypto');
const { sequelize } = require('../models');

const router = express.Router();

// JSON 字段解析工具
function parseJsonField(val) {
  if (Array.isArray(val)) return val;
  if (typeof val === 'string') { try { return JSON.parse(val); } catch(e) {} }
  return [];
}

// 生成唯一分享码
function generateShareCode() {
  return crypto.randomBytes(8).toString('hex');
}

// 生成服务订单号 YS + 日期 + 5位序号
function generateOrderNo() {
  var d = new Date();
  var dateStr = d.getFullYear().toString() +
    ('0' + (d.getMonth() + 1)).slice(-2) +
    ('0' + d.getDate()).slice(-2);
  var rand = Math.floor(10000 + Math.random() * 90000);
  return 'YS' + dateStr + rand;
}

// 优惠券对象转换（统一字段）
function transformCoupon(c) {
  var item = typeof c.toJSON === 'function' ? c.toJSON() : Object.assign({}, c);
  item.desc = item.description || '';
  item.tags = parseJsonField(item.tags);
  item.highlights = parseJsonField(item.highlights);
  item.benefits = parseJsonField(item.benefits);
  item.conditions = parseJsonField(item.conditions);
  item.agencyIds = parseJsonField(item.agencyIds);
  return item;
}

// 机构对象转换
function transformAgency(a) {
  var item = typeof a.toJSON === 'function' ? a.toJSON() : Object.assign({}, a);
  item.tags = parseJsonField(item.tags);
  item.gallery = parseJsonField(item.gallery);
  item.exchangeNotes = parseJsonField(item.exchangeNotes);
  return item;
}

// 手机号脱敏
function maskPhone(phone) {
  if (phone && phone.length === 11) {
    return phone.slice(0, 3) + '****' + phone.slice(7);
  }
  return phone || '';
}

// 用户信息脱敏（移除敏感字段）
function sanitizeUser(user) {
  var result = typeof user.toJSON === 'function' ? user.toJSON() : Object.assign({}, user);
  // 移除敏感字段
  delete result.openid;
  delete result.unionid;
  delete result.idCard;
  delete result.idCardFront;
  delete result.idCardBack;
  // 手机号脱敏
  result.phone = maskPhone(result.phone);
  // 解析 preferredJobTypes
  result.preferredJobTypes = parseJsonField(result.preferredJobTypes);
  return result;
}

// 简单的 token 校验中间件（从 header 里获取 userId 并验证）
// ⚙️ 【生产建议】将此处改为 JWT 验证:
//   1. npm install jsonwebtoken
//   2. wx-login 返回 JWT token（jwt.sign({userId, openid}, SECRET)）
//   3. 此处改为 jwt.verify(token, SECRET) 解析
async function optionalAuth(req, res, next) {
  var token = req.headers['x-user-token'] || '';
  if (token) {
    try {
      // token 格式: userId:openid（简单实现，生产环境应使用 JWT）
      var parts = token.split(':');
      var userId = parseInt(parts[0]);
      if (userId) {
        var user = await User.findByPk(userId);
        if (user) {
          req.wxUser = user;
          req.wxUserId = user.id;
        }
      }
    } catch (e) {}
  }
  next();
}

// 需要登录的中间件
function requireWxAuth(req, res, next) {
  if (!req.wxUserId) {
    return fail(res, '请先登录', 401);
  }
  next();
}

// 全局应用可选认证
router.use(optionalAuth);

// ==================== 优惠券 ====================

// 优惠券列表（仅上架的）
router.get('/coupons', async function(req, res) {
  try {
    var list = await Coupon.findAll({
      where: { status: 'online' },
      order: [['sortOrder', 'DESC'], ['createdAt', 'DESC']]
    });
    var result = list.map(transformCoupon);
    return success(res, result);
  } catch (err) { return fail(res, '查询失败: ' + err.message, 500); }
});

// 优惠券详情
router.get('/coupons/:id', async function(req, res) {
  try {
    var coupon = await Coupon.findByPk(req.params.id);
    if (!coupon) return fail(res, '优惠券不存在', 404);
    return success(res, transformCoupon(coupon));
  } catch (err) { return fail(res, '查询失败', 500); }
});

// 优惠券可兑换机构列表
router.get('/coupons/:id/agencies', async function(req, res) {
  try {
    var coupon = await Coupon.findByPk(req.params.id);
    if (!coupon) return fail(res, '优惠券不存在', 404);
    var rawIds = coupon.getDataValue('agencyIds');
    var agencyIds = parseJsonField(rawIds);
    var allAgencies = await Agency.findAll({ where: { status: 'active' }, order: [['sortOrder', 'DESC']] });
    var list = agencyIds.length > 0
      ? allAgencies.filter(function(a) { return agencyIds.indexOf(a.id) !== -1; })
      : allAgencies;
    return success(res, list.map(transformAgency));
  } catch (err) { return fail(res, '查询失败: ' + err.message, 500); }
});

// ==================== 机构 ====================

router.get('/agencies', async function(req, res) {
  try {
    var list = await Agency.findAll({
      where: { status: 'active' },
      order: [['sortOrder', 'DESC'], ['createdAt', 'DESC']]
    });
    return success(res, list.map(transformAgency));
  } catch (err) { return fail(res, '查询失败: ' + err.message, 500); }
});

router.get('/agencies/:id', async function(req, res) {
  try {
    var agency = await Agency.findByPk(req.params.id, {
      include: [{ model: AgencyCourse, as: 'courses' }]
    });
    if (!agency) return fail(res, '机构不存在', 404);
    return success(res, transformAgency(agency));
  } catch (err) { return fail(res, '查询失败', 500); }
});

// ==================== 文章 ====================

router.get('/articles', async function(req, res) {
  try {
    var where = { status: 'published' };
    if (req.query.category && req.query.category !== '全部') {
      where.category = req.query.category;
    }
    var list = await Article.findAll({
      where: where,
      order: [['sortOrder', 'DESC'], ['publishedAt', 'DESC']]
    });
    var result = list.map(function(a) {
      var item = a.toJSON();
      item.tags = parseJsonField(item.tags);
      item.date = item.publishedAt ? item.publishedAt.toString().slice(0, 10) : '';
      return item;
    });
    return success(res, result);
  } catch (err) { return fail(res, '查询失败: ' + err.message, 500); }
});

router.get('/articles/:id', async function(req, res) {
  try {
    var article = await Article.findByPk(req.params.id);
    if (!article) return fail(res, '文章不存在', 404);
    await article.increment('reads');
    var item = article.toJSON();
    item.tags = parseJsonField(item.tags);
    item.date = item.publishedAt ? item.publishedAt.toString().slice(0, 10) : '';
    return success(res, item);
  } catch (err) { return fail(res, '查询失败', 500); }
});

// ==================== Banner ====================

router.get('/banners', async function(req, res) {
  try {
    var where = { status: 'active' };
    // 按展示位置筛选：home=首页, orders=订单页, 不传则返回全部
    if (req.query.position) {
      where[Op.or] = [
        { position: req.query.position },
        { position: 'all' }
      ];
    }
    var list = await Banner.findAll({
      where: where,
      order: [['sortOrder', 'DESC']]
    });
    return success(res, list);
  } catch (err) { return fail(res, '查询失败', 500); }
});

// ==================== 订单页数据统计 ====================

// 同城数据汇总（订单数、服务者数、累计匹配数）
router.get('/order-stats', async function(req, res) {
  try {
    var city = req.query.city || '';
    var cityWhere = city ? { city: { [Op.like]: '%' + city + '%' } } : {};

    // 原始统计数据
    var pendingOrders = await ServiceOrder.count({
      where: Object.assign({ status: { [Op.in]: ['approved', 'matching'] } }, cityWhere)
    });
    var activeWorkers = await User.count({
      where: city ? { city: { [Op.like]: '%' + city + '%' } } : {}
    });
    var totalMatched = await ServiceOrder.count({
      where: Object.assign({ status: { [Op.in]: ['matched', 'completed'] } }, cityWhere)
    });

    // 应用数据系数（从数据库读取系统设置，默认系数 5）
    var coefficientStr = '5';
    try {
      var setting = await sequelize.models.SystemSetting
        ? await sequelize.models.SystemSetting.findOne({ where: { key: 'data_coefficient' } })
        : null;
      if (setting && setting.value) coefficientStr = setting.value;
    } catch(e) {}
    var coefficient = parseFloat(coefficientStr) || 5;
    // 基础底数，确保新平台也有数据展示
    var basePending = 50;
    var baseWorkers = 120;
    var baseMatched = 200;

    return success(res, {
      pendingOrders: Math.round((pendingOrders + basePending) * coefficient),
      activeWorkers: Math.round((activeWorkers + baseWorkers) * coefficient),
      totalMatched: Math.round((totalMatched + baseMatched) * coefficient),
      city: city || '全国'
    });
  } catch (err) { return fail(res, '查询失败: ' + err.message, 500); }
});

// 匹配成功动态播报（脱敏）
router.get('/match-feed', async function(req, res) {
  try {
    var limit = parseInt(req.query.limit) || 20;

    // 从真实已匹配订单中获取播报数据
    var matchedOrders = await ServiceOrder.findAll({
      where: { status: { [Op.in]: ['matched', 'completed'] } },
      include: [
        { model: User, as: 'publisher', attributes: ['id', 'nickname'] },
        { model: User, as: 'acceptedUser', attributes: ['id', 'nickname'] },
        { model: JobType, as: 'jobType', attributes: ['id', 'name'] }
      ],
      order: [['updatedAt', 'DESC']],
      limit: limit
    });

    // 姓名脱敏函数
    function maskName(name) {
      if (!name || name.length < 1) return '某用户';
      if (name.length === 1) return name + '**';
      return name.charAt(0) + '**';
    }

    var feeds = matchedOrders.map(function(o) {
      var item = o.toJSON();
      var publisherName = maskName(item.publisher ? item.publisher.nickname : '');
      var workerName = maskName(item.acceptedUser ? item.acceptedUser.nickname : '');
      var jobName = item.jobType ? item.jobType.name : '家政服务';
      // 随机选择播报模板
      var templates = [
        '🎉 恭喜 ' + publisherName + '雇主 找到了合适的' + jobName + '阿姨',
        '🎉 恭喜 ' + workerName + '阿姨 成功接单（' + jobName + '）',
        '✅ ' + publisherName + '雇主 与 ' + workerName + '阿姨 匹配成功'
      ];
      var templateIdx = item.id % templates.length;
      // 时间差
      var now = Date.now();
      var updated = new Date(item.updatedAt).getTime();
      var diffMin = Math.round((now - updated) / 60000);
      var timeText = diffMin < 60 ? diffMin + '分钟前' : (diffMin < 1440 ? Math.round(diffMin / 60) + '小时前' : Math.round(diffMin / 1440) + '天前');

      return { text: templates[templateIdx], time: timeText };
    });

    // 如果真实数据不足，用模板数据补充（确保滚动播报不为空）
    if (feeds.length < 10) {
      var templateFeeds = [
        { text: '🎉 恭喜 王**雇主 找到了合适的月嫂阿姨', time: '3分钟前' },
        { text: '🎉 恭喜 李**阿姨 成功接单（育儿嫂）', time: '8分钟前' },
        { text: '✅ 张**雇主 与 陈**阿姨 匹配成功', time: '12分钟前' },
        { text: '🎉 恭喜 刘**雇主 找到了合适的保洁阿姨', time: '18分钟前' },
        { text: '🎉 恭喜 赵**阿姨 成功接单（养老护理）', time: '25分钟前' },
        { text: '✅ 周**雇主 与 吴**阿姨 匹配成功', time: '32分钟前' },
        { text: '🎉 恭喜 黄**雇主 找到了合适的产康师', time: '45分钟前' },
        { text: '🎉 恭喜 孙**阿姨 成功接单（家务）', time: '1小时前' },
        { text: '✅ 林**雇主 与 郑**阿姨 匹配成功', time: '1小时前' },
        { text: '🎉 恭喜 何**雇主 找到了合适的钟点工', time: '2小时前' }
      ];
      // 补充到至少10条
      while (feeds.length < 10) {
        feeds.push(templateFeeds[feeds.length % templateFeeds.length]);
      }
    }

    return success(res, feeds);
  } catch (err) { return fail(res, '查询失败: ' + err.message, 500); }
});

// 工种行情数据（同城宏观统计）
router.get('/job-type-stats/:id', async function(req, res) {
  try {
    var jobTypeId = parseInt(req.params.id);
    var city = req.query.city || '';
    var jobType = await JobType.findByPk(jobTypeId);
    if (!jobType) return fail(res, '工种不存在', 404);

    var cityWhere = city ? { city: { [Op.like]: '%' + city + '%' } } : {};
    var baseWhere = Object.assign({ jobTypeId: jobTypeId }, cityWhere);

    // 查询该工种的薪资范围（取已审核通过订单的中位数范围）
    var salaryOrders = await ServiceOrder.findAll({
      where: Object.assign({}, baseWhere, { status: { [Op.in]: ['approved', 'matching', 'matched', 'completed'] } }),
      attributes: ['salaryMin', 'salaryMax', 'salaryType'],
      order: [['createdAt', 'DESC']],
      limit: 50
    });

    // 计算指导薪资范围
    var monthlyOrders = salaryOrders.filter(function(o) { return o.salaryType === 'monthly'; });
    var guideSalaryMin = 0;
    var guideSalaryMax = 0;
    var salaryUnit = '月';
    if (monthlyOrders.length > 0) {
      var mins = monthlyOrders.map(function(o) { return o.salaryMin; }).sort(function(a, b) { return a - b; });
      var maxs = monthlyOrders.map(function(o) { return o.salaryMax; }).sort(function(a, b) { return a - b; });
      guideSalaryMin = mins[Math.floor(mins.length * 0.25)] || mins[0];
      guideSalaryMax = maxs[Math.floor(maxs.length * 0.75)] || maxs[maxs.length - 1];
    } else if (salaryOrders.length > 0) {
      salaryUnit = '日';
      var mins = salaryOrders.map(function(o) { return o.salaryMin; }).sort(function(a, b) { return a - b; });
      var maxs = salaryOrders.map(function(o) { return o.salaryMax; }).sort(function(a, b) { return a - b; });
      guideSalaryMin = mins[Math.floor(mins.length * 0.25)] || mins[0];
      guideSalaryMax = maxs[Math.floor(maxs.length * 0.75)] || maxs[maxs.length - 1];
    }

    // 默认指导薪资（数据不足时）
    var defaultSalary = {
      yuesao: [8000, 15000], yuer: [5000, 10000], baojie: [200, 400],
      yanglao: [4000, 8000], chankang: [6000, 12000], jiawu: [3000, 6000],
      zhonggong: [150, 300], other: [3000, 8000]
    };
    if (guideSalaryMin === 0 && guideSalaryMax === 0 && defaultSalary[jobType.code]) {
      guideSalaryMin = defaultSalary[jobType.code][0];
      guideSalaryMax = defaultSalary[jobType.code][1];
      salaryUnit = (jobType.code === 'baojie' || jobType.code === 'zhonggong') ? '日' : '月';
    }

    // 本周匹配数
    var weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    var weekMatched = await ServiceOrder.count({
      where: Object.assign({}, baseWhere, {
        status: { [Op.in]: ['matched', 'completed'] },
        updatedAt: { [Op.gte]: weekAgo }
      })
    });

    // 系数放大
    var coefficient = 5;
    try {
      var setting = await sequelize.models.SystemSetting
        ? await sequelize.models.SystemSetting.findOne({ where: { key: 'data_coefficient' } })
        : null;
      if (setting && setting.value) coefficient = parseFloat(setting.value) || 5;
    } catch(e) {}

    // 当前在招数
    var activeOrders = await ServiceOrder.count({
      where: Object.assign({}, baseWhere, { status: { [Op.in]: ['approved', 'matching'] } })
    });

    return success(res, {
      jobTypeId: jobType.id,
      jobTypeName: jobType.name,
      city: city || '全国',
      guideSalaryMin: guideSalaryMin,
      guideSalaryMax: guideSalaryMax,
      salaryUnit: salaryUnit,
      weekMatched: Math.round((weekMatched + 3) * coefficient),
      activeOrders: Math.round((activeOrders + 5) * coefficient),
      sampleCount: salaryOrders.length
    });
  } catch (err) { return fail(res, '查询失败: ' + err.message, 500); }
});

// ==================== 用户 ====================

router.post('/wx-login', async function(req, res) {
  try {
    /**
     * ⚙️ 【生产必改】微信登录换 openid
     *
     * 当前开发模式：使用 dev_user_xxx 模拟 openid
     * 生产模式需要：
     *   1. 在小程序 app.js 里 wx.login() 获取 code
     *   2. 后端拿 code + AppID + AppSecret 调微信接口换 openid
     *   3. 微信接口: GET https://api.weixin.qq.com/sns/jscode2session
     *      ?appid={APPID}&secret={SECRET}&js_code={CODE}&grant_type=authorization_code
     *   4. 在 .env 或 config 中配置:
     *      WX_APPID=你的小程序AppID
     *      WX_SECRET=你的小程序AppSecret
     */
    var openid = req.body.openid;
    if (!openid) {
      // 【生产替换】这里应该用 req.body.code 调微信接口换 openid
      // const wxRes = await axios.get('https://api.weixin.qq.com/sns/jscode2session', {
      //   params: { appid: process.env.WX_APPID, secret: process.env.WX_SECRET, js_code: req.body.code, grant_type: 'authorization_code' }
      // });
      // openid = wxRes.data.openid;
      var hourKey = Math.floor(Date.now() / 3600000);
      openid = 'dev_user_' + hourKey;
    }

    var user = await User.findOne({ where: { openid: openid } });
    var isNew = false;
    if (!user) {
      user = await User.create({ openid: openid, nickname: '微信用户' });
      isNew = true;
    }
    // 锁粉逻辑：新用户且有分享来源时，绑定邀请人
    if (isNew && req.body.inviterId && !user.inviterId) {
      var inviterId = parseInt(req.body.inviterId);
      if (inviterId && inviterId !== user.id) {
        // 验证邀请人存在
        var inviter = await User.findByPk(inviterId);
        if (inviter) {
          await user.update({ inviterId: inviterId });
          // 给邀请人创建邀请注册佣金
          await Commission.create({
            userId: inviterId,
            referUserId: user.id,
            source: 'invite',
            amount: 0, // 邀请奖励金额由后台配置，暂设0
            status: 'pending',
            remark: '邀请新用户注册: ' + user.nickname
          });
          // 更新邀请人推广统计
          await inviter.increment('totalRefer');
        }
      }
    }

    var result = sanitizeUser(user);
    // 生成简单的 token（userId:openid）
    result.token = user.id + ':' + openid;
    // 优惠券统计
    var unused = await CouponOrder.count({ where: { userId: user.id, status: 'unused' } });
    var used = await CouponOrder.count({ where: { userId: user.id, status: 'used' } });
    var expired = await CouponOrder.count({ where: { userId: user.id, status: 'expired' } });
    result.couponStats = { unused: unused, used: used, expired: expired, total: unused + used + expired };
    // 未读消息数
    result.unreadMessageCount = await Message.count({ where: { userId: user.id, isRead: false } });
    return success(res, result);
  } catch (err) { return fail(res, '登录失败: ' + err.message, 500); }
});

router.get('/user/:id', requireWxAuth, async function(req, res) {
  try {
    // 只能查看自己的信息
    var requestedId = parseInt(req.params.id);
    if (requestedId !== req.wxUserId) {
      return fail(res, '无权查看他人信息', 403);
    }
    var user = await User.findByPk(requestedId);
    if (!user) return fail(res, '用户不存在', 404);
    var result = sanitizeUser(user);
    // 优惠券统计
    var unused = await CouponOrder.count({ where: { userId: user.id, status: 'unused' } });
    var used = await CouponOrder.count({ where: { userId: user.id, status: 'used' } });
    var expired = await CouponOrder.count({ where: { userId: user.id, status: 'expired' } });
    result.couponStats = { unused: unused, used: used, expired: expired, total: unused + used + expired };
    // 未读消息数
    result.unreadMessageCount = await Message.count({ where: { userId: user.id, isRead: false } });
    return success(res, result);
  } catch (err) { return fail(res, '查询失败', 500); }
});

// 更新用户资料
router.put('/user/:id', requireWxAuth, async function(req, res) {
  try {
    // 只能修改自己的资料
    var requestedId = parseInt(req.params.id);
    if (requestedId !== req.wxUserId) {
      return fail(res, '无权修改他人资料', 403);
    }
    var user = await User.findByPk(requestedId);
    if (!user) return fail(res, '用户不存在', 404);
    var updates = {};
    if (req.body.nickname !== undefined) updates.nickname = req.body.nickname;
    if (req.body.avatar !== undefined) updates.avatar = req.body.avatar;
    if (req.body.phone !== undefined && req.body.phone.indexOf('*') === -1) updates.phone = req.body.phone;
    if (req.body.gender !== undefined) updates.gender = req.body.gender;
    if (req.body.birthday !== undefined) updates.birthday = req.body.birthday;
    if (req.body.city !== undefined) updates.city = req.body.city;
    if (req.body.preferredJobTypes !== undefined) {
      updates.preferredJobTypes = JSON.stringify(req.body.preferredJobTypes);
    }
    await user.update(updates);
    return success(res, sanitizeUser(user), '更新成功');
  } catch (err) { return fail(res, '更新失败: ' + err.message, 500); }
});

// ==================== 优惠券订单（领取） ====================

router.get('/orders', requireWxAuth, async function(req, res) {
  try {
    // 只能查看自己的订单
    var userId = req.wxUserId;
    var where = { userId: userId };
    if (req.query.status) where.status = req.query.status;
    var list = await CouponOrder.findAll({
      where: where,
      include: [
        { model: Coupon, as: 'coupon', attributes: ['id', 'title', 'valueText', 'condition', 'type'] },
        { model: Agency, as: 'agency', attributes: ['id', 'name', 'address', 'phone'] }
      ],
      order: [['createdAt', 'DESC']]
    });
    var result = list.map(function(o) {
      var item = o.toJSON();
      item.title = item.coupon ? item.coupon.title : '';
      item.valueText = item.coupon ? item.coupon.valueText : '';
      item.condition = item.coupon ? item.coupon.condition : '';
      var statusMap = { unused: '待兑换', used: '已兑换', expired: '已过期', cancelled: '已作废' };
      item.statusText = statusMap[item.status] || item.status;
      return item;
    });
    return success(res, result);
  } catch (err) { return fail(res, '查询失败: ' + err.message, 500); }
});

router.get('/orders/:id', requireWxAuth, async function(req, res) {
  try {
    var order = await CouponOrder.findByPk(req.params.id, {
      include: [
        { model: Coupon, as: 'coupon', attributes: ['id', 'title', 'valueText', 'condition', 'type'] },
        { model: Agency, as: 'agency', attributes: ['id', 'name', 'address', 'phone'] }
      ]
    });
    if (!order) return fail(res, '订单不存在', 404);
    // 只能查看自己的订单
    if (order.userId !== req.wxUserId) {
      return fail(res, '无权查看该订单', 403);
    }
    var item = order.toJSON();
    item.title = item.coupon ? item.coupon.title : '';
    item.valueText = item.coupon ? item.coupon.valueText : '';
    item.condition = item.coupon ? item.coupon.condition : '';
    var statusMap = { unused: '待兑换', used: '已兑换', expired: '已过期', cancelled: '已作废' };
    item.statusText = statusMap[item.status] || item.status;
    return success(res, item);
  } catch (err) { return fail(res, '查询失败', 500); }
});

/**
 * 到店核销（由管理后台/机构端调用，通过 verifyCode 核销）
 *
 * ⚙️ 调用方式:
 *   POST /api/public/orders/:id/exchange
 *   Header: X-User-Token（需要登录态）
 *   Body: { agencyId: 核销机构ID }
 *
 *   调用场景:
 *   1. 管理后台 → 订单管理 → 输入券码查找 → 确认核销
 *   2. 机构端小程序 → 扫描二维码 → 自动调用核销
 *
 * ⚙️ 【生产建议】:
 *   1. 为 verifyCode 字段添加数据库索引提升查询速度
 *   2. 增加机构端鉴权（只允许该机构的工作人员核销）
 *   3. 核销成功后推送站内消息通知用户
 */
router.post('/orders/:id/exchange', requireWxAuth, async function(req, res) {
  try {
    var order = await CouponOrder.findByPk(req.params.id, {
      include: [{ model: Coupon, as: 'coupon' }]
    });
    if (!order) return fail(res, '订单不存在', 404);
    if (order.status !== 'unused') return fail(res, '该订单状态无法核销');

    var agencyId = parseInt(req.body.agencyId);
    if (!agencyId) return fail(res, '请提供核销机构ID');

    // 验证机构
    var agency = await Agency.findByPk(agencyId);
    if (!agency || agency.status !== 'active') return fail(res, '机构无效或已关闭');

    await order.update({
      agencyId: agencyId,
      status: 'used',
      useDate: new Date()
    });

    // 如果有分享人且优惠券设置了分享奖励金，创建佣金记录
    if (order.sharerId && order.coupon && order.coupon.shareRewardAmount > 0 && !order.rewardSettled) {
      await Commission.create({
        userId: order.sharerId,
        referUserId: order.userId,
        couponOrderId: order.id,
        source: 'coupon_share',
        amount: parseFloat(order.coupon.shareRewardAmount),
        status: 'pending',
        remark: '优惠券核销奖励: ' + (order.coupon.title || '')
      });
      // 更新分享人余额和收入
      var sharer = await User.findByPk(order.sharerId);
      if (sharer) {
        await sharer.increment({
          totalEarning: parseFloat(order.coupon.shareRewardAmount),
          balance: parseFloat(order.coupon.shareRewardAmount)
        });
      }
      await order.update({ rewardSettled: true });
    }

    var result = order.toJSON();
    result.agency = agency.toJSON();
    return success(res, result, '兑换成功');
  } catch (err) { return fail(res, '兑换失败: ' + err.message, 500); }
});

// ==================== 推广统计（替代原推荐官API） ====================

router.get('/promotion/:userId', requireWxAuth, async function(req, res) {
  try {
    // 只能查看自己的推广数据
    var requestedId = parseInt(req.params.userId);
    if (requestedId !== req.wxUserId) {
      return fail(res, '无权查看他人推广数据', 403);
    }
    var user = await User.findByPk(requestedId);
    if (!user) return fail(res, '用户不存在', 404);

    var monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    var monthRefer = await Commission.count({
      where: { userId: user.id, createdAt: { [Op.gte]: monthStart } }
    });

    var fansCount = await User.count({ where: { inviterId: user.id } });
    var shareCount = await ShareRecord.count({ where: { sharerId: user.id } });

    var result = {
      userId: user.id,
      nickname: user.nickname,
      memberLevel: user.memberLevel,
      totalRefer: user.totalRefer || 0,
      totalEarning: parseFloat(user.totalEarning || 0),
      balance: parseFloat(user.balance || 0),
      points: user.points || 0,
      monthRefer: monthRefer,
      fansCount: fansCount,
      shareCount: shareCount
    };

    // 最近20条佣金记录
    var records = await Commission.findAll({
      where: { userId: user.id },
      include: [{ model: User, as: 'referUser', attributes: ['id', 'nickname'] }],
      order: [['createdAt', 'DESC']],
      limit: 20
    });
    result.earningRecords = records.map(function(r) {
      var row = r.toJSON();
      var sourceMap = {
        coupon_share: '优惠券分享奖励',
        order_accept: '订单推荐奖励',
        invite: '邀请注册奖励'
      };
      return {
        id: row.id,
        title: (sourceMap[row.source] || '奖励') + (row.referUser ? ' - ' + row.referUser.nickname : ''),
        time: row.createdAt ? row.createdAt.toString().slice(0, 10) : '',
        amount: parseFloat(row.amount),
        source: row.source,
        status: row.status
      };
    });

    return success(res, result);
  } catch (err) { return fail(res, '查询失败: ' + err.message, 500); }
});

// ==================== 分享系统 ====================

// 生成分享记录 & 获取 shareCode
router.post('/share', requireWxAuth, async function(req, res) {
  try {
    var sharerId = req.wxUserId;
    var { shareType, targetId } = req.body;
    if (!shareType) return fail(res, '参数不完整');

    // 查找是否已有同一分享
    var existing = await ShareRecord.findOne({
      where: { sharerId: sharerId, shareType: shareType, targetId: targetId || null }
    });
    if (existing) {
      return success(res, { shareCode: existing.shareCode, shareRecordId: existing.id });
    }

    var shareCode = generateShareCode();
    var record = await ShareRecord.create({
      sharerId: sharerId,
      shareType: shareType,
      targetId: targetId || null,
      shareCode: shareCode
    });
    return success(res, { shareCode: record.shareCode, shareRecordId: record.id });
  } catch (err) { return fail(res, '生成分享码失败: ' + err.message, 500); }
});

// 分享记录列表（按分享人/类型查询）
router.get('/share/list', requireWxAuth, async function(req, res) {
  try {
    var sharerId = req.wxUserId;
    var where = { sharerId: sharerId };
    if (req.query.shareType) where.shareType = req.query.shareType;

    var list = await ShareRecord.findAll({
      where: where,
      order: [['createdAt', 'DESC']],
      limit: 50
    });
    return success(res, list);
  } catch (err) { return fail(res, '查询失败: ' + err.message, 500); }
});

// 通过 shareCode 查看分享内容（记录查看）— 此接口无需登录
router.get('/share/:shareCode', async function(req, res) {
  try {
    var record = await ShareRecord.findOne({
      where: { shareCode: req.params.shareCode },
      include: [{ model: User, as: 'sharer', attributes: ['id', 'nickname', 'avatar'] }]
    });
    if (!record) return fail(res, '分享链接无效', 404);

    // 增加查看次数
    await record.increment('viewCount');

    var result = {
      shareRecordId: record.id,
      sharerId: record.sharerId,
      sharerName: record.sharer ? record.sharer.nickname : '',
      shareType: record.shareType,
      targetId: record.targetId
    };

    // 自动锁粉：如果查看者是新用户，由前端在 wx-login 时传 inviterId
    return success(res, result);
  } catch (err) { return fail(res, '查询失败: ' + err.message, 500); }
});

// 领取优惠券（带分享追溯，使用事务保证并发安全）
router.post('/coupons/:id/claim', requireWxAuth, async function(req, res) {
  var t = await sequelize.transaction();
  try {
    var userId = req.wxUserId;
    var coupon = await Coupon.findByPk(req.params.id, { transaction: t, lock: true });
    if (!coupon) { await t.rollback(); return fail(res, '优惠券不存在', 404); }
    if (coupon.status !== 'online') { await t.rollback(); return fail(res, '该优惠券已下架'); }
    if (coupon.remainCount <= 0) { await t.rollback(); return fail(res, '优惠券已抢完'); }

    // 检查领取限制
    var claimedCount = await CouponOrder.count({ where: { userId: userId, couponId: coupon.id }, transaction: t });
    if (claimedCount >= coupon.limitPerUser) { await t.rollback(); return fail(res, '已达到领取上限'); }

    // 分享追溯
    var sharerId = null;
    var shareRecordId = null;
    if (req.body.shareCode) {
      var shareRecord = await ShareRecord.findOne({ where: { shareCode: req.body.shareCode }, transaction: t });
      if (shareRecord && shareRecord.sharerId !== userId) {
        sharerId = shareRecord.sharerId;
        shareRecordId = shareRecord.id;
        await shareRecord.increment('claimCount', { transaction: t });
        // 记录领取人
        var receivers = parseJsonField(shareRecord.receiverIds);
        if (receivers.indexOf(userId) === -1) {
          receivers.push(userId);
          await shareRecord.update({ receiverIds: JSON.stringify(receivers) }, { transaction: t });
        }
      }
    }

    // 生成订单号
    var orderNo = 'CO' + Date.now() + Math.floor(Math.random() * 1000);
    var verifyCode = Math.floor(100000 + Math.random() * 900000).toString();

    var order = await CouponOrder.create({
      orderNo: orderNo,
      userId: userId,
      couponId: coupon.id,
      verifyCode: verifyCode,
      status: 'unused',
      expireDate: coupon.expireDate,
      sharerId: sharerId,
      shareRecordId: shareRecordId
    }, { transaction: t });

    // 使用条件更新保证并发安全
    var [affectedRows] = await Coupon.update(
      { claimedCount: sequelize.literal('claimedCount + 1'), remainCount: sequelize.literal('remainCount - 1') },
      { where: { id: coupon.id, remainCount: { [Op.gt]: 0 } }, transaction: t }
    );
    if (affectedRows === 0) {
      await t.rollback();
      return fail(res, '优惠券已抢完');
    }

    await t.commit();
    return success(res, order, '领取成功');
  } catch (err) {
    await t.rollback();
    return fail(res, '领取失败: ' + err.message, 500);
  }
});

// ==================== 工种 ====================

router.get('/job-types', async function(req, res) {
  try {
    var list = await JobType.findAll({
      where: { status: 'active' },
      order: [['sortOrder', 'DESC'], ['createdAt', 'ASC']]
    });
    return success(res, list);
  } catch (err) { return fail(res, '查询失败: ' + err.message, 500); }
});

// ==================== 服务订单（小程序端） ====================

// 服务订单列表（已审核通过的，按工种筛选）
router.get('/service-orders', async function(req, res) {
  try {
    var page = parseInt(req.query.page) || 1;
    var pageSize = parseInt(req.query.pageSize) || 10;
    var where = { status: { [Op.in]: ['approved', 'matching'] } };
    if (req.query.jobTypeId) where.jobTypeId = parseInt(req.query.jobTypeId);
    if (req.query.city) where.city = { [Op.like]: '%' + req.query.city + '%' };

    var list = await ServiceOrder.findAll({
      where: where,
      include: [
        { model: JobType, as: 'jobType', attributes: ['id', 'name', 'code', 'icon'] }
      ],
      attributes: { exclude: ['contactPhone', 'contactName', 'adminNote'] },  // 小程序端脱敏
      order: [['createdAt', 'DESC']],
      limit: pageSize,
      offset: (page - 1) * pageSize
    });

    var total = await ServiceOrder.count({ where: where });

    // 附加接单人数
    var result = await Promise.all(list.map(async function(item) {
      var row = item.toJSON();
      row.applicationCount = await OrderApplication.count({ where: { orderId: item.id } });
      return row;
    }));

    return success(res, { list: result, total: total, page: page, pageSize: pageSize });
  } catch (err) { return fail(res, '查询失败: ' + err.message, 500); }
});

// 服务订单详情（手机号脱敏）
router.get('/service-orders/:id', async function(req, res) {
  try {
    var order = await ServiceOrder.findByPk(req.params.id, {
      include: [
        { model: JobType, as: 'jobType' },
        { model: User, as: 'publisher', attributes: ['id', 'nickname', 'avatar'] }
      ]
    });
    if (!order) return fail(res, '订单不存在', 404);

    var result = order.toJSON();
    // 脱敏：移除联系方式
    delete result.contactPhone;
    delete result.contactName;
    delete result.adminNote;
    // 接单人数
    result.applicationCount = await OrderApplication.count({ where: { orderId: order.id } });

    // 处理 shareCode 查看追溯
    if (req.query.shareCode) {
      var shareRecord = await ShareRecord.findOne({ where: { shareCode: req.query.shareCode } });
      if (shareRecord) {
        await shareRecord.increment('viewCount');
        result.shareInfo = {
          shareRecordId: shareRecord.id,
          sharerId: shareRecord.sharerId
        };
      }
    }

    return success(res, result);
  } catch (err) { return fail(res, '查询失败: ' + err.message, 500); }
});

// 发布服务订单（支持 type: employer=雇主发单, worker=阿姨求职）
router.post('/service-orders', requireWxAuth, async function(req, res) {
  try {
    var userId = req.wxUserId;
    var { jobTypeId, serviceDate, serviceDuration, location, city,
          salaryType, salaryMin, salaryMax, contactName, contactPhone, remark, type } = req.body;

    if (!jobTypeId) return fail(res, '参数不完整');

    // 验证工种
    var jobType = await JobType.findByPk(jobTypeId);
    if (!jobType || jobType.status !== 'active') return fail(res, '无效的工种');

    // 自动填充联系方式
    if (!contactPhone) {
      var user = await User.findByPk(userId);
      if (user) {
        contactName = contactName || user.realName || user.nickname || '';
        contactPhone = user.phone || '';
      }
    }

    var orderType = (type === 'worker') ? 'worker' : 'employer';

    var order = await ServiceOrder.create({
      orderNo: generateOrderNo(),
      userId: userId,
      jobTypeId: jobTypeId,
      type: orderType,
      serviceDate: serviceDate || null,
      serviceDuration: serviceDuration || '',
      location: location || '',
      city: city || '',
      salaryType: salaryType || 'monthly',
      salaryMin: salaryMin || 0,
      salaryMax: salaryMax || 0,
      contactName: contactName || '',
      contactPhone: contactPhone || '',
      remark: remark || '',
      status: 'pending'
    });

    var successMsg = orderType === 'worker'
      ? '接单意向已提交，平台会尽快为您匹配订单'
      : '发布成功，很快就有阿姨接单了！';
    return success(res, order, successMsg);
  } catch (err) { return fail(res, '发布失败: ' + err.message, 500); }
});

// 接单申请
router.post('/service-orders/:id/apply', requireWxAuth, async function(req, res) {
  try {
    var order = await ServiceOrder.findByPk(req.params.id);
    if (!order) return fail(res, '订单不存在', 404);
    if (order.status !== 'approved' && order.status !== 'matching') {
      return fail(res, '该订单暂不接受申请');
    }

    var userId = req.wxUserId;
    if (userId === order.userId) return fail(res, '不能申请自己发布的订单');

    // 检查是否已申请（包括被拒绝的，防止重复申请骚扰）
    var existing = await OrderApplication.findOne({
      where: { orderId: order.id, userId: userId }
    });
    if (existing) {
      if (existing.status === 'pending' || existing.status === 'accepted') {
        return fail(res, '您已申请过该订单');
      }
      if (existing.status === 'rejected') {
        return fail(res, '您的申请已被拒绝，无法重复申请');
      }
    }

    // 分享追溯
    var sharerId = null;
    var shareRecordId = null;
    if (req.body.shareCode) {
      var shareRecord = await ShareRecord.findOne({ where: { shareCode: req.body.shareCode } });
      if (shareRecord && shareRecord.sharerId !== userId) {
        sharerId = shareRecord.sharerId;
        shareRecordId = shareRecord.id;
        await shareRecord.increment('claimCount');
      }
    }

    var application = await OrderApplication.create({
      orderId: order.id,
      userId: userId,
      message: req.body.message || '',
      sharerId: sharerId,
      shareRecordId: shareRecordId
    });

    // 更新订单状态为 matching（有人在抢单）
    if (order.status === 'approved') {
      await order.update({ status: 'matching' });
    }

    return success(res, application, '申请成功');
  } catch (err) { return fail(res, '申请失败: ' + err.message, 500); }
});

// 我发布的订单
router.get('/my-orders', requireWxAuth, async function(req, res) {
  try {
    var userId = req.wxUserId;
    var where = { userId: userId };
    if (req.query.status) where.status = req.query.status;

    var list = await ServiceOrder.findAll({
      where: where,
      include: [
        { model: JobType, as: 'jobType', attributes: ['id', 'name', 'icon'] },
        { model: User, as: 'acceptedUser', attributes: ['id', 'nickname', 'avatar'] }
      ],
      order: [['createdAt', 'DESC']]
    });

    var result = await Promise.all(list.map(async function(item) {
      var row = item.toJSON();
      row.applicationCount = await OrderApplication.count({ where: { orderId: item.id } });
      return row;
    }));

    return success(res, result);
  } catch (err) { return fail(res, '查询失败: ' + err.message, 500); }
});

// 我的接单申请
router.get('/my-applications', requireWxAuth, async function(req, res) {
  try {
    var userId = req.wxUserId;
    var where = { userId: userId };
    if (req.query.status) where.status = req.query.status;

    var list = await OrderApplication.findAll({
      where: where,
      include: [
        {
          model: ServiceOrder, as: 'order',
          attributes: ['id', 'orderNo', 'status', 'city', 'location', 'salaryMin', 'salaryMax', 'salaryType', 'serviceDate'],
          include: [{ model: JobType, as: 'jobType', attributes: ['id', 'name', 'icon'] }]
        }
      ],
      order: [['createdAt', 'DESC']]
    });

    return success(res, list);
  } catch (err) { return fail(res, '查询失败: ' + err.message, 500); }
});

// ==================== 消息中心 ====================
// 注意：固定路径路由必须在参数路由之前注册，避免路由冲突

// 未读消息数（固定路径，放在 :id 之前）
router.get('/messages/unread-count', requireWxAuth, async function(req, res) {
  try {
    var userId = req.wxUserId;
    var count = await Message.count({ where: { userId: userId, isRead: false } });
    return success(res, { count: count });
  } catch (err) { return fail(res, '查询失败', 500); }
});

// 全部标记已读（固定路径，放在 :id 之前）
router.put('/messages/read-all', requireWxAuth, async function(req, res) {
  try {
    var userId = req.wxUserId;
    await Message.update(
      { isRead: true, readAt: new Date() },
      { where: { userId: userId, isRead: false } }
    );
    return success(res, null, '全部已读');
  } catch (err) { return fail(res, '操作失败', 500); }
});

// 消息列表
router.get('/messages', requireWxAuth, async function(req, res) {
  try {
    var userId = req.wxUserId;
    var page = parseInt(req.query.page) || 1;
    var pageSize = parseInt(req.query.pageSize) || 20;

    var result = await Message.findAndCountAll({
      where: { userId: userId },
      order: [['createdAt', 'DESC']],
      limit: pageSize,
      offset: (page - 1) * pageSize
    });

    return success(res, {
      list: result.rows,
      total: result.count,
      page: page,
      pageSize: pageSize,
      unreadCount: await Message.count({ where: { userId: userId, isRead: false } })
    });
  } catch (err) { return fail(res, '查询失败: ' + err.message, 500); }
});

// 标记消息已读（参数路由，放在固定路径之后）
router.put('/messages/:id/read', requireWxAuth, async function(req, res) {
  try {
    var msg = await Message.findByPk(req.params.id);
    if (!msg) return fail(res, '消息不存在', 404);
    // 只能标记自己的消息
    if (msg.userId !== req.wxUserId) return fail(res, '无权操作', 403);
    await msg.update({ isRead: true, readAt: new Date() });
    return success(res, msg);
  } catch (err) { return fail(res, '操作失败', 500); }
});

// ==================== 订阅推送设置 ====================

// 获取推送设置
router.get('/subscription', requireWxAuth, async function(req, res) {
  try {
    var userId = req.wxUserId;
    var setting = await SubscriptionSetting.findOne({ where: { userId: userId } });
    if (!setting) {
      // 创建默认设置
      setting = await SubscriptionSetting.create({ userId: userId });
    }
    var result = setting.toJSON();
    result.jobTypeIds = parseJsonField(result.jobTypeIds);
    return success(res, result);
  } catch (err) { return fail(res, '查询失败', 500); }
});

// 更新推送设置
router.put('/subscription', requireWxAuth, async function(req, res) {
  try {
    var userId = req.wxUserId;
    var setting = await SubscriptionSetting.findOne({ where: { userId: userId } });
    if (!setting) {
      setting = await SubscriptionSetting.create({ userId: userId });
    }
    var updates = {};
    if (req.body.enabled !== undefined) updates.enabled = req.body.enabled;
    if (req.body.frequency !== undefined) updates.frequency = req.body.frequency;
    if (req.body.jobTypeIds !== undefined) updates.jobTypeIds = JSON.stringify(req.body.jobTypeIds);
    await setting.update(updates);
    var result = setting.toJSON();
    result.jobTypeIds = parseJsonField(result.jobTypeIds);
    return success(res, result, '设置已保存');
  } catch (err) { return fail(res, '保存失败', 500); }
});

module.exports = router;
