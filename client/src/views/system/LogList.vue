<template>
  <div class="log-list">
    <!-- 筛选区 -->
    <el-card class="filter-card" shadow="never">
      <el-row :gutter="16" align="middle">
        <el-col :span="4">
          <el-select v-model="filters.module" clearable placeholder="模块" @change="fetchList">
            <el-option label="优惠券" value="coupon" />
            <el-option label="机构" value="agency" />
            <el-option label="订单" value="order" />
            <el-option label="推荐官" value="recommender" />
            <el-option label="系统" value="system" />
            <el-option label="用户" value="user" />
            <el-option label="文章" value="article" />
          </el-select>
        </el-col>
        <el-col :span="5">
          <el-input v-model="filters.adminName" clearable placeholder="操作人" @clear="fetchList" @keyup.enter="fetchList" />
        </el-col>
        <el-col :span="8">
          <el-date-picker v-model="dateRange" type="daterange" range-separator="至" start-placeholder="开始" end-placeholder="结束" value-format="YYYY-MM-DD" style="width: 100%;" @change="handleDateChange" />
        </el-col>
        <el-col :span="3">
          <el-button type="primary" @click="fetchList">查询</el-button>
        </el-col>
      </el-row>
    </el-card>

    <!-- 表格 -->
    <el-card shadow="never">
      <el-table :data="list" stripe v-loading="loading" size="small">
        <el-table-column label="时间" min-width="160">
          <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column prop="adminName" label="操作人" min-width="100" />
        <el-table-column label="模块" min-width="80">
          <template #default="{ row }">
            <el-tag size="small" :type="moduleType(row.module)">{{ moduleText(row.module) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="动作" min-width="80">
          <template #default="{ row }">{{ actionText(row.action) }}</template>
        </el-table-column>
        <el-table-column prop="detail" label="详情" min-width="280" show-overflow-tooltip />
        <el-table-column prop="ip" label="IP" min-width="120" />
      </el-table>
      <div class="pagination-wrap">
        <el-pagination background layout="total, prev, pager, next" :total="total" :page-size="pageSize" v-model:current-page="page" @current-change="fetchList" />
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { getLogs } from '../../api/logs.js'

const list = ref([])
const loading = ref(false)
const page = ref(1)
const pageSize = 20
const total = ref(0)
const dateRange = ref(null)
const filters = ref({ module: '', adminName: '', startDate: '', endDate: '' })

function moduleType(m) { return { coupon: '', agency: 'success', order: 'warning', recommender: 'danger', system: 'info', user: '', article: 'success' }[m] || '' }
function moduleText(m) { return { coupon: '优惠券', agency: '机构', order: '订单', recommender: '推荐官', system: '系统', user: '用户', article: '文章' }[m] || m }
function actionText(a) { return { create: '创建', update: '编辑', delete: '删除', approve: '审核通过', reject: '审核拒绝', status: '状态变更', verify: '核销', settle: '结算', withdraw: '提现', suspend: '冻结', 'reset-password': '重置密码' }[a] || a }

function formatDate(d) {
  if (!d) return ''
  var dt = new Date(d)
  return dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0') + '-' + String(dt.getDate()).padStart(2, '0') + ' ' + String(dt.getHours()).padStart(2, '0') + ':' + String(dt.getMinutes()).padStart(2, '0') + ':' + String(dt.getSeconds()).padStart(2, '0')
}

function handleDateChange(val) {
  if (val) {
    filters.value.startDate = val[0]
    filters.value.endDate = val[1]
  } else {
    filters.value.startDate = ''
    filters.value.endDate = ''
  }
  fetchList()
}

async function fetchList() {
  loading.value = true
  try {
    var params = { page: page.value, pageSize: pageSize }
    if (filters.value.module) params.module = filters.value.module
    if (filters.value.adminName) params.adminName = filters.value.adminName
    if (filters.value.startDate) params.startDate = filters.value.startDate
    if (filters.value.endDate) params.endDate = filters.value.endDate
    var res = await getLogs(params)
    list.value = res.data.list
    total.value = res.data.total
  } catch (e) {}
  loading.value = false
}

onMounted(fetchList)
</script>

<style scoped>
.filter-card { margin-bottom: 16px; }
.pagination-wrap { display: flex; justify-content: flex-end; margin-top: 16px; }
</style>
