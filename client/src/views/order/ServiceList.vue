<template>
  <div>
    <el-card class="filter-card">
      <el-row :gutter="16" align="middle">
        <el-col :span="5">
          <el-input v-model="query.keyword" placeholder="搜索订单号/联系人/电话" clearable prefix-icon="Search" @clear="fetchList" @keyup.enter="fetchList" />
        </el-col>
        <el-col :span="3">
          <el-select v-model="query.type" placeholder="订单类型" clearable @change="fetchList">
            <el-option label="雇主发单" value="employer" />
            <el-option label="阿姨求职" value="worker" />
          </el-select>
        </el-col>
        <el-col :span="3">
          <el-select v-model="query.status" placeholder="状态" clearable @change="fetchList">
            <el-option label="待审核" value="pending" />
            <el-option label="已通过" value="approved" />
            <el-option label="匹配中" value="matching" />
            <el-option label="已匹配" value="matched" />
            <el-option label="已完成" value="completed" />
            <el-option label="已拒绝" value="rejected" />
          </el-select>
        </el-col>
        <el-col :span="5">
          <el-date-picker v-model="dateRange" type="daterange" range-separator="至" start-placeholder="开始" end-placeholder="结束" value-format="YYYY-MM-DD" @change="onDateChange" style="width:100%;" />
        </el-col>
        <el-col :span="4">
          <el-button type="primary" @click="fetchList">查询</el-button>
          <el-button @click="resetQuery">重置</el-button>
        </el-col>
      </el-row>
    </el-card>

    <el-card style="margin-top:16px;">
      <el-table :data="list" v-loading="loading" stripe>
        <el-table-column prop="orderNo" label="订单号" width="160" />
        <el-table-column label="类型" width="100">
          <template #default="{ row }">
            <el-tag size="small" :type="row.type === 'worker' ? 'success' : 'primary'">{{ row.type === 'worker' ? '阿姨求职' : '雇主发单' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="工种" width="90">
          <template #default="{ row }">{{ row.jobType ? row.jobType.name : '-' }}</template>
        </el-table-column>
        <el-table-column label="发布人" width="100">
          <template #default="{ row }">{{ row.publisher ? row.publisher.nickname : '-' }}</template>
        </el-table-column>
        <el-table-column prop="city" label="城市" width="80" />
        <el-table-column label="薪资" width="140">
          <template #default="{ row }">{{ row.salaryMin }}-{{ row.salaryMax }}元/{{ row.salaryType === 'monthly' ? '月' : '日' }}</template>
        </el-table-column>
        <el-table-column prop="contactPhone" label="联系电话" width="120" />
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <el-tag size="small" :type="statusType[row.status]">{{ statusMap[row.status] }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="申请数" width="70" align="center">
          <template #default="{ row }">
            <el-badge :value="row.applicationCount" :max="99" v-if="row.applicationCount > 0" />
            <span v-else style="color:#ccc;">0</span>
          </template>
        </el-table-column>
        <el-table-column label="创建时间" width="160">
          <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button v-if="row.status === 'pending'" size="small" type="success" @click="handleApprove(row)">通过</el-button>
            <el-button v-if="row.status === 'pending'" size="small" type="danger" @click="handleReject(row)">拒绝</el-button>
            <el-button v-if="row.status === 'matched'" size="small" type="primary" @click="handleComplete(row)">完成</el-button>
            <el-button size="small" @click="showDetail(row)">详情</el-button>
          </template>
        </el-table-column>
      </el-table>
      <div style="margin-top:16px;text-align:right;">
        <el-pagination v-model:current-page="query.page" :page-size="query.pageSize" :total="total" layout="total, prev, pager, next" @current-change="fetchList" />
      </div>
    </el-card>

    <!-- 详情抽屉 -->
    <el-drawer v-model="drawerVisible" title="服务订单详情" size="450px">
      <template v-if="detail">
        <el-descriptions :column="1" border>
          <el-descriptions-item label="订单号">{{ detail.orderNo }}</el-descriptions-item>
          <el-descriptions-item label="类型">
            <el-tag size="small" :type="detail.type === 'worker' ? 'success' : 'primary'">{{ detail.type === 'worker' ? '阿姨求职' : '雇主发单' }}</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="工种">{{ detail.jobType ? detail.jobType.name : '-' }}</el-descriptions-item>
          <el-descriptions-item label="发布人">{{ detail.publisher ? detail.publisher.nickname + (detail.publisher.phone ? ' (' + detail.publisher.phone + ')' : '') : '-' }}</el-descriptions-item>
          <el-descriptions-item label="城市">{{ detail.city }}</el-descriptions-item>
          <el-descriptions-item label="薪资">{{ detail.salaryMin }}-{{ detail.salaryMax }}元/{{ detail.salaryType === 'monthly' ? '月' : '日' }}</el-descriptions-item>
          <el-descriptions-item label="服务日期">{{ detail.serviceDate || '-' }}</el-descriptions-item>
          <el-descriptions-item label="联系人">{{ detail.contactName }}</el-descriptions-item>
          <el-descriptions-item label="联系电话">{{ detail.contactPhone }}</el-descriptions-item>
          <el-descriptions-item label="状态">
            <el-tag :type="statusType[detail.status]">{{ statusMap[detail.status] }}</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="备注">{{ detail.remark || '-' }}</el-descriptions-item>
          <el-descriptions-item label="匹配阿姨" v-if="detail.acceptedUser">
            {{ detail.acceptedUser.nickname }} ({{ detail.acceptedUser.phone }})
          </el-descriptions-item>
          <el-descriptions-item label="申请数">{{ detail.applicationCount }}</el-descriptions-item>
          <el-descriptions-item label="管理员备注">{{ detail.adminNote || '-' }}</el-descriptions-item>
        </el-descriptions>
      </template>
    </el-drawer>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { getServiceOrders, getServiceOrder, approveServiceOrder, rejectServiceOrder, completeServiceOrder } from '../../api/serviceOrders.js'
import { ElMessage, ElMessageBox } from 'element-plus'

const list = ref([])
const total = ref(0)
const loading = ref(false)
const drawerVisible = ref(false)
const detail = ref(null)
const dateRange = ref([])
const query = reactive({ keyword: '', type: '', status: '', startDate: '', endDate: '', page: 1, pageSize: 10 })
const statusMap = { pending: '待审核', approved: '已通过', matching: '匹配中', matched: '已匹配', completed: '已完成', rejected: '已拒绝', cancelled: '已取消' }
const statusType = { pending: 'warning', approved: 'primary', matching: 'primary', matched: 'success', completed: '', rejected: 'danger', cancelled: 'info' }

function formatDate(d) {
  if (!d) return ''
  var dt = new Date(d)
  return dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0') + '-' + String(dt.getDate()).padStart(2, '0') + ' ' + String(dt.getHours()).padStart(2, '0') + ':' + String(dt.getMinutes()).padStart(2, '0')
}

function onDateChange(val) {
  if (val && val.length === 2) { query.startDate = val[0]; query.endDate = val[1] }
  else { query.startDate = ''; query.endDate = '' }
  fetchList()
}

async function fetchList() {
  loading.value = true
  try {
    const res = await getServiceOrders(query)
    list.value = res.data.list
    total.value = res.data.total
  } catch (e) {} finally { loading.value = false }
}

function resetQuery() {
  query.keyword = ''; query.type = ''; query.status = ''; query.startDate = ''; query.endDate = ''; query.page = 1
  dateRange.value = []
  fetchList()
}

async function handleApprove(row) {
  await ElMessageBox.confirm('确认审核通过订单「' + row.orderNo + '」？', '审核确认', { type: 'success' })
  await approveServiceOrder(row.id, {})
  ElMessage.success('审核通过')
  fetchList()
}

async function handleReject(row) {
  const { value } = await ElMessageBox.prompt('请输入拒绝原因', '拒绝订单 — ' + row.orderNo, { inputPlaceholder: '不符合发布要求' })
  await rejectServiceOrder(row.id, { reason: value || '不符合发布要求' })
  ElMessage.success('已拒绝')
  fetchList()
}

async function handleComplete(row) {
  await ElMessageBox.confirm('确认标记订单「' + row.orderNo + '」为已完成？', '操作确认')
  await completeServiceOrder(row.id, {})
  ElMessage.success('已完成')
  fetchList()
}

async function showDetail(row) {
  try {
    const res = await getServiceOrder(row.id)
    detail.value = res.data
    drawerVisible.value = true
  } catch (e) {}
}

onMounted(fetchList)
</script>
