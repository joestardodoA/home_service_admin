/**
 * server/services/matchEngine.js — 智能订单匹配引擎（海南椰嫂综合平台）
 *
 * 纯规则引擎，零外部 API 成本
 *
 * 评分维度（权重总和上限 100）:
 *   - 工种匹配 (25分) — 候选人偏好工种是否包含订单工种
 *   - 城市匹配 (20分) — 候选人所在城市是否与订单一致
 *   - 薪资匹配 (15分) — 候选人期望薪资是否在订单范围内
 *   - 历史成功率 (15分) — 候选人历史接单成功率
 *   - 实名认证 (10分) — 是否完成实名认证
 *   - 后台管理评分 (15分) — 后台人工回访好评权重
 *
 * ⚠️ 权重总和限制：所有维度加权分数最高 100 分（不含闺蜜圈加权）
 *
 * 闺蜜圈加权:
 *   - 当发单阿姨拥有对应工种的闺蜜圈时，圈内成员额外加 15 分
 *   - 加权仅在该工种的闺蜜圈内生效，其他工种圈不加权
 *
 * 导出函数:
 *   matchOrderCandidates(orderId) — 对指定订单进行全量候选人匹配，返回排序后的推荐列表
 */

const { User, ServiceOrder, OrderApplication, JobType, GuimiCircle, GuimiCircleMember, sequelize } = require('../models');
const { Op } = require('sequelize');

// ==================== 评分维度权重（总和上限 100） ====================
const WEIGHTS = {
  jobType: 25,      // 工种匹配
  city: 20,         // 城市/地区匹配
  salary: 15,       // 薪资范围匹配
  successRate: 15,  // 历史接单成功率
  auth: 10,         // 实名认证加分
  adminScore: 15    // 后台管理评分（人工回访好评加权）
};

// 权重总和上限校验（防止配置错误导致超过 100）
var WEIGHT_SUM = Object.values(WEIGHTS).reduce(function(a, b) { return a + b; }, 0);
if (WEIGHT_SUM > 100) {
  console.error('❌ AI 匹配权重总和（' + WEIGHT_SUM + '）超过 100，将自动归一化');
}
var MAX_BASE_SCORE = 100; // 基础维度最高 100 分

// ==================== 工种匹配评分 ====================
function scoreJobType(order, candidate) {
  var preferredJobTypes = candidate.preferredJobTypes || [];
  if (!Array.isArray(preferredJobTypes)) {
    try { preferredJobTypes = JSON.parse(preferredJobTypes); } catch (e) { preferredJobTypes = []; }
  }

  // 精确匹配：候选人的意向工种包含该订单工种
  if (preferredJobTypes.indexOf(order.jobTypeId) !== -1) {
    return { score: WEIGHTS.jobType, reason: '工种精确匹配' };
  }

  // 候选人未设置意向工种，给一个基础分（不排除）
  if (preferredJobTypes.length === 0) {
    return { score: WEIGHTS.jobType * 0.3, reason: '未设置意向工种' };
  }

  // 工种不匹配
  return { score: 0, reason: '工种不匹配' };
}

// ==================== 城市匹配评分 ====================
function scoreCity(order, candidate) {
  var orderCity = (order.city || '').trim();
  var userCity = (candidate.city || '').trim();

  if (!orderCity || !userCity) {
    return { score: WEIGHTS.city * 0.2, reason: '城市信息不完整' };
  }

  // 精确匹配
  if (orderCity === userCity) {
    return { score: WEIGHTS.city, reason: '同城匹配' };
  }

  // 模糊匹配（如"海口市"包含"海口"）
  if (orderCity.indexOf(userCity) !== -1 || userCity.indexOf(orderCity) !== -1) {
    return { score: WEIGHTS.city * 0.9, reason: '城市模糊匹配' };
  }

  // 同省匹配（简单判断：取前两个字比较，如"海南海口"和"海南三亚"）
  if (orderCity.length >= 2 && userCity.length >= 2 && orderCity.slice(0, 2) === userCity.slice(0, 2)) {
    return { score: WEIGHTS.city * 0.5, reason: '同省匹配' };
  }

  return { score: 0, reason: '城市不匹配' };
}

// ==================== 薪资匹配评分 ====================
async function scoreSalary(order, candidate) {
  // 查询候选人历史接单的薪资范围
  var acceptedOrders = await ServiceOrder.findAll({
    where: { acceptedUserId: candidate.id, status: { [Op.in]: ['matched', 'completed'] } },
    attributes: ['salaryMin', 'salaryMax', 'salaryType'],
    limit: 10,
    order: [['createdAt', 'DESC']]
  });

  // 没有历史记录，给基础分
  if (acceptedOrders.length === 0) {
    return { score: WEIGHTS.salary * 0.5, reason: '无历史薪资参考' };
  }

  // 计算候选人历史薪资的平均范围
  var sameTypeOrders = acceptedOrders.filter(function (o) { return o.salaryType === order.salaryType; });
  if (sameTypeOrders.length === 0) sameTypeOrders = acceptedOrders;

  var avgMin = 0, avgMax = 0;
  for (var i = 0; i < sameTypeOrders.length; i++) {
    avgMin += sameTypeOrders[i].salaryMin;
    avgMax += sameTypeOrders[i].salaryMax;
  }
  avgMin = avgMin / sameTypeOrders.length;
  avgMax = avgMax / sameTypeOrders.length;

  // 计算薪资重叠度
  var overlapMin = Math.max(order.salaryMin, avgMin);
  var overlapMax = Math.min(order.salaryMax, avgMax);
  if (overlapMax <= overlapMin) {
    // 无重叠
    return { score: WEIGHTS.salary * 0.1, reason: '薪资范围不匹配' };
  }

  var overlapRange = overlapMax - overlapMin;
  var orderRange = Math.max(order.salaryMax - order.salaryMin, 1);
  var overlap = Math.min(overlapRange / orderRange, 1);

  return {
    score: Math.round(WEIGHTS.salary * overlap),
    reason: overlap > 0.7 ? '薪资高度匹配' : '薪资部分匹配'
  };
}

// ==================== 历史成功率评分 ====================
async function scoreSuccessRate(candidate) {
  var totalApps = await OrderApplication.count({ where: { userId: candidate.id } });

  // 没有历史申请，给中等分
  if (totalApps === 0) {
    return { score: WEIGHTS.successRate * 0.5, reason: '新用户(无历史记录)' };
  }

  var acceptedApps = await OrderApplication.count({ where: { userId: candidate.id, status: 'accepted' } });
  var rate = acceptedApps / totalApps;

  return {
    score: Math.round(WEIGHTS.successRate * rate),
    reason: '历史成功率 ' + Math.round(rate * 100) + '%（' + acceptedApps + '/' + totalApps + '）'
  };
}

// ==================== 实名认证评分 ====================
function scoreAuth(candidate) {
  if (candidate.isRealAuth) {
    return { score: WEIGHTS.auth, reason: '已实名认证' };
  }
  return { score: 0, reason: '未实名认证' };
}

// ==================== 后台管理评分 ====================
function scoreAdminScore(candidate) {
  var raw = candidate.adminScore || 0;
  if (raw <= 0) {
    return { score: 0, reason: '未设置管理评分' };
  }
  // adminScore 为 0-100 的人工打分，归一化到权重分
  var normalized = Math.round(WEIGHTS.adminScore * (raw / 100));
  return { score: normalized, reason: '管理评分 ' + raw + '/100' };
}

// ==================== 档期检查（一票否决） ====================
async function checkAvailability(candidate) {
  // 检查候选人是否有正在进行中的订单
  var activeCount = await ServiceOrder.count({
    where: {
      acceptedUserId: candidate.id,
      status: { [Op.in]: ['matched'] }
    }
  });
  return {
    available: activeCount === 0,
    activeOrderCount: activeCount
  };
}

// ==================== 单个候选人综合评分 ====================
async function scoreCandidate(order, candidate, guimiMemberIds) {
  // 1. 档期检查（一票否决）
  var availability = await checkAvailability(candidate);

  // 2. 各维度评分
  var jobTypeResult = scoreJobType(order, candidate);
  var cityResult = scoreCity(order, candidate);
  var salaryResult = await scoreSalary(order, candidate);
  var successRateResult = await scoreSuccessRate(candidate);
  var authResult = scoreAuth(candidate);
  var adminScoreResult = scoreAdminScore(candidate);

  // 3. 闺蜜圈加权（不计入 100 分上限）
  var guimiBonus = { score: 0, reason: '非圈内成员' };
  if (guimiMemberIds && guimiMemberIds.indexOf(candidate.id) !== -1) {
    guimiBonus = { score: 15, reason: '闺蜜圈成员加权' };
  }

  // 4. 汇总（基础分上限 100，闺蜜圈额外加权不受限）
  var baseScore = jobTypeResult.score + cityResult.score + salaryResult.score + successRateResult.score + authResult.score + adminScoreResult.score;
  // 归一化：如果权重配置总和超 100，按比例缩放
  if (WEIGHT_SUM > MAX_BASE_SCORE) {
    baseScore = Math.round(baseScore * MAX_BASE_SCORE / WEIGHT_SUM);
  }
  // 基础分最高 100
  if (baseScore > MAX_BASE_SCORE) baseScore = MAX_BASE_SCORE;
  var totalScore = baseScore + guimiBonus.score;

  // 5. 生成匹配标签
  var tags = [];
  if (guimiBonus.score > 0) tags.push('💕 闺蜜圈');
  if (jobTypeResult.score >= WEIGHTS.jobType * 0.8) tags.push('🎯 工种匹配');
  if (cityResult.score >= WEIGHTS.city * 0.8) tags.push('🏠 同城');
  if (salaryResult.score >= WEIGHTS.salary * 0.7) tags.push('💰 薪资匹配');
  if (successRateResult.score >= WEIGHTS.successRate * 0.6) tags.push('📈 高成功率');
  if (authResult.score > 0) tags.push('✅ 已实名');
  if (adminScoreResult.score > 0) tags.push('⭐ 好评');

  return {
    userId: candidate.id,
    nickname: candidate.nickname || '',
    avatar: candidate.avatar || '',
    phone: candidate.phone || '',
    realName: candidate.realName || '',
    city: candidate.city || '',
    memberLevel: candidate.memberLevel || 'normal',
    isRealAuth: candidate.isRealAuth || false,
    adminScore: candidate.adminScore || 0,
    totalScore: totalScore,
    baseScore: baseScore,
    maxScore: MAX_BASE_SCORE + 15,
    matchPercent: Math.round(baseScore),
    available: availability.available,
    activeOrderCount: availability.activeOrderCount,
    isGuimiMember: guimiBonus.score > 0,
    tags: tags,
    breakdown: {
      jobType: jobTypeResult,
      city: cityResult,
      salary: salaryResult,
      successRate: successRateResult,
      auth: authResult,
      adminScore: adminScoreResult,
      guimiCircle: guimiBonus
    }
  };
}

// ==================== 主入口：获取订单推荐列表 ====================
async function getRecommendations(orderId, topN) {
  if (!topN) topN = 15;

  // 1. 查询订单详情
  var order = await ServiceOrder.findByPk(orderId, {
    include: [{ model: JobType, as: 'jobType' }]
  });
  if (!order) {
    return { error: '订单不存在', recommendations: [] };
  }

  // 2. 查询发单人的闺蜜圈（同工种）
  var guimiMemberIds = [];
  try {
    var ownerCircle = await GuimiCircle.findOne({
      where: { ownerId: order.userId, jobTypeId: order.jobTypeId, status: 'active' }
    });
    if (ownerCircle) {
      var circleMembers = await GuimiCircleMember.findAll({
        where: { circleId: ownerCircle.id },
        attributes: ['userId']
      });
      guimiMemberIds = circleMembers.map(function(m) { return m.userId; });
    }
  } catch (e) {
    // 闺蜜圈查询失败不影响推荐
    console.error('[闺蜜圈查询失败]', e.message);
  }

  // 3. 查询候选人池
  // 排除：发单人自己 + 已申请过该订单的用户
  var existingApplicantIds = await OrderApplication.findAll({
    where: { orderId: orderId },
    attributes: ['userId']
  }).then(function (apps) { return apps.map(function (a) { return a.userId; }); });

  var excludeIds = [order.userId];
  for (var i = 0; i < existingApplicantIds.length; i++) {
    if (excludeIds.indexOf(existingApplicantIds[i]) === -1) {
      excludeIds.push(existingApplicantIds[i]);
    }
  }

  var candidates = await User.findAll({
    where: {
      id: { [Op.notIn]: excludeIds }
    },
    // 随机排序确保所有阿姨有平等被推荐的机会（避免只取前 200 条注册最早的用户）
    order: sequelize.random(),
    limit: 200  // 限制候选池大小，避免大量计算
  });

  // 4. 对每个候选人评分（传入闺蜜圈成员ID列表）
  var scoredCandidates = [];
  for (var j = 0; j < candidates.length; j++) {
    var result = await scoreCandidate(order, candidates[j], guimiMemberIds);
    scoredCandidates.push(result);
  }

  // 5. 按分数排序（档期不可用的排在最后）
  scoredCandidates.sort(function (a, b) {
    // 可用的排前面
    if (a.available && !b.available) return -1;
    if (!a.available && b.available) return 1;
    // 同等可用性按分数降序
    return b.totalScore - a.totalScore;
  });

  // 6. 取 top N
  var recommendations = scoredCandidates.slice(0, topN);

  // 7. 已有申请人信息（补充展示）
  var existingApplicants = [];
  if (existingApplicantIds.length > 0) {
    var apps = await OrderApplication.findAll({
      where: { orderId: orderId },
      include: [{ model: User, as: 'applicant', attributes: ['id', 'nickname', 'avatar', 'phone', 'city', 'isRealAuth', 'memberLevel'] }],
      order: [['createdAt', 'ASC']]
    });
    existingApplicants = apps.map(function (a) {
      return {
        applicationId: a.id,
        status: a.status,
        userId: a.userId,
        nickname: a.applicant ? a.applicant.nickname : '',
        avatar: a.applicant ? a.applicant.avatar : '',
        message: a.message,
        createdAt: a.createdAt
      };
    });
  }

  return {
    orderId: order.id,
    orderNo: order.orderNo,
    jobTypeName: order.jobType ? order.jobType.name : '',
    totalCandidates: candidates.length,
    guimiCircleMemberCount: guimiMemberIds.length,
    recommendations: recommendations,
    existingApplicants: existingApplicants,
    weights: WEIGHTS
  };
}

module.exports = {
  getRecommendations: getRecommendations,
  scoreCandidate: scoreCandidate,
  WEIGHTS: WEIGHTS
};
