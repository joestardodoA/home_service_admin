/**
 * 一次性脚本：创建超级管理员 gang 和 jun
 *
 * 使用方法：在服务器 server 目录下执行：
 *   node create-admins.js
 *
 * 执行完成后可删除此脚本
 */
var bcrypt = require('bcryptjs');
var { Admin, sequelize } = require('./models');

async function createAdmins() {
  try {
    await sequelize.authenticate();
    console.log('数据库连接成功');

    // 同步表结构（确保 Admin 表存在）
    await sequelize.sync();

    var password = await bcrypt.hash('admin123', 10);

    var admins = [
      { username: 'gang', realName: 'Gang', role: 'super', password: password, status: 'active' },
      { username: 'jun', realName: 'Jun', role: 'super', password: password, status: 'active' }
    ];

    for (var i = 0; i < admins.length; i++) {
      var a = admins[i];
      var existing = await Admin.findOne({ where: { username: a.username } });
      if (existing) {
        // 已存在则更新为超管 + 重置密码
        await existing.update({ role: 'super', password: password, status: 'active' });
        console.log('✅ 已更新管理员: ' + a.username + ' (重置密码 + 设为超管)');
      } else {
        await Admin.create(a);
        console.log('✅ 已创建超级管理员: ' + a.username);
      }
    }

    console.log('\n完成！两个账号均可用密码 admin123 登录后台。');
    console.log('⚠️ 建议登录后立即修改密码！');
    process.exit(0);
  } catch (err) {
    console.error('❌ 执行失败:', err.message);
    process.exit(1);
  }
}

createAdmins();
