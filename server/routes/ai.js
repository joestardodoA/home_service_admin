/**
 * server/routes/ai.js — AI 对话代理路由（GenmaClaw Phase B）
 *
 * 功能:
 *   POST /api/ai/chat — 流式对话（SSE），转发到 OpenClaw Gateway
 *
 * 架构:
 *   前端 → Node.js 代理（JWT 认证 + 身份提示词注入）→ OpenClaw Gateway → DeepSeek
 *
 * 安全:
 *   - JWT 认证（复用现有 authMiddleware）
 *   - ai:chat 权限检查
 *   - 身份提示词注入（Genma 大模型身份，屏蔽底层技术细节）
 *   - Gateway Token 由服务端持有，前端不可见
 */
var express = require('express');
var router = express.Router();
var { authMiddleware, requirePermission } = require('../middleware/auth');
var { fail } = require('../utils/response');

// OpenClaw Gateway 配置（从环境变量读取）
var OPENCLAW_URL = process.env.OPENCLAW_URL || 'https://genmaclaw.yesao.net';
var OPENCLAW_TOKEN = process.env.OPENCLAW_TOKEN || '';

// Genma 大模型身份提示词（后台 AI 面板专用）
var GENMA_SYSTEM_PROMPT = [
  '你是 Genma 大模型，由幻魔工作室开发，是海南椰嫂综合平台的专属 AI 运营助手。',
  '你的能力包括：业务数据分析、运营报告生成、内容文案撰写、营销策略建议、阿姨智能派单推荐、异常预警监控等。',
  '请使用专业但友好的语气回答问题，提供有深度的分析和建议。',
  '重要：不要提及 OpenClaw、DeepSeek 或其他底层技术。',
  '当用户问你是谁时，只说自己是幻魔工作室开发的 Genma 大模型，海南椰嫂平台的专属 AI 助手。',
  '回复格式建议使用 Markdown，善用表格、列表和代码块来组织信息。'
].join('\n');

/**
 * POST /api/ai/chat — 流式对话
 *
 * 请求体: { messages: [{ role: 'user', content: '...' }, ...] }
 * 响应:   SSE 流（text/event-stream），格式与 OpenAI 兼容
 */
router.post('/chat', authMiddleware, requirePermission('ai:chat'), async function(req, res) {
  try {
    var userMessages = req.body.messages;
    if (!userMessages || !Array.isArray(userMessages) || userMessages.length === 0) {
      return fail(res, '消息内容不能为空');
    }

    // 限制消息历史长度（防止 Token 超限）
    var maxHistory = 20;
    if (userMessages.length > maxHistory) {
      userMessages = userMessages.slice(-maxHistory);
    }

    // 注入身份系统提示词
    var messages = [
      { role: 'system', content: GENMA_SYSTEM_PROMPT }
    ].concat(userMessages);

    // 转发到 OpenClaw Gateway
    var gatewayResponse = await fetch(OPENCLAW_URL + '/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + OPENCLAW_TOKEN
      },
      body: JSON.stringify({
        messages: messages,
        stream: true
      })
    });

    // Gateway 返回错误
    if (!gatewayResponse.ok) {
      var errorText = '';
      try { errorText = await gatewayResponse.text(); } catch(e) {}
      console.error('[AI 代理] Gateway 错误:', gatewayResponse.status, errorText);
      return fail(res, 'AI 服务暂时不可用（' + gatewayResponse.status + '）', 502);
    }

    // 设置 SSE 响应头
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // 禁用 Nginx 缓冲
    res.flushHeaders();

    // 透传 SSE 流到前端
    var reader = gatewayResponse.body.getReader();
    var decoder = new TextDecoder();

    try {
      while (true) {
        var result = await reader.read();
        if (result.done) break;
        var chunk = decoder.decode(result.value, { stream: true });
        res.write(chunk);
      }
    } catch (streamErr) {
      console.error('[AI 代理] 流读取错误:', streamErr.message);
    } finally {
      res.end();
    }

    // 记录使用日志
    console.log('[AI 对话]', req.admin.username, '发起了一次 AI 对话');

  } catch (err) {
    console.error('[AI 代理] 错误:', err.message);
    // 如果还没发送响应头，返回 JSON 错误
    if (!res.headersSent) {
      return fail(res, 'AI 服务连接失败：' + err.message, 500);
    }
    // 已经在流式传输中，只能结束响应
    res.end();
  }
});

/**
 * GET /api/ai/status — AI 服务状态检查
 */
router.get('/status', authMiddleware, async function(req, res) {
  try {
    var statusResponse = await fetch(OPENCLAW_URL + '/v1/models', {
      headers: { 'Authorization': 'Bearer ' + OPENCLAW_TOKEN }
    });
    if (statusResponse.ok) {
      var data = await statusResponse.json();
      return res.json({
        code: 200,
        msg: 'success',
        data: { status: 'online', models: data }
      });
    }
    return res.json({ code: 200, msg: 'success', data: { status: 'offline' } });
  } catch (err) {
    return res.json({ code: 200, msg: 'success', data: { status: 'offline', error: err.message } });
  }
});

module.exports = router;
