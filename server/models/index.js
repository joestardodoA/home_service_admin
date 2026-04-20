// server/models/index.js — 模型注册与关联（海南椰嫂综合平台）
const sequelize = require('../config/database');
const Admin = require('./Admin');
const Coupon = require('./Coupon');
const Agency = require('./Agency');
const AgencyCourse = require('./AgencyCourse');
const CouponOrder = require('./CouponOrder');
const User = require('./User');
const Article = require('./Article');
const Banner = require('./Banner');
const Commission = require('./Commission');
const OperationLog = require('./OperationLog');


// Phase 2 新增
const ShareRecord = require('./ShareRecord');

// Phase 3 新增
const JobType = require('./JobType');
const ServiceOrder = require('./ServiceOrder');
const OrderApplication = require('./OrderApplication');

// Phase 4 新增
const Message = require('./Message');
const SubscriptionSetting = require('./SubscriptionSetting');

// Phase 5 新增
const SystemSetting = require('./SystemSetting');

// === 机构关联 ===
Agency.hasMany(AgencyCourse, { as: 'courses', foreignKey: 'agencyId' });
AgencyCourse.belongsTo(Agency, { foreignKey: 'agencyId' });

// === 优惠券订单关联 ===
CouponOrder.belongsTo(Coupon, { as: 'coupon', foreignKey: 'couponId' });
CouponOrder.belongsTo(Agency, { as: 'agency', foreignKey: 'agencyId' });
CouponOrder.belongsTo(User, { as: 'user', foreignKey: 'userId' });
CouponOrder.belongsTo(User, { as: 'sharer', foreignKey: 'sharerId' });
CouponOrder.belongsTo(ShareRecord, { as: 'shareRecord', foreignKey: 'shareRecordId' });

// === 佣金关联（直接关联 User） ===
Commission.belongsTo(User, { as: 'user', foreignKey: 'userId' });
Commission.belongsTo(User, { as: 'referUser', foreignKey: 'referUserId' });
Commission.belongsTo(CouponOrder, { as: 'couponOrder', foreignKey: 'couponOrderId' });
Commission.belongsTo(ServiceOrder, { as: 'serviceOrder', foreignKey: 'serviceOrderId' });
User.hasMany(Commission, { as: 'commissions', foreignKey: 'userId' });

// === 用户锁粉关联 ===
User.belongsTo(User, { as: 'inviter', foreignKey: 'inviterId' });
User.hasMany(User, { as: 'fans', foreignKey: 'inviterId' });

// === 分享记录关联 ===
ShareRecord.belongsTo(User, { as: 'sharer', foreignKey: 'sharerId' });
User.hasMany(ShareRecord, { as: 'shares', foreignKey: 'sharerId' });

// === 服务订单关联 ===
ServiceOrder.belongsTo(User, { as: 'publisher', foreignKey: 'userId' });
ServiceOrder.belongsTo(JobType, { as: 'jobType', foreignKey: 'jobTypeId' });
ServiceOrder.belongsTo(User, { as: 'acceptedUser', foreignKey: 'acceptedUserId' });
ServiceOrder.belongsTo(ShareRecord, { as: 'shareRecord', foreignKey: 'shareRecordId' });
ServiceOrder.hasMany(OrderApplication, { as: 'applications', foreignKey: 'orderId' });
User.hasMany(ServiceOrder, { as: 'publishedOrders', foreignKey: 'userId' });
JobType.hasMany(ServiceOrder, { as: 'orders', foreignKey: 'jobTypeId' });

// === 接单申请关联 ===
OrderApplication.belongsTo(ServiceOrder, { as: 'order', foreignKey: 'orderId' });
OrderApplication.belongsTo(User, { as: 'applicant', foreignKey: 'userId' });
OrderApplication.belongsTo(User, { as: 'sharer', foreignKey: 'sharerId' });
OrderApplication.belongsTo(ShareRecord, { as: 'shareRecord', foreignKey: 'shareRecordId' });
User.hasMany(OrderApplication, { as: 'applications', foreignKey: 'userId' });

// === 消息关联 ===
Message.belongsTo(User, { as: 'user', foreignKey: 'userId' });
User.hasMany(Message, { as: 'messages', foreignKey: 'userId' });

// === 订阅设置关联 ===
SubscriptionSetting.belongsTo(User, { as: 'user', foreignKey: 'userId' });
User.hasOne(SubscriptionSetting, { as: 'subscription', foreignKey: 'userId' });

module.exports = {
  sequelize, Admin, Coupon, Agency, AgencyCourse,
  CouponOrder, User, Article, Banner,
  Commission, OperationLog,
  ShareRecord, JobType, ServiceOrder, OrderApplication,
  Message, SubscriptionSetting, SystemSetting
};
