<template>
  <div class="dashboard">
    <!-- 顶部指标卡 -->
    <el-row :gutter="16">
      <el-col :xl="6" :lg="6" :md="12" :sm="12" :xs="12" v-for="card in statCards" :key="card.key">
        <div class="stat-card" :style="{ '--accent': card.color }" @click="card.link && router.push(card.link)" :class="{ clickable: card.link }">
          <div class="sc-icon-wrap" :style="{ background: card.iconBg }">
            <span class="sc-icon">{{ card.icon }}</span>
          </div>
          <div class="sc-info">
            <div class="sc-value">{{ card.prefix || '' }}{{ stats[card.key] ?? '-' }}</div>
            <div class="sc-label">{{ card.label }}</div>
            <div v-if="card.compareKey && stats[card.compareKey] !== undefined" class="sc-compare"  :class="{ 'sc-up': stats[card.key] > stats[card.compareKey], 'sc-down': stats[card.key] < stats[card.compareKey] }">
              {{ stats[card.key] > stats[card.compareKey] ? '↑' : stats[card.key] < stats[card.compareKey] ? '↓' : '→' }}
              {{ stats[card.compareKey] === 0 ? (stats[card.key] > 0 ? 'NEW' : '-') : Math.abs(Math.round((stats[card.key] - stats[card.compareKey]) / stats[card.compareKey] * 100)) + '%' }}
              <span class="sc-compare-label">较昨日</span>
            </div>
          </div>
        </div>
      </el-col>
    </el-row>

    <!-- 图表区域 -->
    <el-row :gutter="16" style="margin-top: 20px;">
      <el-col :xl="16" :lg="16" :md="24" :sm="24" :xs="24">
        <el-card shadow="never" class="chart-card">
          <template #header>
            <div class="chart-header">
              <span class="chart-title">趋势概览</span>
              <el-radio-group v-model="trendDays" size="small" @change="fetchTrends">
                <el-radio-button :value="7">近7天</el-radio-button>
                <el-radio-button :value="30">近30天</el-radio-button>
              </el-radio-group>
            </div>
          </template>
          <div ref="trendChartRef" class="chart-container"></div>
        </el-card>
      </el-col>
      <el-col :xl="8" :lg="8" :md="24" :sm="24" :xs="24">
        <el-card shadow="never" class="chart-card">
          <template #header><span class="chart-title">优惠券类型分布</span></template>
          <div ref="pieChartRef" class="chart-container"></div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 排行榜 + 快捷操作 -->
    <el-row :gutter="16" style="margin-top: 20px;">
      <el-col :xl="12" :lg="12" :md="24" :sm="24" :xs="24">
        <el-card shadow="never" class="chart-card">
          <template #header><span class="chart-title">机构核销排行 TOP 5</span></template>
          <div ref="rankChartRef" class="chart-container"></div>
        </el-card>
      </el-col>
      <el-col :xl="12" :lg="12" :md="24" :sm="24" :xs="24">
        <el-card shadow="never">
          <template #header><span class="chart-title">快捷操作</span></template>
          <div class="quick-grid">
            <div class="quick-item" v-for="action in quickActions" :key="action.label" @click="action.handler ? action.handler() : $router.push(action.path)">
              <div class="qi-icon" :style="{ background: action.bg }">{{ action.icon }}</div>
              <span class="qi-label">{{ action.label }}</span>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- AI 报告生成弹窗 -->
    <el-dialog v-model="reportDialogVisible" title="📊 AI 运营报告" width="700px" top="5vh" :append-to-body="false">
      <div style="margin-bottom:16px;display:flex;gap:12px;align-items:center;flex-wrap:wrap;">
        <el-radio-group v-model="reportType" size="small">
          <el-radio-button label="weekly" value="weekly">周报</el-radio-button>
          <el-radio-button label="monthly" value="monthly">月报</el-radio-button>
        </el-radio-group>
        <el-radio-group v-model="reportScope" size="small">
          <el-radio-button label="all" value="all">全平台</el-radio-button>
          <el-radio-button label="personal" value="personal">我的业绩</el-radio-button>
        </el-radio-group>
        <el-button type="primary" size="small" @click="handleGenerateReport" :loading="reportLoading" style="background:#409eff;border-color:#409eff;color:#fff;">
          ⚡ 生成报告
        </el-button>
        <el-button size="small" @click="router.push('/reports')" style="margin-left:auto;">📁 历史报告</el-button>
      </div>
      <div v-if="reportContent" class="report-content" v-html="renderReportMd(reportContent)"></div>
      <div v-else-if="reportLoading" style="text-align:center;padding:60px 0;color:#999;">
        🤖 AI 正在分析数据并生成报告...
      </div>
      <div v-else style="text-align:center;padding:60px 0;color:#ccc;">
        选择报告类型后点击「⚡ 生成报告」
      </div>
      <!-- 存档成功提示 -->
      <div v-if="reportContent && !reportLoading" style="margin-top:12px;padding:8px 12px;background:#f0f9eb;border-radius:6px;color:#67c23a;font-size:13px;">
        ✅ 报告已自动保存，可在「📁 历史报告」中随时查看
      </div>
      <template #footer>
        <el-button v-if="reportContent" @click="copyReport">📋 复制</el-button>
        <el-button v-if="reportContent" type="primary" @click="exportReportWord">📄 导出 Word</el-button>
        <el-button @click="reportDialogVisible = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { getStats, getTrends, getRankings } from '../../api/dashboard.js'
import { generateReport } from '../../api/ai.js'
import * as echarts from 'echarts'
import { Marked } from 'marked'
import { ElMessage } from 'element-plus'

const marked = new Marked({ breaks: true, gfm: true })

const router = useRouter()

const stats = ref({})
const trendDays = ref(7)
const trendChartRef = ref(null)
const pieChartRef = ref(null)
const rankChartRef = ref(null)
let trendChart = null
let pieChart = null
let rankChart = null

const statCards = [
  { key: 'totalUsers', label: '累计用户', icon: '👥', color: '#5E9FFF', iconBg: 'rgba(94,159,255,0.1)', link: '/users' },
  { key: 'todayUsers', label: '今日新增', icon: '🆕', color: '#AF52DE', iconBg: 'rgba(175,82,222,0.1)', link: '/users', compareKey: 'yesterdayUsers' },
  { key: 'totalCoupons', label: '上架优惠券', icon: '🎫', color: '#5AC8FA', iconBg: 'rgba(90,200,250,0.1)', link: '/coupons' },
  { key: 'todayClaimed', label: '今日领券', icon: '📥', color: '#34C759', iconBg: 'rgba(52,199,89,0.1)', link: '/orders', compareKey: 'yesterdayClaimed' },
  { key: 'pendingServiceOrders', label: '待审核订单', icon: '⏳', color: '#FF9F0A', iconBg: 'rgba(255,159,10,0.1)', link: { path: '/service-orders', query: { status: 'pending' } } },
  { key: 'approvedServiceOrders', label: '待分配', icon: '👤', color: '#5E9FFF', iconBg: 'rgba(94,159,255,0.1)', link: { path: '/service-orders', query: { status: 'approved' } } },
  { key: 'assignedServiceOrders', label: '待派单', icon: '🔄', color: '#AF52DE', iconBg: 'rgba(175,82,222,0.1)', link: { path: '/service-orders', query: { status: 'assigned' } } },
  { key: 'todayServiceOrders', label: '今日新订单', icon: '📦', color: '#FF6B6B', iconBg: 'rgba(255,107,107,0.1)', link: '/service-orders', compareKey: 'yesterdayServiceOrders' },
  { key: 'monthCompletedOrders', label: '本月完成', icon: '✅', color: '#34C759', iconBg: 'rgba(52,199,89,0.1)', link: '/service-orders' },
  { key: 'monthOrderAmount', label: '本月金额', icon: '💰', color: '#FF6B6B', iconBg: 'rgba(255,107,107,0.1)', prefix: '¥', link: '/service-orders' }
]

const quickActions = [
  { label: '新建优惠券', icon: '🎫', path: '/coupons/create', bg: 'rgba(94,159,255,0.1)' },
  { label: '新建机构', icon: '🏛️', path: '/agencies/create', bg: 'rgba(52,199,89,0.1)' },
  { label: '服务订单', icon: '📦', path: '/service-orders', bg: 'rgba(255,159,10,0.1)' },
  { label: '推广管理', icon: '🤝', path: '/shares', bg: 'rgba(255,107,107,0.1)' },
  { label: '📊 AI 周报', icon: '🤖', path: '', bg: 'rgba(103,194,58,0.1)', handler: openReportDialog },
  { label: '系统配置', icon: '⚙️', path: '/system/settings', bg: 'rgba(142,142,147,0.1)' }
]

// 图表颜色方案 — 苹果色
var appleColors = ['#5E9FFF', '#FF6B6B', '#34C759', '#FF9F0A', '#AF52DE', '#5AC8FA']

// 初始化趋势折线图
function initTrendChart(data) {
  if (!trendChartRef.value) return
  if (!trendChart) {
    trendChart = echarts.init(trendChartRef.value)
  }
  var dates = data.userTrends.map(function(i) { return i.date })
  trendChart.setOption({
    tooltip: { trigger: 'axis', backgroundColor: 'rgba(255,255,255,0.96)', borderColor: '#eee', borderWidth: 1, textStyle: { color: '#333', fontSize: 12 }, boxShadow: '0 4px 14px rgba(0,0,0,0.1)' },
    legend: { data: ['新增用户', '领券量', '服务订单'], top: 0, textStyle: { color: '#8E8E93', fontSize: 12 } },
    grid: { left: 40, right: 20, top: 40, bottom: 24 },
    xAxis: { type: 'category', data: dates, boundaryGap: false, axisLine: { lineStyle: { color: '#E5E5EA' } }, axisLabel: { color: '#8E8E93', fontSize: 11 } },
    yAxis: { type: 'value', minInterval: 1, splitLine: { lineStyle: { color: '#F5F5F7', type: 'dashed' } }, axisLabel: { color: '#8E8E93', fontSize: 11 } },
    series: [
      { name: '新增用户', type: 'line', data: data.userTrends.map(function(i) { return i.count }), smooth: 0.4, symbol: 'circle', symbolSize: 6, areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(94,159,255,0.15)' }, { offset: 1, color: 'rgba(94,159,255,0)' }] } }, lineStyle: { width: 2.5 }, itemStyle: { color: '#5E9FFF' } },
      { name: '领券量', type: 'line', data: data.orderTrends.map(function(i) { return i.count }), smooth: 0.4, symbol: 'circle', symbolSize: 6, areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(255,107,107,0.15)' }, { offset: 1, color: 'rgba(255,107,107,0)' }] } }, lineStyle: { width: 2.5 }, itemStyle: { color: '#FF6B6B' } },
      { name: '服务订单', type: 'line', data: (data.serviceTrends || []).map(function(i) { return i.count }), smooth: 0.4, symbol: 'circle', symbolSize: 6, areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(52,199,89,0.15)' }, { offset: 1, color: 'rgba(52,199,89,0)' }] } }, lineStyle: { width: 2.5 }, itemStyle: { color: '#34C759' } }
    ]
  })
}

// 初始化饼图
function initPieChart(data) {
  if (!pieChartRef.value) return
  if (!pieChart) {
    pieChart = echarts.init(pieChartRef.value)
  }
  pieChart.setOption({
    tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)', backgroundColor: 'rgba(255,255,255,0.96)', borderColor: '#eee', borderWidth: 1, textStyle: { color: '#333', fontSize: 12 } },
    legend: { bottom: 0, itemWidth: 10, itemHeight: 10, textStyle: { fontSize: 12, color: '#8E8E93' }, itemGap: 16 },
    color: appleColors,
    series: [{
      type: 'pie', radius: ['45%', '72%'], center: ['50%', '45%'],
      label: { show: false },
      emphasis: { label: { show: true, fontWeight: 600, fontSize: 13 }, scaleSize: 6 },
      itemStyle: { borderRadius: 6, borderColor: '#fff', borderWidth: 2 },
      data: data
    }]
  })
}

// 初始化排行柱状图
function initRankChart(data) {
  if (!rankChartRef.value) return
  if (!rankChart) {
    rankChart = echarts.init(rankChartRef.value)
  }
  var names = data.map(function(i) { return i.name }).reverse()
  var counts = data.map(function(i) { return i.count }).reverse()
  rankChart.setOption({
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, backgroundColor: 'rgba(255,255,255,0.96)', borderColor: '#eee', borderWidth: 1, textStyle: { color: '#333', fontSize: 12 } },
    grid: { left: 120, right: 30, top: 10, bottom: 24 },
    xAxis: { type: 'value', minInterval: 1, splitLine: { lineStyle: { color: '#F5F5F7', type: 'dashed' } }, axisLabel: { color: '#8E8E93', fontSize: 11 } },
    yAxis: { type: 'category', data: names, axisLabel: { fontSize: 12, color: '#636366' }, axisLine: { lineStyle: { color: '#E5E5EA' } } },
    series: [{
      type: 'bar', data: counts, barWidth: 20,
      itemStyle: {
        borderRadius: [0, 6, 6, 0],
        color: function(params) { return appleColors[params.dataIndex % appleColors.length] }
      }
    }]
  })
}

async function fetchStats() {
  try {
    var res = await getStats()
    stats.value = res.data
  } catch (e) {}
}

async function fetchTrends() {
  try {
    var res = await getTrends(trendDays.value)
    await nextTick()
    initTrendChart(res.data)
    initPieChart(res.data.couponTypes)
  } catch (e) {}
}

async function fetchRankings() {
  try {
    var res = await getRankings()
    await nextTick()
    initRankChart(res.data)
  } catch (e) {}
}

function handleResize() {
  trendChart && trendChart.resize()
  pieChart && pieChart.resize()
  rankChart && rankChart.resize()
}

onMounted(async () => {
  await fetchStats()
  await fetchTrends()
  await fetchRankings()
  window.addEventListener('resize', handleResize)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
  trendChart && trendChart.dispose()
  pieChart && pieChart.dispose()
  rankChart && rankChart.dispose()
  if (reportController) reportController.abort()
})

// ==================== AI 报告生成 ====================
const reportDialogVisible = ref(false)
const reportType = ref('weekly')
const reportScope = ref('all')
const reportContent = ref('')
const reportLoading = ref(false)
let reportController = null

function openReportDialog() {
  reportDialogVisible.value = true
  reportContent.value = ''
}

function handleGenerateReport() {
  reportContent.value = ''
  reportLoading.value = true
  if (reportController) reportController.abort()

  reportController = generateReport(
    { type: reportType.value, scope: reportScope.value },
    function(chunk) {
      reportContent.value += chunk
    },
    function() {
      reportLoading.value = false
      reportController = null
    },
    function(err) {
      reportLoading.value = false
      reportController = null
      reportContent.value = '⚠️ 报告生成失败: ' + (err.message || '未知错误')
    }
  )
}

function renderReportMd(text) {
  if (!text) return ''
  try { return marked.parse(text) } catch(e) { return text }
}

function copyReport() {
  if (!reportContent.value) return
  navigator.clipboard.writeText(reportContent.value)
    .then(function() { ElMessage.success('报告已复制到剪贴板') })
    .catch(function() { ElMessage.error('复制失败') })
}

function exportReportWord() {
  if (!reportContent.value) return
  var html = marked.parse(reportContent.value)
  var wordHtml = [
    '<html xmlns:o="urn:schemas-microsoft-com:office:office" ',
    'xmlns:w="urn:schemas-microsoft-com:office:word" ',
    'xmlns="http://www.w3.org/TR/REC-html40">',
    '<head><meta charset="utf-8">',
    '<style>',
    'body { font-family: "微软雅黑", sans-serif; font-size: 14px; line-height: 1.8; color: #333; padding: 20px; }',
    'h1 { font-size: 22px; border-bottom: 2px solid #409eff; padding-bottom: 8px; }',
    'h2 { font-size: 18px; }',
    'table { width: 100%; border-collapse: collapse; margin: 12px 0; }',
    'th, td { border: 1px solid #d0d0d0; padding: 8px 12px; font-size: 13px; }',
    'th { background: #f0f2f5; font-weight: bold; }',
    'strong { color: #409eff; }',
    '</style></head><body>',
    html,
    '</body></html>'
  ].join('')
  var blob = new Blob([wordHtml], { type: 'application/msword' })
  var url = URL.createObjectURL(blob)
  var a = document.createElement('a')
  a.href = url
  var typeLabel = reportType.value === 'weekly' ? '周报' : '月报'
  a.download = '运营' + typeLabel + '_' + new Date().toLocaleDateString().replace(/\//g, '-') + '.doc'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
  ElMessage.success('Word 文件已下载')
}
</script>

<style scoped>
/* 指标卡 — 苹果风格 */
.stat-card {
  background: var(--bg-card);
  border-radius: var(--radius-md);
  padding: 20px;
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 4px;
  box-shadow: var(--shadow-sm);
  transition: all var(--transition-normal);
  cursor: default;
}
.stat-card.clickable {
  cursor: pointer;
}
.stat-card:hover {
  box-shadow: var(--shadow-md);
  transform: translateY(-2px);
}
.stat-card.clickable:hover {
  border-left: 3px solid var(--accent, #5E9FFF);
}
.stat-card.clickable:active {
  transform: scale(0.98);
}
.sc-icon-wrap {
  width: 48px;
  height: 48px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.sc-icon { font-size: 22px; }
.sc-value {
  font-size: 28px;
  font-weight: 700;
  line-height: 1.2;
  color: var(--gray-900);
  font-feature-settings: 'tnum';
  letter-spacing: -0.02em;
}
.sc-label {
  font-size: 12px;
  color: var(--gray-500);
  margin-top: 2px;
  font-weight: 500;
}
.sc-compare {
  font-size: 11px;
  margin-top: 4px;
  font-weight: 600;
  color: var(--gray-400);
}
.sc-compare.sc-up { color: #34C759; }
.sc-compare.sc-down { color: #FF3B30; }
.sc-compare-label { font-weight: 400; color: var(--gray-400); margin-left: 2px; }

/* 图表卡片 */
.chart-card { min-height: 320px; }
.chart-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.chart-title {
  font-weight: 600;
  font-size: 15px;
  color: var(--gray-900);
}
.chart-container { width: 100%; height: 280px; }

/* 快捷操作 — 苹果网格风格 */
.quick-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}
.quick-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 20px 8px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all var(--transition-fast);
}
.quick-item:hover {
  background: var(--gray-50);
  transform: translateY(-2px);
}
.qi-icon {
  width: 48px;
  height: 48px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  transition: transform var(--transition-fast);
}
.quick-item:hover .qi-icon {
  transform: scale(1.1);
}
.qi-label {
  font-size: 12px;
  color: var(--gray-600);
  font-weight: 500;
}

/* ===== 响应式适配 ===== */

/* ≤1440px */
@media (max-width: 1440px) {
  .stat-card {
    padding: 16px;
    gap: 12px;
  }
  .sc-value { font-size: 22px; }
  .sc-icon-wrap { width: 40px; height: 40px; border-radius: 12px; }
  .sc-icon { font-size: 18px; }
  .chart-container { height: 240px; }
}

/* ≤1200px */
@media (max-width: 1200px) {
  .stat-card {
    padding: 14px;
    gap: 10px;
  }
  .sc-value { font-size: 20px; }
  .sc-label { font-size: 11px; }
  .chart-container { height: 220px; }
  .quick-grid {
    grid-template-columns: repeat(2, 1fr) !important;
    gap: 8px;
  }
  .quick-item { padding: 14px 6px; }
}

/* ≤1024px */
@media (max-width: 1024px) {
  .stat-card {
    padding: 12px;
    flex-direction: column;
    text-align: center;
    gap: 8px;
  }
  .sc-value { font-size: 18px; }
  .chart-container { height: 200px; }
}

/* AI 报告内容渲染 */
.report-content {
  max-height: 60vh;
  overflow-y: auto;
  padding: 16px;
  background: #fafbfc;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
  font-size: 14px;
  line-height: 1.8;
  color: #333;
}
.report-content h1, .report-content h2, .report-content h3 {
  color: #1d1d1f;
  margin-top: 16px;
  margin-bottom: 8px;
}
.report-content h1 { font-size: 20px; border-bottom: 2px solid #409eff; padding-bottom: 6px; }
.report-content h2 { font-size: 17px; }
.report-content h3 { font-size: 15px; }
.report-content table {
  width: 100%;
  border-collapse: collapse;
  margin: 12px 0;
}
.report-content th, .report-content td {
  border: 1px solid #e5e7eb;
  padding: 8px 12px;
  text-align: left;
  font-size: 13px;
}
.report-content th {
  background: #f0f2f5;
  font-weight: 600;
}
.report-content ul, .report-content ol {
  padding-left: 20px;
  margin: 8px 0;
}
.report-content strong {
  color: #409eff;
}
</style>
