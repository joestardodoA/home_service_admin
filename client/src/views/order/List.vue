<template>
  <div>
    <el-card class="filter-card">
      <el-row :gutter="16" align="middle">
        <el-col :span="6">
          <el-input v-model="query.keyword" placeholder="搜索订单号/核销码" clearable prefix-icon="Search" @clear="fetchList" @keyup.enter="fetchList" />
        </el-col>
        <el-col :span="4">
          <el-select v-model="query.status" placeholder="状态" clearable @change="fetchList">
            <el-option label="未兑换" value="unused" />
            <el-option label="已兑换" value="used" />
            <el-option label="已过期" value="expired" />
            <el-option label="已作废" value="cancelled" />
          </el-select>
        </el-col>
        <el-col :span="6">
          <el-date-picker v-model="dateRange" type="daterange" range-separator="至" start-placeholder="开始日期" end-placeholder="结束日期" value-format="YYYY-MM-DD" @change="onDateChange" />
        </el-col>
        <el-col :span="4">
          <el-button type="primary" @click="fetchList">查询</el-button>
          <el-button @click="resetQuery">重置</el-button>
        </el-col>
      </el-row>
    </el-card>

    <el-card style="margin-top:16px;">
      <el-table :data="list" v-loading="loading" stripe>
        <el-table-column prop="orderNo" label="订单号" width="170" />
        <el-table-column label="优惠券" min-width="160">
          <template #default="{ row }">{{ row.coupon ? row.coupon.title : '-' }}</template>
        </el-table-column>
        <el-table-column label="用户" width="100">
          <template #default="{ row }">{{ row.user ? row.user.nickname : '-' }}</template>
        </el-table-column>
        <el-table-column prop="verifyCode" label="核销码" width="150" />
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <el-tag size="small" :type="statusType[row.status]">{{ statusMap[row.status] }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="source" label="来源" width="90" />
        <el-table-column prop="expireDate" label="过期日期" width="110" />
        <el-table-column label="操作" width="180" fixed="right">
          <template #default="{ row }">
            <el-button v-if="row.status === 'unused'" size="small" type="success" @click="handleVerify(row)">核销</el-button>
            <el-button v-if="row.status === 'unused'" size="small" type="warning" @click="handleCancel(row)">作废</el-button>
            <el-button size="small" @click="showDetail(row)">详情</el-button>
          </template>
        </el-table-column>
      </el-table>
      <div style="margin-top:16px;text-align:right;">
        <el-pagination v-model:current-page="query.page" :page-size="query.pageSize" :total="total" layout="total, prev, pager, next" @current-change="fetchList" />
      </div>
    </el-card>

    <!-- 详情抽屉 -->
    <el-drawer v-model="drawerVisible" title="订单详情" size="400px">
      <template v-if="detail">
        <el-descriptions :column="1" border>
          <el-descriptions-item label="订单号">{{ detail.orderNo }}</el-descriptions-item>
          <el-descriptions-item label="优惠券">{{ detail.coupon ? detail.coupon.title : '-' }}</el-descriptions-item>
          <el-descriptions-item label="用户">{{ detail.user ? detail.user.nickname : '-' }}</el-descriptions-item>
          <el-descriptions-item label="核销码">{{ detail.verifyCode }}</el-descriptions-item>
          <el-descriptions-item label="状态">{{ statusMap[detail.status] }}</el-descriptions-item>
          <el-descriptions-item label="来源">{{ detail.source }}</el-descriptions-item>
          <el-descriptions-item label="领券时间">{{ detail.claimDate }}</el-descriptions-item>
          <el-descriptions-item label="核销时间">{{ detail.useDate || '-' }}</el-descriptions-item>
          <el-descriptions-item label="过期日期">{{ detail.expireDate }}</el-descriptions-item>
          <el-descriptions-item label="兑换机构">{{ detail.agency ? detail.agency.name : '-' }}</el-descriptions-item>
        </el-descriptions>
      </template>
    </el-drawer>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { getOrders, getOrder, verifyOrder, cancelOrder } from '../../api/orders.js'
import { ElMessage, ElMessageBox } from 'element-plus'

const list = ref([])
const total = ref(0)
const loading = ref(false)
const drawerVisible = ref(false)
const detail = ref(null)
const dateRange = ref([])
const query = reactive({ keyword: '', status: '', startDate: '', endDate: '', page: 1, pageSize: 10 })
const statusMap = { unused: '未兑换', used: '已兑换', expired: '已过期', cancelled: '已作废' }
const statusType = { unused: 'warning', used: 'success', expired: 'info', cancelled: 'danger' }

function onDateChange(val) {
  if (val && val.length === 2) { query.startDate = val[0]; query.endDate = val[1] }
  else { query.startDate = ''; query.endDate = '' }
  fetchList()
}

async function fetchList() {
  loading.value = true
  try {
    const res = await getOrders(query)
    list.value = res.data.list
    total.value = res.data.total
  } catch (e) {} finally { loading.value = false }
}

function resetQuery() {
  query.keyword = ''; query.status = ''; query.startDate = ''; query.endDate = ''; query.page = 1
  dateRange.value = []
  fetchList()
}

async function handleVerify(row) {
  await ElMessageBox.confirm('确认核销订单「' + row.orderNo + '」？', '核销确认', { type: 'success' })
  await verifyOrder(row.id)
  ElMessage.success('核销成功')
  fetchList()
}

async function handleCancel(row) {
  await ElMessageBox.confirm('确认作废订单「' + row.orderNo + '」？此操作不可恢复。', '警告', { type: 'warning' })
  await cancelOrder(row.id)
  ElMessage.success('已作废')
  fetchList()
}

async function showDetail(row) {
  try {
    const res = await getOrder(row.id)
    detail.value = res.data
    drawerVisible.value = true
  } catch (e) {}
}

onMounted(fetchList)
</script>
