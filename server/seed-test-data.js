/**
 * 测试数据填充脚本
 * 用法: DB_HOST=127.0.0.1 DB_USER=coconut DB_PASS=arJXG5kh3EN8YrGP DB_NAME=coconut DB_DIALECT=mysql node seed-test-data.js
 */
var bcrypt = require('bcryptjs');
var {
  sequelize, User, Admin, Coupon, Agency, AgencyCourse, CouponOrder,
  Article, Banner, Commission, ShareRecord, JobType, ServiceOrder,
  OrderApplication, Message, GuimiCircle, GuimiCircleMember,
  Announcement, AdminNotification, SystemSetting
} = require('./models');

// 工具函数
function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function dateAgo(days) { var d = new Date(); d.setDate(d.getDate() - days); return d; }

var cities = ['海口市', '三亚市', '儋州市', '琼海市', '万宁市', '文昌市'];
var lastNames = ['王', '李', '张', '刘', '陈', '杨', '黄', '赵', '吴', '周', '徐', '孙', '马', '朱', '胡', '林', '郭', '何', '高', '罗'];

async function seed() {
  try {
    await sequelize.authenticate();
    console.log('✅ 数据库连接成功');
    await sequelize.sync();

    // ==================== 1. 工种（如果不存在则创建） ====================
    var jobTypeData = [
      { name: '月嫂', code: 'yuesao', icon: '👶', sortOrder: 100 },
      { name: '育儿嫂', code: 'yuer', icon: '🍼', sortOrder: 90 },
      { name: '保洁', code: 'baojie', icon: '🧹', sortOrder: 80 },
      { name: '养老护理', code: 'yanglao', icon: '👴', sortOrder: 70 },
      { name: '产康师', code: 'chankang', icon: '💆', sortOrder: 60 },
      { name: '家务', code: 'jiawu', icon: '🏠', sortOrder: 50 },
      { name: '钟点工', code: 'zhonggong', icon: '⏰', sortOrder: 40 },
      { name: '其他', code: 'other', icon: '📋', sortOrder: 10 }
    ];
    for (var jt of jobTypeData) {
      await JobType.findOrCreate({ where: { code: jt.code }, defaults: Object.assign(jt, { status: 'active' }) });
    }
    var jobTypes = await JobType.findAll({ where: { status: 'active' } });
    console.log('✅ 工种: ' + jobTypes.length + ' 个');

    // ==================== 2. 用户（30个测试阿姨） ====================
    var password = await bcrypt.hash('123456', 10);
    var createdUsers = [];
    for (var i = 1; i <= 30; i++) {
      var ln = pick(lastNames);
      var suffix = i <= 15 ? '姐' : '阿姨';
      var nickname = ln + suffix;
      var phone = '138' + String(10000000 + i).slice(-8);
      var [user] = await User.findOrCreate({
        where: { phone: phone },
        defaults: {
          openid: 'test_openid_' + i,
          nickname: nickname,
          phone: phone,
          gender: 2,
          city: pick(cities),
          realName: ln + (i % 2 === 0 ? '秀英' : '丽华'),
          isRealAuth: i <= 20,
          authStatus: i <= 20 ? 'approved' : (i <= 25 ? 'pending' : 'none'),
          memberLevel: i <= 3 ? 'partner' : (i <= 10 ? 'senior' : 'normal'),
          points: rand(0, 500),
          adminScore: i <= 20 ? rand(40, 95) : 0,
          preferredJobTypes: JSON.stringify([jobTypes[i % jobTypes.length].id, jobTypes[(i + 3) % jobTypes.length].id]),
          totalRefer: rand(0, 10),
          totalEarning: rand(0, 500),
          balance: rand(0, 200),
          status: 'active',
          createdAt: dateAgo(rand(1, 90))
        }
      });
      createdUsers.push(user);
    }
    // 5个雇主
    for (var i = 31; i <= 35; i++) {
      var ln = pick(lastNames);
      var phone = '139' + String(10000000 + i).slice(-8);
      var [user] = await User.findOrCreate({
        where: { phone: phone },
        defaults: {
          openid: 'test_employer_' + i,
          nickname: ln + '先生',
          phone: phone,
          gender: 1,
          city: pick(cities),
          realName: ln + '建国',
          isRealAuth: true,
          authStatus: 'approved',
          memberLevel: 'normal',
          status: 'active',
          createdAt: dateAgo(rand(1, 60))
        }
      });
      createdUsers.push(user);
    }
    console.log('✅ 用户: 创建/确认 35 个');

    // ==================== 3. 机构 ====================
    var agencyData = [
      { name: '椰城家政培训中心', address: '海口市龙华区国贸路88号', phone: '0898-66668888', description: '海南最大的家政培训基地', tags: '["专业培训","证书认证","推荐就业"]', gallery: '[]', status: 'active', sortOrder: 100 },
      { name: '三亚阳光月嫂学校', address: '三亚市天涯区解放路168号', phone: '0898-88886666', description: '专注月嫂育婴师培训', tags: '["月嫂专业","小班教学"]', gallery: '[]', status: 'active', sortOrder: 90 },
      { name: '海南母婴护理协会', address: '海口市美兰区海甸岛5号', phone: '0898-65558888', description: '行业标准制定机构', tags: '["行业协会","权威认证"]', gallery: '[]', status: 'active', sortOrder: 80 }
    ];
    for (var a of agencyData) {
      await Agency.findOrCreate({ where: { name: a.name }, defaults: a });
    }
    var agencies = await Agency.findAll();
    console.log('✅ 机构: ' + agencies.length + ' 家');

    // ==================== 4. 优惠券 ====================
    var couponData = [
      { title: '新用户专享200元培训券', type: 'discount', valueText: '¥200', description: '首次报名家政培训立减200元', condition: '满1000可用', totalCount: 500, remainCount: 450, claimedCount: 50, limitPerUser: 1, status: 'online', shareRewardAmount: 10, sortOrder: 100, tags: '["新人专享","限时"]', highlights: '["立减200元","全场通用"]', benefits: '["免费试听","推荐就业"]', conditions: '["满1000可用","不可与其他优惠叠加"]', agencyIds: '[]' },
      { title: '月嫂培训8折券', type: 'discount', valueText: '8折', description: '月嫂课程专享8折优惠', condition: '月嫂课程专用', totalCount: 200, remainCount: 180, claimedCount: 20, limitPerUser: 2, status: 'online', shareRewardAmount: 5, sortOrder: 90, tags: '["月嫂专享"]', highlights: '["8折优惠"]', benefits: '["专业课程"]', conditions: '["仅限月嫂课程"]', agencyIds: '[]' },
      { title: '免费体验课程券', type: 'free', valueText: '免费', description: '任意课程免费体验一次', condition: '每人限领1次', totalCount: 100, remainCount: 85, claimedCount: 15, limitPerUser: 1, status: 'online', shareRewardAmount: 0, sortOrder: 80, tags: '["免费体验"]', highlights: '["免费一次"]', benefits: '["体验课程"]', conditions: '["限体验课"]', agencyIds: '[]' }
    ];
    for (var c of couponData) {
      c.expireDate = dateAgo(-60);
      await Coupon.findOrCreate({ where: { title: c.title }, defaults: c });
    }
    var coupons = await Coupon.findAll();
    console.log('✅ 优惠券: ' + coupons.length + ' 张');

    // ==================== 5. 服务订单（20条各种状态） ====================
    var statusList = ['pending', 'approved', 'assigned', 'matching', 'matched', 'completed', 'rejected', 'cancelled'];
    var admins = await Admin.findAll();
    var orderCount = await ServiceOrder.count();
    if (orderCount < 15) {
      for (var i = 0; i < 20; i++) {
        var type = i < 15 ? 'employer' : 'worker';
        var status = statusList[i % statusList.length];
        var jt = jobTypes[i % jobTypes.length];
        var publisher = createdUsers[i % createdUsers.length];
        var city = pick(cities);
        var salaryMin = pick([3000, 5000, 6000, 8000]);
        var salaryMax = salaryMin + rand(2000, 5000);
        var assignedAdmin = admins.length > 0 ? admins[i % admins.length] : null;

        var order = await ServiceOrder.create({
          orderNo: 'YS2026050' + String(10000 + i).slice(-5) + rand(10000, 99999),
          userId: publisher.id,
          jobTypeId: jt.id,
          type: type,
          status: status,
          city: city,
          location: city + pick(['龙华区', '美兰区', '秀英区', '琼山区']) + '某小区',
          salaryType: jt.code === 'baojie' || jt.code === 'zhonggong' ? 'daily' : 'monthly',
          salaryMin: salaryMin,
          salaryMax: salaryMax,
          contactName: publisher.realName || publisher.nickname,
          contactPhone: publisher.phone,
          remark: '测试订单 ' + jt.name,
          serviceDate: dateAgo(-rand(5, 30)),
          assignedAdminId: ['assigned', 'matching', 'matched', 'completed'].indexOf(status) !== -1 && assignedAdmin ? assignedAdmin.id : null,
          acceptedUserId: status === 'matched' || status === 'completed' ? createdUsers[(i + 5) % createdUsers.length].id : null,
          actualAmount: status === 'completed' ? rand(3000, 15000) : null,
          completedAt: status === 'completed' ? dateAgo(rand(1, 15)) : null,
          createdAt: dateAgo(rand(1, 45))
        });

        // 为部分订单创建申请
        if (['matching', 'matched', 'completed'].indexOf(status) !== -1) {
          for (var j = 0; j < rand(1, 4); j++) {
            var applicant = createdUsers[(i + j + 10) % createdUsers.length];
            if (applicant.id !== publisher.id) {
              await OrderApplication.findOrCreate({
                where: { orderId: order.id, userId: applicant.id },
                defaults: {
                  orderId: order.id,
                  userId: applicant.id,
                  status: j === 0 && status !== 'matching' ? 'accepted' : (j === 0 ? 'pending' : 'rejected'),
                  message: '我有' + rand(1, 10) + '年' + jt.name + '经验'
                }
              });
            }
          }
        }
      }
    }
    console.log('✅ 服务订单: 已创建 20 条（含申请记录）');

    // ==================== 6. 优惠券订单 ====================
    var couponOrderCount = await CouponOrder.count();
    if (couponOrderCount < 10) {
      for (var i = 0; i < 15; i++) {
        var u = createdUsers[i % createdUsers.length];
        var c = coupons[i % coupons.length];
        var st = pick(['unused', 'unused', 'used', 'expired']);
        await CouponOrder.create({
          orderNo: 'CO' + Date.now() + rand(100, 999) + i,
          userId: u.id,
          couponId: c.id,
          verifyCode: String(rand(100000, 999999)),
          status: st,
          expireDate: dateAgo(-30),
          useDate: st === 'used' ? dateAgo(rand(1, 10)) : null,
          agencyId: st === 'used' ? agencies[0].id : null,
          createdAt: dateAgo(rand(1, 30))
        });
      }
    }
    console.log('✅ 优惠券订单: 15 条');

    // ==================== 7. 文章 ====================
    var articleData = [
      { title: '月嫂新手必读：产后护理十大要点', category: '月嫂', summary: '专业月嫂分享产后护理经验', content: '<h2>产后护理要点</h2><p>产后护理是月嫂工作的核心，以下十大要点帮助新手月嫂快速上手...</p><h3>1. 产后饮食调理</h3><p>产后第一周以清淡为主，逐渐过渡到营养丰富的月子餐...</p>', tags: '["月嫂","产后护理","新手指南"]', status: 'published', reads: rand(100, 2000), sortOrder: 100 },
      { title: '育儿嫂面试技巧：如何脱颖而出', category: '育儿嫂', summary: '资深育儿嫂分享面试经验', content: '<h2>面试准备</h2><p>面试是获得好工作的关键环节...</p>', tags: '["育儿嫂","面试技巧"]', status: 'published', reads: rand(50, 1500), sortOrder: 90 },
      { title: '保洁阿姨的一天：高效清洁攻略', category: '保洁', summary: '专业保洁流程分享', content: '<h2>高效清洁流程</h2><p>合理安排清洁顺序能大大提高效率...</p>', tags: '["保洁","清洁技巧"]', status: 'published', reads: rand(80, 1000), sortOrder: 80 },
      { title: '养老护理员必备技能清单', category: '养老护理', summary: '养老护理专业技能汇总', content: '<h2>核心技能</h2><p>养老护理需要耐心和专业知识...</p>', tags: '["养老护理","技能"]', status: 'published', reads: rand(60, 800), sortOrder: 70 },
      { title: '海南家政市场2026年趋势分析', category: '职场', summary: '行业专家解读市场走向', content: '<h2>市场趋势</h2><p>2026年海南家政服务市场持续增长...</p>', tags: '["市场分析","行业趋势"]', status: 'published', reads: rand(200, 3000), sortOrder: 95 },
      { title: '产康师职业发展路径指南', category: '产康师', summary: '从入门到资深的成长之路', content: '<h2>职业发展</h2><p>产康师是近年来快速发展的新兴职业...</p>', tags: '["产康师","职业规划"]', status: 'published', reads: rand(40, 600), sortOrder: 60 }
    ];
    for (var a of articleData) {
      a.publishedAt = dateAgo(rand(1, 30));
      await Article.findOrCreate({ where: { title: a.title }, defaults: a });
    }
    console.log('✅ 文章: ' + articleData.length + ' 篇');

    // ==================== 8. Banner ====================
    var bannerData = [
      { title: '椰嫂平台正式上线', imageUrl: '/uploads/banner_launch.jpg', linkType: 'none', position: 'home', status: 'active', sortOrder: 100 },
      { title: '月嫂培训限时优惠', imageUrl: '/uploads/banner_training.jpg', linkType: 'coupon', position: 'home', status: 'active', sortOrder: 90 },
      { title: '新用户福利', imageUrl: '/uploads/banner_newuser.jpg', linkType: 'none', position: 'home', status: 'active', sortOrder: 80 }
    ];
    for (var b of bannerData) {
      await Banner.findOrCreate({ where: { title: b.title }, defaults: b });
    }
    console.log('✅ Banner: ' + bannerData.length + ' 条');

    // ==================== 9. 佣金记录 ====================
    var commCount = await Commission.count();
    if (commCount < 10) {
      for (var i = 0; i < 12; i++) {
        var u = createdUsers[i % 10];
        var ref = createdUsers[(i + 15) % createdUsers.length];
        await Commission.create({
          userId: u.id,
          referUserId: ref.id,
          source: pick(['coupon_share', 'order_accept', 'invite']),
          amount: rand(5, 50),
          status: pick(['pending', 'settled', 'settled']),
          settledAt: i % 2 === 0 ? dateAgo(rand(1, 10)) : null,
          remark: '测试佣金 #' + (i + 1),
          createdAt: dateAgo(rand(1, 30))
        });
      }
    }
    console.log('✅ 佣金记录: 12 条');

    // ==================== 10. 分享记录 ====================
    var shareCount = await ShareRecord.count();
    if (shareCount < 5) {
      for (var i = 0; i < 10; i++) {
        var u = createdUsers[i % createdUsers.length];
        await ShareRecord.create({
          sharerId: u.id,
          shareType: pick(['coupon', 'order', 'article', 'circle']),
          targetId: rand(1, 5),
          shareCode: require('crypto').randomBytes(8).toString('hex'),
          viewCount: rand(0, 50),
          claimCount: rand(0, 10),
          createdAt: dateAgo(rand(1, 20))
        });
      }
    }
    console.log('✅ 分享记录: 10 条');

    // ==================== 11. 闺蜜圈 ====================
    var circleCount = await GuimiCircle.count();
    if (circleCount < 2) {
      for (var i = 0; i < 3; i++) {
        var owner = createdUsers[i];
        var jt = jobTypes[i % jobTypes.length];
        var circle = await GuimiCircle.create({
          ownerId: owner.id,
          jobTypeId: jt.id,
          name: owner.nickname + '的' + jt.name + '闺蜜圈',
          inviteCode: require('crypto').randomBytes(4).toString('hex').toUpperCase(),
          memberCount: 1,
          maxMembers: 1000,
          status: 'active'
        });
        await GuimiCircleMember.create({ circleId: circle.id, userId: owner.id, role: 'owner', joinedAt: new Date() });
        // 每个圈加几个成员
        for (var j = 1; j <= 5; j++) {
          var member = createdUsers[(i * 5 + j + 3) % createdUsers.length];
          if (member.id !== owner.id) {
            var [, created] = await GuimiCircleMember.findOrCreate({
              where: { circleId: circle.id, userId: member.id },
              defaults: { circleId: circle.id, userId: member.id, role: 'member', joinedAt: dateAgo(rand(1, 15)) }
            });
            if (created) await circle.increment('memberCount');
          }
        }
      }
    }
    console.log('✅ 闺蜜圈: 3 个（含成员）');

    // ==================== 12. 站内消息 ====================
    var msgCount = await Message.count();
    if (msgCount < 10) {
      for (var i = 0; i < 20; i++) {
        var u = createdUsers[i % createdUsers.length];
        await Message.create({
          userId: u.id,
          type: pick(['order_status', 'order_accepted', 'system', 'points_reward']),
          title: pick(['订单审核通过', '接单申请已通过', '系统通知', '积分奖励']),
          content: '这是一条测试消息 #' + (i + 1),
          isRead: i % 3 === 0,
          createdAt: dateAgo(rand(0, 15))
        });
      }
    }
    console.log('✅ 站内消息: 20 条');

    // ==================== 13. 内部公告 ====================
    var annoCount = await Announcement.count();
    if (annoCount < 2) {
      var admin = admins[0];
      await Announcement.create({ adminId: admin ? admin.id : 1, title: '平台正式上线通知', content: '各位同事，椰嫂综合平台已于今日正式上线运营，请熟悉各项功能。', priority: 'high', status: 'active' });
      await Announcement.create({ adminId: admin ? admin.id : 1, title: '本周工作安排', content: '本周重点：1.处理积压订单 2.完成阿姨认证审核 3.准备运营周报。', priority: 'normal', status: 'active' });
    }
    console.log('✅ 内部公告: 2 条');

    // ==================== 14. 系统设置 ====================
    var settings = [
      { key: 'data_coefficient', value: '5', description: '前端数据展示系数' },
      { key: 'points_exchange_address', value: '海口市龙华区国贸路88号椰城家政中心', description: '积分兑换地址' },
      { key: 'points_exchange_phone', value: '0898-66668888', description: '积分兑换联系电话' },
      { key: 'points_exchange_hours', value: '工作日 9:00-18:00', description: '积分兑换营业时间' }
    ];
    for (var s of settings) {
      await SystemSetting.findOrCreate({ where: { key: s.key }, defaults: s });
    }
    console.log('✅ 系统设置: ' + settings.length + ' 项');

    console.log('\n🎉 全部测试数据填充完成！');
    process.exit(0);
  } catch (err) {
    console.error('❌ 失败:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

seed();
