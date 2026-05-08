<template>
  <div>
    <!-- 搜索栏 -->
    <el-card>
      <el-row :gutter="16" align="middle">
        <el-col :span="5"><el-input v-model="query.ownerName" placeholder="搜索圈主昵称" clearable @clear="fetchList" @keyup.enter="fetchList" /></el-col>
        <el-col :span="4"><el-select v-model="query.status" placeholder="状态" clearable @change="fetchList">
          <el-option label="活跃" value="active" /><el-option label="已解散" value="disbanded" />
        </el-select></el-col>
        <el-col :span="4"><el-button type="primary" @click="fetchList">查询</el-button><el-button @click="resetQuery">重置</el-button></el-col>
      </el-row>
    </el-card>

    <!-- 列表 -->
    <el-card style="margin-top:16px;">
      <el-table :data="list" v-loading="loading" stripe>
        <el-table-column prop="id" label="ID" width="60" />
        <el-table-column label="圈名" min-width="180">
          <template #default="{ row }"><strong>{{ row.name }}</strong></template>
        </el-table-column>
        <el-table-column label="工种" width="100">
          <template #default="{ row }">{{ row.jobType ? row.jobType.name : '-' }}</template>
        </el-table-column>
        <el-table-column label="圈主" width="120">
          <template #default="{ row }">{{ row.owner ? row.owner.nickname : '-' }}</template>
        </el-table-column>
        <el-table-column label="成员数" width="100">
          <template #default="{ row }">{{ row.memberCount }} / {{ row.maxMembers }}</template>
        </el-table-column>
        <el-table-column prop="inviteCode" label="邀请码" width="100" />
        <el-table-column label="状态" width="80">
          <template #default="{ row }"><el-tag :type="row.status === 'active' ? 'success' : 'info'" size="small">{{ row.status === 'active' ? '活跃' : '已解散' }}</el-tag></template>
        </el-table-column>
        <el-table-column prop="createdAt" label="创建时间" width="170" />
        <el-table-column label="操作" width="140" fixed="right">
          <template #default="{ row }">
            <el-button size="small" type="primary" @click="showDetail(row)">详情</el-button>
            <el-button v-if="row.status === 'active'" size="small" type="danger" @click="handleDisband(row)">解散</el-button>
          </template>
        </el-table-column>
      </el-table>
      <div style="margin-top:16px;text-align:right;">
        <el-pagination v-model:current-page="query.page" :page-size="query.pageSize" :total="total" layout="total, prev, pager, next" @current-change="fetchList" />
      </div>
    </el-card>

    <!-- 详情抽屉 -->
    <el-drawer v-model="drawerVisible" :title="detail ? detail.name : '闺蜜圈详情'" size="650px">
      <template v-if="detail">
        <!-- 基本信息 -->
        <el-descriptions :column="2" border size="small">
          <el-descriptions-item label="圈名">{{ detail.name }}</el-descriptions-item>
          <el-descriptions-item label="工种">{{ detail.jobType ? detail.jobType.name : '-' }}</el-descriptions-item>
          <el-descriptions-item label="圈主">{{ detail.owner ? detail.owner.nickname : '-' }}（{{ detail.owner ? detail.owner.phone : '' }}）</el-descriptions-item>
          <el-descriptions-item label="邀请码"><el-tag>{{ detail.inviteCode }}</el-tag></el-descriptions-item>
          <el-descriptions-item label="成员数">{{ detail.memberCount }} / {{ detail.maxMembers }}</el-descriptions-item>
          <el-descriptions-item label="状态"><el-tag :type="detail.status === 'active' ? 'success' : 'info'">{{ detail.status === 'active' ? '活跃' : '已解散' }}</el-tag></el-descriptions-item>
        </el-descriptions>

        <!-- 多 Tab 页 -->
        <el-tabs v-model="activeTab" style="margin-top:20px;" @tab-change="handleTabChange">
          <!-- 成员列表 -->
          <el-tab-pane label="成员列表" name="members">
            <el-table :data="detail.members ? detail.members.list : []" size="small" stripe>
              <el-table-column label="昵称" width="100"><template #default="{ row }">{{ row.user ? row.user.nickname : '-' }}</template></el-table-column>
              <el-table-column label="手机号" width="120"><template #default="{ row }">{{ row.user ? row.user.phone : '-' }}</template></el-table-column>
              <el-table-column label="城市" width="80"><template #default="{ row }">{{ row.user ? row.user.city : '-' }}</template></el-table-column>
              <el-table-column label="角色" width="70"><template #default="{ row }"><el-tag :type="row.role === 'owner' ? 'warning' : ''" size="small">{{ row.role === 'owner' ? '圈主' : '成员' }}</el-tag></template></el-table-column>
              <el-table-column label="状态" width="90">
                <template #default="{ row }">
                  <el-tag :type="statusType[row.status]" size="small">{{ statusMap[row.status] || row.status }}</el-tag>
                </template>
              </el-table-column>
              <el-table-column prop="joinedAt" label="加入时间" width="170" />
            </el-table>
          </el-tab-pane>

          <!-- 圈子动态 -->
          <el-tab-pane name="events">
            <template #label>
              <span>圈子动态</span>
              <el-badge v-if="eventTotal > 0" :value="eventTotal" :max="99" style="margin-left:6px;" />
            </template>
            <div style="margin-bottom:12px;">
              <el-select v-model="eventFilter" placeholder="事件类型" clearable size="small" style="width:160px;" @change="fetchEvents">
                <el-option v-for="(label, key) in eventTypeMap" :key="key" :label="label" :value="key" />
              </el-select>
            </div>
            <el-timeline>
              <el-timeline-item v-for="evt in events" :key="evt.id" :timestamp="formatTime(evt.createdAt)" placement="top" :type="eventColor[evt.eventType] || 'primary'" :hollow="evt.isRead">
                <div style="display:flex;align-items:center;gap:8px;">
                  <el-avatar v-if="evt.user" :src="evt.user.avatar" :size="24" />
                  <span style="font-weight:500;">{{ evt.user ? evt.user.nickname : '系统' }}</span>
                  <el-tag size="small" :type="eventColor[evt.eventType] || ''">{{ eventTypeMap[evt.eventType] || evt.eventType }}</el-tag>
                </div>
                <div style="color:#666;font-size:13px;margin-top:4px;">{{ evt.targetInfo }}</div>
              </el-timeline-item>
            </el-timeline>
            <div v-if="events.length === 0" style="text-align:center;color:#999;padding:40px 0;">暂无动态</div>
            <div v-if="eventTotal > events.length" style="text-align:center;margin-top:12px;">
              <el-button size="small" @click="loadMoreEvents">加载更多</el-button>
            </div>
          </el-tab-pane>

          <!-- 待审批 -->
          <el-tab-pane name="pending">
            <template #label>
              <span>待审批</span>
              <el-badge v-if="pendingMembers.length > 0" :value="pendingMembers.length" style="margin-left:6px;" />
            </template>
            <el-table :data="pendingMembers" size="small" stripe>
              <el-table-column label="昵称" width="100"><template #default="{ row }">{{ row.user ? row.user.nickname : '-' }}</template></el-table-column>
              <el-table-column label="手机号" width="120"><template #default="{ row }">{{ row.user ? row.user.phone : '-' }}</template></el-table-column>
              <el-table-column label="城市" width="80"><template #default="{ row }">{{ row.user ? row.user.city : '-' }}</template></el-table-column>
              <el-table-column label="实名" width="70"><template #default="{ row }"><el-tag :type="row.user && row.user.isRealAuth ? 'success' : 'info'" size="small">{{ row.user && row.user.isRealAuth ? '已认证' : '未认证' }}</el-tag></template></el-table-column>
              <el-table-column label="申请留言" min-width="150"><template #default="{ row }">{{ row.applyMessage || '-' }}</template></el-table-column>
              <el-table-column label="申请时间" width="170" prop="createdAt" />
            </el-table>
            <div v-if="pendingMembers.length === 0" style="text-align:center;color:#999;padding:40px 0;">暂无待审批申请</div>
          </el-tab-pane>

          <!-- 退出中 -->
          <el-tab-pane name="leaving">
            <template #label>
              <span>退出中</span>
              <el-badge v-if="leavingMembers.length > 0" :value="leavingMembers.length" type="warning" style="margin-left:6px;" />
            </template>
            <el-table :data="leavingMembers" size="small" stripe>
              <el-table-column label="昵称" width="100"><template #default="{ row }">{{ row.user ? row.user.nickname : '-' }}</template></el-table-column>
              <el-table-column label="手机号" width="120"><template #default="{ row }">{{ row.user ? row.user.phone : '-' }}</template></el-table-column>
              <el-table-column label="城市" width="80"><template #default="{ row }">{{ row.user ? row.user.city : '-' }}</template></el-table-column>
              <el-table-column label="申请退出时间" width="170" prop="leaveRequestAt" />
              <el-table-column label="剩余冷静期" width="120">
                <template #default="{ row }">
                  <el-tag v-if="row.daysRemaining > 0" type="warning" size="small">{{ row.daysRemaining }} 天</el-tag>
                  <el-tag v-else type="danger" size="small">已到期</el-tag>
                </template>
              </el-table-column>
            </el-table>
            <div v-if="leavingMembers.length === 0" style="text-align:center;color:#999;padding:40px 0;">暂无退出中成员</div>
          </el-tab-pane>
        </el-tabs>

        <div style="margin-top:24px;text-align:right;">
          <el-button @click="drawerVisible = false">关闭</el-button>
        </div>
      </template>
    </el-drawer>
  </div>
</template>

<script setup>
/**
 * 后台管理 — 闺蜜圈列表页（升级版）
 *
 * 功能:
 *   - 闺蜜圈列表查询（按圈主昵称搜索、按状态筛选）
 *   - 抽屉查看圈子详情：成员列表 / 圈子动态 / 待审批 / 退出中
 *   - 管理员强制解散圈子
 */
import { ref, reactive, onMounted } from 'vue'
import { getGuimiCircles, getGuimiCircle, disbandGuimiCircle, getCircleEvents, getLeavingMembers, getPendingMembers } from '../../api/guimiCircles.js'
import { ElMessage, ElMessageBox } from 'element-plus'

// 列表数据
const list = ref([])
const total = ref(0)
const loading = ref(false)
const drawerVisible = ref(false)
const detail = ref(null)
const query = reactive({ ownerName: '', status: 'active', page: 1, pageSize: 10 })

// Tab 控制
const activeTab = ref('members')

// 事件流
const events = ref([])
const eventTotal = ref(0)
const eventPage = ref(1)
const eventFilter = ref('')

// 待审批 + 退出中
const pendingMembers = ref([])
const leavingMembers = ref([])

// 状态映射
const statusMap = { pending: '待审批', active: '正式成员', leaving: '退出中', left: '已退出', rejected: '已拒绝' }
const statusType = { pending: 'warning', active: 'success', leaving: '', left: 'info', rejected: 'danger' }

// 事件类型映射
const eventTypeMap = {
  member_apply: '申请加入',
  member_join: '加入圈子',
  member_leave_request: '申请退出',
  member_left: '已退出',
  member_retained: '取消退出',
  member_rejected: '申请拒绝',
  order_published: '发布订单',
  order_accepted: '接到订单',
  coupon_claimed: '领取优惠券',
  coupon_verified: '核销优惠券'
}
const eventColor = {
  member_apply: 'warning',
  member_join: 'success',
  member_leave_request: 'danger',
  member_left: 'info',
  member_retained: 'success',
  member_rejected: 'danger',
  order_published: 'primary',
  order_accepted: 'success',
  coupon_claimed: '',
  coupon_verified: 'success'
}

// 列表
async function fetchList() {
  loading.value = true
  try { const res = await getGuimiCircles(query); list.value = res.data.list; total.value = res.data.total } catch(e) {} finally { loading.value = false }
}
function resetQuery() { query.ownerName = ''; query.status = 'active'; query.page = 1; fetchList() }

// 详情
async function showDetail(row) {
  try {
    const res = await getGuimiCircle(row.id, { pageSize: 50 })
    detail.value = res.data
    activeTab.value = 'members'
    events.value = []
    eventTotal.value = 0
    eventPage.value = 1
    pendingMembers.value = []
    leavingMembers.value = []
    drawerVisible.value = true
  } catch(e) {}
}

// Tab 切换
function handleTabChange(tab) {
  if (!detail.value) return
  if (tab === 'events' && events.length === 0) fetchEvents()
  if (tab === 'pending') fetchPending()
  if (tab === 'leaving') fetchLeaving()
}

// 事件流
async function fetchEvents() {
  if (!detail.value) return
  eventPage.value = 1
  try {
    var params = { page: 1, pageSize: 20 }
    if (eventFilter.value) params.eventType = eventFilter.value
    const res = await getCircleEvents(detail.value.id, params)
    events.value = res.data.list
    eventTotal.value = res.data.total
  } catch(e) {}
}
async function loadMoreEvents() {
  if (!detail.value) return
  eventPage.value++
  try {
    var params = { page: eventPage.value, pageSize: 20 }
    if (eventFilter.value) params.eventType = eventFilter.value
    const res = await getCircleEvents(detail.value.id, params)
    events.value = events.value.concat(res.data.list)
  } catch(e) {}
}

// 待审批
async function fetchPending() {
  if (!detail.value) return
  try { const res = await getPendingMembers(detail.value.id); pendingMembers.value = res.data } catch(e) {}
}

// 退出中
async function fetchLeaving() {
  if (!detail.value) return
  try { const res = await getLeavingMembers(detail.value.id); leavingMembers.value = res.data } catch(e) {}
}

// 解散
async function handleDisband(row) {
  await ElMessageBox.confirm('确定要解散「' + row.name + '」？此操作不可撤销。', '警告', { type: 'warning' })
  await disbandGuimiCircle(row.id)
  ElMessage.success('已解散')
  fetchList()
}

// 时间格式化
function formatTime(t) {
  if (!t) return ''
  var d = new Date(t)
  var pad = function(n) { return n < 10 ? '0' + n : '' + n }
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes())
}

onMounted(fetchList)
</script>
