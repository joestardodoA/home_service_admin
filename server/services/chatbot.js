// server/services/chatbot.js — AI 智能客服（海南椰嫂综合平台）
// 基于 Function Calling 的智能客服，可查询平台业务数据

var aiService = require('./ai');
var { JobType, ServiceOrder, User, Coupon } = require('../models');
var { Op } = require('sequelize');

// ==================== 可调用的工具函数 ====================

var TOOLS = {
  // 查询工种薪资行情
  query_salary: {
    description: '查询某个工种的薪资行情和市场数据',
    handler: async function(params) {
      var jobTypes = await JobType.findAll({ where: { status: 'active' } });
      var target = null;
      for (var i = 0; i < jobTypes.length; i++) {
        if (jobTypes[i].name.indexOf(params.jobType || '') !== -1) {
          target = jobTypes[i]; break;
        }
      }
      if (!target) {
        return '抱歉，没有找到「' + (params.jobType || '') + '」这个工种。目前平台有以下工种：' +
          jobTypes.map(function(j) { return j.name; }).join('、');
      }
      // 查询该工种订单统计
      var activeOrders = await ServiceOrder.count({
        where: { jobTypeId: target.id, status: { [Op.in]: ['approved', 'assigned', 'matching'] } }
      });
      var completedOrders = await ServiceOrder.count({
        where: { jobTypeId: target.id, status: 'completed' }
      });
      // 查询薪资范围
      var orders = await ServiceOrder.findAll({
        where: { jobTypeId: target.id, status: { [Op.in]: ['approved', 'matched', 'completed'] } },
        attributes: ['salaryMin', 'salaryMax'],
        limit: 50,
        order: [['createdAt', 'DESC']]
      });
      var avgMin = 0, avgMax = 0;
      if (orders.length > 0) {
        for (var k = 0; k < orders.length; k++) {
          avgMin += orders[k].salaryMin;
          avgMax += orders[k].salaryMax;
        }
        avgMin = Math.round(avgMin / orders.length);
        avgMax = Math.round(avgMax / orders.length);
      }
      return '【' + target.name + '】行情数据：\n' +
        '• 当前在招订单: ' + activeOrders + ' 个\n' +
        '• 累计完成: ' + completedOrders + ' 单\n' +
        '• 参考薪资范围: ' + (avgMin || '暂无数据') + ' - ' + (avgMax || '暂无数据') + ' 元/月\n' +
        '如需了解更多，可以直接在订单页查看详情。';
    }
  },

  // 查询用户订单状态
  query_order: {
    description: '查询用户的订单状态',
    handler: async function(params, userId) {
      if (!userId) return '您还未登录，无法查询订单。请先登录后再试。';
      var where = { userId: userId };
      if (params.status) where.status = params.status;
      var orders = await ServiceOrder.findAll({
        where: where,
        include: [{ model: JobType, as: 'jobType' }],
        order: [['createdAt', 'DESC']],
        limit: 5
      });
      if (orders.length === 0) {
        return '您暂时没有相关订单记录。\n可以在订单页点击"我要发单"或"我要接单"开始使用。';
      }
      var statusMap = { pending: '待审核', approved: '公域池', assigned: '已分配', matching: '匹配中', matched: '已派单', completed: '已完成', rejected: '已拒绝' };
      var lines = orders.map(function(o, idx) {
        return (idx + 1) + '. ' + (o.jobType ? o.jobType.name : '未知') + ' | ' +
          (statusMap[o.status] || o.status) + ' | ' + o.city + ' | ' +
          o.salaryMin + '-' + o.salaryMax + '元';
      });
      return '您最近的订单：\n' + lines.join('\n');
    }
  },

  // 查询优惠券
  query_coupon: {
    description: '查询当前可用的优惠券',
    handler: async function() {
      var coupons = await Coupon.findAll({
        where: { status: 'active', remainCount: { [Op.gt]: 0 } },
        limit: 5,
        order: [['sortOrder', 'DESC']]
      });
      if (coupons.length === 0) {
        return '当前暂无可领取的优惠券，请关注首页活动动态。';
      }
      var lines = coupons.map(function(c) {
        return '🎫 ' + c.title + ' - ' + (c.valueText || c.value + '元') + (c.subtitle ? ' (' + c.subtitle + ')' : '');
      });
      return '当前可领取的优惠券：\n' + lines.join('\n') + '\n\n在首页可以直接领取哦！';
    }
  },

  // 引导实名认证
  guide_auth: {
    description: '引导用户完成实名认证',
    handler: async function(params, userId) {
      var user = await User.findByPk(userId);
      if (!user) return '请先登录。';
      if (user.isRealAuth) return '您已经完成实名认证了！✅';
      if (user.authStatus === 'pending') return '您的实名认证正在审核中，请耐心等待。';
      if (user.authStatus === 'rejected') {
        return '您的实名认证被退回了。\n原因：' + (user.authRejectReason || '信息不完整') +
          '\n请在"个人中心 → 实名认证"中重新提交。';
      }
      return '实名认证流程：\n1. 进入"个人中心"\n2. 点击"实名认证"\n3. 填写真实姓名和身份证号\n4. 上传身份证正反面照片\n5. 提交后等待审核（通常1个工作日内）\n\n完成实名认证后，接单和发单会更受信任哦！';
    }
  }
};

// ==================== 主对话函数 ====================

/**
 * AI 客服对话
 * @param {number} userId - 当前用户 ID
 * @param {string} message - 用户消息
 * @param {Array} history - 对话历史 [{role, content}]
 * @returns {Promise<Object>} - { reply, suggestedQuestions }
 */
async function chat(userId, message, history) {
  if (!history) history = [];

  // 检查是否有真实 AI Key 可用
  var hasRealAI = aiService.AI_CONFIG.provider !== 'mock' && aiService.AI_CONFIG.apiKey;

  if (hasRealAI) {
    // ===== 真实 LLM 模式 =====
    var systemPrompt = require('./ai-prompt');

    var messages = [{ role: 'system', content: systemPrompt }];
    // 取最近8轮历史
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

    try {
      var reply = await aiService.callLLM(systemPrompt, message, {
        temperature: 0.7,
        maxTokens: 500,
        messages: messages
      });

      return {
        reply: reply,
        suggestedQuestions: generateSuggestions(message)
      };
    } catch (err) {
      console.error('[AI 调用失败，降级到 Mock]', err.message);
      // 降级到 Mock
      return mockChat(userId, message);
    }
  }

  // ===== Mock 模式 =====
  return mockChat(userId, message);
}

/**
 * Mock 模式的关键词客服
 */
async function mockChat(userId, message) {
  var msg = message.toLowerCase();
  var reply = '';
  var suggested = ['月嫂多少钱？', '怎么发单？', '怎么实名认证？', '查看我的订单'];

  // 关键词匹配
  if (msg.indexOf('价格') !== -1 || msg.indexOf('多少钱') !== -1 || msg.indexOf('薪资') !== -1 || msg.indexOf('行情') !== -1) {
    // 尝试匹配工种
    var jobType = '';
    var keywords = ['月嫂', '育儿嫂', '保洁', '保姆', '护工', '钟点工'];
    for (var i = 0; i < keywords.length; i++) {
      if (msg.indexOf(keywords[i]) !== -1) { jobType = keywords[i]; break; }
    }
    if (jobType) {
      reply = await TOOLS.query_salary.handler({ jobType: jobType });
    } else {
      reply = '请问您想了解哪个工种的价格呢？\n目前平台提供：月嫂、育儿嫂、保洁、家务、养老护理等工种的服务。';
    }
    suggested = ['月嫂多少钱？', '育儿嫂行情', '保洁价格', '怎么发单？'];
  } else if (msg.indexOf('发单') !== -1 || msg.indexOf('找阿姨') !== -1 || msg.indexOf('请阿姨') !== -1) {
    reply = '发单很简单哦！😊\n\n1. 进入"订单"页面\n2. 点击底部"📝 我要发单"按钮\n3. 填写需求（工种、城市、薪资等）\n💡 新功能：支持"一句话发单"，AI 帮你自动填写表单！\n4. 提交后等待平台为您匹配合适的阿姨\n\n如有紧急需求，可以在备注中说明哦！';
    suggested = ['月嫂多少钱？', '怎么接单？', '怎么实名认证？'];
  } else if (msg.indexOf('接单') !== -1 || msg.indexOf('找工作') !== -1) {
    reply = '接单流程：\n\n1. 进入"订单"页面\n2. 点击底部"🙋 我要接单"按钮\n3. 填写您的意向工种、期望薪资等信息\n4. 提交后平台会为您匹配合适的订单\n\n💡 建议先完成实名认证，可以大大提高匹配成功率！';
    suggested = ['怎么实名认证？', '查看我的订单', '月嫂多少钱？'];
  } else if (msg.indexOf('认证') !== -1 || msg.indexOf('实名') !== -1) {
    reply = await TOOLS.guide_auth.handler({}, userId);
    suggested = ['怎么发单？', '怎么接单？', '查看优惠券'];
  } else if (msg.indexOf('订单') !== -1 || msg.indexOf('查询') !== -1 || msg.indexOf('状态') !== -1) {
    reply = await TOOLS.query_order.handler({}, userId);
    suggested = ['怎么发单？', '月嫂多少钱？', '查看优惠券'];
  } else if (msg.indexOf('优惠') !== -1 || msg.indexOf('券') !== -1 || msg.indexOf('活动') !== -1) {
    reply = await TOOLS.query_coupon.handler();
    suggested = ['怎么发单？', '月嫂多少钱？', '怎么实名认证？'];
  } else if (msg.indexOf('你好') !== -1 || msg.indexOf('hi') !== -1 || msg.indexOf('hello') !== -1 || msg.indexOf('在吗') !== -1) {
    reply = '您好！我是椰小助 🤖，海南椰嫂平台的智能客服。\n\n我可以帮您：\n• 查询工种行情和薪资参考\n• 了解发单/接单流程\n• 查询订单状态\n• 引导实名认证\n• 推荐优惠活动\n\n请问有什么可以帮您的？';
  } else if (msg.indexOf('人工') !== -1 || msg.indexOf('转接') !== -1 || msg.indexOf('客服') !== -1) {
    reply = '如需人工客服，请拨打平台热线：\n📞 400-XXX-XXXX（工作日 9:00-18:00）\n\n或者在"个人中心"中联系在线客服。';
    suggested = ['月嫂多少钱？', '怎么发单？', '怎么实名认证？'];
  } else {
    reply = '感谢您的提问！😊\n\n我目前可以帮您解答以下问题：\n• 工种行情和薪资（如"月嫂多少钱"）\n• 发单/接单流程\n• 订单查询\n• 实名认证\n• 优惠活动\n\n如果我无法解答，建议您联系人工客服获取更专业的帮助。';
  }

  return {
    reply: reply,
    suggestedQuestions: suggested
  };
}

// 根据用户消息动态生成推荐问题
function generateSuggestions(message) {
  var msg = (message || '').toLowerCase();
  if (msg.indexOf('月嫂') !== -1) return ['月嫂需要什么证书？', '月嫂薪资多少？', '怎么发单找月嫂？'];
  if (msg.indexOf('保洁') !== -1) return ['保洁价格怎么算？', '开荒保洁多少钱？', '怎么找靠谱保洁？'];
  if (msg.indexOf('育儿') !== -1 || msg.indexOf('育婴') !== -1) return ['育儿嫂和月嫂有什么区别？', '育儿嫂薪资多少？', '怎么发单？'];
  if (msg.indexOf('价格') !== -1 || msg.indexOf('多少钱') !== -1) return ['怎么发单？', '怎么接单？', '查看优惠券'];
  if (msg.indexOf('发单') !== -1) return ['月嫂多少钱？', '怎么接单？', '查看我的订单'];
  return ['月嫂多少钱？', '怎么发单？', '怎么实名认证？'];
}

module.exports = {
  chat: chat,
  TOOLS: TOOLS
};
