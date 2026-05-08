// server/utils/adminNotify.js — 后台管理员通知工具
const { Admin, AdminNotification } = require('../models');
const { Op } = require('sequelize');

/**
 * 通知拥有指定权限的所有管理员
 * @param {string} permission - 权限码（如 notifications:receive_order）
 * @param {object} notification - { type, title, content, linkType, linkId }
 */
async function notifyAdminsWithPermission(permission, notification) {
  try {
    // 查找所有活跃管理员
    var admins = await Admin.findAll({ where: { status: 'active' } });
    var targets = admins.filter(function(a) {
      // super 角色接收所有通知
      if (a.role === 'super') return true;
      var perms = [];
      try { perms = typeof a.permissions === 'object' ? a.permissions : JSON.parse(a.permissions || '[]'); } catch(e) {}
      return perms.indexOf(permission) !== -1;
    });

    // 批量创建通知
    var records = targets.map(function(a) {
      return {
        adminId: a.id,
        type: notification.type || 'system',
        title: notification.title || '',
        content: notification.content || '',
        linkType: notification.linkType || '',
        linkId: notification.linkId || null
      };
    });

    if (records.length > 0) {
      await AdminNotification.bulkCreate(records);
    }
    return records.length;
  } catch (e) {
    console.error('发送后台通知失败:', e.message);
    return 0;
  }
}

/**
 * 通知指定管理员
 * @param {number} adminId - 目标管理员 ID
 * @param {object} notification - { type, title, content, linkType, linkId }
 */
async function notifyAdmin(adminId, notification) {
  try {
    await AdminNotification.create({
      adminId: adminId,
      type: notification.type || 'system',
      title: notification.title || '',
      content: notification.content || '',
      linkType: notification.linkType || '',
      linkId: notification.linkId || null
    });
    return true;
  } catch (e) {
    console.error('发送后台通知失败:', e.message);
    return false;
  }
}

module.exports = { notifyAdminsWithPermission, notifyAdmin };
