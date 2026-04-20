<template>
  <div>
    <el-card>
      <el-row :gutter="16" align="middle">
        <el-col :span="6"><el-input v-model="query.keyword" placeholder="搜索昵称/手机号" clearable prefix-icon="Search" @clear="fetchList" @keyup.enter="fetchList" /></el-col>
        <el-col :span="4"><el-select v-model="query.authStatus" placeholder="认证状态" clearable @change="fetchList">
          <el-option label="未提交" value="none" /><el-option label="待审核" value="pending" />
          <el-option label="已通过" value="approved" /><el-option label="已拒绝" value="rejected" />
        </el-select></el-col>
        <el-col :span="4"><el-button type="primary" @click="fetchList">查询</el-button><el-button @click="resetQuery">重置</el-button></el-col>
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
        <el-table-column prop="createdAt" label="注册时间" width="170" />
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button v-if="row.authStatus === 'pending'" size="small" type="success" @click="handleApprove(row)">通过</el-button>
            <el-button v-if="row.authStatus === 'pending'" size="small" type="danger" @click="handleReject(row)">拒绝</el-button>
            <el-button size="small" @click="showDetail(row)">详情</el-button>
          </template>
        </el-table-column>
      </el-table>
      <div style="margin-top:16px;text-align:right;">
        <el-pagination v-model:current-page="query.page" :page-size="query.pageSize" :total="total" layout="total, prev, pager, next" @current-change="fetchList" />
      </div>
    </el-card>

    <el-drawer v-model="drawerVisible" title="用户详情" size="400px">
      <template v-if="detail">
        <el-descriptions :column="1" border>
          <el-descriptions-item label="昵称">{{ detail.nickname }}</el-descriptions-item>
          <el-descriptions-item label="手机号">{{ detail.phone }}</el-descriptions-item>
          <el-descriptions-item label="性别">{{ genderMap[detail.gender] }}</el-descriptions-item>
          <el-descriptions-item label="城市">{{ detail.city }}</el-descriptions-item>
          <el-descriptions-item label="真实姓名">{{ detail.realName || '-' }}</el-descriptions-item>
          <el-descriptions-item label="身份证号">{{ detail.idCard ? detail.idCard.slice(0,6) + '********' + detail.idCard.slice(-4) : '-' }}</el-descriptions-item>
          <el-descriptions-item label="认证状态"><el-tag :type="authType[detail.authStatus]">{{ authMap[detail.authStatus] }}</el-tag></el-descriptions-item>
          <el-descriptions-item label="拒绝原因" v-if="detail.authRejectReason">{{ detail.authRejectReason }}</el-descriptions-item>
          <el-descriptions-item label="注册时间">{{ detail.createdAt }}</el-descriptions-item>
        </el-descriptions>
      </template>
    </el-drawer>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { getUsers, getUser, approveUser, rejectUser } from '../../api/users.js'
import { ElMessage, ElMessageBox } from 'element-plus'

const list = ref([])
const total = ref(0)
const loading = ref(false)
const drawerVisible = ref(false)
const detail = ref(null)
const query = reactive({ keyword: '', authStatus: '', page: 1, pageSize: 10 })
const genderMap = { 0: '未知', 1: '男', 2: '女' }
const authMap = { none: '未提交', pending: '待审核', approved: '已通过', rejected: '已拒绝' }
const authType = { none: 'info', pending: 'warning', approved: 'success', rejected: 'danger' }

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
  try { const res = await getUser(row.id); detail.value = res.data; drawerVisible.value = true } catch(e) {}
}
onMounted(fetchList)
</script>
