<template>
  <div class="login-log">
    <el-card shadow="never">
      <template #header>
        <div class="card-header">
          <span>登录日志</span>
          <el-button type="danger" size="small" plain @click="handleClear">清空日志</el-button>
        </div>
      </template>
      <!-- 搜索栏 -->
      <el-form :inline="true" :model="query" class="search-form">
        <el-form-item label="用户名"><el-input v-model="query.username" placeholder="搜索用户名" clearable style="width:150px;" /></el-form-item>
        <el-form-item label="状态">
          <el-select v-model="query.status" placeholder="全部" clearable style="width:120px;">
            <el-option label="成功" value="success" /><el-option label="失败" value="fail" />
          </el-select>
        </el-form-item>
        <el-form-item label="IP"><el-input v-model="query.ip" placeholder="搜索IP" clearable style="width:150px;" /></el-form-item>
        <el-form-item>
          <el-button type="primary" @click="fetchList">查询</el-button>
          <el-button @click="resetQuery">重置</el-button>
        </el-form-item>
      </el-form>
      <!-- 表格 -->
      <el-table :data="list" stripe v-loading="loading">
        <el-table-column prop="username" label="用户名" width="120" />
        <el-table-column label="状态" width="80" align="center">
          <template #default="{ row }"><el-tag :type="row.status === 'success' ? 'success' : 'danger'" size="small">{{ row.status === 'success' ? '成功' : '失败' }}</el-tag></template>
        </el-table-column>
        <el-table-column prop="message" label="提示信息" min-width="160" />
        <el-table-column prop="ip" label="登录IP" width="140" />
        <el-table-column label="浏览器/设备" min-width="200" show-overflow-tooltip>
          <template #default="{ row }">{{ parseUA(row.userAgent) }}</template>
        </el-table-column>
        <el-table-column label="登录时间" width="170">
          <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
        </el-table-column>
      </el-table>
      <div style="margin-top:16px;text-align:right;">
        <el-pagination background layout="total, prev, pager, next" :total="total" :page-size="query.pageSize" v-model:current-page="query.page" @current-change="fetchList" />
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getLoginLogs, clearLoginLogs } from '../../api/system.js'

const list = ref([])
const loading = ref(false)
const total = ref(0)
const query = reactive({ username: '', status: '', ip: '', page: 1, pageSize: 20 })

function formatDate(d) {
  if (!d) return ''
  var dt = new Date(d)
  return dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0') + '-' + String(dt.getDate()).padStart(2, '0') + ' ' + String(dt.getHours()).padStart(2, '0') + ':' + String(dt.getMinutes()).padStart(2, '0') + ':' + String(dt.getSeconds()).padStart(2, '0')
}

// 简单解析 UA
function parseUA(ua) {
  if (!ua) return '-'
  if (ua.indexOf('Chrome') > -1) return 'Chrome'
  if (ua.indexOf('Firefox') > -1) return 'Firefox'
  if (ua.indexOf('Safari') > -1) return 'Safari'
  if (ua.indexOf('Edge') > -1) return 'Edge'
  return ua.substring(0, 60)
}

async function fetchList() {
  loading.value = true
  try {
    var res = await getLoginLogs(query)
    list.value = res.data.list
    total.value = res.data.total
  } catch (e) {}
  loading.value = false
}

function resetQuery() {
  query.username = ''; query.status = ''; query.ip = ''; query.page = 1
  fetchList()
}

async function handleClear() {
  await ElMessageBox.confirm('确认清空所有登录日志？此操作不可恢复。', '清空确认', { type: 'warning' })
  await clearLoginLogs()
  ElMessage.success('日志已清空')
  fetchList()
}

onMounted(fetchList)
</script>

<style scoped>
.card-header { display: flex; justify-content: space-between; align-items: center; }
.search-form { margin-bottom: 16px; }
</style>
