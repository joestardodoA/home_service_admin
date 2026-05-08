<template>
  <div>
    <el-tabs v-model="activeTab" type="card">
      <!-- 发送公告 -->
      <el-tab-pane label="发送系统公告" name="send">
        <el-card>
          <el-form label-width="100px" style="max-width:700px;">
            <el-form-item label="公告标题" required>
              <el-input v-model="broadcast.title" placeholder="如：系统维护通知" maxlength="50" show-word-limit />
            </el-form-item>
            <el-form-item label="公告内容" required>
              <el-input v-model="broadcast.content" type="textarea" :rows="5" placeholder="公告正文" maxlength="500" show-word-limit />
            </el-form-item>
            <el-form-item label="推送范围">
              <el-radio-group v-model="broadcast.targetType">
                <el-radio value="all">全部用户</el-radio>
                <el-radio value="specific">指定用户</el-radio>
              </el-radio-group>
            </el-form-item>
            <el-form-item v-if="broadcast.targetType === 'specific'" label="用户ID">
              <el-input v-model="broadcast.targetInput" placeholder="输入用户ID，多个用逗号分隔，如：1,5,12" />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" @click="handleSend" :loading="sending" icon="Promotion">发送公告</el-button>
            </el-form-item>
          </el-form>
        </el-card>
      </el-tab-pane>

      <!-- 发送记录 -->
      <el-tab-pane label="发送记录" name="history">
        <el-card>
          <el-table :data="history" v-loading="historyLoading" stripe>
            <el-table-column label="发送时间" width="180">
              <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
            </el-table-column>
            <el-table-column label="操作人" width="120">
              <template #default="{ row }">{{ row.adminUsername || '-' }}</template>
            </el-table-column>
            <el-table-column label="内容摘要" min-width="300">
              <template #default="{ row }">{{ row.detail || '-' }}</template>
            </el-table-column>
          </el-table>
          <div style="margin-top:16px;text-align:right;">
            <el-pagination v-model:current-page="historyPage" :page-size="10" :total="historyTotal" layout="total, prev, pager, next" @current-change="fetchHistory" />
          </div>
        </el-card>
      </el-tab-pane>

      <!-- 我的后台通知 -->
      <el-tab-pane name="my">
        <template #label>
          我的通知 <el-badge :value="unreadCount" :max="99" v-if="unreadCount > 0" style="margin-left:4px;" />
        </template>
        <el-card>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
            <el-radio-group v-model="notifyFilter" size="small" @change="fetchNotifications">
              <el-radio-button value="">全部</el-radio-button>
              <el-radio-button value="false">未读</el-radio-button>
              <el-radio-button value="true">已读</el-radio-button>
            </el-radio-group>
            <el-button size="small" @click="handleMarkAllRead" v-if="unreadCount > 0">全部标为已读</el-button>
          </div>
          <div v-if="notifications.length === 0" style="text-align:center;color:#999;padding:40px 0;">暂无通知</div>
          <div v-for="n in notifications" :key="n.id" class="notify-item" :class="{ 'unread': !n.isRead }" @click="handleReadNotify(n)">
            <div class="ni-dot" v-if="!n.isRead"></div>
            <div class="ni-body">
              <div class="ni-title">{{ n.title }}</div>
              <div class="ni-content">{{ n.content }}</div>
              <div class="ni-time">{{ formatDate(n.createdAt) }}</div>
            </div>
          </div>
          <div style="margin-top:16px;text-align:right;">
            <el-pagination v-model:current-page="notifyPage" :page-size="20" :total="notifyTotal" layout="total, prev, pager, next" @current-change="fetchNotifications" />
          </div>
        </el-card>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { getNotifications, getUnreadCount, markRead, markAllRead, sendBroadcast, getBroadcastHistory } from '../../api/messages.js'
import { ElMessage, ElMessageBox } from 'element-plus'

const activeTab = ref('send')
const sending = ref(false)
const broadcast = reactive({ title: '', content: '', targetType: 'all', targetInput: '' })

// 发送公告
async function handleSend() {
  if (!broadcast.title || !broadcast.content) { ElMessage.warning('请填写标题和内容'); return }
  await ElMessageBox.confirm('确认发送此系统公告？' + (broadcast.targetType === 'all' ? '将推送给所有用户' : '将推送给指定用户'), '发送确认', { type: 'warning' })
  sending.value = true
  try {
    var targetUserIds = []
    if (broadcast.targetType === 'specific' && broadcast.targetInput) {
      targetUserIds = broadcast.targetInput.split(',').map(function(s) { return parseInt(s.trim()) }).filter(function(n) { return !isNaN(n) })
    }
    var res = await sendBroadcast({ title: broadcast.title, content: broadcast.content, targetType: broadcast.targetType, targetUserIds: targetUserIds })
    ElMessage.success(res.msg || '发送成功')
    broadcast.title = ''; broadcast.content = ''; broadcast.targetInput = ''
  } catch (e) {
    ElMessage.error('发送失败')
  } finally { sending.value = false }
}

// 发送记录
const history = ref([])
const historyLoading = ref(false)
const historyPage = ref(1)
const historyTotal = ref(0)

async function fetchHistory() {
  historyLoading.value = true
  try {
    var res = await getBroadcastHistory({ page: historyPage.value, pageSize: 10 })
    history.value = res.data.list || res.data || []
    historyTotal.value = res.data.total || 0
  } catch (e) {} finally { historyLoading.value = false }
}

// 我的通知
const notifications = ref([])
const notifyPage = ref(1)
const notifyTotal = ref(0)
const notifyFilter = ref('')
const unreadCount = ref(0)

async function fetchNotifications() {
  try {
    var params = { page: notifyPage.value, pageSize: 20 }
    if (notifyFilter.value !== '') params.isRead = notifyFilter.value
    var res = await getNotifications(params)
    notifications.value = res.data.list || res.data || []
    notifyTotal.value = res.data.total || 0
  } catch (e) {}
}

async function fetchUnread() {
  try {
    var res = await getUnreadCount()
    unreadCount.value = res.data.count || 0
  } catch (e) {}
}

async function handleReadNotify(n) {
  if (!n.isRead) {
    await markRead(n.id)
    n.isRead = true
    unreadCount.value = Math.max(0, unreadCount.value - 1)
  }
}

async function handleMarkAllRead() {
  await markAllRead()
  ElMessage.success('已全部标为已读')
  unreadCount.value = 0
  fetchNotifications()
}

function formatDate(d) {
  if (!d) return ''
  var dt = new Date(d)
  return dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0') + '-' + String(dt.getDate()).padStart(2, '0') + ' ' + String(dt.getHours()).padStart(2, '0') + ':' + String(dt.getMinutes()).padStart(2, '0')
}

onMounted(() => {
  fetchUnread()
  fetchNotifications()
  fetchHistory()
})
</script>

<style scoped>
.notify-item { display:flex; align-items:flex-start; gap:12px; padding:16px; border-bottom:1px solid #f0f0f0; cursor:pointer; transition:background 0.2s; }
.notify-item:hover { background:#f9f9fb; }
.notify-item.unread { background:#f0f7ff; }
.ni-dot { width:8px; height:8px; border-radius:50%; background:#ff4d4f; margin-top:6px; flex-shrink:0; }
.ni-title { font-size:14px; font-weight:600; color:#333; margin-bottom:4px; }
.ni-content { font-size:13px; color:#666; margin-bottom:6px; line-height:1.5; }
.ni-time { font-size:12px; color:#999; }
</style>
