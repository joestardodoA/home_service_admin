<template>
  <div>
    <el-card>
      <el-row :gutter="16" align="middle">
        <el-col :span="6"><el-input v-model="query.keyword" placeholder="搜索昵称/手机号" clearable prefix-icon="Search" @clear="fetchList" @keyup.enter="fetchList" /></el-col>
        <el-col :span="4"><el-select v-model="query.authStatus" placeholder="认证状态" clearable @change="fetchList">
          <el-option label="未提交" value="none" /><el-option label="待审核" value="pending" />
          <el-option label="已通过" value="approved" /><el-option label="已拒绝" value="rejected" />
        </el-select></el-col>
        <el-col :span="8"><el-button type="primary" @click="fetchList">查询</el-button><el-button @click="resetQuery">重置</el-button><el-button type="success" plain icon="Download" @click="handleExport">导出</el-button><el-button type="warning" plain icon="Upload" @click="importDialogVisible = true">批量导入</el-button></el-col>
      </el-row>
    </el-card>

    <el-card style="margin-top:16px;">
      <el-table :data="list" v-loading="loading" stripe>
        <el-table-column prop="id" label="ID" width="60" />
        <el-table-column prop="nickname" label="昵称" width="100" />
        <el-table-column prop="phone" label="手机号" width="130" />
        <el-table-column label="性别" width="70"><template #default="{ row }">{{ genderMap[row.gender] }}</template></el-table-column>
        <el-table-column prop="city" label="城市" width="80" />
        <el-table-column prop="realName" label="真实姓名" width="100" />
        <el-table-column label="认证状态" width="100">
          <template #default="{ row }"><el-tag size="small" :type="authType[row.authStatus]">{{ authMap[row.authStatus] }}</el-tag></template>
        </el-table-column>
        <el-table-column label="管理评分" width="100" align="center" sortable :sort-method="(a, b) => (a.adminScore || 0) - (b.adminScore || 0)">
          <template #default="{ row }">
            <el-tag v-if="row.adminScore > 0" size="small" :type="row.adminScore >= 80 ? 'success' : row.adminScore >= 50 ? 'warning' : 'info'">⭐ {{ row.adminScore }}</el-tag>
            <span v-else style="color:#c0c4cc;">未评</span>
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="注册时间" width="170" />
        <el-table-column label="状态" width="80">
          <template #default="{ row }">
            <el-tag v-if="row.status === 'disabled'" size="small" type="danger">已禁用</el-tag>
            <el-tag v-else size="small" type="success">正常</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="260" fixed="right">
          <template #default="{ row }">
            <el-button v-if="row.authStatus === 'pending'" size="small" type="success" @click="handleApprove(row)">通过</el-button>
            <el-button v-if="row.authStatus === 'pending'" size="small" type="danger" @click="handleReject(row)">拒绝</el-button>
            <el-button v-if="row.status !== 'disabled'" size="small" type="warning" plain @click="handleToggleStatus(row)">禁用</el-button>
            <el-button v-else size="small" type="success" plain @click="handleToggleStatus(row)">启用</el-button>
            <el-button size="small" type="primary" plain @click="openScoreDialog(row)">评分</el-button>
            <el-button size="small" type="primary" @click="showDetail(row)">详情</el-button>
          </template>
        </el-table-column>
      </el-table>
      <div style="margin-top:16px;text-align:right;">
        <el-pagination v-model:current-page="query.page" :page-size="query.pageSize" :total="total" layout="total, prev, pager, next" @current-change="fetchList" />
      </div>
    </el-card>

    <!-- 用户详情抽屉（多 Tab） -->
    <el-drawer v-model="drawerVisible" title="用户详情" size="550px">
      <template v-if="detail">
        <el-tabs v-model="detailTab" @tab-change="onTabChange">
          <!-- Tab 1: 基本信息 -->
          <el-tab-pane label="基本信息" name="info">
            <el-descriptions :column="1" border>
              <el-descriptions-item label="昵称">{{ detail.nickname }}</el-descriptions-item>
              <el-descriptions-item label="手机号">{{ detail.phone }}</el-descriptions-item>
              <el-descriptions-item label="性别">{{ genderMap[detail.gender] }}</el-descriptions-item>
              <el-descriptions-item label="城市">{{ detail.city }}</el-descriptions-item>
              <el-descriptions-item label="真实姓名">{{ detail.realName || '-' }}</el-descriptions-item>
              <el-descriptions-item label="身份证号">{{ detail.idCard ? detail.idCard.slice(0,6) + '********' + detail.idCard.slice(-4) : '-' }}</el-descriptions-item>
              <el-descriptions-item label="认证状态"><el-tag :type="authType[detail.authStatus]">{{ authMap[detail.authStatus] }}</el-tag></el-descriptions-item>
              <el-descriptions-item label="拒绝原因" v-if="detail.authRejectReason">{{ detail.authRejectReason }}</el-descriptions-item>
              <el-descriptions-item label="会员等级">
                <el-tag :type="detail.memberLevel === 'partner' ? 'danger' : detail.memberLevel === 'senior' ? 'warning' : 'info'" size="small">
                  {{ { normal: '普通', senior: '高级', partner: '合伙人' }[detail.memberLevel] || '普通' }}
                </el-tag>
              </el-descriptions-item>
              <el-descriptions-item label="积分">{{ detail.points || 0 }}</el-descriptions-item>
              <el-descriptions-item label="管理评分">
                <el-tag v-if="detail.adminScore > 0" :type="detail.adminScore >= 80 ? 'success' : 'warning'" size="small">⭐ {{ detail.adminScore }}</el-tag>
                <span v-else style="color:#ccc;">未评</span>
              </el-descriptions-item>
              <el-descriptions-item label="注册时间">{{ detail.createdAt }}</el-descriptions-item>
            </el-descriptions>
          </el-tab-pane>

          <!-- Tab 2: 订单记录 -->
          <el-tab-pane name="orders">
            <template #label>
              订单记录 <el-badge v-if="profileData.orders && profileData.orders.total > 0" :value="profileData.orders.total" :max="99" style="margin-left:4px;" />
            </template>
            <div v-loading="profileLoading">
              <div v-if="!profileData.orders || profileData.orders.list.length === 0" class="tab-empty">暂无订单记录</div>
              <template v-else>
                <!-- 统计摘要 -->
                <div class="summary-row">
                  <div class="summary-item"><span class="sl">总发单</span><span class="sv">{{ profileData.orders.total }}</span></div>
                  <div class="summary-item"><span class="sl">已完成</span><span class="sv" style="color:#67c23a;">{{ profileData.orders.stats.completedCount }}</span></div>
                </div>
                <!-- 列表 -->
                <div v-for="o in profileData.orders.list" :key="o.id" class="record-card">
                  <div class="rc-header">
                    <span class="rc-no">{{ o.orderNo }}</span>
                    <el-tag size="small" :type="orderStatusType[o.status]">{{ orderStatusMap[o.status] }}</el-tag>
                  </div>
                  <div class="rc-meta">
                    <span>{{ o.type === 'worker' ? '求职' : '发单' }}</span>
                    <span v-if="o.jobType">· {{ o.jobType.name }}</span>
                    <span>· {{ o.city }}</span>
                    <span>· {{ o.salaryMin }}-{{ o.salaryMax }}元/{{ o.salaryType === 'monthly' ? '月' : '日' }}</span>
                  </div>
                  <div class="rc-time">{{ formatDate(o.createdAt) }}</div>
                </div>
              </template>
            </div>
          </el-tab-pane>

          <!-- Tab 3: 领券记录 -->
          <el-tab-pane name="coupons">
            <template #label>
              领券记录 <el-badge v-if="profileData.coupons && profileData.coupons.total > 0" :value="profileData.coupons.total" :max="99" style="margin-left:4px;" />
            </template>
            <div v-loading="profileLoading">
              <div v-if="!profileData.coupons || profileData.coupons.list.length === 0" class="tab-empty">暂无领券记录</div>
              <div v-for="c in (profileData.coupons ? profileData.coupons.list : [])" :key="c.id" class="record-card">
                <div class="rc-header">
                  <span class="rc-no">{{ c.coupon ? c.coupon.title : '优惠券' }}</span>
                  <el-tag size="small" :type="c.status === 'used' ? 'success' : c.status === 'expired' ? 'info' : 'warning'">
                    {{ { claimed: '已领取', used: '已使用', expired: '已过期' }[c.status] || c.status }}
                  </el-tag>
                </div>
                <div class="rc-meta">
                  <span v-if="c.coupon">类型：{{ { free: '免费', discount: '折扣', cash: '现金' }[c.coupon.type] || c.coupon.type }}</span>
                </div>
                <div class="rc-time">领取：{{ formatDate(c.claimedAt || c.createdAt) }}<span v-if="c.usedAt"> · 使用：{{ formatDate(c.usedAt) }}</span></div>
              </div>
            </div>
          </el-tab-pane>

          <!-- Tab 4: 推广记录 -->
          <el-tab-pane label="推广" name="promotion">
            <div v-loading="profileLoading">
              <div class="summary-row" v-if="profileData.promotion">
                <div class="summary-item"><span class="sl">分享次数</span><span class="sv">{{ profileData.promotion.shareCount }}</span></div>
                <div class="summary-item"><span class="sl">邀请粉丝</span><span class="sv">{{ profileData.promotion.fansCount }}</span></div>
              </div>
              <div v-if="!profileData.promotion || (profileData.promotion.shareCount === 0 && profileData.promotion.fansCount === 0)" class="tab-empty">暂无推广数据</div>
            </div>
          </el-tab-pane>

          <!-- Tab 5: 闺蜜圈 -->
          <el-tab-pane label="闺蜜圈" name="circles">
            <div v-loading="profileLoading">
              <div v-if="!profileData.circles || profileData.circles.length === 0" class="tab-empty">未加入任何闺蜜圈</div>
              <div v-for="m in (profileData.circles || [])" :key="m.id" class="record-card">
                <div class="rc-header">
                  <span class="rc-no">{{ m.circle ? m.circle.name : '圈子' }}</span>
                  <el-tag size="small" :type="m.role === 'owner' ? 'danger' : m.role === 'admin' ? 'warning' : 'info'">
                    {{ { owner: '圈主', admin: '管理', member: '成员' }[m.role] || m.role }}
                  </el-tag>
                </div>
                <div class="rc-meta">
                  状态：{{ { active: '正常', leaving: '退出中', left: '已退出' }[m.status] || m.status }}
                </div>
                <div class="rc-time" v-if="m.joinedAt">加入时间：{{ formatDate(m.joinedAt) }}</div>
              </div>
            </div>
          </el-tab-pane>
        </el-tabs>
      </template>
    </el-drawer>

    <!-- 管理评分弹窗 -->
    <el-dialog v-model="scoreDialogVisible" title="设置管理评分" width="420px">
      <div style="margin-bottom:12px;color:#606266;">为「{{ scoreTarget.nickname || scoreTarget.realName || '-' }}」设置好评权重分</div>
      <el-form label-width="80px">
        <el-form-item label="评分">
          <el-input-number v-model="scoreValue" :min="0" :max="100" :step="5" style="width:200px;" />
          <span style="margin-left:12px;color:#999;font-size:13px;">0-100 分</span>
        </el-form-item>
        <el-form-item label="说明">
          <div style="font-size:12px;color:#999;">评分将纳入 AI 智能匹配权重（占 15%），好评越高优先推荐。权重总和不超过 100 分。</div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="scoreDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="scoreSubmitting" @click="submitScore">确定</el-button>
      </template>
    </el-dialog>

    <!-- 批量导入对话框 -->
    <el-dialog v-model="importDialogVisible" title="批量导入用户" width="640px" destroy-on-close>
      <el-alert type="info" :closable="false" style="margin-bottom:16px;">
        <template #title><span style="font-weight:600;">📋 导入说明</span></template>
        <div style="line-height:1.8;font-size:13px;">
          支持 <strong>.xlsx / .xls / .csv</strong> 格式。表头列名支持：<br/>
          <code>昵称、手机号、性别、城市、真实姓名、身份证号</code><br/>
          手机号已存在的记录会自动跳过，单次最多 500 条。
        </div>
      </el-alert>
      <div style="margin-bottom:16px;">
        <el-button type="primary" plain size="small" @click="downloadTemplate">📥 下载导入模板</el-button>
      </div>
      <el-upload
        ref="uploadRef"
        :auto-upload="false"
        :limit="1"
        accept=".xlsx,.xls,.csv"
        :on-change="handleFileChange"
        :on-remove="() => { importPreview = []; importFile = null }"
        drag
      >
        <el-icon style="font-size:40px;color:#c0c4cc;"><UploadFilled /></el-icon>
        <div style="margin-top:8px;color:#606266;">拖拽文件到此处，或 <em>点击上传</em></div>
      </el-upload>
      <!-- 预览表格 -->
      <div v-if="importPreview.length > 0" style="margin-top:16px;">
        <div style="font-weight:600;margin-bottom:8px;">📊 预览（前 5 条）</div>
        <el-table :data="importPreview.slice(0, 5)" border size="small" max-height="200">
          <el-table-column prop="nickname" label="昵称" />
          <el-table-column prop="phone" label="手机号" />
          <el-table-column prop="gender" label="性别" width="60" />
          <el-table-column prop="city" label="城市" />
          <el-table-column prop="realName" label="真实姓名" />
        </el-table>
        <div style="margin-top:8px;color:#909399;font-size:13px;">共解析 {{ importPreview.length }} 条记录</div>
        <!-- 🤖 AI 智能分析按钮 -->
        <div style="margin-top:12px;display:flex;gap:8px;">
          <el-button type="success" plain @click="handleAiAnalyze" :loading="aiAnalyzing" :disabled="importPreview.length === 0">
            🤖 AI 智能分析
          </el-button>
          <span v-if="aiAnalyzing" style="font-size:12px;color:#67c23a;line-height:32px;">正在分析数据质量...</span>
        </div>
        <!-- AI 分析结果面板 -->
        <div v-if="aiAnalysisResult" style="margin-top:12px;">
          <el-card shadow="never" style="border-color:#67c23a;">
            <template #header>
              <div style="display:flex;align-items:center;justify-content:space-between;">
                <span style="font-weight:600;">🤖 AI 分析结果</span>
                <el-button size="small" type="primary" plain @click="applyAiMapping" v-if="aiAnalysisResult.fieldMapping && Object.keys(aiAnalysisResult.fieldMapping).length > 0">应用映射建议</el-button>
              </div>
            </template>
            <!-- 字段映射 -->
            <div v-if="aiAnalysisResult.fieldMapping && Object.keys(aiAnalysisResult.fieldMapping).length > 0" style="margin-bottom:12px;">
              <div style="font-weight:500;margin-bottom:6px;">📋 字段映射建议:</div>
              <el-tag v-for="(target, source) in aiAnalysisResult.fieldMapping" :key="source" size="small" style="margin:2px 4px;">
                {{ source }} → {{ target }}
              </el-tag>
            </div>
            <!-- 异常标记 -->
            <div v-if="aiAnalysisResult.issues && aiAnalysisResult.issues.length > 0" style="margin-bottom:12px;">
              <div style="font-weight:500;margin-bottom:6px;">⚠️ 异常数据 ({{ aiAnalysisResult.issues.length }} 条):</div>
              <div v-for="(issue, idx) in aiAnalysisResult.issues.slice(0, 10)" :key="idx" style="font-size:12px;color:#f56c6c;line-height:1.8;">
                第 {{ issue.row }} 行「{{ issue.field }}」: {{ issue.issue }}
              </div>
              <div v-if="aiAnalysisResult.issues.length > 10" style="font-size:12px;color:#909399;">... 还有 {{ aiAnalysisResult.issues.length - 10 }} 条</div>
            </div>
            <!-- 总结 -->
            <div v-if="aiAnalysisResult.summary" style="background:#f5f7fa;padding:10px;border-radius:6px;font-size:13px;">
              <div>📊 有效行: <strong>{{ aiAnalysisResult.summary.validRows }}</strong> / {{ aiAnalysisResult.summary.totalSample }}</div>
              <div v-if="aiAnalysisResult.summary.recommendation" style="margin-top:4px;color:#409eff;">💡 {{ aiAnalysisResult.summary.recommendation }}</div>
            </div>
          </el-card>
        </div>
      </div>
      <!-- 导入结果 -->
      <div v-if="importResult" style="margin-top:16px;">
        <el-alert :type="importResult.imported > 0 ? 'success' : 'warning'" :closable="false">
          <template #title>导入完成</template>
          成功导入 <strong>{{ importResult.imported }}</strong> 条，跳过 <strong>{{ importResult.skipped }}</strong> 条（共 {{ importResult.total }} 条）
          <div v-if="importResult.errors && importResult.errors.length > 0" style="margin-top:6px;color:#f56c6c;font-size:12px;">
            <div v-for="(err, idx) in importResult.errors" :key="idx">{{ err }}</div>
          </div>
        </el-alert>
      </div>
      <template #footer>
        <el-button @click="importDialogVisible = false">关闭</el-button>
        <el-button type="primary" :loading="importLoading" :disabled="importPreview.length === 0" @click="handleImport">确认导入 ({{ importPreview.length }} 条)</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { getUsers, getUser, approveUser, rejectUser, toggleUserStatus, setAdminScore, getUserProfileSummary, importUsers } from '../../api/users.js'
import { analyzeImport } from '../../api/ai.js'
import { UploadFilled } from '@element-plus/icons-vue'
import * as XLSX from 'xlsx'
import { ElMessage, ElMessageBox } from 'element-plus'

const list = ref([])
const total = ref(0)
const loading = ref(false)
const drawerVisible = ref(false)
const detail = ref(null)
const detailTab = ref('info')
const profileData = ref({})
const profileLoading = ref(false)
const profileLoaded = ref(false)
const query = reactive({ keyword: '', authStatus: '', page: 1, pageSize: 10 })
const genderMap = { 0: '未知', 1: '男', 2: '女' }
const authMap = { none: '未提交', pending: '待审核', approved: '已通过', rejected: '已拒绝' }
const authType = { none: 'info', pending: 'warning', approved: 'success', rejected: 'danger' }
const orderStatusMap = { pending: '待审核', approved: '待分配', assigned: '待派单', matching: '匹配中', matched: '已派单', completed: '已完成', rejected: '已拒绝', cancelled: '已取消' }
const orderStatusType = { pending: 'warning', approved: 'info', assigned: 'primary', matching: 'primary', matched: 'success', completed: '', rejected: 'danger', cancelled: 'info' }

function formatDate(d) {
  if (!d) return ''
  var dt = new Date(d)
  return dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0') + '-' + String(dt.getDate()).padStart(2, '0') + ' ' + String(dt.getHours()).padStart(2, '0') + ':' + String(dt.getMinutes()).padStart(2, '0')
}

async function fetchList() {
  loading.value = true
  try { const res = await getUsers(query); list.value = res.data.list; total.value = res.data.total } catch(e) {} finally { loading.value = false }
}
function resetQuery() { query.keyword = ''; query.authStatus = ''; query.page = 1; fetchList() }
async function handleApprove(row) {
  await ElMessageBox.confirm('通过「' + row.nickname + '」的实名认证？', '确认')
  await approveUser(row.id); ElMessage.success('已通过'); fetchList()
}
async function handleReject(row) {
  const { value } = await ElMessageBox.prompt('请输入拒绝原因', '拒绝认证', { inputPlaceholder: '如：证件照模糊' })
  await rejectUser(row.id, value); ElMessage.success('已拒绝'); fetchList()
}
async function showDetail(row) {
  try {
    const res = await getUser(row.id)
    detail.value = res.data
    detailTab.value = 'info'
    profileData.value = {}
    profileLoaded.value = false
    drawerVisible.value = true
  } catch(e) {}
}

// 切换 Tab 时懒加载画像数据
async function onTabChange(tab) {
  if (tab !== 'info' && !profileLoaded.value && detail.value) {
    profileLoading.value = true
    try {
      var res = await getUserProfileSummary(detail.value.id)
      profileData.value = res.data
      profileLoaded.value = true
    } catch(e) { ElMessage.error('加载用户画像失败') }
    finally { profileLoading.value = false }
  }
}

// 导出用户 CSV
function handleExport() {
  var token = localStorage.getItem('token')
  var baseUrl = import.meta.env.VITE_API_BASE || '/api'
  fetch(baseUrl + '/users/export/csv', { headers: { 'Authorization': 'Bearer ' + token } })
    .then(function(res) { return res.blob() })
    .then(function(blob) {
      var link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = 'users_' + Date.now() + '.csv'
      link.click()
      ElMessage.success('导出成功')
    })
    .catch(function() { ElMessage.error('导出失败') })
}
// 禁用/启用用户
async function handleToggleStatus(row) {
  var action = row.status === 'disabled' ? '启用' : '禁用'
  await ElMessageBox.confirm('确认' + action + '用户「' + row.nickname + '」？', action + '用户', {
    type: action === '禁用' ? 'warning' : 'success'
  })
  try {
    await toggleUserStatus(row.id)
    ElMessage.success('已' + action)
    fetchList()
  } catch (e) {}
}
onMounted(fetchList)

// 管理评分相关
const scoreDialogVisible = ref(false)
const scoreTarget = ref({})
const scoreValue = ref(0)
const scoreSubmitting = ref(false)

function openScoreDialog(row) {
  scoreTarget.value = row
  scoreValue.value = row.adminScore || 0
  scoreDialogVisible.value = true
}
async function submitScore() {
  scoreSubmitting.value = true
  try {
    await setAdminScore(scoreTarget.value.id, scoreValue.value)
    ElMessage.success('评分已更新为 ' + scoreValue.value + ' 分')
    scoreDialogVisible.value = false
    fetchList()
  } catch (e) {}
  scoreSubmitting.value = false
}

// ========== 批量导入相关 ==========
const importDialogVisible = ref(false)
const importLoading = ref(false)
const importPreview = ref([])
const importFile = ref(null)
const importResult = ref(null)
const uploadRef = ref(null)

// Excel 列名映射
var colMap = {
  '昵称': 'nickname', 'nickname': 'nickname', '姓名': 'nickname',
  '手机号': 'phone', 'phone': 'phone', '手机': 'phone', '电话': 'phone',
  '性别': 'gender', 'gender': 'gender',
  '城市': 'city', 'city': 'city', '地区': 'city',
  '真实姓名': 'realName', 'realName': 'realName', 'realname': 'realName',
  '身份证号': 'idCard', 'idCard': 'idCard', '身份证': 'idCard'
}

function handleFileChange(file) {
  importResult.value = null
  var reader = new FileReader()
  reader.onload = function(e) {
    try {
      var data = new Uint8Array(e.target.result)
      var wb = XLSX.read(data, { type: 'array' })
      var sheet = wb.Sheets[wb.SheetNames[0]]
      var json = XLSX.utils.sheet_to_json(sheet, { defval: '' })
      // 映射列名
      importPreview.value = json.map(function(row) {
        var mapped = {}
        Object.keys(row).forEach(function(key) {
          var k = key.trim()
          var field = colMap[k]
          if (field) mapped[field] = String(row[key]).trim()
        })
        return mapped
      }).filter(function(r) { return r.phone || r.nickname })
      importFile.value = file
    } catch(err) {
      ElMessage.error('文件解析失败: ' + err.message)
      importPreview.value = []
    }
  }
  reader.readAsArrayBuffer(file.raw)
}

async function handleImport() {
  if (importPreview.value.length === 0) return
  importLoading.value = true
  try {
    var res = await importUsers(importPreview.value)
    importResult.value = res.data
    ElMessage.success('导入完成: 成功 ' + res.data.imported + ' 条')
    fetchList()
  } catch(err) {
    ElMessage.error('导入失败')
  } finally {
    importLoading.value = false
  }
}

function downloadTemplate() {
  var token = localStorage.getItem('token')
  var baseUrl = import.meta.env.VITE_API_BASE || '/api'
  fetch(baseUrl + '/users/import/template', { headers: { 'Authorization': 'Bearer ' + token } })
    .then(function(res) { return res.blob() })
    .then(function(blob) {
      var link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = 'user_import_template.csv'
      link.click()
    })
    .catch(function() { ElMessage.error('下载模板失败') })
}

// ========== AI 导入辅助分析 ==========
const aiAnalyzing = ref(false)
const aiAnalysisResult = ref(null)

async function handleAiAnalyze() {
  if (importPreview.value.length === 0) return
  aiAnalyzing.value = true
  aiAnalysisResult.value = null
  try {
    // 获取原始表头（从第一条解析数据的 key）
    var headers = Object.keys(importPreview.value[0] || {})
    // 取前 20 行样本
    var sampleRows = importPreview.value.slice(0, 20)
    var result = await analyzeImport({
      headers: headers,
      sampleRows: sampleRows
    })
    aiAnalysisResult.value = result
    ElMessage.success('AI 分析完成')
  } catch (err) {
    ElMessage.error('AI 分析失败: ' + (err.message || '未知错误'))
  } finally {
    aiAnalyzing.value = false
  }
}

// 应用 AI 的映射建议：重新映射已解析数据
function applyAiMapping() {
  if (!aiAnalysisResult.value || !aiAnalysisResult.value.fieldMapping) return
  var mapping = aiAnalysisResult.value.fieldMapping
  // 用 AI 推荐的映射重新处理
  importPreview.value = importPreview.value.map(function(row) {
    var newRow = Object.assign({}, row)
    Object.keys(mapping).forEach(function(oldKey) {
      var newKey = mapping[oldKey]
      if (oldKey !== newKey && row[oldKey] !== undefined) {
        newRow[newKey] = row[oldKey]
      }
    })
    return newRow
  })
  ElMessage.success('已应用 AI 映射建议')
}
</script>

<style scoped>
/* 详情 Tab 内容样式 */
.tab-empty { text-align: center; color: #c0c4cc; padding: 40px 0; font-size: 13px; }

.summary-row {
  display: flex; gap: 16px; margin-bottom: 16px;
}
.summary-item {
  flex: 1; background: #f5f7fa; border-radius: 8px; padding: 14px 16px;
  display: flex; flex-direction: column; align-items: center;
}
.sl { font-size: 12px; color: #999; margin-bottom: 4px; }
.sv { font-size: 22px; font-weight: 700; color: var(--gray-900, #1d1d1f); }

.record-card {
  border: 1px solid #ebeef5; border-radius: 8px; padding: 12px 14px;
  margin-bottom: 10px; transition: box-shadow 0.2s;
}
.record-card:hover { box-shadow: 0 2px 8px rgba(0,0,0,0.06); }
.rc-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; }
.rc-no { font-weight: 600; font-size: 13px; color: #303133; }
.rc-meta { font-size: 12px; color: #909399; }
.rc-time { font-size: 11px; color: #c0c4cc; margin-top: 4px; }
</style>
