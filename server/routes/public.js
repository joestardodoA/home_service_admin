// server/routes/public.js — 小程序公开 API（免认证）（海南椰嫂综合平台）
const express = require('express');
const {
  Coupon, Agency, AgencyCourse, Article, Banner,
  CouponOrder, User, Commission, ShareRecord,
  JobType, ServiceOrder, OrderApplication,
  Message, SubscriptionSetting, SystemSetting,
  GuimiCircle, GuimiCircleMember, GuimiInviteCode,
  sequelize
} = require('../models');
const { success, fail } = require('../utils/response');
const { Op } = require('sequelize');
const crypto = require('crypto');
var { recordEventByUser } = require('../utils/circleEvent');

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
  // 添加毫秒后3位进一步降低碰撞概率
  var ms = ('000' + d.getMilliseconds()).slice(-3);
  return 'YS' + dateStr + ms + rand;
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

// 小程序端 JWT 密钥（与后台管理独立）
var wxJwt = require('jsonwebtoken');
var WX_JWT_SECRET = process.env.WX_JWT_SECRET || '';
if (!WX_JWT_SECRET) {
  // 开发模式使用固定密钥（确保重启后 Token 仍有效）
  WX_JWT_SECRET = 'wx_dev_secret_coconut_2026';
}

// 签发小程序 JWT
function signWxToken(userId, openid) {
  return wxJwt.sign({ userId: userId, openid: openid }, WX_JWT_SECRET, { expiresIn: '30d' });
}

// JWT 校验中间件（从 header 解析并验证 JWT）
async function optionalAuth(req, res, next) {
  var token = req.headers['x-user-token'] || '';
  if (token) {
    try {
      var decoded = wxJwt.verify(token, WX_JWT_SECRET);
      if (decoded && decoded.userId) {
        var user = await User.findByPk(decoded.userId);
        if (user) {
          req.wxUser = user;
          req.wxUserId = user.id;
        }
      }
    } catch (e) {
      // Token 无效或过期，不抦截（可选认证）
    }
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

// ==================== 文件上传（小程序端） ====================

var multer = require('multer');
var path = require('path');
var fs = require('fs');
var uploadConfig = require('../config/upload');

// 确保上传目录存在
var uploadDir = path.join(__dirname, '..', uploadConfig.local.uploadDir);
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

var wxStorage = multer.diskStorage({
  destination: function(req, file, cb) { cb(null, uploadDir); },
  filename: function(req, file, cb) {
    var ext = path.extname(file.originalname).toLowerCase();
    cb(null, Date.now() + '_' + crypto.randomBytes(6).toString('hex') + ext);
  }
});
var wxUpload = multer({
  storage: wxStorage,
  fileFilter: function(req, file, cb) {
    if (uploadConfig.allowedMimeTypes.indexOf(file.mimetype) !== -1) {
      cb(null, true);
    } else {
      cb(new Error('不支持的文件类型'), false);
    }
  },
  limits: { fileSize: uploadConfig.maxFileSize }
});

// 小程序端上传（需登录）
router.post('/upload', requireWxAuth, function(req, res) {
  wxUpload.single('file')(req, res, function(err) {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return fail(res, '文件不能超过 ' + Math.round(uploadConfig.maxFileSize / 1024 / 1024) + 'MB');
      }
      return fail(res, '上传失败: ' + err.message);
    }
    if (!req.file) return fail(res, '请选择要上传的文件');
    var fileUrl = uploadConfig.local.urlPrefix + '/' + req.file.filename;
    return success(res, {
      url: fileUrl,
      filename: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size
    }, '上传成功');
  });
});

// ==================== 优惠券 ====================

// 优惠券列表（仅上架的，登录用户附带领取状态）
router.get('/coupons', async function(req, res) {
  try {
    var list = await Coupon.findAll({
      where: { status: 'online' },
      order: [['sortOrder', 'DESC'], ['createdAt', 'DESC']]
    });
    var result = list.map(transformCoupon);

    // 如果用户已登录，查询每张券的领取状态
    if (req.wxUserId) {
      var couponIds = result.map(function(c) { return c.id; });
      var orders = await CouponOrder.findAll({
        where: { userId: req.wxUserId, couponId: { [Op.in]: couponIds } },
        attributes: ['couponId', 'status']
      });
      // 构建 couponId -> status 映射
      var statusMap = {};
      orders.forEach(function(o) {
        // 如果同一券领了多次，优先显示 unused > used > expired > cancelled
        var priority = { unused: 4, used: 3, expired: 2, cancelled: 1 };
        var existing = statusMap[o.couponId];
        if (!existing || (priority[o.status] || 0) > (priority[existing] || 0)) {
          statusMap[o.couponId] = o.status;
        }
      });
      result.forEach(function(c) {
        c.claimStatus = statusMap[c.id] || null; // null=未领取, unused=已领取, used=已兑换
      });
    }

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

// 按工种分组的文章列表（含工种实时统计数据）
router.get('/articles-by-jobtype', async function(req, res) {
  try {
    var city = req.query.city || '';
    var cityWhere = city ? { city: { [Op.like]: '%' + city + '%' } } : {};

    // 获取所有工种
    var jobTypes = await JobType.findAll({ order: [['sortOrder', 'DESC'], ['id', 'ASC']] });

    // 获取所有已发布文章
    var articles = await Article.findAll({
      where: { status: 'published' },
      order: [['sortOrder', 'DESC'], ['publishedAt', 'DESC']]
    });

    // 工种名称到 code 的映射（用于文章分类匹配）
    var categoryToCode = {
      '月嫂': 'yuesao', '育婴': 'yuer', '育儿嫂': 'yuer', '保洁': 'baojie',
      '养老': 'yanglao', '养老护理': 'yanglao', '产康': 'chankang', '产康师': 'chankang',
      '家务': 'jiawu', '钟点工': 'zhonggong', '职场': 'other'
    };

    // 数据系数
    var coefficient = 5;
    try {
      var setting = await SystemSetting.findOne({ where: { key: 'data_coefficient' } });
      if (setting && setting.value) coefficient = parseFloat(setting.value) || 5;
    } catch(e) {}

    // 为每个工种查询统计数据
    var groups = [];
    for (var i = 0; i < jobTypes.length; i++) {
      var jt = jobTypes[i];
      var baseWhere = Object.assign({ jobTypeId: jt.id }, cityWhere);

      // 待接单数（approved + matching）
      var pendingOrders = await ServiceOrder.count({
        where: Object.assign({}, baseWhere, { status: { [Op.in]: ['approved', 'matching'] } })
      });

      // 该工种阿姨数（User 表中 preferredJobTypes 包含该工种 ID 的用户）
      var workerCount = await User.count({
        where: Object.assign({}, city ? { city: { [Op.like]: '%' + city + '%' } } : {})
      });
      // 按工种比例分配（简化处理：总人数 / 工种数 * 随机波动）
      var workerBase = Math.max(1, Math.floor(workerCount / Math.max(jobTypes.length, 1)));

      // 累计匹配数
      var totalMatched = await ServiceOrder.count({
        where: Object.assign({}, baseWhere, { status: { [Op.in]: ['matched', 'completed'] } })
      });

      // 筛选该工种对应的文章（按 category 匹配）
      var jtArticles = articles.filter(function(a) {
        var cat = a.category || '';
        // 精确匹配工种名称
        if (cat === jt.name) return true;
        // 通过映射表匹配
        if (categoryToCode[cat] && categoryToCode[cat] === jt.code) return true;
        // 标题或标签包含工种名
        var title = a.title || '';
        var tags = parseJsonField(a.getDataValue('tags'));
        if (title.indexOf(jt.name) !== -1) return true;
        for (var t = 0; t < tags.length; t++) {
          if (tags[t] === jt.name) return true;
        }
        return false;
      });

      // 只保留有文章的工种（或者有统计数据的工种）
      var hasData = jtArticles.length > 0 || pendingOrders > 0 || totalMatched > 0;
      if (!hasData) continue;

      groups.push({
        jobType: {
          id: jt.id,
          name: jt.name,
          code: jt.code,
          icon: jt.icon || ''
        },
        stats: {
          pendingOrders: Math.round((pendingOrders + 3) * coefficient),
          workerCount: Math.round((workerBase + 5) * coefficient),
          totalMatched: Math.round((totalMatched + 2) * coefficient),
          city: city || '全国'
        },
        articles: jtArticles.slice(0, 5).map(function(a) {
          var item = a.toJSON();
          item.tags = parseJsonField(item.tags);
          item.date = item.publishedAt ? item.publishedAt.toString().slice(0, 10) : '';
          return item;
        })
      });
    }

    return success(res, groups);
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
      var setting = await SystemSetting.findOne({ where: { key: 'data_coefficient' } });
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
      var setting = await SystemSetting.findOne({ where: { key: 'data_coefficient' } });
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
var rateLimit = require('express-rate-limit');

// wx-login 速率限制：每IP每分钟最多10次
var wxLoginLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: function(req, res) {
    return fail(res, '请求过于频繁，请稍后再试', 429);
  }
});

router.post('/wx-login', wxLoginLimiter, async function(req, res) {
  try {
    /**
     * 微信登录：用 wx.login() 的 code 换取 openid
     *
     * 流程：
     *   1. 小程序 app.js 里 wx.login() 获取 code
     *   2. 后端拿 code + AppID + AppSecret 调微信接口换 openid
     *   3. 微信接口: GET https://api.weixin.qq.com/sns/jscode2session
     *
     * 环境变量：
     *   WX_APPID  — 小程序 AppID
     *   WX_SECRET — 小程序 AppSecret
     */
    var openid = req.body.openid;
    if (!openid) {
      var code = req.body.code;
      // 多小程序支持：根据 appSource 选择对应的 AppID/AppSecret
      var appSource = req.body.appSource || 'yesao';
      var wxAppId, wxSecret;
      if (appSource === 'xiaoweilan' && process.env.WX_APPID_XWL && process.env.WX_SECRET_XWL) {
        wxAppId = process.env.WX_APPID_XWL;
        wxSecret = process.env.WX_SECRET_XWL;
      } else {
        wxAppId = process.env.WX_APPID;
        wxSecret = process.env.WX_SECRET;
      }
      if (code && wxAppId && wxSecret) {
        // 生产模式：调微信接口换 openid
        try {
          var axios = require('axios');
          var wxRes = await axios.get('https://api.weixin.qq.com/sns/jscode2session', {
            params: {
              appid: wxAppId,
              secret: wxSecret,
              js_code: code,
              grant_type: 'authorization_code'
            }
          });
          if (wxRes.data && wxRes.data.openid) {
            openid = wxRes.data.openid;
          } else {
            console.error('[微信登录] jscode2session 返回异常:', wxRes.data);
            return fail(res, '微信登录失败: ' + (wxRes.data.errmsg || '未知错误'), 400);
          }
        } catch (wxErr) {
          console.error('[微信登录] 调用微信接口失败:', wxErr.message);
          return fail(res, '微信登录服务异常', 500);
        }
      } else {
        // 开发模式降级：未配置 WX_APPID/WX_SECRET 时使用模拟 openid
        var hourKey = Math.floor(Date.now() / 3600000);
        openid = 'dev_user_' + hourKey;
        console.warn('[微信登录] 未配置 WX_APPID/WX_SECRET，使用模拟 openid:', openid);
      }
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

    // 闺蜜圈自动加入：注册时如果携带 circleId 参数，自动加入该圈子
    if (req.body.circleId) {
      try {
        var joinCircleId = parseInt(req.body.circleId);
        var { GuimiCircle: GC, GuimiCircleMember: GCM } = require('../models');
        var targetCircle = await GC.findByPk(joinCircleId);
        if (targetCircle && targetCircle.status === 'active' && targetCircle.memberCount < targetCircle.maxMembers) {
          // 检查是否已在圈中
          var alreadyIn = await GCM.findOne({ where: { circleId: joinCircleId, userId: user.id } });
          if (!alreadyIn) {
            // 检查同工种是否已加入其他圈子
            var sameJobCircle = await GCM.findOne({
              where: { userId: user.id },
              include: [{ model: GC, as: 'circle', where: { jobTypeId: targetCircle.jobTypeId, status: 'active' } }]
            });
            if (!sameJobCircle) {
              await GCM.create({ circleId: joinCircleId, userId: user.id, role: 'member', joinedAt: new Date() });
              await targetCircle.increment('memberCount');
            }
          }
        }
      } catch (circleErr) {
        // 闺蜜圈加入失败不阻塞登录流程
        console.error('[闺蜜圈自动加入失败]', circleErr.message);
      }
    }

    var result = sanitizeUser(user);
    // 签发 JWT Token
    result.token = signWxToken(user.id, openid);
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

// 绑定手机号（支持两种模式）
// 模式1: 微信授权（传 code 参数）— 需企业认证
// 模式2: 手动输入（传 phone 参数）— 通用
router.post('/bind-phone', requireWxAuth, async function(req, res) {
  try {
    var phoneNumber = '';

    // 模式1: 微信手机号授权（企业认证小程序）
    if (req.body.code && !req.body.phone) {
      var phoneCode = req.body.code;
      var appSource = req.body.appSource || 'yesao';
      var wxAppId, wxSecret;
      if (appSource === 'xiaoweilan' && process.env.WX_APPID_XWL && process.env.WX_SECRET_XWL) {
        wxAppId = process.env.WX_APPID_XWL;
        wxSecret = process.env.WX_SECRET_XWL;
      } else {
        wxAppId = process.env.WX_APPID;
        wxSecret = process.env.WX_SECRET;
      }
      var axios = require('axios');
      var tokenRes = await axios.get('https://api.weixin.qq.com/cgi-bin/token', {
        params: { grant_type: 'client_credential', appid: wxAppId, secret: wxSecret }
      });
      if (!tokenRes.data || !tokenRes.data.access_token) {
        return fail(res, '获取凭证失败');
      }
      var phoneRes = await axios.post(
        'https://api.weixin.qq.com/wxa/business/getuserphonenumber?access_token=' + tokenRes.data.access_token,
        { code: phoneCode }
      );
      if (!phoneRes.data || phoneRes.data.errcode !== 0 || !phoneRes.data.phone_info) {
        return fail(res, '获取手机号失败: ' + (phoneRes.data.errmsg || '请重试'));
      }
      phoneNumber = phoneRes.data.phone_info.purePhoneNumber || phoneRes.data.phone_info.phoneNumber;
    }
    // 模式2: 手动输入手机号
    else if (req.body.phone) {
      phoneNumber = req.body.phone.trim();
      // 验证手机号格式
      if (!/^1\d{10}$/.test(phoneNumber)) {
        return fail(res, '手机号格式不正确');
      }
    }
    else {
      return fail(res, '缺少手机号参数');
    }

    if (!phoneNumber) return fail(res, '未获取到手机号');

    // 更新用户手机号
    var user = await User.findByPk(req.wxUserId);
    if (!user) return fail(res, '用户不存在', 404);
    await user.update({ phone: phoneNumber });

    return success(res, { phone: phoneNumber }, '手机号绑定成功');
  } catch (err) {
    console.error('[绑定手机] 异常:', err.message);
    return fail(res, '绑定失败: ' + err.message, 500);
  }
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
        status: 'settled',
        settledAt: new Date(),
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

    // 闺蜜圈事件埋点：成员核销
    recordEventByUser(order.userId, 'coupon_verified', order.id, '核销了优惠券，核销机构：' + (agency.name || ''));

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

    // 闺蜜圈事件埋点：成员领券
    recordEventByUser(userId, 'coupon_claimed', order.id, '领取了优惠券「' + (coupon.title || '') + '」');

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
    var where = { status: { [Op.in]: ['approved', 'assigned', 'matching'] } };
    // 按订单类型筛选：employer=雇主发单（默认）, worker=阿姨求职, all=全部
    if (req.query.type && req.query.type !== 'all') {
      where.type = req.query.type;
    } else if (!req.query.type) {
      // 默认只展示雇主发单（阿姨浏览接单用）
      where.type = 'employer';
    }
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

// 服务订单详情（手机号脱敏，仅允许查看特定状态的订单）
router.get('/service-orders/:id', async function(req, res) {
  try {
    var order = await ServiceOrder.findByPk(req.params.id, {
      include: [
        { model: JobType, as: 'jobType' },
        { model: User, as: 'publisher', attributes: ['id', 'nickname', 'avatar'] }
      ]
    });
    if (!order) return fail(res, '订单不存在', 404);
    // 状态过滤：小程序端不允许查看待审核/已拒绝的订单（发布者自己除外）
    var restrictedStatuses = ['pending', 'rejected', 'cancelled'];
    if (restrictedStatuses.indexOf(order.status) !== -1 && (!req.wxUserId || order.userId !== req.wxUserId)) {
      return fail(res, '订单不存在', 404);
    }

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

    // 薪资校验
    salaryMin = parseInt(salaryMin) || 0;
    salaryMax = parseInt(salaryMax) || 0;
    if (salaryMin < 0 || salaryMax < 0) return fail(res, '薪资不能为负数');
    if (salaryMax > 0 && salaryMin > salaryMax) return fail(res, '最低薪资不能高于最高薪资');

    // 文本长度限制
    if (remark && remark.length > 500) return fail(res, '备注不能超过500字');
    if (contactName && contactName.length > 20) return fail(res, '联系人姓名过长');

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

    // 站内消息通知
    await Message.create({
      userId: userId,
      type: 'order_status',
      title: orderType === 'worker' ? '求职意向已提交' : '订单已提交审核',
      content: '您的' + (orderType === 'worker' ? '求职意向' : '服务订单') + ' ' + order.orderNo + ' 已提交，平台将尽快审核。',
      linkType: 'service_order',
      linkId: order.id
    });

    // 闺蜜圈事件埋点：成员发单
    recordEventByUser(userId, 'order_published', order.id,
      (orderType === 'worker' ? '提交了求职意向' : '发布了服务订单') + ' ' + order.orderNo, jobTypeId);

    return success(res, order, successMsg);
  } catch (err) { return fail(res, '发布失败: ' + err.message, 500); }
});

// 接单申请
router.post('/service-orders/:id/apply', requireWxAuth, async function(req, res) {
  try {
    var order = await ServiceOrder.findByPk(req.params.id);
    if (!order) return fail(res, '订单不存在', 404);
    if (order.status !== 'approved' && order.status !== 'assigned' && order.status !== 'matching') {
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
      // cancelled 状态允许重新申请：删除旧记录后继续流程
      if (existing.status === 'cancelled') {
        await existing.destroy();
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
    if (order.status === 'approved' || order.status === 'assigned') {
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
    // 按订单类型筛选：employer=雇主发单, worker=阿姨接单意向
    if (req.query.type) where.type = req.query.type;

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

// 用户取消自己的订单（仅 pending / approved 状态可取消）
router.put('/service-orders/:id/cancel', requireWxAuth, async function(req, res) {
  try {
    var userId = req.wxUserId;
    var order = await ServiceOrder.findByPk(req.params.id);
    if (!order) return fail(res, '订单不存在', 404);
    if (order.userId !== userId) return fail(res, '无权操作', 403);
    if (order.status !== 'pending' && order.status !== 'approved') {
      return fail(res, '当前状态无法取消，请联系客服');
    }
    await order.update({ status: 'cancelled' });

    // 通知用户
    await Message.create({
      userId: userId,
      type: 'order_status',
      title: '订单已取消',
      content: '您的订单 ' + order.orderNo + ' 已取消。',
      linkType: 'service_order',
      linkId: order.id
    });

    return success(res, order, '订单已取消');
  } catch (err) { return fail(res, '操作失败: ' + err.message, 500); }
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

// ==================== AI 智能辅助 ====================
var aiService = require('../services/ai');

// POST /ai/parse-order — 解析自然语言发单需求
router.post('/ai/parse-order', async function(req, res) {
  try {
    var text = (req.body.text || '').trim();
    if (!text) return fail(res, '请输入需求描述');
    if (text.length > 500) return fail(res, '输入文字过长，请精简描述');

    // 获取可用工种列表
    var jobTypes = await JobType.findAll({
      where: { status: 'active' },
      attributes: ['id', 'name', 'code'],
      order: [['sortOrder', 'ASC']]
    });

    // 调用 AI 解析
    var parsed = await aiService.parseOrderIntent(text, jobTypes);

    if (parsed.error) {
      return fail(res, parsed.error);
    }

    return success(res, parsed, '解析成功');
  } catch (err) {
    console.error('[AI 解析错误]', err);
    return fail(res, 'AI 解析失败: ' + err.message, 500);
  }
});

// POST /chat — AI 智能客服对话
var chatbot = require('../services/chatbot');
// 简单限流（防刷保护，正式环境建议用 Redis）
var chatRateLimit = {};
var CHAT_RATE_INTERVAL = 2000; // 同一 IP 最小间隔 2 秒
// 定时清理过期记录（每 5 分钟执行一次，防止内存泄漏）
setInterval(function() {
  var threshold = Date.now() - 60000;
  var keys = Object.keys(chatRateLimit);
  for (var i = 0; i < keys.length; i++) {
    if (chatRateLimit[keys[i]] < threshold) delete chatRateLimit[keys[i]];
  }
}, 5 * 60 * 1000);

router.post('/chat', async function(req, res) {
  try {
    // 限流检查
    var clientIp = req.ip || req.connection.remoteAddress || '';
    var now = Date.now();
    if (chatRateLimit[clientIp] && now - chatRateLimit[clientIp] < CHAT_RATE_INTERVAL) {
      return fail(res, '请求过于频繁，请稍后再试');
    }
    chatRateLimit[clientIp] = now;
    // 定期清理过期记录（每 100 次请求清理一次）
    if (Object.keys(chatRateLimit).length > 1000) {
      var threshold = now - 60000;
      Object.keys(chatRateLimit).forEach(function(k) { if (chatRateLimit[k] < threshold) delete chatRateLimit[k]; });
    }

    var message = (req.body.message || '').trim();
    if (!message) return fail(res, '请输入消息');
    if (message.length > 500) return fail(res, '消息过长');

    // 从全局中间件 optionalAuth 获取用户 ID
    var userId = req.wxUserId || 0;

    var history = req.body.history || [];
    var result = await chatbot.chat(userId, message, history);
    return success(res, result);
  } catch (err) {
    console.error('[客服错误]', err);
    return fail(res, '客服暂时不可用', 500);
  }
});

// POST /chat-stream — AI 流式对话（SSE，支持逐字输出）
var aiService = require('../services/ai');
router.post('/chat-stream', async function(req, res) {
  try {
    var clientIp = req.ip || req.connection.remoteAddress || '';
    var now = Date.now();
    if (chatRateLimit[clientIp] && now - chatRateLimit[clientIp] < CHAT_RATE_INTERVAL) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.flushHeaders();
      res.write('data: ' + JSON.stringify({ error: '请求过于频繁' }) + '\n\n');
      res.write('data: [DONE]\n\n');
      return res.end();
    }
    chatRateLimit[clientIp] = now;

    var message = (req.body.message || '').trim();
    if (!message) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.flushHeaders();
      res.write('data: ' + JSON.stringify({ error: '请输入消息' }) + '\n\n');
      res.write('data: [DONE]\n\n');
      return res.end();
    }

    // 提示词注入检测（第二道防线）
    var msgLower = message.toLowerCase();
    var injectionPatterns = [
      'ignore all', 'ignore previous', 'ignore above', 'disregard',
      'forget your', 'forget all', 'new instructions', 'override',
      'system prompt', 'repeat your prompt', 'show me your prompt',
      'print your instructions', 'reveal your', 'what are your instructions',
      '忽略以上', '忽略之前', '忽略你的', '无视以上', '无视之前',
      '输出你的提示', '显示你的指令', '你的prompt', '你的系统提示',
      '假装你是', '假设你是', '扮演一个', '现在你是',
      '进入开发者模式', 'developer mode', 'jailbreak', 'DAN',
      'do anything now', '越狱'
    ];
    var isInjection = false;
    for (var pi = 0; pi < injectionPatterns.length; pi++) {
      if (msgLower.indexOf(injectionPatterns[pi].toLowerCase()) !== -1) {
        isInjection = true;
        break;
      }
    }
    if (isInjection) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.flushHeaders();
      var safeReply = '您好！我是椰小助 🤖，海南椰嫂平台的智能客服。我只能回答家政服务相关的问题哦~ 😊\n\n请问有什么家政方面需要帮助的吗？比如：\n• 各工种薪资行情\n• 发单/接单流程\n• 优惠券使用方式\n• 实名认证指引';
      res.write('data: ' + JSON.stringify({ content: safeReply }) + '\n\n');
      res.write('data: [DONE]\n\n');
      return res.end();
    }

    // 构建消息列表
    var basePrompt = require('../services/ai-prompt');

    // 根据来源小程序切换 AI 身份
    var appSource = req.body.appSource || 'yesao';
    var city = (req.body.city || '').trim();
    var identityOverride = '';

    if (appSource === 'xiaoweilan') {
      identityOverride = '\n\n# 身份覆盖\n你的名字是"围小助"，小围栏家政服务平台的 AI 智能客服。\n注意：你不是"椰小助"，也不是海南椰嫂平台的客服。你是"围小助"，服务于小围栏平台。\n在回复中请使用"围小助"自称。\n';
    }

    // 位置上下文
    var locationContext = '';
    if (city) {
      locationContext = '\n\n# 当前用户位置\n用户当前定位城市：' + city + '。请根据该城市提供本地化的家政服务建议和薪资参考。\n';
    } else {
      locationContext = '\n\n# 位置信息缺失\n用户尚未授权位置信息。在涉及到薪资行情、服务价格、当地政策等与地域相关的问题时，请先礼貌询问用户所在的城市，以便提供更准确的本地化建议。\n例如："请问您是在哪个城市呢？不同城市的行情可能有所不同哦~ 😊"\n';
    }

    var finalPrompt = basePrompt + identityOverride + locationContext;

    var messages = [{ role: 'system', content: finalPrompt }];
    var history = req.body.history || [];
    var recentHistory = history.slice(-8);
    for (var i = 0; i < recentHistory.length; i++) {
      var h = recentHistory[i];
      if (h.role === 'user') {
        messages.push({ role: 'user', content: h.content });
      } else if (h.role === 'bot' || h.role === 'assistant') {
        messages.push({ role: 'assistant', content: h.content });
      }
    }
    messages.push({ role: 'user', content: message });

    // 调用流式 API
    await aiService.callLLMStream(res, messages, {
      temperature: 0.7,
      maxTokens: 500
    });
  } catch (err) {
    console.error('[流式客服错误]', err);
    if (!res.headersSent) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.flushHeaders();
    }
    res.write('data: ' + JSON.stringify({ error: '服务暂时不可用' }) + '\n\n');
    res.write('data: [DONE]\n\n');
    res.end();
  }
});

// POST /auth/submit — 提交实名认证（含 OCR 辅助）
var ocrService = require('../services/ocr');
router.post('/auth/submit', async function(req, res) {
  try {
    // 从全局中间件 optionalAuth 获取用户
    var userId = req.wxUserId || 0;
    if (!userId) return fail(res, '请先登录', 401);

    var user = await User.findByPk(userId);
    if (!user) return fail(res, '用户不存在', 404);

    var realName = (req.body.realName || '').trim();
    var idCard = (req.body.idCard || '').trim();
    var idCardFront = req.body.idCardFront || '';
    var idCardBack = req.body.idCardBack || '';

    if (!realName) return fail(res, '请输入真实姓名');
    if (realName.length > 20) return fail(res, '姓名长度不合法');
    if (!idCard || idCard.length !== 18) return fail(res, '请输入正确的身份证号');
    // 身份证号基本格式校验（17位数字+1位数字或X）
    if (!/^\d{17}[\dXx]$/.test(idCard)) return fail(res, '身份证号格式不正确');

    // 防重复提交
    if (user.isRealAuth) return fail(res, '您已通过实名认证，无需重复提交');
    if (user.authStatus === 'pending') return fail(res, '认证正在审核中，请耐心等待');

    // 尝试 OCR 识别
    var ocrResult = null;
    var comparison = null;
    if (idCardFront) {
      ocrResult = await ocrService.recognizeIdCard(idCardFront);
      comparison = ocrService.compareInfo(ocrResult, { realName: realName, idCard: idCard });
    }

    // 更新用户信息
    var updateData = {
      realName: realName,
      idCard: idCard,
      idCardFront: idCardFront,
      idCardBack: idCardBack
    };

    // 判断是否可以自动通过
    if (comparison && comparison.autoApprove) {
      // 高置信度自动通过
      updateData.authStatus = 'approved';
      updateData.isRealAuth = true;
      updateData.authRejectReason = '';
      await user.update(updateData);
      return success(res, {
        authStatus: 'approved',
        autoApproved: true,
        ocrMatch: comparison
      }, '实名认证已自动通过');
    }

    // 转人工审核
    updateData.authStatus = 'pending';
    await user.update(updateData);

    return success(res, {
      authStatus: 'pending',
      autoApproved: false,
      ocrMatch: comparison
    }, '认证已提交，等待审核');
  } catch (err) {
    console.error('[认证提交错误]', err);
    return fail(res, '提交失败: ' + err.message, 500);
  }
});

/**
 * ==================== 闺蜜圈系统 ====================
 *
 * 功能说明:
 *   阿姨可按工种创建闺蜜圈，邀请同行加入。
 *   圈内阿姨发送该工种订单时，系统优先匹配同圈成员。
 *
 * 业务规则:
 *   - 每人每工种最多创建1个圈子，可创建多个不同工种圈子
 *   - 每人每工种最多加入1个圈子
 *   - 每个圈子上限1000人
 *   - 圈主可踢人、解散、修改圈名、生成邀请码
 *   - 成员可退出
 *
 * 邀请方式:
 *   1. 永久邀请码（8位字母数字）— 用于链接分享和二维码
 *   2. 临时邀请码（6位字母数字）— 5分钟有效，防数据冲突
 *   3. 注册时自动加入 — wx-login 携带 circleId 参数
 *
 * 接口清单（小程序端，挂载在 /api/public 下）:
 *   GET    /guimi-circles/available-jobtypes     — 查询可创建圈子的工种
 *   POST   /guimi-circles                        — 创建闺蜜圈
 *   GET    /guimi-circles/my                     — 我的闺蜜圈（创建的+加入的）
 *   GET    /guimi-circles/invite-info/:inviteCode — 预览圈子信息（无需登录）
 *   GET    /guimi-circles/:id                    — 圈子详情（含成员列表）
 *   PUT    /guimi-circles/:id/name               — 修改圈名（仅圈主）
 *   DELETE /guimi-circles/:id                    — 解散圈子（仅圈主）
 *   POST   /guimi-circles/:id/generate-code      — 生成5分钟临时邀请码
 *   POST   /guimi-circles/join-by-code           — 通过临时码加入
 *   POST   /guimi-circles/join-by-link           — 通过永久邀请码加入
 *   POST   /guimi-circles/:id/leave              — 退出圈子（成员）
 *   POST   /guimi-circles/:id/kick               — 踢出成员（仅圈主）
 *   GET    /exchange-info                        — 积分兑换信息（地点+电话）
 */

// 生成随机字母数字码（排除易混淆字符 0OI1）
function generateRandomCode(length) {
  var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  var code = '';
  for (var i = 0; i < length; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// 可创建的工种列表（排除已创建的）
router.get('/guimi-circles/available-jobtypes', requireWxAuth, async function(req, res) {
  try {
    var userId = req.wxUserId;
    // 查询用户已创建的闺蜜圈工种
    var existingCircles = await GuimiCircle.findAll({
      where: { ownerId: userId, status: 'active' },
      attributes: ['jobTypeId']
    });
    var existingJobTypeIds = existingCircles.map(function(c) { return c.jobTypeId; });

    // 查询所有可用工种
    var where = { status: 'active' };
    if (existingJobTypeIds.length > 0) {
      where.id = { [Op.notIn]: existingJobTypeIds };
    }
    var jobTypes = await JobType.findAll({ where: where, order: [['sortOrder', 'DESC']] });
    return success(res, jobTypes);
  } catch (err) { return fail(res, '查询失败: ' + err.message, 500); }
});

// 创建闺蜜圈
router.post('/guimi-circles', requireWxAuth, async function(req, res) {
  try {
    var userId = req.wxUserId;
    var jobTypeId = parseInt(req.body.jobTypeId);
    if (!jobTypeId) return fail(res, '请选择工种');

    // 验证工种
    var jobType = await JobType.findByPk(jobTypeId);
    if (!jobType || jobType.status !== 'active') return fail(res, '无效的工种');

    // 校验：该工种是否已创建过
    var existing = await GuimiCircle.findOne({
      where: { ownerId: userId, jobTypeId: jobTypeId, status: 'active' }
    });
    if (existing) return fail(res, '您已创建过该工种的闺蜜圈');

    // 校验：该工种是否已加入别人的圈子
    var memberCheck = await GuimiCircleMember.findOne({
      where: { userId: userId },
      include: [{
        model: GuimiCircle, as: 'circle',
        where: { jobTypeId: jobTypeId, status: 'active' }
      }]
    });
    if (memberCheck) return fail(res, '您已加入该工种的其他闺蜜圈，请先退出后再创建');

    // 生成唯一邀请码（重试机制）
    var inviteCode = '';
    for (var i = 0; i < 10; i++) {
      inviteCode = generateRandomCode(8);
      var codeExists = await GuimiCircle.findOne({ where: { inviteCode: inviteCode } });
      if (!codeExists) break;
    }

    // 获取用户昵称
    var user = await User.findByPk(userId);
    var defaultName = (user ? user.nickname || '阿姨' : '阿姨') + '的' + jobType.name + '闺蜜圈';
    var circleName = (req.body.name || '').trim().slice(0, 50) || defaultName;

    // 创建圈子 + 圈主成员记录
    var circle = await GuimiCircle.create({
      ownerId: userId,
      jobTypeId: jobTypeId,
      name: circleName,
      inviteCode: inviteCode,
      memberCount: 1,
      maxMembers: 1000,
      status: 'active'
    });

    await GuimiCircleMember.create({
      circleId: circle.id,
      userId: userId,
      role: 'owner',
      joinedAt: new Date()
    });

    var result = circle.toJSON();
    result.jobType = jobType.toJSON();
    return success(res, result, '闺蜜圈创建成功');
  } catch (err) { return fail(res, '创建失败: ' + err.message, 500); }
});

// 我的闺蜜圈列表（创建的 + 加入的）
router.get('/guimi-circles/my', requireWxAuth, async function(req, res) {
  try {
    var userId = req.wxUserId;

    // 我创建的
    var owned = await GuimiCircle.findAll({
      where: { ownerId: userId, status: 'active' },
      include: [{ model: JobType, as: 'jobType', attributes: ['id', 'name', 'icon'] }],
      order: [['createdAt', 'DESC']]
    });

    // 我加入的（非圈主）
    var memberships = await GuimiCircleMember.findAll({
      where: { userId: userId, role: 'member' },
      include: [{
        model: GuimiCircle, as: 'circle',
        where: { status: 'active' },
        include: [
          { model: JobType, as: 'jobType', attributes: ['id', 'name', 'icon'] },
          { model: User, as: 'owner', attributes: ['id', 'nickname', 'avatar'] }
        ]
      }],
      order: [['joinedAt', 'DESC']]
    });

    var joined = memberships.map(function(m) {
      var item = m.circle.toJSON();
      item.joinedAt = m.joinedAt;
      return item;
    });

    return success(res, { owned: owned, joined: joined });
  } catch (err) { return fail(res, '查询失败: ' + err.message, 500); }
});

// 预览圈子信息（通过永久邀请码，无需登录）— 必须在 /:id 路由之前注册
router.get('/guimi-circles/invite-info/:inviteCode', async function(req, res) {
  try {
    var circle = await GuimiCircle.findOne({
      where: { inviteCode: req.params.inviteCode, status: 'active' },
      include: [
        { model: JobType, as: 'jobType', attributes: ['id', 'name', 'icon'] },
        { model: User, as: 'owner', attributes: ['id', 'nickname', 'avatar'] }
      ]
    });
    if (!circle) return fail(res, '闺蜜圈不存在或已解散', 404);
    return success(res, {
      circleId: circle.id,
      name: circle.name,
      ownerName: circle.owner ? circle.owner.nickname : '',
      ownerAvatar: circle.owner ? circle.owner.avatar : '',
      jobTypeName: circle.jobType ? circle.jobType.name : '',
      jobTypeIcon: circle.jobType ? circle.jobType.icon : '',
      memberCount: circle.memberCount,
      maxMembers: circle.maxMembers
    });
  } catch (err) { return fail(res, '查询失败: ' + err.message, 500); }
});

// 圈子详情（含成员列表）
router.get('/guimi-circles/:id', requireWxAuth, async function(req, res) {
  try {
    var circleId = parseInt(req.params.id);
    var circle = await GuimiCircle.findByPk(circleId, {
      include: [
        { model: JobType, as: 'jobType' },
        { model: User, as: 'owner', attributes: ['id', 'nickname', 'avatar'] }
      ]
    });
    if (!circle || circle.status !== 'active') return fail(res, '闺蜜圈不存在或已解散', 404);

    // 查成员列表
    var page = parseInt(req.query.page) || 1;
    var pageSize = parseInt(req.query.pageSize) || 20;
    var members = await GuimiCircleMember.findAndCountAll({
      where: { circleId: circleId },
      include: [{ model: User, as: 'user', attributes: ['id', 'nickname', 'avatar', 'phone', 'isRealAuth', 'city'] }],
      order: [['role', 'ASC'], ['joinedAt', 'ASC']],
      limit: pageSize,
      offset: (page - 1) * pageSize
    });

    var result = circle.toJSON();
    result.isOwner = (circle.ownerId === req.wxUserId);
    result.isMember = false;
    // 检查当前用户是否是成员
    var myMembership = await GuimiCircleMember.findOne({ where: { circleId: circleId, userId: req.wxUserId } });
    result.isMember = !!myMembership;
    result.members = {
      list: members.rows,
      total: members.count,
      page: page,
      pageSize: pageSize
    };

    return success(res, result);
  } catch (err) { return fail(res, '查询失败: ' + err.message, 500); }
});

// 修改圈名（仅圈主）
router.put('/guimi-circles/:id/name', requireWxAuth, async function(req, res) {
  try {
    var circle = await GuimiCircle.findByPk(req.params.id);
    if (!circle || circle.status !== 'active') return fail(res, '闺蜜圈不存在', 404);
    if (circle.ownerId !== req.wxUserId) return fail(res, '仅圈主可修改圈名', 403);
    var newName = (req.body.name || '').trim();
    if (!newName || newName.length > 50) return fail(res, '圈名不能为空且不超过50字');
    await circle.update({ name: newName });
    return success(res, circle, '圈名已修改');
  } catch (err) { return fail(res, '修改失败: ' + err.message, 500); }
});

// 解散圈子（仅圈主）
router.delete('/guimi-circles/:id', requireWxAuth, async function(req, res) {
  try {
    var circle = await GuimiCircle.findByPk(req.params.id);
    if (!circle || circle.status !== 'active') return fail(res, '闺蜜圈不存在', 404);
    if (circle.ownerId !== req.wxUserId) return fail(res, '仅圈主可解散闺蜜圈', 403);

    // 标记解散（不物理删除，保留历史数据）
    await circle.update({ status: 'disbanded' });
    // 清除所有成员关系
    await GuimiCircleMember.destroy({ where: { circleId: circle.id } });
    // 作废所有未使用的临时码
    await GuimiInviteCode.update({ used: true }, { where: { circleId: circle.id, used: false } });

    return success(res, null, '闺蜜圈已解散');
  } catch (err) { return fail(res, '操作失败: ' + err.message, 500); }
});

// 生成临时邀请码（5分钟有效）
router.post('/guimi-circles/:id/generate-code', requireWxAuth, async function(req, res) {
  try {
    var circle = await GuimiCircle.findByPk(req.params.id);
    if (!circle || circle.status !== 'active') return fail(res, '闺蜜圈不存在', 404);
    if (circle.ownerId !== req.wxUserId) {
      // 非圈主也可以生成邀请码（成员拉人）
      var membership = await GuimiCircleMember.findOne({ where: { circleId: circle.id, userId: req.wxUserId } });
      if (!membership) return fail(res, '您不是该圈子成员', 403);
    }

    // 生成6位临时码（重试防冲突）
    var code = '';
    var expireAt = new Date(Date.now() + 5 * 60 * 1000);
    for (var i = 0; i < 10; i++) {
      code = generateRandomCode(6);
      try {
        await GuimiInviteCode.create({
          circleId: circle.id,
          code: code,
          expireAt: expireAt,
          used: false
        });
        break;
      } catch (e) {
        // 唯一约束冲突，重试
        if (i === 9) return fail(res, '邀请码生成失败，请重试');
        code = '';
      }
    }

    return success(res, {
      code: code,
      expireAt: expireAt,
      circleName: circle.name,
      circleId: circle.id
    }, '邀请码已生成，5分钟内有效');
  } catch (err) { return fail(res, '生成失败: ' + err.message, 500); }
});

// 生成微信小程序码（通用接口）
// scene 参数: type=guimi&code=xxx 或 type=verify&code=xxx
router.post('/wxacode', requireWxAuth, async function(req, res) {
  try {
    var scene = req.body.scene; // 例如 "guimi_ABC123" 或 "verify_654321"
    var page = req.body.page || '';  // 跳转页面路径（可选）
    if (!scene) return fail(res, '缺少 scene 参数');

    // 获取 access_token
    var axios = require('axios');
    var appId = process.env.WX_APPID;
    var appSecret = process.env.WX_SECRET;

    // 根据来源选择对应 AppID（多小程序支持）
    if (req.body.appSource === 'xiaoweilan' && process.env.WX_APPID_XWL && process.env.WX_SECRET_XWL) {
      appId = process.env.WX_APPID_XWL;
      appSecret = process.env.WX_SECRET_XWL;
    }

    if (!appId || !appSecret) {
      return fail(res, '未配置小程序 AppID/AppSecret，无法生成小程序码');
    }

    // 1. 获取 access_token（简单实现，生产可加缓存）
    var tokenRes = await axios.get('https://api.weixin.qq.com/cgi-bin/token', {
      params: { grant_type: 'client_credential', appid: appId, secret: appSecret }
    });
    if (!tokenRes.data || !tokenRes.data.access_token) {
      console.error('[小程序码] 获取 access_token 失败:', tokenRes.data);
      return fail(res, '获取 access_token 失败');
    }
    var accessToken = tokenRes.data.access_token;

    // 2. 调用 wxacode.getUnlimited 生成小程序码
    var wxacodeRes = await axios.post(
      'https://api.weixin.qq.com/wxa/getwxacodeunlimit?access_token=' + accessToken,
      {
        scene: scene,        // 最大32字符
        page: page || undefined,
        width: 430,
        auto_color: false,
        line_color: { r: 255, g: 107, b: 107 },  // 主题红色
        is_hyaline: false
      },
      { responseType: 'arraybuffer' }
    );

    // 如果返回的是 JSON（报错），处理错误
    var contentType = wxacodeRes.headers['content-type'] || '';
    if (contentType.indexOf('json') > -1) {
      var errData = JSON.parse(Buffer.from(wxacodeRes.data).toString());
      console.error('[小程序码] 生成失败:', errData);
      return fail(res, '生成小程序码失败: ' + (errData.errmsg || '未知错误'));
    }

    // 返回 base64 图片
    var base64 = Buffer.from(wxacodeRes.data).toString('base64');
    return success(res, {
      image: 'data:image/png;base64,' + base64
    });
  } catch (err) {
    console.error('[小程序码] 异常:', err.message);
    return fail(res, '生成小程序码失败: ' + err.message, 500);
  }
});

// 通过临时邀请码加入
router.post('/guimi-circles/join-by-code', requireWxAuth, async function(req, res) {
  try {
    var userId = req.wxUserId;
    var code = (req.body.code || '').trim().toUpperCase();
    if (!code) return fail(res, '请输入邀请码');

    // 查找未使用且未过期的邀请码
    var invite = await GuimiInviteCode.findOne({
      where: { code: code, used: false, expireAt: { [Op.gt]: new Date() } },
      include: [{ model: GuimiCircle, as: 'circle' }]
    });
    if (!invite) return fail(res, '邀请码无效或已过期');
    if (!invite.circle || invite.circle.status !== 'active') return fail(res, '该闺蜜圈已解散');

    var circle = invite.circle;

    // 校验：是否已满
    if (circle.memberCount >= circle.maxMembers) return fail(res, '该闺蜜圈已满员');

    // 校验：是否已是成员
    var existing = await GuimiCircleMember.findOne({ where: { circleId: circle.id, userId: userId } });
    if (existing) return fail(res, '您已在该闺蜜圈中');

    // 校验：该工种是否已加入其他圈子
    var otherCircle = await GuimiCircleMember.findOne({
      where: { userId: userId },
      include: [{
        model: GuimiCircle, as: 'circle',
        where: { jobTypeId: circle.jobTypeId, status: 'active' }
      }]
    });
    if (otherCircle) return fail(res, '您已加入该工种的其他闺蜜圈，请先退出后再加入');

    // 加入
    await GuimiCircleMember.create({ circleId: circle.id, userId: userId, role: 'member', joinedAt: new Date() });
    await circle.increment('memberCount');
    // 标记邀请码已使用
    await invite.update({ used: true, usedBy: userId, usedAt: new Date() });

    return success(res, { circleId: circle.id, circleName: circle.name }, '加入成功');
  } catch (err) { return fail(res, '加入失败: ' + err.message, 500); }
});

// 通过链接/二维码加入（使用永久 inviteCode）
router.post('/guimi-circles/join-by-link', requireWxAuth, async function(req, res) {
  try {
    var userId = req.wxUserId;
    var inviteCode = (req.body.inviteCode || '').trim();
    var circleId = parseInt(req.body.circleId);

    var circle = null;
    if (inviteCode) {
      circle = await GuimiCircle.findOne({ where: { inviteCode: inviteCode, status: 'active' } });
    } else if (circleId) {
      circle = await GuimiCircle.findByPk(circleId);
      if (circle && circle.status !== 'active') circle = null;
    }
    if (!circle) return fail(res, '闺蜜圈不存在或已解散');

    // 校验
    if (circle.memberCount >= circle.maxMembers) return fail(res, '该闺蜜圈已满员');
    var existing = await GuimiCircleMember.findOne({ where: { circleId: circle.id, userId: userId } });
    if (existing) return fail(res, '您已在该闺蜜圈中');
    var otherCircle = await GuimiCircleMember.findOne({
      where: { userId: userId },
      include: [{
        model: GuimiCircle, as: 'circle',
        where: { jobTypeId: circle.jobTypeId, status: 'active' }
      }]
    });
    if (otherCircle) return fail(res, '您已加入该工种的其他闺蜜圈，请先退出后再加入');

    await GuimiCircleMember.create({ circleId: circle.id, userId: userId, role: 'member', joinedAt: new Date() });
    await circle.increment('memberCount');
    return success(res, { circleId: circle.id, circleName: circle.name }, '加入成功');
  } catch (err) { return fail(res, '加入失败: ' + err.message, 500); }
});


// 退出圈子
router.post('/guimi-circles/:id/leave', requireWxAuth, async function(req, res) {
  try {
    var userId = req.wxUserId;
    var circle = await GuimiCircle.findByPk(req.params.id);
    if (!circle || circle.status !== 'active') return fail(res, '闺蜜圈不存在', 404);
    if (circle.ownerId === userId) return fail(res, '圈主不能退出，请先解散闺蜜圈');

    var membership = await GuimiCircleMember.findOne({ where: { circleId: circle.id, userId: userId } });
    if (!membership) return fail(res, '您不在该闺蜜圈中');

    await membership.destroy();
    await circle.decrement('memberCount');
    return success(res, null, '已退出闺蜜圈');
  } catch (err) { return fail(res, '操作失败: ' + err.message, 500); }
});

// 踢出成员（仅圈主）
router.post('/guimi-circles/:id/kick', requireWxAuth, async function(req, res) {
  try {
    var circle = await GuimiCircle.findByPk(req.params.id);
    if (!circle || circle.status !== 'active') return fail(res, '闺蜜圈不存在', 404);
    if (circle.ownerId !== req.wxUserId) return fail(res, '仅圈主可踢人', 403);

    var targetUserId = parseInt(req.body.userId);
    if (!targetUserId) return fail(res, '请指定要踢出的成员');
    if (targetUserId === req.wxUserId) return fail(res, '不能踢出自己');

    var membership = await GuimiCircleMember.findOne({ where: { circleId: circle.id, userId: targetUserId } });
    if (!membership) return fail(res, '该用户不在闺蜜圈中');

    await membership.destroy();
    await circle.decrement('memberCount');

    // 通知被踢的用户
    await Message.create({
      userId: targetUserId,
      type: 'system',
      title: '已被移出闺蜜圈',
      content: '您已被移出"' + circle.name + '"闺蜜圈。',
      linkType: 'guimi_circle'
    });

    return success(res, null, '已踢出该成员');
  } catch (err) { return fail(res, '操作失败: ' + err.message, 500); }
});

// 积分兑换信息
router.get('/exchange-info', async function(req, res) {
  try {
    var settings = await SystemSetting.findAll({
      where: { key: { [Op.in]: ['points_exchange_address', 'points_exchange_phone', 'points_exchange_hours'] } }
    });
    var result = {};
    settings.forEach(function(s) { result[s.key] = s.value; });
    return success(res, {
      address: result.points_exchange_address || '请联系平台获取兑换地址',
      phone: result.points_exchange_phone || '请联系平台客服',
      hours: result.points_exchange_hours || '工作日 9:00-18:00'
    });
  } catch (err) { return fail(res, '查询失败', 500); }
});

module.exports = router;
