<template>
  <!-- AI 悬浮球 -->
  <!-- 自定义图标位置：替换下方 SVG 为你的品牌 Logo -->
  <div class="ai-fab" :class="{ 'ai-fab-hidden': panelOpen }" @click="togglePanel" id="ai-fab-trigger">
    <div class="ai-fab-inner">
      <!-- 自定义图标位置 START -->
      <svg class="ai-fab-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" fill="url(#fab-grad)" opacity="0.15"/>
        <circle cx="9" cy="10" r="1.2" fill="currentColor"/>
        <circle cx="15" cy="10" r="1.2" fill="currentColor"/>
        <path d="M8 14s1.5 2 4 2 4-2 4-2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        <path d="M2 12h2M20 12h2M12 2v2M12 20v2" stroke="currentColor" stroke-width="1" stroke-linecap="round" opacity="0.3"/>
        <defs><linearGradient id="fab-grad" x1="2" y1="2" x2="22" y2="22"><stop stop-color="#7C5CFC"/><stop offset="1" stop-color="#5E9FFF"/></linearGradient></defs>
      </svg>
      <!-- 自定义图标位置 END -->
    </div>
    <div class="ai-fab-pulse"></div>
  </div>

  <!-- 聊天面板 -->
  <transition name="ai-panel">
    <div v-if="panelOpen" class="ai-panel" id="ai-chat-panel">
      <!-- 面板头 -->
      <div class="ai-panel-header">
        <div class="ai-header-left">
          <!-- 自定义图标位置：小 Logo -->
          <div class="ai-header-avatar">
            <svg viewBox="0 0 24 24" fill="none" width="20" height="20">
              <circle cx="9" cy="10" r="1.2" fill="#fff"/>
              <circle cx="15" cy="10" r="1.2" fill="#fff"/>
              <path d="M8 14s1.5 2 4 2 4-2 4-2" stroke="#fff" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
          </div>
          <div>
            <div class="ai-header-title">Genma 大模型</div>
            <div class="ai-header-sub">
              <span class="ai-status-dot" :class="aiOnline ? 'online' : 'offline'"></span>
              {{ aiOnline ? '在线' : '离线' }}
            </div>
          </div>
        </div>
        <div class="ai-header-actions">
          <button class="ai-header-btn" @click="clearChat" title="新对话">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
          </button>
          <button class="ai-header-btn" @click="togglePanel" title="关闭">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>
      </div>

      <!-- 消息列表 -->
      <div class="ai-messages" ref="messagesRef">
        <!-- 欢迎信息 -->
        <div v-if="chatMessages.length === 0" class="ai-welcome">
          <div class="ai-welcome-icon">🤖</div>
          <div class="ai-welcome-title">你好，我是 Genma</div>
          <div class="ai-welcome-desc">海南椰嫂平台的专属 AI 助手，有什么可以帮你？</div>
          <div class="ai-quick-actions">
            <button v-for="q in quickQuestions" :key="q" class="ai-quick-btn" @click="sendQuick(q)">{{ q }}</button>
          </div>
        </div>

        <!-- 消息气泡 -->
        <div v-for="(msg, idx) in chatMessages" :key="idx" class="ai-msg" :class="'ai-msg-' + msg.role">
          <div class="ai-msg-avatar" v-if="msg.role === 'assistant'">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none">
              <circle cx="9" cy="10" r="1.2" fill="currentColor"/><circle cx="15" cy="10" r="1.2" fill="currentColor"/>
              <path d="M8 14s1.5 2 4 2 4-2 4-2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
          </div>
          <div class="ai-msg-bubble" v-html="msg.role === 'assistant' ? renderMd(msg.content) : escapeHtml(msg.content)"></div>
        </div>

        <!-- 思考状态面板 -->
        <div v-if="loading" class="ai-msg ai-msg-assistant">
          <div class="ai-msg-avatar ai-avatar-thinking">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none">
              <circle cx="9" cy="10" r="1.2" fill="currentColor"/><circle cx="15" cy="10" r="1.2" fill="currentColor"/>
              <path d="M8 14s1.5 2 4 2 4-2 4-2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
          </div>
          <div class="ai-msg-bubble ai-thinking-bubble">
            <!-- 思考状态文字 -->
            <div class="ai-thinking-header">
              <span class="ai-thinking-spinner"></span>
              <span class="ai-thinking-text">{{ thinkingText }}</span>
            </div>
            <!-- 工具调用可视化 -->
            <div v-if="toolCalls.length > 0" class="ai-tool-calls">
              <div v-for="(tool, idx) in toolCalls" :key="idx" class="ai-tool-item" :class="{ done: tool.done }">
                <span class="ai-tool-icon">{{ tool.done ? '✅' : '🔧' }}</span>
                <span class="ai-tool-name">{{ tool.name }}</span>
                <span v-if="!tool.done" class="ai-tool-status">{{ tool.status }}</span>
              </div>
            </div>
            <!-- 计时器 -->
            <div class="ai-thinking-timer">已思考 {{ thinkingSeconds }}s</div>
          </div>
        </div>
      </div>

      <!-- 输入区 -->
      <div class="ai-input-area">
        <!-- 文件预览卡片 -->
        <div v-if="attachedFile" class="ai-file-card">
          <div class="ai-file-icon">{{ fileIcon(attachedFile) }}</div>
          <div class="ai-file-info">
            <div class="ai-file-name">{{ attachedFile.name }}</div>
            <div class="ai-file-size">{{ formatFileSize(attachedFile.size) }}</div>
          </div>
          <button class="ai-file-remove" @click="removeFile" title="移除文件">✕</button>
        </div>
        <div class="ai-input-wrap">
          <!-- 📎 附件按钮 -->
          <button class="ai-attach-btn" @click="triggerFileInput" title="上传文件分析" :disabled="loading">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/></svg>
          </button>
          <input type="file" ref="fileInputRef" style="display:none" @change="handleFileSelect" accept=".xlsx,.xls,.csv,.txt,.pdf,.docx,.doc" />
          <textarea
            ref="inputRef"
            v-model="inputText"
            class="ai-input"
            :placeholder="attachedFile ? '描述你想让 AI 分析什么...' : '输入消息... (Enter 发送, Shift+Enter 换行)'"
            rows="1"
            @keydown="handleKeydown"
            @input="autoResize"
            :disabled="loading"
          ></textarea>
          <button class="ai-send-btn" @click="sendMessage" :disabled="(!inputText.trim() && !attachedFile) || loading" :class="{ active: (inputText.trim() || attachedFile) && !loading }">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 2L11 13"/><path d="M22 2L15 22l-4-9-9-4z"/></svg>
          </button>
        </div>
        <div class="ai-input-hint">Genma 大模型 · 幻魔工作室 · 📎 支持 Excel/CSV/TXT/PDF</div>
      </div>
    </div>
  </transition>

  <!-- 遮罩（移动端） -->
  <div v-if="panelOpen && isMobile" class="ai-overlay" @click="togglePanel"></div>
</template>

<script setup>
import { ref, nextTick, onMounted, onBeforeUnmount, watch } from 'vue'
import { chatStream, analyzeFile } from '../api/ai.js'
import { Marked } from 'marked'
import hljs from 'highlight.js/lib/core'
// 按需加载常用语言（减小体积）
import javascript from 'highlight.js/lib/languages/javascript'
import python from 'highlight.js/lib/languages/python'
import sql from 'highlight.js/lib/languages/sql'
import json from 'highlight.js/lib/languages/json'
import bash from 'highlight.js/lib/languages/bash'
import xml from 'highlight.js/lib/languages/xml'
import css from 'highlight.js/lib/languages/css'

hljs.registerLanguage('javascript', javascript)
hljs.registerLanguage('js', javascript)
hljs.registerLanguage('python', python)
hljs.registerLanguage('sql', sql)
hljs.registerLanguage('json', json)
hljs.registerLanguage('bash', bash)
hljs.registerLanguage('shell', bash)
hljs.registerLanguage('html', xml)
hljs.registerLanguage('xml', xml)
hljs.registerLanguage('css', css)

// 配置 marked
var marked = new Marked({
  breaks: true,
  gfm: true,
  highlight: function(code, lang) {
    if (lang && hljs.getLanguage(lang)) {
      try { return hljs.highlight(code, { language: lang }).value } catch(e) {}
    }
    try { return hljs.highlightAuto(code).value } catch(e) {}
    return code
  }
})

var panelOpen = ref(false)
var inputText = ref('')
var chatMessages = ref([])
var loading = ref(false)
var aiOnline = ref(true)
var isMobile = ref(false)
var currentController = null
var messagesRef = ref(null)
var fileInputRef = ref(null)
var attachedFile = ref(null)

// 思考状态增强
var thinkingSeconds = ref(0)
var thinkingPhase = ref(0)
var thinkingTimer = null
var toolCalls = ref([])

var thinkingPhrases = [
  '🧠 Genma 正在思考...',
  '📊 正在分析数据...',
  '✍️ 正在组织回答...',
  '🔍 正在深入思考...'
]

var thinkingText = ref(thinkingPhrases[0])

function startThinking() {
  thinkingSeconds.value = 0
  thinkingPhase.value = 0
  thinkingText.value = thinkingPhrases[0]
  toolCalls.value = []
  thinkingTimer = setInterval(function() {
    thinkingSeconds.value++
    // 每 3 秒切换提示文字
    if (thinkingSeconds.value % 3 === 0) {
      thinkingPhase.value = Math.min(thinkingPhase.value + 1, thinkingPhrases.length - 1)
      thinkingText.value = thinkingPhrases[thinkingPhase.value]
    }
    // 超过 10 秒显示安抚提示
    if (thinkingSeconds.value === 10) {
      thinkingText.value = '⏳ 正在处理复杂任务，请稍候...'
    }
  }, 1000)
}

function stopThinking() {
  if (thinkingTimer) {
    clearInterval(thinkingTimer)
    thinkingTimer = null
  }
  thinkingSeconds.value = 0
  toolCalls.value = []
}
var inputRef = ref(null)

var quickQuestions = [
  '📊 本周订单趋势',
  '✍️ 写一篇推广文案',
  '📋 生成运营日报',
  '💡 营销策略建议'
]

function togglePanel() {
  panelOpen.value = !panelOpen.value
  if (panelOpen.value) {
    nextTick(function() {
      if (inputRef.value) inputRef.value.focus()
      scrollToBottom()
    })
  }
}

function clearChat() {
  if (loading.value && currentController) {
    currentController.abort()
    currentController = null
  }
  chatMessages.value = []
  loading.value = false
  inputText.value = ''
}

function sendQuick(q) {
  // 去掉 emoji 前缀
  inputText.value = q.replace(/^[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]\s*/u, '')
  sendMessage()
}

function sendMessage() {
  var text = inputText.value.trim()
  var file = attachedFile.value
  if ((!text && !file) || loading.value) return

  // 如果有文件，走文件分析流程
  if (file) {
    sendFileAnalysis(file, text)
    return
  }

  // 普通对话流程
  chatMessages.value.push({ role: 'user', content: text })
  inputText.value = ''
  loading.value = true
  startThinking()

  if (inputRef.value) inputRef.value.style.height = 'auto'
  nextTick(scrollToBottom)

  var messages = chatMessages.value.map(function(m) {
    return { role: m.role, content: m.content }
  })

  var aiMsgIndex = chatMessages.value.length
  chatMessages.value.push({ role: 'assistant', content: '' })

  currentController = chatStream(
    messages,
    function(chunk) {
      loading.value = false
      stopThinking()
      chatMessages.value[aiMsgIndex].content += chunk
      nextTick(scrollToBottom)
    },
    function() {
      loading.value = false
      stopThinking()
      currentController = null
    },
    function(err) {
      loading.value = false
      stopThinking()
      currentController = null
      chatMessages.value[aiMsgIndex].content = '⚠️ ' + (err.message || 'AI 服务连接失败，请稍后重试')
    },
    function(toolName, status) {
      var existing = toolCalls.value.find(function(t) { return t.name === toolName })
      if (existing) {
        existing.status = status
        if (status === '完成') existing.done = true
      } else {
        toolCalls.value.push({ name: toolName, status: status, done: status === '完成' })
      }
      thinkingText.value = '🔧 正在调用工具...'
      nextTick(scrollToBottom)
    }
  )
}

// ==================== 文件上传逻辑 ====================
function triggerFileInput() {
  if (fileInputRef.value) fileInputRef.value.click()
}

function handleFileSelect(e) {
  var file = e.target.files && e.target.files[0]
  if (!file) return
  // 大小检查（10MB）
  if (file.size > 10 * 1024 * 1024) {
    chatMessages.value.push({ role: 'assistant', content: '⚠️ 文件过大，最大支持 10MB' })
    return
  }
  attachedFile.value = file
  // 清空 input 以便重复选择同名文件
  if (fileInputRef.value) fileInputRef.value.value = ''
}

function removeFile() {
  attachedFile.value = null
}

function fileIcon(file) {
  if (!file) return '📄'
  var name = file.name.toLowerCase()
  if (name.endsWith('.xlsx') || name.endsWith('.xls')) return '📊'
  if (name.endsWith('.csv')) return '📋'
  if (name.endsWith('.pdf')) return '📕'
  if (name.endsWith('.docx') || name.endsWith('.doc')) return '📝'
  if (name.endsWith('.txt') || name.endsWith('.md')) return '📄'
  return '📎'
}

function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + 'B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + 'KB'
  return (bytes / 1024 / 1024).toFixed(1) + 'MB'
}

function sendFileAnalysis(file, prompt) {
  // 显示用户消息（带文件标识）
  chatMessages.value.push({
    role: 'user',
    content: '📎 **' + file.name + '** (' + formatFileSize(file.size) + ')\n\n' + (prompt || '请分析这个文件。')
  })
  inputText.value = ''
  attachedFile.value = null
  loading.value = true
  startThinking()
  thinkingText.value = '📂 正在解析文件...'

  if (inputRef.value) inputRef.value.style.height = 'auto'
  nextTick(scrollToBottom)

  var aiMsgIndex = chatMessages.value.length
  chatMessages.value.push({ role: 'assistant', content: '' })

  currentController = analyzeFile(
    file,
    prompt || '请分析这个文件的内容，给出关键信息总结。',
    function(chunk) {
      loading.value = false
      stopThinking()
      chatMessages.value[aiMsgIndex].content += chunk
      nextTick(scrollToBottom)
    },
    function() {
      loading.value = false
      stopThinking()
      currentController = null
    },
    function(err) {
      loading.value = false
      stopThinking()
      currentController = null
      chatMessages.value[aiMsgIndex].content = '⚠️ ' + (err.message || '文件分析失败')
    }
  )
}

function handleKeydown(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    sendMessage()
  }
}

function autoResize() {
  var el = inputRef.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = Math.min(el.scrollHeight, 120) + 'px'
}

function scrollToBottom() {
  if (messagesRef.value) {
    messagesRef.value.scrollTop = messagesRef.value.scrollHeight
  }
}

function renderMd(text) {
  if (!text) return ''
  try { return marked.parse(text) } catch(e) { return escapeHtml(text) }
}

function escapeHtml(text) {
  var div = document.createElement('div')
  div.textContent = text
  return div.innerHTML.replace(/\n/g, '<br>')
}

function checkMobile() {
  isMobile.value = window.innerWidth <= 768
}

onMounted(function() {
  checkMobile()
  window.addEventListener('resize', checkMobile)
})

onBeforeUnmount(function() {
  window.removeEventListener('resize', checkMobile)
  if (currentController) currentController.abort()
  stopThinking()
})
</script>

<style>
/* highlight.js 内联主题（避免额外 CSS 文件） */
.ai-msg-bubble pre code.hljs { display: block; overflow-x: auto; padding: 14px; }
.ai-msg-bubble code.hljs { padding: 3px 5px; }
.hljs { color: #c9d1d9; background: #161b22; }
.hljs-keyword, .hljs-selector-tag { color: #ff7b72; }
.hljs-string, .hljs-attr { color: #a5d6ff; }
.hljs-number, .hljs-literal { color: #79c0ff; }
.hljs-comment { color: #8b949e; font-style: italic; }
.hljs-function .hljs-title, .hljs-title.function_ { color: #d2a8ff; }
.hljs-built_in { color: #ffa657; }
.hljs-type, .hljs-class .hljs-title { color: #7ee787; }
.hljs-variable, .hljs-template-variable { color: #ffa657; }
</style>

<style scoped>
/* ===== 悬浮球 ===== */
.ai-fab {
  position: fixed;
  right: 28px;
  bottom: 28px;
  z-index: 2000;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.ai-fab:hover { transform: scale(1.1); }
.ai-fab:active { transform: scale(0.95); }
.ai-fab-hidden { opacity: 0; pointer-events: none; transform: scale(0.5); }
.ai-fab-inner {
  width: 56px; height: 56px; border-radius: 50%;
  background: linear-gradient(135deg, #7C5CFC 0%, #5E9FFF 100%);
  display: flex; align-items: center; justify-content: center;
  box-shadow: 0 4px 20px rgba(124, 92, 252, 0.4), 0 2px 8px rgba(0,0,0,0.1);
  position: relative; z-index: 2;
}
.ai-fab-icon { width: 28px; height: 28px; color: #fff; }
.ai-fab-pulse {
  position: absolute; top: 0; left: 0; right: 0; bottom: 0;
  border-radius: 50%;
  background: linear-gradient(135deg, #7C5CFC, #5E9FFF);
  animation: ai-pulse 2s ease-in-out infinite;
  z-index: 1;
}
@keyframes ai-pulse {
  0%, 100% { transform: scale(1); opacity: 0.4; }
  50% { transform: scale(1.4); opacity: 0; }
}

/* ===== 面板 ===== */
.ai-panel {
  position: fixed;
  right: 24px; bottom: 24px;
  width: 420px; height: 620px;
  max-height: calc(100vh - 48px);
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  border-radius: 20px;
  box-shadow: 0 20px 60px rgba(0,0,0,0.12), 0 4px 16px rgba(0,0,0,0.06);
  border: 1px solid rgba(0,0,0,0.06);
  display: flex; flex-direction: column;
  z-index: 2001; overflow: hidden;
}

/* 面板动画 */
.ai-panel-enter-active { animation: ai-panel-in 0.35s cubic-bezier(0.34, 1.56, 0.64, 1); }
.ai-panel-leave-active { animation: ai-panel-out 0.2s ease-in; }
@keyframes ai-panel-in {
  from { opacity: 0; transform: translateY(20px) scale(0.9); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}
@keyframes ai-panel-out {
  from { opacity: 1; transform: translateY(0) scale(1); }
  to { opacity: 0; transform: translateY(20px) scale(0.9); }
}

/* ===== 面板头 ===== */
.ai-panel-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 16px 20px;
  background: linear-gradient(135deg, #7C5CFC 0%, #5E9FFF 100%);
  color: #fff; flex-shrink: 0;
}
.ai-header-left { display: flex; align-items: center; gap: 12px; }
.ai-header-avatar {
  width: 36px; height: 36px; border-radius: 50%;
  background: rgba(255,255,255,0.2);
  display: flex; align-items: center; justify-content: center;
}
.ai-header-title { font-size: 15px; font-weight: 600; }
.ai-header-sub { font-size: 11px; opacity: 0.85; display: flex; align-items: center; gap: 4px; }
.ai-status-dot { width: 6px; height: 6px; border-radius: 50%; }
.ai-status-dot.online { background: #4ADE80; box-shadow: 0 0 6px rgba(74, 222, 128, 0.6); }
.ai-status-dot.offline { background: #F87171; }
.ai-header-actions { display: flex; gap: 4px; }
.ai-header-btn {
  width: 32px; height: 32px; border-radius: 8px; border: none;
  background: rgba(255,255,255,0.15); color: #fff;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; transition: background 0.15s;
}
.ai-header-btn:hover { background: rgba(255,255,255,0.25); }

/* ===== 消息区 ===== */
.ai-messages {
  flex: 1; overflow-y: auto; padding: 16px 20px;
  scroll-behavior: smooth;
}
.ai-messages::-webkit-scrollbar { width: 4px; }
.ai-messages::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.1); border-radius: 2px; }

/* 欢迎页 */
.ai-welcome { text-align: center; padding: 40px 20px 20px; }
.ai-welcome-icon { font-size: 48px; margin-bottom: 12px; }
.ai-welcome-title { font-size: 18px; font-weight: 700; color: #1C1C1E; margin-bottom: 6px; }
.ai-welcome-desc { font-size: 13px; color: #8E8E93; margin-bottom: 24px; }
.ai-quick-actions { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; }
.ai-quick-btn {
  padding: 8px 14px; border-radius: 20px; border: 1px solid #E5E5EA;
  background: #fff; color: #48484A; font-size: 12px; cursor: pointer;
  transition: all 0.15s;
}
.ai-quick-btn:hover { border-color: #7C5CFC; color: #7C5CFC; background: rgba(124,92,252,0.04); }

/* 消息气泡 */
.ai-msg { display: flex; gap: 8px; margin-bottom: 16px; }
.ai-msg-user { flex-direction: row-reverse; }
.ai-msg-avatar {
  width: 28px; height: 28px; border-radius: 50%; flex-shrink: 0;
  background: linear-gradient(135deg, #7C5CFC, #5E9FFF);
  color: #fff; display: flex; align-items: center; justify-content: center;
  margin-top: 2px;
}
.ai-msg-bubble {
  max-width: 85%; padding: 10px 14px; border-radius: 14px;
  font-size: 13px; line-height: 1.6; word-break: break-word;
}
.ai-msg-user .ai-msg-bubble {
  background: linear-gradient(135deg, #7C5CFC 0%, #5E9FFF 100%);
  color: #fff; border-bottom-right-radius: 4px;
}
.ai-msg-assistant .ai-msg-bubble {
  background: #F5F5F7; color: #1C1C1E; border-bottom-left-radius: 4px;
}

/* Markdown 渲染样式 */
.ai-msg-assistant .ai-msg-bubble :deep(p) { margin: 0 0 8px; }
.ai-msg-assistant .ai-msg-bubble :deep(p:last-child) { margin-bottom: 0; }
.ai-msg-assistant .ai-msg-bubble :deep(pre) {
  background: #161b22; border-radius: 8px; padding: 0; margin: 8px 0; overflow: hidden;
}
.ai-msg-assistant .ai-msg-bubble :deep(pre code) {
  display: block; padding: 12px; font-size: 12px; line-height: 1.5;
  font-family: 'SF Mono', 'Fira Code', monospace; overflow-x: auto;
}
.ai-msg-assistant .ai-msg-bubble :deep(code) {
  background: rgba(0,0,0,0.06); padding: 2px 6px; border-radius: 4px;
  font-size: 12px; font-family: 'SF Mono', 'Fira Code', monospace;
}
.ai-msg-assistant .ai-msg-bubble :deep(pre code) { background: none; padding: 0; }
.ai-msg-assistant .ai-msg-bubble :deep(ul), .ai-msg-assistant .ai-msg-bubble :deep(ol) { padding-left: 20px; margin: 6px 0; }
.ai-msg-assistant .ai-msg-bubble :deep(li) { margin: 2px 0; }
.ai-msg-assistant .ai-msg-bubble :deep(table) { border-collapse: collapse; width: 100%; margin: 8px 0; font-size: 12px; }
.ai-msg-assistant .ai-msg-bubble :deep(th), .ai-msg-assistant .ai-msg-bubble :deep(td) { border: 1px solid #D1D1D6; padding: 6px 10px; text-align: left; }
.ai-msg-assistant .ai-msg-bubble :deep(th) { background: #E5E5EA; font-weight: 600; }
.ai-msg-assistant .ai-msg-bubble :deep(blockquote) { border-left: 3px solid #7C5CFC; padding-left: 12px; margin: 8px 0; color: #636366; }
.ai-msg-assistant .ai-msg-bubble :deep(h1), .ai-msg-assistant .ai-msg-bubble :deep(h2), .ai-msg-assistant .ai-msg-bubble :deep(h3) { margin: 12px 0 6px; font-weight: 700; }
.ai-msg-assistant .ai-msg-bubble :deep(h1) { font-size: 16px; }
.ai-msg-assistant .ai-msg-bubble :deep(h2) { font-size: 15px; }
.ai-msg-assistant .ai-msg-bubble :deep(h3) { font-size: 14px; }
.ai-msg-assistant .ai-msg-bubble :deep(a) { color: #5E9FFF; text-decoration: none; }
.ai-msg-assistant .ai-msg-bubble :deep(hr) { border: none; border-top: 1px solid #E5E5EA; margin: 12px 0; }
.ai-msg-assistant .ai-msg-bubble :deep(strong) { font-weight: 700; }

/* 思考状态面板 */
.ai-avatar-thinking {
  animation: ai-avatar-breathe 2s ease-in-out infinite;
}
@keyframes ai-avatar-breathe {
  0%, 100% { box-shadow: 0 0 0 0 rgba(124, 92, 252, 0.4); }
  50% { box-shadow: 0 0 12px 4px rgba(124, 92, 252, 0.25); }
}
.ai-thinking-bubble {
  padding: 12px 16px !important;
  background: linear-gradient(135deg, rgba(124,92,252,0.06), rgba(94,159,255,0.06)) !important;
  border: 1px solid rgba(124,92,252,0.12) !important;
}
.ai-thinking-header {
  display: flex; align-items: center; gap: 8px;
  font-size: 13px; color: #7C5CFC; font-weight: 500;
}
.ai-thinking-spinner {
  width: 14px; height: 14px; border-radius: 50%;
  border: 2px solid rgba(124,92,252,0.2);
  border-top-color: #7C5CFC;
  animation: ai-spin 0.8s linear infinite;
}
@keyframes ai-spin {
  to { transform: rotate(360deg); }
}
.ai-thinking-text {
  animation: ai-text-fade 0.4s ease;
}
@keyframes ai-text-fade {
  from { opacity: 0; transform: translateY(-4px); }
  to { opacity: 1; transform: translateY(0); }
}
.ai-thinking-timer {
  font-size: 10px; color: #AEAEB2; margin-top: 6px;
}
/* 工具调用可视化 */
.ai-tool-calls {
  margin-top: 8px; display: flex; flex-direction: column; gap: 4px;
}
.ai-tool-item {
  display: flex; align-items: center; gap: 6px;
  font-size: 11px; color: #636366;
  padding: 4px 8px; border-radius: 6px;
  background: rgba(124,92,252,0.06);
  animation: ai-tool-slide 0.3s ease;
}
.ai-tool-item.done {
  color: #34C759; background: rgba(52,199,89,0.06);
}
@keyframes ai-tool-slide {
  from { opacity: 0; transform: translateX(-8px); }
  to { opacity: 1; transform: translateX(0); }
}
.ai-tool-icon { font-size: 12px; }
.ai-tool-name { font-weight: 500; }
.ai-tool-status {
  margin-left: auto; font-size: 10px; color: #AEAEB2;
  animation: ai-dot-pulse 1.5s infinite;
}
@keyframes ai-dot-pulse {
  0%, 100% { opacity: 0.5; }
  50% { opacity: 1; }
}

/* ===== 输入区 ===== */
.ai-input-area { padding: 12px 16px 8px; border-top: 1px solid rgba(0,0,0,0.05); flex-shrink: 0; }
.ai-input-wrap {
  display: flex; align-items: flex-end; gap: 8px;
  background: #F5F5F7; border-radius: 14px; padding: 6px 6px 6px 14px;
  border: 1px solid transparent; transition: all 0.2s;
}
.ai-input-wrap:focus-within { border-color: #7C5CFC; background: #fff; box-shadow: 0 0 0 3px rgba(124,92,252,0.1); }
.ai-input {
  flex: 1; border: none; background: none; resize: none; outline: none;
  font-size: 13px; line-height: 1.5; color: #1C1C1E; padding: 6px 0;
  font-family: inherit; max-height: 120px;
}
.ai-input::placeholder { color: #AEAEB2; }
.ai-send-btn {
  width: 34px; height: 34px; border-radius: 10px; border: none;
  background: #E5E5EA; color: #AEAEB2;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; transition: all 0.2s; flex-shrink: 0;
}
.ai-send-btn.active { background: linear-gradient(135deg, #7C5CFC, #5E9FFF); color: #fff; }
.ai-send-btn.active:hover { transform: scale(1.05); box-shadow: 0 2px 8px rgba(124,92,252,0.3); }
.ai-input-hint { text-align: center; font-size: 10px; color: #AEAEB2; margin-top: 6px; padding-bottom: 4px; }

/* ===== 📎 附件按钮 ===== */
.ai-attach-btn {
  width: 34px; height: 34px; border-radius: 10px; border: none;
  background: transparent; color: #8E8E93;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; transition: all 0.2s; flex-shrink: 0;
}
.ai-attach-btn:hover { background: rgba(124,92,252,0.1); color: #7C5CFC; }
.ai-attach-btn:disabled { opacity: 0.4; cursor: not-allowed; }

/* ===== 文件预览卡片 ===== */
.ai-file-card {
  display: flex; align-items: center; gap: 10px;
  background: linear-gradient(135deg, rgba(124,92,252,0.08), rgba(94,159,255,0.08));
  border: 1px solid rgba(124,92,252,0.15); border-radius: 12px;
  padding: 10px 12px; margin-bottom: 8px;
  animation: ai-file-slide 0.25s ease-out;
}
@keyframes ai-file-slide {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
.ai-file-icon { font-size: 24px; flex-shrink: 0; }
.ai-file-info { flex: 1; min-width: 0; }
.ai-file-name {
  font-size: 13px; font-weight: 500; color: #1C1C1E;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.ai-file-size { font-size: 11px; color: #8E8E93; margin-top: 2px; }
.ai-file-remove {
  width: 24px; height: 24px; border-radius: 50%; border: none;
  background: rgba(0,0,0,0.06); color: #8E8E93; font-size: 12px;
  cursor: pointer; transition: all 0.2s; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
}
.ai-file-remove:hover { background: rgba(255,59,48,0.1); color: #FF3B30; }

/* ===== 遮罩 ===== */
.ai-overlay {
  position: fixed; top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.35); z-index: 2000;
}

/* ===== 响应式 ===== */
@media (max-width: 768px) {
  .ai-fab { right: 16px; bottom: 16px; }
  .ai-fab-inner { width: 50px; height: 50px; }
  .ai-fab-icon { width: 24px; height: 24px; }
  .ai-panel {
    right: 0; bottom: 0; left: 0;
    width: 100%; height: 100%;
    max-height: 100vh; border-radius: 0;
  }
}
@media (max-width: 480px) {
  .ai-quick-actions { flex-direction: column; }
  .ai-quick-btn { width: 100%; }
}
</style>
