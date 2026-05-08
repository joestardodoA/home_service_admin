/**
 * server/routes/aiBusiness.js — AI 智能动作路由（GenmaClaw Phase C）
 *
 * 功能:
 *   POST /api/ai/analyze-file       — 悬浮球文件分析（SSE 流式）
 *   POST /api/ai/analyze-import     — 导入 AI 辅助解析（JSON）
 *   POST /api/ai/recommend/:orderId — 智能派单推荐（JSON）
 *   POST /api/ai/report             — 运营报告生成（SSE 流式）
 *
 * 架构:
 *   前端按钮 → Node.js 构造 prompt → OpenClaw Gateway → AI 返回结构化结果
 *
 * 安全:
 *   - 每个接口独立权限码（ai:analyze / ai:import / ai:recommend / ai:report）
 *   - 智能派单不脱敏（管理员点击展开后可见联系方式）
 *   - 普通销售仅可生成个人周报
 */
var express = require('express');
var router = express.Router();
var multer = require('multer');
var path = require('path');
var fs = require('fs');
var crypto = require('crypto');
var { authMiddleware, requirePermission, getEffectivePermissions } = require('../middleware/auth');
var { success, fail } = require('../utils/response');
var { parseFile, parseExcelToJson } = require('../utils/fileParser');
var uploadConfig = require('../config/upload');
var matchEngine = require('../services/matchEngine');
var { ServiceOrder, User, CouponOrder, Commission, Agency, Coupon, JobType, GuimiCircle } = require('../models');
var { Op, fn, col } = require('sequelize');

// OpenClaw Gateway 配置
var OPENCLAW_URL = process.env.OPENCLAW_URL || 'https://genmaclaw.yesao.net';
var OPENCLAW_TOKEN = process.env.OPENCLAW_TOKEN || '';

// 所有接口需要后台 JWT 认证
router.use(authMiddleware);

// ==================== 文件上传 multer 配置 ====================
var aiUploadDir = path.join(__dirname, '..', 'public/uploads/ai_temp');
if (!fs.existsSync(aiUploadDir)) {
  fs.mkdirSync(aiUploadDir, { recursive: true });
}

var aiStorage = multer.diskStorage({
  destination: function(req, file, cb) { cb(null, aiUploadDir); },
  filename: function(req, file, cb) {
    var ext = path.extname(file.originalname).toLowerCase();
    cb(null, Date.now() + '_' + crypto.randomBytes(4).toString('hex') + ext);
  }
});

var aiUpload = multer({
  storage: aiStorage,
  limits: { fileSize: uploadConfig.maxFileSize },
  fileFilter: function(req, file, cb) {
    if (uploadConfig.allowedMimeTypes.indexOf(file.mimetype) !== -1) {
      cb(null, true);
    } else {
      cb(new Error('不支持的文件类型: ' + file.mimetype));
    }
  }
});

// ==================== 工具函数 ====================

/**
 * 调用 OpenClaw 并返回非流式 JSON 结果
 */
async function callOpenClaw(systemPrompt, userContent, jsonMode) {
  var messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userContent }
  ];

  var body = { messages: messages, stream: false };
  if (jsonMode) {
    body.response_format = { type: 'json_object' };
  }

  var resp = await fetch(OPENCLAW_URL + '/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + OPENCLAW_TOKEN
    },
    body: JSON.stringify(body)
  });

  if (!resp.ok) {
    var errText = '';
    try { errText = await resp.text(); } catch(e) {}
    throw new Error('OpenClaw 调用失败(' + resp.status + '): ' + errText.slice(0, 200));
  }

  var data = await resp.json();
  var content = data.choices && data.choices[0] && data.choices[0].message
    ? data.choices[0].message.content : '';
  return content;
}

/**
 * 调用 OpenClaw 并以 SSE 流式响应
 */
async function streamOpenClaw(res, systemPrompt, userContent) {
  var messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userContent }
  ];

  var resp = await fetch(OPENCLAW_URL + '/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + OPENCLAW_TOKEN
    },
    body: JSON.stringify({ messages: messages, stream: true })
  });

  if (!resp.ok) {
    var errText = '';
    try { errText = await resp.text(); } catch(e) {}
    throw new Error('AI 服务不可用(' + resp.status + ')');
  }

  // 设置 SSE 响应头
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  var reader = resp.body.getReader();
  var decoder = new TextDecoder();
  try {
    while (true) {
      var result = await reader.read();
      if (result.done) break;
      res.write(decoder.decode(result.value, { stream: true }));
    }
  } catch (e) {
    console.error('[AI 流] 读取错误:', e.message);
  } finally {
    res.end();
  }
}

/**
 * 清理临时文件（延迟删除）
 */
function cleanupFile(filePath) {
  setTimeout(function() {
    try { fs.unlinkSync(filePath); } catch(e) {}
  }, 5000);
}

// ==================== 1. 文件分析（SSE 流式） ====================
router.post('/analyze-file',
  requirePermission('ai:analyze'),
  aiUpload.single('file'),
  async function(req, res) {
    var filePath = req.file ? req.file.path : null;
    try {
      if (!req.file) {
        return fail(res, '请上传文件');
      }

      var userPrompt = req.body.prompt || '请分析这个文件的内容，给出关键信息总结。';

      // 解析文件内容
      var parsed = parseFile(filePath, req.file.mimetype);

      var systemPrompt = [
        '你是 Genma 大模型，海南椰嫂综合平台的专属 AI 助手。',
        '用户上传了一个文件，请根据文件内容和用户指令进行分析。',
        '回复使用 Markdown 格式，善用表格和列表组织信息。',
        '如果是表格数据，重点分析数据质量、关键统计和异常值。',
        '不要提及 OpenClaw、DeepSeek 等底层技术。'
      ].join('\n');

      var content = '## 文件信息\n'
        + '文件名: ' + req.file.originalname + '\n'
        + '类型: ' + parsed.fileType + '\n\n'
        + '## 文件内容\n' + parsed.text + '\n\n'
        + '## 用户指令\n' + userPrompt;

      console.log('[AI 文件分析]', req.admin.username, '分析文件:', req.file.originalname);

      await streamOpenClaw(res, systemPrompt, content);

    } catch (err) {
      console.error('[AI 文件分析] 错误:', err.message);
      if (!res.headersSent) {
        return fail(res, 'AI 文件分析失败: ' + err.message, 500);
      }
      res.end();
    } finally {
      if (filePath) cleanupFile(filePath);
    }
  }
);

// ==================== 2. 导入 AI 辅助分析（JSON） ====================
router.post('/analyze-import',
  requirePermission('ai:import'),
  async function(req, res) {
    try {
      var headers = req.body.headers;
      var sampleRows = req.body.sampleRows;
      var targetFields = req.body.targetFields;

      if (!headers || !Array.isArray(headers) || headers.length === 0) {
        return fail(res, '请提供表头信息');
      }
      if (!sampleRows || !Array.isArray(sampleRows) || sampleRows.length === 0) {
        return fail(res, '请提供样本数据');
      }

      // 截取前 20 行样本
      var sample = sampleRows.slice(0, 20);

      var systemPrompt = [
        '你是数据导入助手。用户上传了一个包含人员信息的表格，需要你帮助分析和映射字段。',
        '你必须严格返回 JSON 格式，不要包含任何其他文字。',
        '',
        '返回格式:',
        '{',
        '  "fieldMapping": { "原始列名": "目标字段名", ... },',
        '  "issues": [',
        '    { "row": 行号, "field": "字段名", "value": "问题值", "issue": "问题描述" }',
        '  ],',
        '  "summary": {',
        '    "totalSample": 样本行数,',
        '    "validRows": 有效行数,',
        '    "issueCount": 问题数量,',
        '    "recommendation": "总体建议"',
        '  }',
        '}',
        '',
        '目标字段列表: nickname(昵称), realName(真实姓名), phone(手机号),',
        'city(城市), idCard(身份证号), preferredJobTypes(意向工种),',
        'expectedSalaryMin(期望最低薪资), expectedSalaryMax(期望最高薪资),',
        'experience(工作经验), bio(个人简介)'
      ].join('\n');

      // 添加用户自定义目标字段
      if (targetFields && Array.isArray(targetFields)) {
        systemPrompt += '\n\n用户自定义目标字段: ' + targetFields.join(', ');
      }

      var userContent = '## 表头\n' + headers.join(', ')
        + '\n\n## 样本数据（前 ' + sample.length + ' 行）\n'
        + JSON.stringify(sample, null, 2);

      console.log('[AI 导入分析]', req.admin.username, '分析 ' + headers.length + ' 列 × ' + sample.length + ' 行');

      var result = await callOpenClaw(systemPrompt, userContent, true);

      // 尝试解析 JSON
      var parsed = null;
      try {
        parsed = JSON.parse(result);
      } catch (e) {
        // AI 返回了非标准 JSON，尝试提取
        var jsonMatch = result.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try { parsed = JSON.parse(jsonMatch[0]); } catch(e2) {}
        }
      }

      if (!parsed) {
        return success(res, {
          raw: result,
          parsed: false,
          message: 'AI 返回了非结构化结果，请参考原始内容'
        });
      }

      return success(res, {
        fieldMapping: parsed.fieldMapping || {},
        issues: parsed.issues || [],
        summary: parsed.summary || {},
        parsed: true
      });

    } catch (err) {
      console.error('[AI 导入分析] 错误:', err.message);
      return fail(res, 'AI 导入分析失败: ' + err.message, 500);
    }
  }
);

// ==================== 3. 智能派单推荐（JSON） ====================
router.post('/recommend/:orderId',
  requirePermission('ai:recommend'),
  async function(req, res) {
    try {
      var orderId = parseInt(req.params.orderId);
      if (!orderId || isNaN(orderId)) {
        return fail(res, '无效的订单 ID');
      }

      var topN = parseInt(req.body.topN) || 15;
      if (topN < 5) topN = 5;
      if (topN > 30) topN = 30;

      // 1. 调用 matchEngine 获取候选人
      console.log('[AI 智能派单]', req.admin.username, '请求订单', orderId, '的智能推荐');
      var matchResult = await matchEngine.getRecommendations(orderId, topN);

      if (matchResult.error) {
        return fail(res, matchResult.error);
      }

      var candidates = matchResult.recommendations || [];
      if (candidates.length === 0) {
        return success(res, {
          orderId: orderId,
          orderNo: matchResult.orderNo,
          recommendations: [],
          aiSummary: '暂无符合条件的候选人',
          totalCandidates: 0
        });
      }

      // 2. 构造 AI prompt，让 AI 生成推荐理由
      var candidateSummary = candidates.map(function(c, idx) {
        var info = '候选人 ' + (idx + 1) + ': '
          + (c.nickname || '未设置昵称')
          + ' | 城市: ' + (c.city || '未知')
          + ' | 评分: ' + c.totalScore + '/' + c.maxScore
          + ' | 标签: ' + (c.tags.join(', ') || '无')
          + ' | 档期: ' + (c.available ? '可用' : '忙碌(' + c.activeOrderCount + '单)')
          + ' | 实名: ' + (c.isRealAuth ? '是' : '否')
          + ' | 管理评分: ' + (c.adminScore || 0) + '/100';

        // 评分明细
        var bd = c.breakdown;
        info += '\n  评分明细: 工种' + bd.jobType.score + ' 城市' + bd.city.score
          + ' 薪资' + bd.salary.score + ' 成功率' + bd.successRate.score
          + ' 实名' + bd.auth.score + ' 管理评' + bd.adminScore.score
          + ' 闺蜜圈' + bd.guimiCircle.score;

        return info;
      }).join('\n\n');

      var systemPrompt = [
        '你是海南椰嫂平台的智能派单助手。',
        '根据订单需求和候选人评分数据，为每位候选人生成简短推荐理由（每人1-2句话）。',
        '你必须严格返回 JSON 格式，不要包含任何其他文字。',
        '',
        '返回格式:',
        '{',
        '  "recommendations": [',
        '    { "index": 1, "reason": "推荐理由", "highlight": "最大优势关键词" }',
        '  ],',
        '  "summary": "整体推荐总结（1-2句话）"',
        '}',
        '',
        '推荐理由要结合具体数据，例如"同城阿姨，工种精确匹配，历史成功率85%"。',
        '如果是闺蜜圈成员，要特别提及"闺蜜圈优先推荐"。',
        '不要编造数据，只使用提供的评分信息。'
      ].join('\n');

      var userContent = '## 订单信息\n'
        + '订单号: ' + matchResult.orderNo + '\n'
        + '工种: ' + matchResult.jobTypeName + '\n'
        + '闺蜜圈成员数: ' + matchResult.guimiCircleMemberCount + '\n'
        + '候选池总人数: ' + matchResult.totalCandidates + '\n\n'
        + '## 候选人列表（已按评分排序）\n' + candidateSummary;

      var aiResult = await callOpenClaw(systemPrompt, userContent, true);

      // 解析 AI 推荐理由
      var aiParsed = null;
      try {
        aiParsed = JSON.parse(aiResult);
      } catch (e) {
        var m = aiResult.match(/\{[\s\S]*\}/);
        if (m) { try { aiParsed = JSON.parse(m[0]); } catch(e2) {} }
      }

      // 合并 matchEngine 数据 + AI 推荐理由
      var finalList = candidates.map(function(c, idx) {
        var aiRec = aiParsed && aiParsed.recommendations
          ? aiParsed.recommendations.find(function(r) { return r.index === idx + 1; })
          : null;

        return {
          // 卡片展示信息（默认可见）
          userId: c.userId,
          nickname: c.nickname,
          avatar: c.avatar,
          city: c.city,
          memberLevel: c.memberLevel,
          isRealAuth: c.isRealAuth,
          totalScore: c.totalScore,
          maxScore: c.maxScore,
          matchPercent: c.matchPercent,
          available: c.available,
          activeOrderCount: c.activeOrderCount,
          isGuimiMember: c.isGuimiMember,
          tags: c.tags,
          aiReason: aiRec ? aiRec.reason : '',
          aiHighlight: aiRec ? aiRec.highlight : '',
          // 点击展开后可见的详细信息
          detail: {
            phone: c.phone,
            realName: c.realName,
            adminScore: c.adminScore,
            breakdown: c.breakdown
          }
        };
      });

      return success(res, {
        orderId: matchResult.orderId,
        orderNo: matchResult.orderNo,
        jobTypeName: matchResult.jobTypeName,
        totalCandidates: matchResult.totalCandidates,
        guimiCircleMemberCount: matchResult.guimiCircleMemberCount,
        aiSummary: aiParsed ? aiParsed.summary : '',
        recommendations: finalList,
        existingApplicants: matchResult.existingApplicants,
        weights: matchResult.weights
      });

    } catch (err) {
      console.error('[AI 智能派单] 错误:', err.message);
      return fail(res, 'AI 智能派单失败: ' + err.message, 500);
    }
  }
);

// ==================== 4. 运营报告生成（SSE 流式 + 自动存档） ====================

/**
 * 流式输出并收集完整内容，流结束后自动存档
 */
async function streamAndSave(res, systemPrompt, userContent, saveInfo) {
  var messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userContent }
  ];

  var resp = await fetch(OPENCLAW_URL + '/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + OPENCLAW_TOKEN
    },
    body: JSON.stringify({ messages: messages, stream: true })
  });

  if (!resp.ok) {
    var errText = '';
    try { errText = await resp.text(); } catch(e) {}
    throw new Error('AI 服务不可用(' + resp.status + ')');
  }

  // 设置 SSE 响应头
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  var reader = resp.body.getReader();
  var decoder = new TextDecoder();
  var fullContent = ''; // 收集完整内容

  try {
    while (true) {
      var result = await reader.read();
      if (result.done) break;
      var chunk = decoder.decode(result.value, { stream: true });
      res.write(chunk);

      // 从 SSE 块中提取文本内容
      var lines = chunk.split('\n');
      for (var i = 0; i < lines.length; i++) {
        var line = lines[i].trim();
        if (line.startsWith('data: ') && line !== 'data: [DONE]') {
          try {
            var json = JSON.parse(line.slice(6));
            if (json.choices && json.choices[0] && json.choices[0].delta && json.choices[0].delta.content) {
              fullContent += json.choices[0].delta.content;
            }
          } catch(e) {}
        }
      }
    }
  } catch (e) {
    console.error('[AI 流] 读取错误:', e.message);
  } finally {
    res.end();
  }

  // 流结束后异步存档（不阻塞响应）
  if (fullContent.length > 10 && saveInfo) {
    try {
      var AiReportModel = require('../models/AiReport');
      await AiReportModel.create({
        adminId: saveInfo.adminId,
        type: saveInfo.type,
        scope: saveInfo.scope,
        periodLabel: saveInfo.periodLabel,
        periodStart: saveInfo.periodStart,
        periodEnd: saveInfo.periodEnd,
        content: fullContent,
        rawData: saveInfo.rawData
      });
      console.log('[AI 报告] 已自动存档，长度:', fullContent.length);
    } catch (saveErr) {
      console.error('[AI 报告] 存档失败:', saveErr.message);
    }
  }
}

router.post('/report',
  requirePermission('ai:report'),
  async function(req, res) {
    try {
      var type = req.body.type || 'weekly';   // weekly / monthly
      var scope = req.body.scope || 'all';    // all / personal

      // 权限检查：普通销售只能生成个人报告
      var perms = getEffectivePermissions(req.admin);
      if (scope === 'all' && req.admin.role !== 'super' && perms.indexOf('service_orders:view_all') === -1) {
        scope = 'personal';
      }

      // 计算时间范围
      var now = new Date();
      var startDate, periodLabel;
      if (type === 'monthly') {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        periodLabel = now.getFullYear() + '年' + (now.getMonth() + 1) + '月';
      } else {
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 7);
        startDate.setHours(0, 0, 0, 0);
        periodLabel = (startDate.getMonth() + 1) + '/' + startDate.getDate()
          + ' - ' + (now.getMonth() + 1) + '/' + now.getDate();
      }

      var dateFilter = { [Op.gte]: startDate, [Op.lte]: now };

      // 聚合数据（含环比）
      var reportData = {};
      if (scope === 'all') {
        reportData = await aggregateAllData(dateFilter, periodLabel, type, startDate, now);
      } else {
        reportData = await aggregatePersonalData(dateFilter, periodLabel, type, req.admin, startDate, now);
      }

      // 构造 prompt（新增环比分析指令）
      var systemPrompt = [
        '你是 Genma 大模型，海南椰嫂综合平台的运营分析师。',
        '根据提供的数据生成专业的运营' + (type === 'monthly' ? '月报' : '周报') + '。',
        '报告格式要求：使用 Markdown，包含以下章节：',
        '1. 📊 数据摘要（核心指标一览表）',
        '2. 📈 环比分析（与上一周期对比，指出增长或下降的关键指标）',
        '3. 🔍 关键发现（数据背后的洞察）',
        '4. 💡 改进建议（具体可执行的行动项）',
        '',
        '数据中带有 Prev 后缀的字段是上一周期的值，带 Change 后缀的是环比变化率。',
        '请重点分析环比变化，指出哪些指标在改善、哪些需要关注。',
        '语气专业但友好，数据引用准确，建议具体可执行。',
        scope === 'personal' ? '这是个人工作报告，聚焦个人业绩表现和改进方向。' : '这是全平台运营报告，需要宏观视角和战略建议。',
        '不要提及 OpenClaw、DeepSeek 等技术细节。'
      ].join('\n');

      var userContent = '## 报告周期: ' + periodLabel + '\n'
        + '## 报告范围: ' + (scope === 'all' ? '全平台' : req.admin.username + ' 个人') + '\n\n'
        + '## 数据\n' + JSON.stringify(reportData, null, 2);

      console.log('[AI 报告]', req.admin.username, '生成' + (scope === 'all' ? '全平台' : '个人') + type);

      // 流式输出 + 自动存档
      await streamAndSave(res, systemPrompt, userContent, {
        adminId: req.admin.id,
        type: type,
        scope: scope,
        periodLabel: periodLabel,
        periodStart: startDate,
        periodEnd: now,
        rawData: reportData
      });

    } catch (err) {
      console.error('[AI 报告] 错误:', err.message);
      if (!res.headersSent) {
        return fail(res, 'AI 报告生成失败: ' + err.message, 500);
      }
      res.end();
    }
  }
);

// ==================== 数据聚合函数 ====================

/**
 * 计算环比变化率
 */
function calcChange(current, previous) {
  if (previous === 0) return current > 0 ? '+100%' : '持平';
  var rate = Math.round((current - previous) / previous * 100);
  return (rate >= 0 ? '+' : '') + rate + '%';
}

/**
 * 获取单项统计数据（当期 + 上期）
 */
async function fetchPeriodPair(queryFn, dateFilter, prevDateFilter) {
  var current = await queryFn(dateFilter);
  var previous = await queryFn(prevDateFilter);
  return { current: current, previous: previous, change: calcChange(current, previous) };
}

/**
 * 聚合全平台运营数据（含环比对比）
 */
async function aggregateAllData(dateFilter, periodLabel, type, startDate, endDate) {
  // 计算上一周期的时间范围
  var periodMs = endDate.getTime() - startDate.getTime();
  var prevStart = new Date(startDate.getTime() - periodMs);
  var prevEnd = new Date(startDate.getTime() - 1);
  var prevDateFilter = { [Op.gte]: prevStart, [Op.lte]: prevEnd };

  var prevLabel = (prevStart.getMonth() + 1) + '/' + prevStart.getDate()
    + ' - ' + (prevEnd.getMonth() + 1) + '/' + prevEnd.getDate();

  // 并行查询当期和上期数据
  var totalUsers = await User.count();

  var newUsers = await fetchPeriodPair(
    function(df) { return User.count({ where: { createdAt: df } }); },
    dateFilter, prevDateFilter
  );
  var newOrders = await fetchPeriodPair(
    function(df) { return ServiceOrder.count({ where: { createdAt: df } }); },
    dateFilter, prevDateFilter
  );
  var completedOrders = await fetchPeriodPair(
    function(df) {
      return ServiceOrder.count({
        where: { status: 'completed', [Op.or]: [{ completedAt: df }, { completedAt: null, updatedAt: df }] }
      });
    },
    dateFilter, prevDateFilter
  );
  var totalRevenue = await fetchPeriodPair(
    function(df) {
      return ServiceOrder.sum('actualAmount', {
        where: { status: 'completed', [Op.or]: [{ completedAt: df }, { completedAt: null, updatedAt: df }] }
      }).then(function(v) { return v || 0; });
    },
    dateFilter, prevDateFilter
  );
  var pendingOrders = await ServiceOrder.count({ where: { status: 'pending' } });
  var couponsClaimed = await fetchPeriodPair(
    function(df) { return CouponOrder.count({ where: { createdAt: df } }); },
    dateFilter, prevDateFilter
  );
  var couponsUsed = await fetchPeriodPair(
    function(df) { return CouponOrder.count({ where: { status: 'used', useDate: df } }); },
    dateFilter, prevDateFilter
  );
  var commissionTotal = await fetchPeriodPair(
    function(df) { return Commission.sum('amount', { where: { createdAt: df } }).then(function(v) { return v || 0; }); },
    dateFilter, prevDateFilter
  );

  // 工种分布（仅当期）
  var ordersByJobType = await ServiceOrder.findAll({
    where: { createdAt: dateFilter },
    attributes: ['jobTypeId', [fn('COUNT', col('id')), 'count']],
    group: ['jobTypeId'],
    raw: true
  });
  var jobTypeIds = ordersByJobType.map(function(o) { return o.jobTypeId; });
  var jobTypes = jobTypeIds.length > 0
    ? await JobType.findAll({ where: { id: jobTypeIds }, attributes: ['id', 'name'] })
    : [];
  var jobTypeMap = {};
  jobTypes.forEach(function(j) { jobTypeMap[j.id] = j.name; });
  var jobTypeDistribution = ordersByJobType.map(function(o) {
    return { name: jobTypeMap[o.jobTypeId] || '未知', count: parseInt(o.count) };
  });

  return {
    period: periodLabel,
    previousPeriod: prevLabel,
    scope: '全平台',
    users: { total: totalUsers, new: newUsers.current, newPrev: newUsers.previous, newChange: newUsers.change },
    serviceOrders: {
      new: newOrders.current, newPrev: newOrders.previous, newChange: newOrders.change,
      completed: completedOrders.current, completedPrev: completedOrders.previous, completedChange: completedOrders.change,
      pending: pendingOrders,
      revenue: parseFloat(totalRevenue.current), revenuePrev: parseFloat(totalRevenue.previous), revenueChange: totalRevenue.change
    },
    coupons: {
      claimed: couponsClaimed.current, claimedPrev: couponsClaimed.previous, claimedChange: couponsClaimed.change,
      used: couponsUsed.current, usedPrev: couponsUsed.previous, usedChange: couponsUsed.change
    },
    commission: parseFloat(commissionTotal.current),
    commissionPrev: parseFloat(commissionTotal.previous),
    commissionChange: commissionTotal.change,
    jobTypeDistribution: jobTypeDistribution
  };
}

/**
 * 聚合个人业绩数据（含环比对比）
 */
async function aggregatePersonalData(dateFilter, periodLabel, type, admin, startDate, endDate) {
  var periodMs = endDate.getTime() - startDate.getTime();
  var prevStart = new Date(startDate.getTime() - periodMs);
  var prevEnd = new Date(startDate.getTime() - 1);
  var prevDateFilter = { [Op.gte]: prevStart, [Op.lte]: prevEnd };

  var myOrders = await fetchPeriodPair(
    function(df) { return ServiceOrder.count({ where: { assignedAdminId: admin.id, createdAt: df } }); },
    dateFilter, prevDateFilter
  );
  var myCompleted = await fetchPeriodPair(
    function(df) { return ServiceOrder.count({ where: { assignedAdminId: admin.id, status: 'completed', completedAt: df } }); },
    dateFilter, prevDateFilter
  );
  var myRevenue = await fetchPeriodPair(
    function(df) {
      return ServiceOrder.sum('actualAmount', {
        where: { assignedAdminId: admin.id, status: 'completed', completedAt: df }
      }).then(function(v) { return v || 0; });
    },
    dateFilter, prevDateFilter
  );
  var myPending = await ServiceOrder.count({
    where: { assignedAdminId: admin.id, status: { [Op.in]: ['assigned', 'matching'] } }
  });

  return {
    period: periodLabel,
    scope: '个人(' + admin.username + ')',
    myOrders: {
      total: myOrders.current, totalPrev: myOrders.previous, totalChange: myOrders.change,
      completed: myCompleted.current, completedPrev: myCompleted.previous, completedChange: myCompleted.change,
      pending: myPending,
      revenue: parseFloat(myRevenue.current), revenuePrev: parseFloat(myRevenue.previous), revenueChange: myRevenue.change,
      completionRate: myOrders.current > 0 ? Math.round(myCompleted.current / myOrders.current * 100) + '%' : 'N/A'
    }
  };
}

// ==================== 5. 历史报告 CRUD ====================

var AiReport = require('../models/AiReport');
var Admin = require('../models/Admin');

// 获取历史报告列表
router.get('/reports',
  requirePermission('ai:report'),
  async function(req, res) {
    try {
      var page = parseInt(req.query.page) || 1;
      var pageSize = parseInt(req.query.pageSize) || 10;
      var typeFilter = req.query.type;   // weekly / monthly
      var scopeFilter = req.query.scope; // all / personal

      var where = {};
      if (typeFilter) where.type = typeFilter;
      if (scopeFilter) where.scope = scopeFilter;

      // 非超管只能看自己的报告
      var perms = getEffectivePermissions(req.admin);
      if (req.admin.role !== 'super' && perms.indexOf('service_orders:view_all') === -1) {
        where.adminId = req.admin.id;
      }

      var result = await AiReport.findAndCountAll({
        where: where,
        include: [{ model: Admin, as: 'admin', attributes: ['id', 'username', 'realName'] }],
        order: [['createdAt', 'DESC']],
        offset: (page - 1) * pageSize,
        limit: pageSize,
        attributes: ['id', 'type', 'scope', 'periodLabel', 'periodStart', 'periodEnd', 'adminId', 'createdAt']
      });

      return success(res, {
        list: result.rows,
        total: result.count,
        page: page,
        pageSize: pageSize
      });
    } catch (err) {
      console.error('[AI 报告列表] 错误:', err.message);
      return fail(res, '获取报告列表失败: ' + err.message, 500);
    }
  }
);

// 获取单个报告详情
router.get('/reports/:id',
  requirePermission('ai:report'),
  async function(req, res) {
    try {
      var report = await AiReport.findByPk(req.params.id, {
        include: [{ model: Admin, as: 'admin', attributes: ['id', 'username', 'realName'] }]
      });
      if (!report) return fail(res, '报告不存在', 404);

      // 非超管只能查看自己的报告
      if (req.admin.role !== 'super' && report.adminId !== req.admin.id) {
        return fail(res, '无权查看此报告', 403);
      }

      return success(res, report);
    } catch (err) {
      console.error('[AI 报告详情] 错误:', err.message);
      return fail(res, '获取报告详情失败', 500);
    }
  }
);

// 删除报告
router.delete('/reports/:id',
  requirePermission('ai:report'),
  async function(req, res) {
    try {
      var report = await AiReport.findByPk(req.params.id);
      if (!report) return fail(res, '报告不存在', 404);

      // 非超管只能删除自己的报告
      if (req.admin.role !== 'super' && report.adminId !== req.admin.id) {
        return fail(res, '无权删除此报告', 403);
      }

      await report.destroy();
      return success(res, null, '报告已删除');
    } catch (err) {
      console.error('[AI 报告删除] 错误:', err.message);
      return fail(res, '删除报告失败', 500);
    }
  }
);

module.exports = router;
