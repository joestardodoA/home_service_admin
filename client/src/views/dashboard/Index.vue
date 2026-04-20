<template>
  <div class="dashboard">
    <!-- 顶部指标卡 -->
    <el-row :gutter="14">
      <el-col :span="cols" v-for="card in statCards" :key="card.key">
        <div class="stat-card" :style="{ background: card.bg }">
          <div class="sc-icon">{{ card.icon }}</div>
          <div class="sc-info">
            <div class="sc-value">{{ stats[card.key] ?? '-' }}</div>
            <div class="sc-label">{{ card.label }}</div>
          </div>
        </div>
      </el-col>
    </el-row>

    <!-- 图表区域 -->
    <el-row :gutter="16" style="margin-top: 20px;">
      <el-col :span="16">
        <el-card shadow="never" class="chart-card">
          <template #header>
            <div class="chart-header">
              <span>趋势概览</span>
              <el-radio-group v-model="trendDays" size="small" @change="fetchTrends">
                <el-radio-button :value="7">近7天</el-radio-button>
                <el-radio-button :value="30">近30天</el-radio-button>
              </el-radio-group>
            </div>
          </template>
          <div ref="trendChartRef" class="chart-container"></div>
        </el-card>
      </el-col>
      <el-col :span="8">
        <el-card shadow="never" class="chart-card">
          <template #header><span>优惠券类型分布</span></template>
          <div ref="pieChartRef" class="chart-container"></div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 排行榜 + 快捷操作 -->
    <el-row :gutter="16" style="margin-top: 20px;">
      <el-col :span="12">
        <el-card shadow="never" class="chart-card">
          <template #header><span>机构核销排行 TOP 5</span></template>
          <div ref="rankChartRef" class="chart-container"></div>
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card shadow="never" header="快捷操作">
          <el-row :gutter="12">
            <el-col :span="8" v-for="action in quickActions" :key="action.label">
              <el-button :type="action.type" class="shortcut-btn" @click="$router.push(action.path)">
                <span class="sa-icon">{{ action.icon }}</span>{{ action.label }}
              </el-button>
            </el-col>
          </el-row>
        </el-card>
        <el-card shadow="never" header="系统信息" style="margin-top: 16px;">
          <div class="sys-info">
            <p><span>系统版本</span><span>V2.0.0 (Phase 3)</span></p>
            <p><span>运行环境</span><span>Node.js + Vue 3</span></p>
            <p><span>数据库</span><span>SQLite (开发)</span></p>
            <p><span>图表引擎</span><span>ECharts 5</span></p>
          </div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { getStats, getTrends, getRankings } from '../../api/dashboard.js'
import * as echarts from 'echarts'

const stats = ref({})
const trendDays = ref(7)
const trendChartRef = ref(null)
const pieChartRef = ref(null)
const rankChartRef = ref(null)
let trendChart = null
let pieChart = null
let rankChart = null

// 根据指标卡数量 = 7，用 span = 3（不整除时最后一个占用余下空间）
const cols = computed(() => 3)
const statCards = [
  { key: 'totalUsers', label: '累计用户', icon: '👥', bg: 'linear-gradient(135deg, #667eea, #764ba2)' },
  { key: 'todayUsers', label: '今日新增', icon: '🆕', bg: 'linear-gradient(135deg, #f093fb, #f5576c)' },
  { key: 'totalCoupons', label: '上架优惠券', icon: '🎫', bg: 'linear-gradient(135deg, #4facfe, #00f2fe)' },
  { key: 'todayClaimed', label: '今日领券', icon: '📥', bg: 'linear-gradient(135deg, #43e97b, #38f9d7)' },
  { key: 'unusedOrders', label: '待核销', icon: '⏳', bg: 'linear-gradient(135deg, #fa709a, #fee140)' },
  { key: 'totalRecommenders', label: '推荐官', icon: '🤝', bg: 'linear-gradient(135deg, #a18cd1, #fbc2eb)' },
  { key: 'monthCommission', label: '本月佣金', icon: '💰', bg: 'linear-gradient(135deg, #ffecd2, #fcb69f)' },
  { key: 'totalAgencies', label: '合作机构', icon: '🏛️', bg: 'linear-gradient(135deg, #89f7fe, #66a6ff)' }
]

const quickActions = [
  { label: '新建优惠券', type: 'primary', icon: '🎫', path: '/coupons/create' },
  { label: '新建机构', type: 'success', icon: '🏛️', path: '/agencies/create' },
  { label: '订单管理', type: 'warning', icon: '📦', path: '/orders' },
  { label: '推荐官审核', type: 'danger', icon: '🤝', path: '/recommenders' },
  { label: '发布文章', type: 'info', icon: '📝', path: '/articles/create' },
  { label: '操作日志', type: '', icon: '📋', path: '/system/logs' }
]

// 初始化趋势折线图
function initTrendChart(data) {
  if (!trendChartRef.value) return
  if (!trendChart) {
    trendChart = echarts.init(trendChartRef.value)
  }
  var dates = data.userTrends.map(function(i) { return i.date })
  trendChart.setOption({
    tooltip: { trigger: 'axis' },
    legend: { data: ['新增用户', '领券量'], top: 0 },
    grid: { left: 40, right: 20, top: 36, bottom: 24 },
    xAxis: { type: 'category', data: dates, boundaryGap: false },
    yAxis: { type: 'value', minInterval: 1 },
    series: [
      { name: '新增用户', type: 'line', data: data.userTrends.map(function(i) { return i.count }), smooth: true, areaStyle: { opacity: 0.15 }, color: '#667eea' },
      { name: '领券量', type: 'line', data: data.orderTrends.map(function(i) { return i.count }), smooth: true, areaStyle: { opacity: 0.15 }, color: '#f5576c' }
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
    tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
    legend: { bottom: 0, itemWidth: 12, itemHeight: 12, textStyle: { fontSize: 12 } },
    color: ['#43e97b', '#4facfe', '#f5576c'],
    series: [{
      type: 'pie', radius: ['42%', '70%'], center: ['50%', '45%'],
      label: { show: false },
      emphasis: { label: { show: true, fontWeight: 'bold' } },
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
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { left: 120, right: 30, top: 10, bottom: 24 },
    xAxis: { type: 'value', minInterval: 1 },
    yAxis: { type: 'category', data: names, axisLabel: { fontSize: 12 } },
    series: [{
      type: 'bar', data: counts, barWidth: 18,
      itemStyle: {
        borderRadius: [0, 4, 4, 0],
        color: function(params) {
          var colors = ['#667eea', '#4facfe', '#43e97b', '#f5576c', '#fa709a']
          return colors[params.dataIndex % colors.length]
        }
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
})
</script>

<style scoped>
.stat-card {
  border-radius: 12px;
  padding: 16px;
  color: #fff;
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 4px;
}
.sc-icon { font-size: 28px; }
.sc-value { font-size: 26px; font-weight: 700; line-height: 1.2; }
.sc-label { font-size: 12px; opacity: 0.85; margin-top: 2px; }
.chart-card { min-height: 320px; }
.chart-header { display: flex; justify-content: space-between; align-items: center; }
.chart-container { width: 100%; height: 280px; }
.shortcut-btn { width: 100%; margin-bottom: 10px; height: 48px; font-size: 14px; }
.sa-icon { margin-right: 6px; }
.sys-info p { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f0f0f0; font-size: 13px; color: #666; }
.sys-info p span:first-child { color: #999; }
</style>
