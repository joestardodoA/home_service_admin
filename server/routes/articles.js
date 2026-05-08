// server/routes/articles.js — 文章 CRUD
const express = require('express');
const { Article } = require('../models');
const { authMiddleware, requirePermission } = require('../middleware/auth');
const { success, fail, paginate } = require('../utils/response');
const { Op } = require('sequelize');

const router = express.Router();
router.use(authMiddleware);

router.get('/', requirePermission('articles:view'), async function(req, res) {
  try {
    var page = parseInt(req.query.page) || 1;
    var pageSize = parseInt(req.query.pageSize) || 10;
    var where = {};
    if (req.query.status) where.status = req.query.status;
    if (req.query.category) where.category = req.query.category;
    if (req.query.keyword) where.title = { [Op.like]: '%' + req.query.keyword + '%' };
    var result = await Article.findAndCountAll({
      where: where, order: [['sortOrder', 'DESC'], ['createdAt', 'DESC']],
      limit: pageSize, offset: (page - 1) * pageSize
    });
    return paginate(res, result.rows, result.count, page, pageSize);
  } catch (err) { return fail(res, '查询失败: ' + err.message, 500); }
});

router.get('/:id', async function(req, res) {
  try {
    var article = await Article.findByPk(req.params.id);
    if (!article) return fail(res, '文章不存在', 404);
    return success(res, article);
  } catch (err) { return fail(res, '查询失败', 500); }
});

router.post('/', requirePermission('articles:create'), async function(req, res) {
  try {
    if (!req.body.title) return fail(res, '标题不能为空');
    var article = await Article.create(req.body);
    return success(res, article, '创建成功');
  } catch (err) { return fail(res, '创建失败: ' + err.message, 500); }
});

router.put('/:id', requirePermission('articles:edit'), async function(req, res) {
  try {
    var article = await Article.findByPk(req.params.id);
    if (!article) return fail(res, '文章不存在', 404);
    var updates = Object.assign({}, req.body);
    delete updates.id;
    delete updates.createdAt;
    delete updates.updatedAt;
    await article.update(updates);
    return success(res, article, '更新成功');
  } catch (err) { return fail(res, '更新失败', 500); }
});

router.delete('/:id', requirePermission('articles:delete'), async function(req, res) {
  try {
    var article = await Article.findByPk(req.params.id);
    if (!article) return fail(res, '文章不存在', 404);
    await article.destroy();
    return success(res, null, '删除成功');
  } catch (err) { return fail(res, '删除失败', 500); }
});

// 发布/下架
router.put('/:id/status', requirePermission('articles:edit'), async function(req, res) {
  try {
    var article = await Article.findByPk(req.params.id);
    if (!article) return fail(res, '文章不存在', 404);
    var status = req.body.status;
    var update = { status: status };
    if (status === 'published' && !article.publishedAt) update.publishedAt = new Date();
    await article.update(update);
    return success(res, article, '状态更新成功');
  } catch (err) { return fail(res, '操作失败', 500); }
});

// AI 生成文章草稿
var aiService = require('../services/ai');
router.post('/ai-generate', requirePermission('articles:create'), async function(req, res) {
  try {
    var topic = (req.body.topic || '').trim();
    var category = req.body.category || '保洁';
    if (!topic) return fail(res, '请输入文章主题');
    if (topic.length > 100) return fail(res, '主题不能超过100个字符');
    // 过滤 HTML 标签防止 XSS
    topic = topic.replace(/<[^>]*>/g, '');
    category = (category + '').replace(/<[^>]*>/g, '');

    // Mock 模式：返回模板文章
    if (aiService.AI_CONFIG.provider === 'mock') {
      var mockArticle = {
        title: '【' + category + '指南】' + topic,
        summary: '本文为您详细介绍' + topic + '的相关知识，包括注意事项、选择技巧和常见问题解答。',
        content: '# ' + topic + '\n\n' +
          '## 一、什么是' + topic + '？\n\n' +
          topic + '是家政服务中重要的一环。随着生活品质的提升，越来越多家庭开始关注专业的家政服务。\n\n' +
          '## 二、如何选择合适的服务？\n\n' +
          '1. **查看资质认证**：选择经过平台实名认证的服务人员\n' +
          '2. **参考评价反馈**：查看历史服务评价和完成率\n' +
          '3. **明确需求细节**：提前沟通服务时间、内容和注意事项\n' +
          '4. **了解价格行情**：参考平台提供的工种行情数据\n\n' +
          '## 三、注意事项\n\n' +
          '- 签订服务协议，明确双方权责\n' +
          '- 提前预约，给平台充足的匹配时间\n' +
          '- 保持良好沟通，及时反馈服务体验\n\n' +
          '## 四、常见问题\n\n' +
          '**Q: 如何在平台发单？**\n' +
          'A: 进入订单页面，点击"我要发单"，填写需求信息即可。支持"一句话发单"功能，AI 帮您自动填写表单。\n\n' +
          '**Q: 服务不满意怎么办？**\n' +
          'A: 可以联系平台客服，我们会协助您解决问题。\n\n' +
          '---\n*本文由海南椰嫂综合平台 AI 辅助生成，仅供参考。*',
        tags: [category, topic.slice(0, 4)],
        _source: 'mock'
      };
      return success(res, mockArticle, 'AI 草稿生成成功（模拟模式）');
    }

    // 真实 LLM 模式
    var systemPrompt = '你是海南椰嫂家政服务平台的内容编辑。请根据给定的主题，撰写一篇家政行业知识文章。\n' +
      '要求：\n1. 标题吸引人，包含关键词\n2. 摘要100字以内\n3. 正文使用 Markdown 格式，分3-5个小节\n4. 内容专业、实用、通俗易懂\n5. 结尾可以引导用户使用平台服务\n\n' +
      '请严格以 JSON 格式返回：\n' +
      '{"title":"文章标题","summary":"文章摘要","content":"Markdown正文","tags":["标签1","标签2"]}';

    var result = await aiService.callLLMJson(systemPrompt, '分类：' + category + '\n主题：' + topic, { temperature: 0.8 });
    result._source = 'llm';
    return success(res, result, 'AI 草稿生成成功');
  } catch (err) {
    return fail(res, 'AI 生成失败: ' + err.message, 500);
  }
});

module.exports = router;

