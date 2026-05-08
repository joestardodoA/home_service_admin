// server/models/GuimiCircleEvent.js — 闺蜜圈事件流模型（海南椰嫂综合平台）
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const GuimiCircleEvent = sequelize.define('GuimiCircleEvent', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },

  // 所属圈子
  circleId: { type: DataTypes.INTEGER, allowNull: false },

  // 触发事件的用户
  userId: { type: DataTypes.INTEGER, allowNull: false },

  // 事件类型
  eventType: {
    type: DataTypes.ENUM(
      'member_apply',        // 有人申请加入
      'member_join',         // 成员正式加入（审批通过）
      'member_leave_request',// 成员申请退出
      'member_left',         // 成员正式退出（冷静期结束）
      'member_retained',     // 成员取消退出（被挽回）
      'member_rejected',     // 申请被拒绝
      'order_published',     // 成员发单了
      'order_accepted',      // 成员接单了
      'coupon_claimed',      // 成员领券了
      'coupon_verified'      // 成员核销了
    ),
    allowNull: false
  },

  // 关联对象 ID（如订单 ID、优惠券 ID）
  targetId: { type: DataTypes.INTEGER, allowNull: true },

  // 摘要信息（如 "月嫂订单 YS20260427001"）
  targetInfo: { type: DataTypes.STRING(500), defaultValue: '' },

  // 圈主是否已读
  isRead: { type: DataTypes.BOOLEAN, defaultValue: false }
}, {
  tableName: 'guimi_circle_events',
  updatedAt: false, // 事件不需要 updatedAt
  indexes: [
    { fields: ['circleId', 'createdAt'] },
    { fields: ['circleId', 'isRead'] },
    { fields: ['userId'] }
  ]
});

module.exports = GuimiCircleEvent;
