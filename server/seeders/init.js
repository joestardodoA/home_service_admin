// server/seeders/init.js — 种子数据（海南椰嫂综合平台）
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');
const {
  sequelize, Admin, Coupon, Agency, AgencyCourse, CouponOrder, User, Article, Banner,
  Commission, OperationLog, ShareRecord, JobType, ServiceOrder, OrderApplication,
  Message, SubscriptionSetting
} = require('../models');

async function seed() {
  // 删除旧数据库文件，避免外键约束问题
  var dbPath = path.join(__dirname, '..', 'database.sqlite');
  if (fs.existsSync(dbPath)) {
    fs.unlinkSync(dbPath);
    console.log('已清理旧数据库');
  }
  await sequelize.sync({ force: true });
  console.log('数据表已创建');

  var pwd = await bcrypt.hash('admin123', 10);
  await Admin.bulkCreate([
    { username: 'admin', password: pwd, realName: '超级管理员', role: 'super', permissions: '[]' },
    { username: 'operator1', password: pwd, realName: '运营小张', role: 'operator', permissions: JSON.stringify(['coupons:manage', 'orders:manage', 'articles:manage', 'banners:manage', 'service_orders:manage']) },
    { username: 'auditor1', password: pwd, realName: '审核小李', role: 'auditor', permissions: JSON.stringify(['users:manage', 'orders:manage', 'service_orders:manage']) }
  ]);

  // 优惠券详情页数据
  var defaultHighlights = JSON.stringify([
    { icon: 'star', title: '海量学员', desc: '机构资源多' },
    { icon: 'book', title: '精品课程', desc: '课程覆盖全' },
    { icon: 'cert', title: '证书可靠', desc: '政府认证权威' }
  ]);
  var defaultBenefits = JSON.stringify([
    { title: '免费学习', desc: '完全免费的政府培训课程，上岗就业的第一步。所有费用政府承担。' },
    { title: '权威证书', desc: '结业后颁发人社部门认可的职业技能等级证书，含金量高，全国通用。' },
    { title: '政府补贴', desc: '享受政府补贴支持。学费减免还享受生活补贴，为劳动者减轻负担。' },
    { title: '推荐就业', desc: '优秀学员推荐知名家政公司面试就业。已帮助数千名学员成功上岗。' }
  ]);
  var defaultConditions = JSON.stringify([
    '年龄要求：不超过法定退休年龄（女50/55周岁，男60周岁）。',
    '身份证明：持有有效居民身份证，且属当地社保缴纳区域。',
    '就业状态：初次求职者、失业人员、农村转移就业劳动力优先。',
    '健康要求：身体健康，能够正常参加培训及相关实操课程。'
  ]);

  // 机构
  var a1 = await Agency.create({ name: '椰城家政培训中心', address: '海口市龙华区国贸大道88号', lat: 20.017, lng: 110.349, phone: '400-123-4567', score: 4.9, reviewCount: 2341, tags: JSON.stringify(['平台认证','专业师资','金牌服务']), status: 'active', intro: '椰城家政成立于2019年，是海南领先的家政服务综合运营商。', businessHours: '周一至周日 08:30-18:00', bookingNote: '建议提前2-3天进行预约', qualification: '营业执照已验证', gallery: JSON.stringify([]), exchangeNotes: JSON.stringify(['请凭有效兑换码到机构前台验证','到店前请提前2小时电话预约','兑换当日即可开始培训课程']), sortOrder: 2 });
  var a2 = await Agency.create({ name: '三亚阳光家政培训站', address: '三亚市天涯区解放路200号', lat: 18.252, lng: 109.512, phone: '400-765-4321', score: 4.8, reviewCount: 1890, tags: JSON.stringify(['养老护理','高级育婴','专业保洁']), status: 'active', intro: '专注高端家政培训，致力于为家政从业者提供优质培训课程。', businessHours: '周一至周六 09:00-17:30', bookingNote: '建议提前1天电话预约', qualification: '营业执照已验证', gallery: JSON.stringify([]), exchangeNotes: JSON.stringify(['凭优惠券二维码到前台核验','培训开始前30分钟到场签到']), sortOrder: 1 });

  await AgencyCourse.bulkCreate([
    { agencyId: a1.id, name: '月嫂护理培训', desc: '24天专业培训，包含产后护理及宝宝照护全部技能。', duration: '24天/期', discount: '7折/满减', exchangeCount: 5, sortOrder: 2 },
    { agencyId: a1.id, name: '育儿嫂培训', desc: '系统培训育儿技能，包含婴幼儿照护、早教启蒙等。', duration: '14天/期', discount: '8折', exchangeCount: 3, sortOrder: 1 },
    { agencyId: a2.id, name: '养老护理员培训', desc: '老年人日常照护专业培训，涵盖生活照料、康复协助等。', duration: '10天/期', discount: '政府补贴', exchangeCount: 2, sortOrder: 1 }
  ]);

  // 优惠券（含分享设置）
  await Coupon.bulkCreate([
    { title: '政府免费培训券', type: 'free', value: 0, valueText: '免费', condition: '一门指定政府免费培训课程', description: '一分钱不花的培训，快来领取吧', subtitle: '不用花钱的培训，政府补贴、免费学习，解锁新的技能。', limitTag: '限时特惠', courseName: '月嫂课程', highlights: defaultHighlights, benefits: defaultBenefits, conditions: defaultConditions, agencyIds: JSON.stringify([a1.id, a2.id]), tags: JSON.stringify(['官方认证','完全免费','就近学习']), status: 'online', totalCount: 500, remainCount: 414, claimedCount: 86, limitPerUser: 1, startDate: '2026-01-01', expireDate: '2026-06-30', sortOrder: 3, shareable: true, shareRewardAmount: 50 },
    { title: '家政就业面试抵用券', type: 'cash', value: 200, valueText: '¥200', condition: '满1000元可用', description: '200元当1000元花，快来领取吧', subtitle: '降低就业门槛，帮助更多姐妹零成本进入家政行业。', limitTag: '热门', courseName: '面试辅导', highlights: defaultHighlights, benefits: defaultBenefits, conditions: defaultConditions, agencyIds: JSON.stringify([a1.id]), tags: JSON.stringify(['优质商户','全城通用']), status: 'online', totalCount: 300, remainCount: 250, claimedCount: 50, limitPerUser: 1, startDate: '2026-01-01', expireDate: '2026-06-30', sortOrder: 2, shareable: true, shareRewardAmount: 30 },
    { title: '家政服务保洁抵用券', type: 'cash', value: 500, valueText: '¥500', condition: '满1000元可用', description: '500元当1000元花，快来领取吧', subtitle: '家政保洁培训专用抵扣，助力技能提升。', limitTag: '限时特惠', courseName: '保洁培训', highlights: defaultHighlights, benefits: defaultBenefits, conditions: defaultConditions, agencyIds: JSON.stringify([a2.id]), tags: JSON.stringify(['限时特惠']), status: 'online', totalCount: 200, remainCount: 170, claimedCount: 30, limitPerUser: 1, startDate: '2026-01-01', expireDate: '2026-06-30', sortOrder: 1, shareable: true, shareRewardAmount: 20 },
    { title: '新人体验券', type: 'free', value: 0, valueText: '免费', description: '新人专享免费体验券', tags: JSON.stringify(['新人专享']), status: 'draft', totalCount: 1000, remainCount: 1000, claimedCount: 0, limitPerUser: 1, startDate: '2026-05-01', expireDate: '2026-12-31', sortOrder: 0, shareable: false, shareRewardAmount: 0 }
  ]);

  // 用户（统一为阿姨角色，含会员等级、推广统计、积分）
  await User.bulkCreate([
    { openid: 'mock_openid_user1', nickname: '张姐', avatar: '', phone: '13800138888', gender: 2, birthday: '1990-01-01', city: '海口', isRealAuth: true, realName: '张伟', idCard: '460100199001011234', authStatus: 'approved', memberLevel: 'partner', totalRefer: 15, totalEarning: 750, balance: 250, points: 120, preferredJobTypes: JSON.stringify([1, 2]) },
    { openid: 'mock_openid_user2', nickname: '李姐', avatar: '', phone: '13900139999', gender: 2, birthday: '1992-05-05', city: '三亚', isRealAuth: true, realName: '李娜', idCard: '460200199205052345', authStatus: 'approved', memberLevel: 'senior', totalRefer: 8, totalEarning: 400, balance: 200, points: 80, inviterId: 1, preferredJobTypes: JSON.stringify([1, 3]) },
    { openid: 'mock_openid_user3', nickname: '王阿姨', avatar: '', phone: '15800158888', gender: 2, birthday: '1995-08-08', city: '海口', isRealAuth: false, realName: '王芳', idCard: '460100199508083456', authStatus: 'pending', memberLevel: 'normal', points: 10, inviterId: 1, preferredJobTypes: JSON.stringify([2, 4]) },
    { openid: 'mock_openid_user4', nickname: '赵姐', avatar: '', phone: '13700137777', gender: 2, city: '儋州', isRealAuth: false, authStatus: 'none', memberLevel: 'normal', inviterId: 1, preferredJobTypes: JSON.stringify([5]) },
    { openid: 'mock_openid_user5', nickname: '刘阿姨', avatar: '', phone: '18600186666', gender: 2, birthday: '1980-12-12', city: '海口', isRealAuth: false, realName: '刘美', idCard: '460100198012124567', authStatus: 'pending', memberLevel: 'normal', points: 5, inviterId: 2, preferredJobTypes: JSON.stringify([1]) },
    { openid: 'mock_openid_user6', nickname: '陈姐', avatar: '', phone: '13500135555', gender: 2, birthday: '1993-06-06', city: '琼海', isRealAuth: true, realName: '陈丽', idCard: '460300199306066789', authStatus: 'approved', memberLevel: 'normal', points: 15, inviterId: 2, preferredJobTypes: JSON.stringify([3, 6]) },
    { openid: 'mock_openid_user7', nickname: '周阿姨', avatar: '', phone: '15900159999', gender: 2, birthday: '1985-11-11', city: '万宁', isRealAuth: true, realName: '周敏', idCard: '460400198511119876', authStatus: 'approved', memberLevel: 'normal', points: 0, preferredJobTypes: JSON.stringify([4, 7]) }
  ]);

  // 分享记录
  await ShareRecord.bulkCreate([
    { sharerId: 1, shareType: 'coupon', targetId: 1, shareCode: 'sc_coupon_001', viewCount: 25, claimCount: 3, receiverIds: JSON.stringify([2, 3, 5]) },
    { sharerId: 1, shareType: 'invite', targetId: null, shareCode: 'sc_invite_001', viewCount: 50, claimCount: 3, receiverIds: JSON.stringify([3, 4, 5]) },
    { sharerId: 2, shareType: 'coupon', targetId: 2, shareCode: 'sc_coupon_002', viewCount: 15, claimCount: 2, receiverIds: JSON.stringify([6, 7]) },
    { sharerId: 1, shareType: 'service_order', targetId: 1, shareCode: 'sc_order_001', viewCount: 12, claimCount: 1, receiverIds: JSON.stringify([6]) },
    { sharerId: 2, shareType: 'invite', targetId: null, shareCode: 'sc_invite_002', viewCount: 30, claimCount: 2, receiverIds: JSON.stringify([5, 6]) }
  ]);

  // 优惠券订单（含分享来源追溯）
  await CouponOrder.bulkCreate([
    { orderNo: 'YS2026041200001', userId: 1, couponId: 1, verifyCode: 'VF20260412A001', status: 'unused', source: '平台领取', expireDate: '2026-06-30' },
    { orderNo: 'YS2026041200002', userId: 1, couponId: 2, verifyCode: 'VF20260412A002', status: 'unused', source: '平台领取', expireDate: '2026-06-30' },
    { orderNo: 'YS2026041200003', userId: 2, couponId: 1, agencyId: a1.id, verifyCode: 'VF20260412B001', status: 'used', source: '分享领取', useDate: new Date('2026-03-15'), expireDate: '2026-06-30', sharerId: 1, shareRecordId: 1, rewardSettled: true },
    { orderNo: 'YS2026041200004', userId: 2, couponId: 3, verifyCode: 'VF20260412B002', status: 'expired', source: '平台活动', expireDate: '2025-12-31' },
    { orderNo: 'YS2026041200005', userId: 3, couponId: 1, verifyCode: 'VF20260412C001', status: 'unused', source: '分享领取', expireDate: '2026-06-30', sharerId: 1, shareRecordId: 1 },
    { orderNo: 'YS2026041200006', userId: 6, couponId: 2, agencyId: a2.id, verifyCode: 'VF20260412F001', status: 'used', source: '分享领取', useDate: new Date('2026-04-01'), expireDate: '2026-06-30', sharerId: 2, shareRecordId: 3, rewardSettled: true },
    { orderNo: 'YS2026041200007', userId: 7, couponId: 1, agencyId: a1.id, verifyCode: 'VF20260412G001', status: 'used', source: '分享领取', useDate: new Date('2026-04-05'), expireDate: '2026-06-30', sharerId: 2, shareRecordId: 3, rewardSettled: true }
  ]);

  // ==================== 工种 ====================
  await JobType.bulkCreate([
    { code: 'yuesao', name: '月嫂', icon: '', description: '产后母婴护理专业服务', sortOrder: 8, status: 'active' },
    { code: 'yuer', name: '育儿嫂', icon: '', description: '婴幼儿日常照护与早教', sortOrder: 7, status: 'active' },
    { code: 'baojie', name: '保洁', icon: '', description: '家庭/商业清洁保洁服务', sortOrder: 6, status: 'active' },
    { code: 'yanglao', name: '养老护理', icon: '', description: '老年人生活照料与康复协助', sortOrder: 5, status: 'active' },
    { code: 'chankang', name: '产康师', icon: '', description: '产后康复与身体调理', sortOrder: 4, status: 'active' },
    { code: 'jiawu', name: '家务', icon: '', description: '日常家务整理与管理', sortOrder: 3, status: 'active' },
    { code: 'zhonggong', name: '钟点工', icon: '', description: '按小时计费的灵活服务', sortOrder: 2, status: 'active' },
    { code: 'other', name: '其他', icon: '', description: '其他家政服务类型', sortOrder: 1, status: 'active' }
  ]);

  // ==================== 服务订单 ====================
  await ServiceOrder.bulkCreate([
    {
      orderNo: 'YS2026041800001', userId: 1, jobTypeId: 1,
      serviceDate: '2026-05-01', serviceDuration: '26天', location: '海口市龙华区国贸大道168号',
      city: '海口市', salaryType: 'monthly', salaryMin: 8000, salaryMax: 12000,
      contactName: '张伟', contactPhone: '13800138888',
      remark: '需要有3年以上月嫂经验，有证书优先', status: 'approved', shareable: true
    },
    {
      orderNo: 'YS2026041800002', userId: 2, jobTypeId: 3,
      serviceDate: '2026-05-10', serviceDuration: '1天', location: '三亚市天涯区海棠湾某小区',
      city: '三亚市', salaryType: 'daily', salaryMin: 300, salaryMax: 500,
      contactName: '李娜', contactPhone: '13900139999',
      remark: '大扫除，约120平米', status: 'approved', shareable: true
    },
    {
      orderNo: 'YS2026041800003', userId: 3, jobTypeId: 4,
      serviceDate: '2026-05-15', serviceDuration: '长期', location: '海口市美兰区蓝天路12号',
      city: '海口市', salaryType: 'monthly', salaryMin: 5000, salaryMax: 7000,
      contactName: '王芳', contactPhone: '15800158888',
      remark: '照顾80岁老人，需有耐心', status: 'matching', shareable: true
    },
    {
      orderNo: 'YS2026041800004', userId: 1, jobTypeId: 2,
      serviceDate: '2026-06-01', serviceDuration: '3个月', location: '海口市琼山区府城镇',
      city: '海口市', salaryType: 'monthly', salaryMin: 6000, salaryMax: 9000,
      contactName: '张伟', contactPhone: '13800138888',
      remark: '照顾6个月大的宝宝', status: 'pending', shareable: true
    },
    {
      orderNo: 'YS2026041800005', userId: 6, jobTypeId: 5,
      serviceDate: '2026-05-20', serviceDuration: '10次', location: '琼海市嘉积镇',
      city: '琼海市', salaryType: 'daily', salaryMin: 400, salaryMax: 600,
      contactName: '陈丽', contactPhone: '13500135555',
      remark: '产后42天，需要专业产康师', status: 'approved', shareable: true
    },
    {
      orderNo: 'YS2026041800006', userId: 2, jobTypeId: 1,
      serviceDate: '2026-04-20', serviceDuration: '26天', location: '三亚市吉阳区亚龙湾',
      city: '三亚市', salaryType: 'monthly', salaryMin: 10000, salaryMax: 15000,
      contactName: '李娜', contactPhone: '13900139999',
      remark: '双胞胎月嫂，需经验丰富', status: 'matched',
      acceptedApplicationId: 1, acceptedUserId: 5, shareable: true
    }
  ]);

  // ==================== 接单申请 ====================
  await OrderApplication.bulkCreate([
    // 订单6 的接单申请（已有一个被接受）
    { orderId: 6, userId: 5, status: 'accepted', message: '我有5年月嫂经验，擅长双胎护理', processedAt: new Date('2026-04-18'), sharerId: 1, shareRecordId: 4 },
    { orderId: 6, userId: 7, status: 'rejected', message: '我可以接这个单', processedAt: new Date('2026-04-18') },
    // 订单1 的接单申请
    { orderId: 1, userId: 2, status: 'pending', message: '我有月嫂高级证书，3年经验' },
    { orderId: 1, userId: 5, status: 'pending', message: '我在海口，可以随时上岗', sharerId: 1, shareRecordId: 4 },
    { orderId: 1, userId: 7, status: 'pending', message: '有丰富经验，可以面谈' },
    // 订单3 的接单申请
    { orderId: 3, userId: 6, status: 'pending', message: '我有养老护理证，很有耐心', sharerId: 1 },
    { orderId: 3, userId: 7, status: 'pending', message: '在海口，方便上岗' },
    // 订单5 的接单申请
    { orderId: 5, userId: 3, status: 'pending', message: '我学过产康课程' }
  ]);

  // 文章
  await Article.bulkCreate([
    { title: '月嫂上岗前，这5个证书必须拿到', summary: '做月嫂需要拿到哪些证书？很多新手姐妹都不了解', content: '做月嫂是一个非常有前景的职业。', category: '月嫂', tags: JSON.stringify(['月嫂','证书','入门']), status: 'published', reads: 3245, publishedAt: new Date('2026-03-10'), sortOrder: 5 },
    { title: '保洁阿姨的收纳秘诀：10分钟搞定一个房间', summary: '专业保洁师分享快速收纳整理技巧', content: '作为一名有10年经验的保洁师', category: '保洁', tags: JSON.stringify(['保洁','收纳','技巧']), status: 'published', reads: 1876, publishedAt: new Date('2026-03-18'), sortOrder: 4 },
    { title: '育婴师证怎么考？2026年最新报考指南', summary: '详细解读育婴师资格证的报考条件', content: '育婴师是国家职业资格证书。', category: '育婴', tags: JSON.stringify(['育婴师','考证','指南']), status: 'published', reads: 2103, publishedAt: new Date('2026-04-01'), sortOrder: 3 },
    { title: '养老护理员日常工作内容大揭秘', summary: '了解养老护理员的真实工作状态', content: '养老护理员的日常工作包括照料', category: '养老', tags: JSON.stringify(['养老','护理']), status: 'published', reads: 1540, publishedAt: new Date('2026-04-05'), sortOrder: 2 },
    { title: '家政从业者如何提升职场竞争力', summary: '职场发展建议与技能提升路径', content: '提升竞争力的5个方法', category: '职场', tags: JSON.stringify(['职场','发展']), status: 'draft', reads: 0, sortOrder: 1 }
  ]);

  // Banner
  await Banner.bulkCreate([
    { title: '免费学家政技能', subtitle: '政府补贴培训，零成本上岗', linkType: 'coupon', linkValue: '1', status: 'active', sortOrder: 3 },
    { title: '月嫂培训火热报名中', subtitle: '24天专业培训，高薪就业', linkType: 'agency', linkValue: '1', status: 'active', sortOrder: 2 },
    { title: '邀请姐妹得奖励', subtitle: '分享推荐，积分奖励', linkType: 'none', linkValue: '', status: 'active', sortOrder: 1 }
  ]);

  // 佣金记录
  await Commission.bulkCreate([
    { userId: 1, referUserId: 3, couponOrderId: 5, source: 'coupon_share', amount: 50.00, status: 'pending' },
    { userId: 1, referUserId: 4, source: 'invite', amount: 50.00, status: 'settled', settledAt: new Date('2026-03-25') },
    { userId: 1, referUserId: 5, source: 'invite', amount: 50.00, status: 'pending' },
    { userId: 2, referUserId: 6, couponOrderId: 6, source: 'coupon_share', amount: 30.00, status: 'settled', settledAt: new Date('2026-04-02') },
    { userId: 2, referUserId: 7, couponOrderId: 7, source: 'coupon_share', amount: 50.00, status: 'pending' }
  ]);

  // 操作日志
  await OperationLog.bulkCreate([
    { adminId: 1, adminName: '超级管理员', module: 'coupon', action: 'create', targetType: 'Coupon', targetId: 1, detail: '创建优惠券: 政府免费培训券', ip: '127.0.0.1' },
    { adminId: 1, adminName: '超级管理员', module: 'coupon', action: 'status', targetType: 'Coupon', targetId: 1, detail: '上架优惠券: 政府免费培训券', ip: '127.0.0.1' },
    { adminId: 1, adminName: '超级管理员', module: 'agency', action: 'create', targetType: 'Agency', targetId: 1, detail: '创建机构: 椰城家政培训中心', ip: '127.0.0.1' },
    { adminId: 2, adminName: '运营小张', module: 'order', action: 'verify', targetType: 'CouponOrder', targetId: 3, detail: '核销订单: YS2026041200003', ip: '192.168.1.100' },
    { adminId: 1, adminName: '超级管理员', module: 'system', action: 'create', targetType: 'Admin', targetId: 2, detail: '创建管理员: operator1', ip: '127.0.0.1' },
    { adminId: 1, adminName: '超级管理员', module: 'user', action: 'approve', targetType: 'User', targetId: 1, detail: '审核通过用户认证: 张姐', ip: '127.0.0.1' },
    { adminId: 2, adminName: '运营小张', module: 'service_order', action: 'approve', targetType: 'ServiceOrder', targetId: 1, detail: '审核通过订单: YS2026041800001', ip: '192.168.1.100' },
    { adminId: 2, adminName: '运营小张', module: 'service_order', action: 'accept_application', targetType: 'ServiceOrder', targetId: 6, detail: '确认接单: YS2026041800006 → 刘阿姨（推荐人: 张姐）', ip: '192.168.1.100' }
  ]);

  // ==================== 站内消息 ====================
  await Message.bulkCreate([
    { userId: 5, type: 'order_accepted', title: '接单申请已通过', content: '恭喜！您对月嫂订单的接单申请已被确认。订单号：YS2026041800006', linkType: 'service_order', linkId: 6, isRead: true, readAt: new Date('2026-04-18') },
    { userId: 7, type: 'order_rejected', title: '接单申请未通过', content: '很遗憾，您对订单 YS2026041800006 的接单申请未被选中，请关注其他订单机会。', linkType: 'service_order', linkId: 6, isRead: false },
    { userId: 1, type: 'coupon_reward', title: '优惠券分享奖励', content: '您分享的政府免费培训券已被用户领取并核销，获得 ¥50 奖励金。', linkType: 'coupon', linkId: 1, isRead: true, readAt: new Date('2026-03-16') },
    { userId: 2, type: 'coupon_reward', title: '优惠券分享奖励', content: '您分享的家政就业面试抵用券已被用户领取并核销，获得 ¥30 奖励金。', linkType: 'coupon', linkId: 2, isRead: false },
    { userId: 1, type: 'order_status', title: '订单审核通过', content: '您发布的月嫂订单已通过审核，正在为您匹配合适的阿姨。订单号：YS2026041800001', linkType: 'service_order', linkId: 1, isRead: true, readAt: new Date('2026-04-18') },
    { userId: 3, type: 'order_match', title: '新订单推荐', content: '有一个养老护理订单匹配您的意向工种，快去看看吧！', linkType: 'service_order', linkId: 3, isRead: false },
    { userId: 1, type: 'points_reward', title: '获得积分奖励', content: '获得 10 积分。原因：推荐刘阿姨接单成功', linkType: 'points', isRead: false },
    { userId: 6, type: 'order_match', title: '新订单推荐', content: '有一个产康师订单匹配您的意向工种，快去看看吧！', linkType: 'service_order', linkId: 5, isRead: false },
    { userId: 1, type: 'system', title: '欢迎来到海南椰嫂综合平台', content: '感谢您注册海南椰嫂综合平台！您可以浏览订单、领取优惠券、邀请姐妹一起来。', isRead: true, readAt: new Date('2026-01-01') }
  ]);

  // ==================== 订阅设置 ====================
  await SubscriptionSetting.bulkCreate([
    { userId: 1, enabled: true, frequency: 'realtime', jobTypeIds: JSON.stringify([1, 2]) },
    { userId: 2, enabled: true, frequency: 'daily', jobTypeIds: JSON.stringify([1, 3]) },
    { userId: 3, enabled: true, frequency: 'daily', jobTypeIds: JSON.stringify([2, 4]) },
    { userId: 5, enabled: true, frequency: 'realtime', jobTypeIds: JSON.stringify([1]) },
    { userId: 6, enabled: true, frequency: 'weekly', jobTypeIds: JSON.stringify([3, 5, 6]) },
    { userId: 7, enabled: false, frequency: 'monthly', jobTypeIds: JSON.stringify([4, 7]) }
  ]);

  console.log('');
  console.log('✅ 海南椰嫂综合平台 种子数据初始化完成！');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('管理员: admin / admin123, operator1 / admin123, auditor1 / admin123');
  console.log('用户: 7人（张姐=合伙人, 李姐=高级会员, 其余=普通会员）');
  console.log('工种: 8种（月嫂、育儿嫂、保洁、养老护理、产康师、家务、钟点工、其他）');
  console.log('服务订单: 6个（含不同状态：pending/approved/matching/matched）');
  console.log('接单申请: 8条（含分享追溯来源）');
  console.log('分享记录: 5条（优惠券分享、邀请分享、订单分享）');
  console.log('优惠券订单: 7条, 佣金记录: 5条');
  console.log('站内消息: 9条, 订阅设置: 6条');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  process.exit(0);
}

seed().catch(function(err) { console.error('种子数据初始化失败:', err); process.exit(1); });
