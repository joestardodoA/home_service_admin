/**
 * server/utils/circleEvent.js — 闺蜜圈事件记录工具（海南椰嫂综合平台）
 *
 * 统一入口：在各业务逻辑中调用 recordCircleEvent() 即可自动：
 *   1. 查找用户所在的活跃圈子
 *   2. 写入事件记录
 *   3. 触发微信订阅消息推送给圈主（预留接口）
 */
const { GuimiCircleMember, GuimiCircleEvent, GuimiCircle, User } = require('../models');

// 事件类型中文映射（用于推送通知）
var EVENT_LABELS = {
  member_apply: '有人申请加入',
  member_join: '新成员加入',
  member_leave_request: '成员申请退出',
  member_left: '成员已退出',
  member_retained: '成员取消退出',
  member_rejected: '申请被拒绝',
  order_published: '成员发布了订单',
  order_accepted: '成员接到了订单',
  coupon_claimed: '成员领取了优惠券',
  coupon_verified: '成员核销了优惠券'
};

/**
 * 记录圈子事件（核心函数）
 *
 * @param {number} circleId  - 圈子 ID（已知圈子时直接传入）
 * @param {number} userId    - 触发事件的用户 ID
 * @param {string} eventType - 事件类型（枚举值）
 * @param {number} [targetId]   - 关联对象 ID（订单/优惠券 ID）
 * @param {string} [targetInfo] - 摘要信息
 */
async function recordCircleEvent(circleId, userId, eventType, targetId, targetInfo) {
  try {
    await GuimiCircleEvent.create({
      circleId: circleId,
      userId: userId,
      eventType: eventType,
      targetId: targetId || null,
      targetInfo: targetInfo || ''
    });

    // 触发微信订阅消息推送给圈主（预留）
    try {
      await pushToCircleOwner(circleId, userId, eventType, targetInfo);
    } catch (pushErr) {
      console.error('[圈子推送失败]', pushErr.message);
    }
  } catch (err) {
    // 事件记录失败不阻断主业务流程
    console.error('[圈子事件记录失败]', err.message);
  }
}

/**
 * 按用户 ID 自动查找所在圈子并记录事件
 * 适用于业务埋点：发单/接单/领券/核销时，不知道具体 circleId
 *
 * @param {number} userId    - 用户 ID
 * @param {string} eventType - 事件类型
 * @param {number} [targetId]   - 关联对象 ID
 * @param {string} [targetInfo] - 摘要信息
 * @param {number} [jobTypeId]  - 工种 ID（可选，用于精确匹配圈子）
 */
async function recordEventByUser(userId, eventType, targetId, targetInfo, jobTypeId) {
  try {
    // 查找该用户所有活跃的成员记录
    var where = { userId: userId, status: 'active' };
    var members = await GuimiCircleMember.findAll({
      where: where,
      include: [{ model: GuimiCircle, as: 'circle', attributes: ['id', 'jobTypeId', 'status'] }]
    });

    // 过滤出活跃圈子
    var activeMembers = members.filter(function(m) {
      return m.circle && m.circle.status === 'active';
    });

    // 如果指定了工种，精确匹配
    if (jobTypeId) {
      activeMembers = activeMembers.filter(function(m) {
        return m.circle.jobTypeId === jobTypeId;
      });
    }

    // 为每个所在圈子记录事件
    for (var i = 0; i < activeMembers.length; i++) {
      await recordCircleEvent(activeMembers[i].circleId, userId, eventType, targetId, targetInfo);
    }
  } catch (err) {
    console.error('[圈子事件自动记录失败]', err.message);
  }
}

/**
 * 推送微信订阅消息给圈主（预留实现）
 * 需要配置微信小程序订阅消息模板 ID
 */
async function pushToCircleOwner(circleId, userId, eventType, targetInfo) {
  // 查询圈主信息
  var circle = await GuimiCircle.findByPk(circleId, {
    include: [{ model: User, as: 'owner', attributes: ['id', 'openid', 'nickname'] }]
  });
  if (!circle || !circle.owner || !circle.owner.openid) return;

  // 查询触发用户昵称
  var triggerUser = await User.findByPk(userId, { attributes: ['nickname', 'realName'] });
  var userName = triggerUser ? (triggerUser.realName || triggerUser.nickname || '未知用户') : '未知用户';
  var label = EVENT_LABELS[eventType] || '圈子动态';

  // TODO: 调用微信 subscribeMessage.send API
  // 需要在微信公众平台申请订阅消息模板，配置以下参数：
  // - template_id: 圈子动态通知模板 ID
  // - touser: circle.owner.openid
  // - data: { thing1: { value: circle.name }, thing2: { value: userName + label }, time3: { value: new Date().toLocaleString() } }
  //
  // 示例代码（需要配合 access_token 获取模块）：
  // var axios = require('axios');
  // var accessToken = await getAccessToken();
  // await axios.post('https://api.weixin.qq.com/cgi-bin/message/subscribe/send?access_token=' + accessToken, {
  //   touser: circle.owner.openid,
  //   template_id: process.env.WX_CIRCLE_EVENT_TEMPLATE_ID,
  //   data: { ... }
  // });

  console.log('[圈子推送预留]', circle.name, '→', circle.owner.nickname, ':', userName, label, targetInfo || '');
}

/**
 * 处理 7 天冷静期到期的成员（定时调用）
 * 将 status='leaving' 且 leaveRequestAt 超过 7 天的成员标记为 'left'
 */
async function processExpiredLeaving() {
  var { Op } = require('sequelize');
  var sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  var expiredMembers = await GuimiCircleMember.findAll({
    where: {
      status: 'leaving',
      leaveRequestAt: { [Op.lt]: sevenDaysAgo }
    }
  });

  for (var i = 0; i < expiredMembers.length; i++) {
    var member = expiredMembers[i];
    await member.update({ status: 'left' });
    // 更新圈子成员数
    await GuimiCircle.decrement('memberCount', { where: { id: member.circleId } });
    // 记录退出事件
    await recordCircleEvent(member.circleId, member.userId, 'member_left', null, '冷静期结束，已正式退出');
  }

  if (expiredMembers.length > 0) {
    console.log('[冷静期处理] 已处理', expiredMembers.length, '名到期退出成员');
  }
}

module.exports = {
  recordCircleEvent: recordCircleEvent,
  recordEventByUser: recordEventByUser,
  processExpiredLeaving: processExpiredLeaving,
  EVENT_LABELS: EVENT_LABELS
};
