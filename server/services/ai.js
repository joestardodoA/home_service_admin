// server/services/ai.js — AI 服务统一入口（海南椰嫂综合平台）
// 统一管理所有 LLM / OCR 调用，便于切换供应商和控制成本
// 当前为占位实现，后续接入真实 API 只需修改此文件

// ==================== 配置 ====================
// 从环境变量读取，部署时在 .env 中配置
var AI_CONFIG = {
  provider: process.env.AI_PROVIDER || 'deepseek',
  apiKey: process.env.AI_API_KEY || 'sk-ce92e7c9e5da4177ba9106eb41308e07',
  baseUrl: process.env.AI_BASE_URL || 'https://api.deepseek.com',
  model: process.env.AI_MODEL || 'deepseek-v4-pro'
};

var OCR_CONFIG = {
  provider: process.env.OCR_PROVIDER || 'mock',   // mock / tencent / baidu
  secretId: process.env.OCR_SECRET_ID || '',
  secretKey: process.env.OCR_SECRET_KEY || ''
};

// ==================== LLM 调用（统一接口） ====================

/**
 * 调用 LLM 生成回复
 * @param {string} systemPrompt - 系统提示词
 * @param {string} userMessage - 用户消息
 * @param {Object} options - 可选参数 { temperature, maxTokens, responseFormat }
 * @returns {Promise<string>} - LLM 回复文本
 */
async function callLLM(systemPrompt, userMessage, options) {
  if (!options) options = {};

  // Mock 模式：返回模拟数据（开发测试用）
  if (AI_CONFIG.provider === 'mock') {
    console.log('[AI Mock] 系统提示:', (systemPrompt || '').slice(0, 50) + '...');
    console.log('[AI Mock] 用户消息:', (userMessage || '').slice(0, 100));
    return '[AI Mock 回复] 当前为模拟模式，请配置 AI_PROVIDER 和 AI_API_KEY 启用真实 AI 服务。';
  }

  // 真实调用（需要安装 axios: npm install axios）
  try {
    var axios = require('axios');
    var url = '';
    var headers = {};
    var body = {};

    if (AI_CONFIG.provider === 'deepseek') {
      // DeepSeek API（兼容 OpenAI 格式）
      url = (AI_CONFIG.baseUrl || 'https://api.deepseek.com') + '/chat/completions';
      headers = { 'Authorization': 'Bearer ' + AI_CONFIG.apiKey, 'Content-Type': 'application/json' };
      body = {
        model: AI_CONFIG.model || 'deepseek-chat',
        messages: options.messages || [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage }
        ],
        temperature: options.temperature || 0.7,
        max_tokens: options.maxTokens || 2000
      };
      if (options.responseFormat === 'json') {
        body.response_format = { type: 'json_object' };
      }
    } else if (AI_CONFIG.provider === 'qwen') {
      // 通义千问 API
      url = (AI_CONFIG.baseUrl || 'https://dashscope.aliyuncs.com/compatible-mode/v1') + '/chat/completions';
      headers = { 'Authorization': 'Bearer ' + AI_CONFIG.apiKey, 'Content-Type': 'application/json' };
      body = {
        model: AI_CONFIG.model || 'qwen-plus',
        messages: options.messages || [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage }
        ],
        temperature: options.temperature || 0.7,
        max_tokens: options.maxTokens || 2000
      };
    } else if (AI_CONFIG.provider === 'openai') {
      // OpenAI API
      url = (AI_CONFIG.baseUrl || 'https://api.openai.com/v1') + '/chat/completions';
      headers = { 'Authorization': 'Bearer ' + AI_CONFIG.apiKey, 'Content-Type': 'application/json' };
      body = {
        model: AI_CONFIG.model || 'gpt-4o-mini',
        messages: options.messages || [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage }
        ],
        temperature: options.temperature || 0.7,
        max_tokens: options.maxTokens || 2000
      };
    } else {
      return '[AI 错误] 未知的 AI_PROVIDER: ' + AI_CONFIG.provider;
    }

    var response = await axios.post(url, body, { headers: headers, timeout: 60000 });
    var content = response.data.choices[0].message.content || '';
    return content;
  } catch (err) {
    console.error('[AI 调用失败]', err.message);
    return '[AI 错误] 调用失败: ' + err.message;
  }
}

/**
 * 流式调用 LLM（SSE）— 将流式响应直接管道到 HTTP Response
 * @param {Object} res - Express Response 对象
 * @param {Array} messages - 消息列表
 * @param {Object} options - 可选参数
 */
async function callLLMStream(res, messages, options) {
  if (!options) options = {};
  var axios = require('axios');

  // 构建请求
  var url = (AI_CONFIG.baseUrl || 'https://api.deepseek.com') + '/chat/completions';
  var headers = {
    'Authorization': 'Bearer ' + AI_CONFIG.apiKey,
    'Content-Type': 'application/json'
  };
  var body = {
    model: AI_CONFIG.model || 'deepseek-v4-pro',
    messages: messages,
    temperature: options.temperature || 0.7,
    max_tokens: options.maxTokens || 2000,
    stream: true
  };

  // 设置 SSE 响应头
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  try {
    var response = await axios.post(url, body, {
      headers: headers,
      timeout: 60000,
      responseType: 'stream'
    });

    var fullContent = '';

    response.data.on('data', function(chunk) {
      var text = chunk.toString();
      // SSE 数据可能包含多行
      var lines = text.split('\n');
      for (var i = 0; i < lines.length; i++) {
        var line = lines[i].trim();
        if (!line || !line.startsWith('data: ')) continue;
        var jsonStr = line.slice(6);
        if (jsonStr === '[DONE]') {
          // 流结束，发送结束标记
          res.write('data: [DONE]\n\n');
          return;
        }
        try {
          var parsed = JSON.parse(jsonStr);
          var delta = parsed.choices && parsed.choices[0] && parsed.choices[0].delta;
          if (delta && delta.content) {
            fullContent += delta.content;
            // 转发给客户端
            res.write('data: ' + JSON.stringify({ content: delta.content }) + '\n\n');
          }
        } catch (e) {
          // 解析失败跳过
        }
      }
    });

    response.data.on('end', function() {
      res.write('data: [DONE]\n\n');
      res.end();
    });

    response.data.on('error', function(err) {
      console.error('[AI 流式错误]', err.message);
      res.write('data: ' + JSON.stringify({ error: err.message }) + '\n\n');
      res.write('data: [DONE]\n\n');
      res.end();
    });
  } catch (err) {
    console.error('[AI 流式调用失败]', err.message);
    res.write('data: ' + JSON.stringify({ error: '服务暂时不可用: ' + err.message }) + '\n\n');
    res.write('data: [DONE]\n\n');
    res.end();
  }
}

/**
 * 调用 LLM 并解析 JSON 响应
 */
async function callLLMJson(systemPrompt, userMessage, options) {
  if (!options) options = {};
  options.responseFormat = 'json';

  var result = await callLLM(systemPrompt, userMessage, options);

  // Mock 模式返回空对象
  if (AI_CONFIG.provider === 'mock') return {};

  // 尝试解析 JSON
  try {
    // 处理 markdown 代码块包裹的 JSON
    var cleaned = result.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(cleaned);
  } catch (e) {
    console.error('[AI JSON 解析失败]', result);
    return { error: '解析失败', raw: result };
  }
}

// ==================== 业务函数：解析发单意图 ====================

// 中文数字映射
var CN_NUM = { '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9, '十': 10 };

/**
 * Mock 模式下的规则引擎解析（无需 LLM，基于关键词提取）
 * 当配置了真实 LLM 后会自动切换为 AI 解析
 */
function mockParseOrder(text, jobTypes) {
  var result = {
    jobTypeName: '',
    jobTypeId: null,
    city: '',
    salaryMin: null,
    salaryMax: null,
    salaryType: 'monthly',
    serviceDate: '',
    remark: ''
  };

  var normalized = text.replace(/\s+/g, ' ').trim();

  // 1. 匹配工种
  for (var i = 0; i < jobTypes.length; i++) {
    if (normalized.indexOf(jobTypes[i].name) !== -1) {
      result.jobTypeName = jobTypes[i].name;
      result.jobTypeId = jobTypes[i].id;
      break;
    }
  }
  // 常见别名兜底
  if (!result.jobTypeName) {
    var aliases = {
      '月嫂': '月嫂', '育儿嫂': '育儿嫂', '育婴': '育儿嫂', '带孩子': '育儿嫂',
      '保洁': '保洁', '打扫': '保洁', '清洁': '保洁',
      '保姆': '家务', '做饭': '家务', '家政': '家务',
      '护工': '养老护理', '老人': '养老护理', '养老': '养老护理',
      '产后': '产康', '产康': '产康', '恢复': '产康',
      '钟点工': '钟点工', '临时': '钟点工'
    };
    var keys = Object.keys(aliases);
    for (var a = 0; a < keys.length; a++) {
      if (normalized.indexOf(keys[a]) !== -1) {
        var targetName = aliases[keys[a]];
        for (var j = 0; j < jobTypes.length; j++) {
          if (jobTypes[j].name.indexOf(targetName) !== -1) {
            result.jobTypeName = jobTypes[j].name;
            result.jobTypeId = jobTypes[j].id;
            break;
          }
        }
        if (result.jobTypeName) break;
      }
    }
  }

  // 2. 匹配城市
  // 先尝试常见城市名直接匹配（优先，避免正则带前缀）
  var commonCities = ['海口', '三亚', '儋州', '琼海', '文昌', '万宁', '五指山', '东方',
    '北京', '上海', '广州', '深圳', '成都', '重庆', '武汉', '杭州', '南京', '西安'];
  for (var c = 0; c < commonCities.length; c++) {
    if (normalized.indexOf(commonCities[c]) !== -1) {
      result.city = commonCities[c];
      break;
    }
  }
  // 如果没有精确匹配，尝试带后缀的城市名（去掉“市/县/区”后缀）
  if (!result.city) {
    var cityMatch = normalized.match(/([\u4e00-\u9fa5]{2,4})(?:市|县|区|州)/);
    if (cityMatch) {
      result.city = cityMatch[1];
    }
  }

  // 3. 匹配薪资（支持多种写法）
  // "1万" "1w" "10000" "8000-12000" "8千到1万" "预算1万左右"
  var salaryPatterns = [
    // "8000-12000" 或 "8000到12000"（排除月日格式如"6月1号"）
    /(\d{4,})\s*[-~到至]\s*(\d{4,})\s*(?:元|块)?/,
    // "1万到1.5万" 或 "1万-1.5万"
    /(\d+(?:\.\d+)?)\s*[万w]\s*[-~到至]\s*(\d+(?:\.\d+)?)\s*[万w]/,
    // "8千到1万" "8千-1万"（千万混合格式）
    /(\d+)\s*千\s*[-~到至]\s*(\d+(?:\.\d+)?)\s*[万w]/,
    // "预算1万" "薪资1万" "1万左右"
    /(?:预算|薪资|工资|月薪)?(\d+(?:\.\d+)?)\s*[万w](?:左右|以[上内])?/,
    // "8千" "八千"
    /(\d+)\s*千/,
    // 纯数字（4位以上视为薪资）
    /(?:预算|薪资|工资|月薪)\s*(\d{4,})/
  ];

  // 薪资匹配处理器索引对应：
  // 0=数字范围, 1=万范围, 2=千到万, 3=单万, 4=千, 5=纯数字
  var SALARY_HANDLER_INDEX_QIAN_TO_WAN = 2;

  for (var p = 0; p < salaryPatterns.length; p++) {
    var sm = normalized.match(salaryPatterns[p]);
    if (sm) {
      if (p === 0) {
        // "8000-12000"
        result.salaryMin = parseInt(sm[1]);
        result.salaryMax = parseInt(sm[2]);
      } else if (p === 1) {
        // "1万-1.5万"
        result.salaryMin = Math.round(parseFloat(sm[1]) * 10000);
        result.salaryMax = Math.round(parseFloat(sm[2]) * 10000);
      } else if (p === SALARY_HANDLER_INDEX_QIAN_TO_WAN) {
        // "8千到1万"
        result.salaryMin = parseInt(sm[1]) * 1000;
        result.salaryMax = Math.round(parseFloat(sm[2]) * 10000);
      } else if (p === 3) {
        // "预算1万"
        var base = Math.round(parseFloat(sm[1]) * 10000);
        result.salaryMin = Math.round(base * 0.8);
        result.salaryMax = Math.round(base * 1.2);
      } else if (p === 4) {
        // "8千"
        var baseK = parseInt(sm[1]) * 1000;
        result.salaryMin = Math.round(baseK * 0.8);
        result.salaryMax = Math.round(baseK * 1.2);
      } else if (p === 5) {
        // 纯数字
        var baseN = parseInt(sm[1]);
        result.salaryMin = Math.round(baseN * 0.8);
        result.salaryMax = Math.round(baseN * 1.2);
      }
      break;
    }
  }

  // 4. 匹配日期
  // "下月初" "下个月" "6月" "6月1号" "明天" "下周"
  var now = new Date();
  var datePatterns = [
    { regex: /(\d{1,2})月(\d{1,2})[日号]/, handler: function(m) {
      var d = new Date(now.getFullYear(), parseInt(m[1]) - 1, parseInt(m[2]));
      if (d < now) d.setFullYear(d.getFullYear() + 1);
      return d;
    }},
    { regex: /(\d{1,2})月/, handler: function(m) {
      var month = parseInt(m[1]) - 1;
      var d = new Date(now.getFullYear(), month, 1);
      if (d < now) d.setFullYear(d.getFullYear() + 1);
      return d;
    }},
    { regex: /下[个]?月[初]?/, handler: function() {
      return new Date(now.getFullYear(), now.getMonth() + 1, 1);
    }},
    { regex: /这[个]?月/, handler: function() {
      return new Date(now.getFullYear(), now.getMonth(), 15);
    }},
    { regex: /明天/, handler: function() {
      var d = new Date(now); d.setDate(d.getDate() + 1);
      return d;
    }},
    { regex: /后天/, handler: function() {
      var d = new Date(now); d.setDate(d.getDate() + 2);
      return d;
    }},
    { regex: /马上|尽快|立即|急需/, handler: function() {
      var d = new Date(now); d.setDate(d.getDate() + 3);
      return d;
    }}
  ];

  for (var dp = 0; dp < datePatterns.length; dp++) {
    var dm = normalized.match(datePatterns[dp].regex);
    if (dm) {
      var parsedDate = datePatterns[dp].handler(dm);
      result.serviceDate = parsedDate.getFullYear() + '-' +
        ('0' + (parsedDate.getMonth() + 1)).slice(-2) + '-' +
        ('0' + parsedDate.getDate()).slice(-2);
      break;
    }
  }

  // 5. 剩余文本作为备注（去掉已提取的部分）
  var remainText = normalized;
  if (result.jobTypeName) remainText = remainText.replace(result.jobTypeName, '');
  if (result.city) remainText = remainText.replace(result.city, '');
  remainText = remainText.replace(/[，,。.！!？?、\s]+/g, ' ').trim();
  if (remainText.length > 2 && remainText.length < 100) {
    result.remark = remainText;
  }

  return result;
}

/**
 * 解析用户自然语言发单需求
 * @param {string} text - 用户输入的自然语言文本
 * @param {Array} jobTypes - 可用工种列表 [{id, name, code}]
 * @returns {Promise<Object>} - 解析后的结构化订单数据
 */
async function parseOrderIntent(text, jobTypes) {
  if (!text || text.trim().length === 0) {
    return { error: '请输入需求描述' };
  }

  // Mock 模式：使用规则引擎
  if (AI_CONFIG.provider === 'mock') {
    console.log('[AI Mock] 解析发单意图:', text);
    var mockResult = mockParseOrder(text, jobTypes);
    mockResult._source = 'rule_engine';
    return mockResult;
  }

  // 真实 LLM 模式
  var systemPrompt = '你是海南椰嫂家政平台的智能助手。用户想要发布一个家政服务需求，请从用户的描述中提取结构化信息。\n\n' +
    '可选工种列表：' + jobTypes.map(function(j) { return j.name; }).join('、') + '\n\n' +
    '请严格以 JSON 格式返回，字段如下：\n' +
    '{\n' +
    '  "jobTypeName": "匹配到的工种名称（必须是可选列表中的一个）",\n' +
    '  "city": "城市名",\n' +
    '  "salaryMin": 最低薪资数字(元/月),\n' +
    '  "salaryMax": 最高薪资数字(元/月),\n' +
    '  "serviceDate": "YYYY-MM-DD格式的日期，如果用户说下月初则计算具体日期",\n' +
    '  "remark": "其他补充信息"\n' +
    '}\n' +
    '如果某个字段无法从文本提取，设为 null。注意薪资统一转换为 元/月。';

  var parsed = await callLLMJson(systemPrompt, text, { temperature: 0.3 });

  // 匹配工种 ID
  if (parsed.jobTypeName) {
    for (var k = 0; k < jobTypes.length; k++) {
      if (jobTypes[k].name === parsed.jobTypeName || jobTypes[k].name.indexOf(parsed.jobTypeName) !== -1) {
        parsed.jobTypeId = jobTypes[k].id;
        break;
      }
    }
  }

  parsed._source = 'llm';
  return parsed;
}

// ==================== 导出 ====================
module.exports = {
  callLLM: callLLM,
  callLLMStream: callLLMStream,
  callLLMJson: callLLMJson,
  parseOrderIntent: parseOrderIntent,
  AI_CONFIG: AI_CONFIG,
  OCR_CONFIG: OCR_CONFIG
};

