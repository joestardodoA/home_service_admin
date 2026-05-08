<template>
  <div class="online-users">
    <el-card shadow="never">
      <template #header>
        <div class="card-header">
          <span>在线用户（{{ total }}）</span>
          <el-button type="primary" size="small" plain @click="fetchList"><el-icon><Refresh /></el-icon> 刷新</el-button>
        </div>
      </template>
      <el-table :data="list" stripe v-loading="loading">
        <el-table-column prop="username" label="用户名" width="120" />
        <el-table-column prop="realName" label="真实姓名" width="120" />
        <el-table-column prop="role" label="角色" width="100">
          <template #default="{ row }"><el-tag size="small">{{ row.role }}</el-tag></template>
        </el-table-column>
        <el-table-column prop="ip" label="登录IP" width="140" />
        <el-table-column label="登录时间" min-width="170">
          <template #default="{ row }">{{ formatDate(row.loginAt) }}</template>
        </el-table-column>
        <el-table-column prop="tokenKey" label="Token" width="100" />
        <el-table-column label="操作" width="100" align="center">
          <template #default="{ row }">
            <el-popconfirm title="确认强制下线此用户？" @confirm="handleKick(row)">
              <template #reference><el-button type="danger" size="small" link>强制下线</el-button></template>
            </el-popconfirm>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Refresh } from '@element-plus/icons-vue'
import { getOnlineUsers, kickoutUser } from '../../api/system.js'

const list = ref([])
const loading = ref(false)
const total = ref(0)

function formatDate(d) {
  if (!d) return ''
  var dt = new Date(d)
  return dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0') + '-' + String(dt.getDate()).padStart(2, '0') + ' ' + String(dt.getHours()).padStart(2, '0') + ':' + String(dt.getMinutes()).padStart(2, '0')
}

async function fetchList() {
  loading.value = true
  try {
    var res = await getOnlineUsers()
    list.value = res.data.list
    total.value = res.data.total
  } catch (e) {}
  loading.value = false
}

async function handleKick(row) {
  try {
    var key = row.tokenKey.replace('...', '')
    await kickoutUser(key)
    ElMessage.success('已强制下线: ' + row.username)
    fetchList()
  } catch (e) {}
}

onMounted(fetchList)
</script>

<style scoped>
.card-header { display: flex; justify-content: space-between; align-items: center; }
</style>
