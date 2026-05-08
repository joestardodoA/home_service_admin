/**
 * src/api/ai.js — AI 对话 API 封装（GenmaClaw Phase B）
 *
 * 使用 Fetch API（而非 Axios）实现 SSE 流式读取
 * Axios 不原生支持 ReadableStream，Fetch 是唯一选择
 */

/**
 * 发起流式 AI 对话
 * @param {Array} messages - 消息历史 [{ role: 'user'|'assistant', content: '...' }]
 * @param {Function} onChunk - 每收到一段文本时的回调 (text: string) => void
 * @param {Function} onDone - 流结束时的回调 () => void
 * @param {Function} onError - 错误回调 (error: Error) => void
 * @returns {AbortController} - 可用于取消请求
 */
export function chatStream(messages, onChunk, onDone, onError, onToolCall) {
  var controller = new AbortController()
  var token = localStorage.getItem('token')

  fetch('/api/ai/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + token
    },
    body: JSON.stringify({ messages: messages }),
    signal: controller.signal
  }).then(function(response) {
    if (!response.ok) {
      // 尝试读取错误信息
      return response.json().then(function(data) {
        throw new Error(data.msg || '请求失败（' + response.status + '）')
      }).catch(function(e) {
        if (e.message && !e.message.includes('请求失败')) {
          throw e
        }
        throw new Error('AI 服务暂时不可用（' + response.status + '）')
      })
    }

    var reader = response.body.getReader()
    var decoder = new TextDecoder()
    var buffer = ''

    function pump() {
      return reader.read().then(function(result) {
        if (result.done) {
          // 处理缓冲区中剩余数据
          if (buffer.trim()) {
            processSSEBuffer(buffer, onChunk, onToolCall)
          }
          onDone()
          return
        }

        buffer += decoder.decode(result.value, { stream: true })

        // 按行分割处理 SSE 数据
        var lines = buffer.split('\n')
        // 保留最后一个可能不完整的行
        buffer = lines.pop() || ''

        for (var i = 0; i < lines.length; i++) {
          var line = lines[i].trim()
          if (!line) continue
          if (line === 'data: [DONE]') {
            onDone()
            return
          }
          if (line.startsWith('data: ')) {
            try {
              var json = JSON.parse(line.slice(6))
              var content = ''
              // 兼容 OpenAI 格式
              if (json.choices && json.choices[0]) {
                var delta = json.choices[0].delta
                if (delta && delta.content) {
                  content = delta.content
                }
                // 检测工具调用事件
                if (delta && delta.tool_calls && onToolCall) {
                  for (var t = 0; t < delta.tool_calls.length; t++) {
                    var tc = delta.tool_calls[t]
                    var toolName = (tc.function && tc.function.name) || '工具'
                    onToolCall(toolName, '执行中')
                  }
                }
                // 检测 finish_reason 为 tool_calls 的完成事件
                if (json.choices[0].finish_reason === 'tool_calls' && onToolCall) {
                  onToolCall('工具', '完成')
                }
              }
              if (content) {
                onChunk(content)
              }
            } catch (parseErr) {
              // 解析失败，跳过此行（可能是不完整的 JSON）
            }
          }
        }

        return pump()
      })
    }

    return pump()
  }).catch(function(err) {
    if (err.name === 'AbortError') return // 用户主动取消
    onError(err)
  })

  return controller
}

/**
 * 处理残余 SSE 缓冲
 */
function processSSEBuffer(buffer, onChunk, onToolCall) {
  var lines = buffer.split('\n')
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i].trim()
    if (line.startsWith('data: ') && line !== 'data: [DONE]') {
      try {
        var json = JSON.parse(line.slice(6))
        if (json.choices && json.choices[0]) {
          if (json.choices[0].delta && json.choices[0].delta.content) {
            onChunk(json.choices[0].delta.content)
          }
          // 工具调用检测
          if (json.choices[0].delta && json.choices[0].delta.tool_calls && onToolCall) {
            for (var t = 0; t < json.choices[0].delta.tool_calls.length; t++) {
              var tc = json.choices[0].delta.tool_calls[t]
              var toolName = (tc.function && tc.function.name) || '工具'
              onToolCall(toolName, '执行中')
            }
          }
        }
      } catch (e) {}
    }
  }
}

/**
 * 检查 AI 服务状态
 */
export async function checkAiStatus() {
  var token = localStorage.getItem('token')
  try {
    var response = await fetch('/api/ai/status', {
      headers: { 'Authorization': 'Bearer ' + token }
    })
    var data = await response.json()
    return data.data
  } catch (e) {
    return { status: 'offline', error: e.message }
  }
}

// ==================== Phase C: AI 智能动作 API ====================

/**
 * AI 文件分析（SSE 流式）
 * @param {File} file - 上传的文件对象
 * @param {string} prompt - 分析指令
 * @param {Function} onChunk - 文本块回调
 * @param {Function} onDone - 完成回调
 * @param {Function} onError - 错误回调
 * @returns {AbortController}
 */
export function analyzeFile(file, prompt, onChunk, onDone, onError) {
  var controller = new AbortController()
  var token = localStorage.getItem('token')

  var formData = new FormData()
  formData.append('file', file)
  formData.append('prompt', prompt || '请分析这个文件的内容。')

  fetch('/api/ai/analyze-file', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + token },
    body: formData,
    signal: controller.signal
  }).then(function(response) {
    if (!response.ok) {
      return response.json().then(function(data) {
        throw new Error(data.msg || 'AI 文件分析失败（' + response.status + '）')
      }).catch(function(e) {
        if (e.message && !e.message.includes('分析失败')) throw e
        throw new Error('AI 服务不可用（' + response.status + '）')
      })
    }

    var reader = response.body.getReader()
    var decoder = new TextDecoder()
    var buffer = ''

    function pump() {
      return reader.read().then(function(result) {
        if (result.done) {
          if (buffer.trim()) processSSEBuffer(buffer, onChunk)
          onDone()
          return
        }
        buffer += decoder.decode(result.value, { stream: true })
        var lines = buffer.split('\n')
        buffer = lines.pop() || ''
        for (var i = 0; i < lines.length; i++) {
          var line = lines[i].trim()
          if (!line) continue
          if (line === 'data: [DONE]') { onDone(); return }
          if (line.startsWith('data: ')) {
            try {
              var json = JSON.parse(line.slice(6))
              if (json.choices && json.choices[0] && json.choices[0].delta && json.choices[0].delta.content) {
                onChunk(json.choices[0].delta.content)
              }
            } catch (e) {}
          }
        }
        return pump()
      })
    }
    return pump()
  }).catch(function(err) {
    if (err.name === 'AbortError') return
    onError(err)
  })

  return controller
}

/**
 * AI 导入辅助分析（非流式 JSON）
 * @param {{ headers: string[], sampleRows: object[], targetFields?: string[] }} data
 * @returns {Promise<object>}
 */
export async function analyzeImport(data) {
  var token = localStorage.getItem('token')
  var response = await fetch('/api/ai/analyze-import', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + token
    },
    body: JSON.stringify(data)
  })
  var result = await response.json()
  if (result.code !== 200) {
    throw new Error(result.msg || 'AI 导入分析失败')
  }
  return result.data
}

/**
 * AI 智能派单推荐（非流式 JSON）
 * @param {number} orderId - 订单 ID
 * @param {number} [topN=15] - 推荐数量
 * @returns {Promise<object>}
 */
export async function getAiRecommendations(orderId, topN) {
  var token = localStorage.getItem('token')
  var response = await fetch('/api/ai/recommend/' + orderId, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + token
    },
    body: JSON.stringify({ topN: topN || 15 })
  })
  var result = await response.json()
  if (result.code !== 200) {
    throw new Error(result.msg || 'AI 推荐失败')
  }
  return result.data
}

/**
 * AI 运营报告生成（SSE 流式）
 * @param {{ type: 'weekly'|'monthly', scope: 'all'|'personal' }} params
 * @param {Function} onChunk - 文本块回调
 * @param {Function} onDone - 完成回调
 * @param {Function} onError - 错误回调
 * @returns {AbortController}
 */
export function generateReport(params, onChunk, onDone, onError) {
  var controller = new AbortController()
  var token = localStorage.getItem('token')

  fetch('/api/ai/report', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + token
    },
    body: JSON.stringify(params),
    signal: controller.signal
  }).then(function(response) {
    if (!response.ok) {
      return response.json().then(function(data) {
        throw new Error(data.msg || '报告生成失败（' + response.status + '）')
      }).catch(function(e) {
        if (e.message && !e.message.includes('生成失败')) throw e
        throw new Error('AI 服务不可用（' + response.status + '）')
      })
    }

    var reader = response.body.getReader()
    var decoder = new TextDecoder()
    var buffer = ''

    function pump() {
      return reader.read().then(function(result) {
        if (result.done) {
          if (buffer.trim()) processSSEBuffer(buffer, onChunk)
          onDone()
          return
        }
        buffer += decoder.decode(result.value, { stream: true })
        var lines = buffer.split('\n')
        buffer = lines.pop() || ''
        for (var i = 0; i < lines.length; i++) {
          var line = lines[i].trim()
          if (!line) continue
          if (line === 'data: [DONE]') { onDone(); return }
          if (line.startsWith('data: ')) {
            try {
              var json = JSON.parse(line.slice(6))
              if (json.choices && json.choices[0] && json.choices[0].delta && json.choices[0].delta.content) {
                onChunk(json.choices[0].delta.content)
              }
            } catch (e) {}
          }
        }
        return pump()
      })
    }
    return pump()
  }).catch(function(err) {
    if (err.name === 'AbortError') return
    onError(err)
  })

  return controller
}

// ==================== Phase D: 历史报告 API ====================

/**
 * 获取历史报告列表
 * @param {{ page?: number, pageSize?: number, type?: string, scope?: string }} params
 * @returns {Promise<object>}
 */
export async function getReportList(params) {
  var token = localStorage.getItem('token')
  var query = new URLSearchParams()
  if (params.page) query.set('page', params.page)
  if (params.pageSize) query.set('pageSize', params.pageSize)
  if (params.type) query.set('type', params.type)
  if (params.scope) query.set('scope', params.scope)

  var response = await fetch('/api/ai/reports?' + query.toString(), {
    headers: { 'Authorization': 'Bearer ' + token }
  })
  var result = await response.json()
  if (result.code !== 200) throw new Error(result.msg || '获取报告列表失败')
  return result.data
}

/**
 * 获取单个报告详情
 * @param {number} id
 * @returns {Promise<object>}
 */
export async function getReportDetail(id) {
  var token = localStorage.getItem('token')
  var response = await fetch('/api/ai/reports/' + id, {
    headers: { 'Authorization': 'Bearer ' + token }
  })
  var result = await response.json()
  if (result.code !== 200) throw new Error(result.msg || '获取报告详情失败')
  return result.data
}

/**
 * 删除报告
 * @param {number} id
 * @returns {Promise<void>}
 */
export async function deleteReport(id) {
  var token = localStorage.getItem('token')
  var response = await fetch('/api/ai/reports/' + id, {
    method: 'DELETE',
    headers: { 'Authorization': 'Bearer ' + token }
  })
  var result = await response.json()
  if (result.code !== 200) throw new Error(result.msg || '删除报告失败')
}

