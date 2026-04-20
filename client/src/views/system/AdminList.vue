<template>
  <div class="admin-list">
    <el-card shadow="never">
      <template #header>
        <div class="card-header">
          <span>管理员账号</span>
          <el-button type="primary" size="small" @click="openDialog()">新建管理员</el-button>
        </div>
      </template>

      <el-table :data="list" stripe v-loading="loading">
        <el-table-column prop="username" label="用户名" min-width="120" />
        <el-table-column prop="realName" label="真实姓名" min-width="100" />
        <el-table-column label="角色" min-width="100">
          <template #default="{ row }">
            <el-tag :type="roleType(row.role)" size="small">{{ roleText(row.role) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="状态" min-width="80" align="center">
          <template #default="{ row }">
            <el-tag :type="row.status === 'active' ? 'success' : 'danger'" size="small">{{ row.status === 'active' ? '正常' : '禁用' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="最后登录" min-width="160">
          <template #default="{ row }">{{ row.lastLoginAt ? formatDate(row.lastLoginAt) : '从未登录' }}</template>
        </el-table-column>
        <el-table-column label="操作" min-width="240" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="openDialog(row)">编辑</el-button>
            <el-button link :type="row.status === 'active' ? 'warning' : 'success'" size="small" @click="handleToggle(row)">{{ row.status === 'active' ? '禁用' : '启用' }}</el-button>
            <el-button link type="info" size="small" @click="handleReset(row)">重置密码</el-button>
            <el-button link type="danger" size="small" @click="handleDelete(row)" :disabled="row.role === 'super'">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
      <div class="pagination-wrap">
        <el-pagination background layout="total, prev, pager, next" :total="total" :page-size="pageSize" v-model:current-page="page" @current-change="fetchList" />
      </div>
    </el-card>

    <!-- 新建/编辑弹窗 -->
    <el-dialog :title="editId ? '编辑管理员' : '新建管理员'" v-model="dialogVisible" width="480px" destroy-on-close>
      <el-form :model="form" label-width="80px">
        <el-form-item label="用户名" required>
          <el-input v-model="form.username" :disabled="!!editId" placeholder="登录用户名" />
        </el-form-item>
        <el-form-item v-if="!editId" label="密码" required>
          <el-input v-model="form.password" type="password" show-password placeholder="初始密码" />
        </el-form-item>
        <el-form-item label="真实姓名">
          <el-input v-model="form.realName" placeholder="姓名" />
        </el-form-item>
        <el-form-item label="角色">
          <el-select v-model="form.role" style="width: 100%;">
            <el-option label="超级管理员" value="super" />
            <el-option label="运营管理员" value="operator" />
            <el-option label="审核员" value="auditor" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSubmit" :loading="submitting">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getAdmins, createAdmin, updateAdmin, toggleAdminStatus, deleteAdmin, resetAdminPassword } from '../../api/system.js'

const list = ref([])
const loading = ref(false)
const page = ref(1)
const pageSize = 10
const total = ref(0)
const dialogVisible = ref(false)
const editId = ref(null)
const submitting = ref(false)
const form = ref({ username: '', password: '', realName: '', role: 'operator' })

function roleType(r) { return { super: 'danger', operator: '', auditor: 'warning' }[r] || 'info' }
function roleText(r) { return { super: '超级管理员', operator: '运营管理员', auditor: '审核员' }[r] || r }
function formatDate(d) {
  if (!d) return ''
  var dt = new Date(d)
  return dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0') + '-' + String(dt.getDate()).padStart(2, '0') + ' ' + String(dt.getHours()).padStart(2, '0') + ':' + String(dt.getMinutes()).padStart(2, '0')
}

async function fetchList() {
  loading.value = true
  try {
    var res = await getAdmins({ page: page.value, pageSize })
    list.value = res.data.list
    total.value = res.data.total
  } catch (e) {}
  loading.value = false
}

function openDialog(row) {
  if (row) {
    editId.value = row.id
    form.value = { username: row.username, password: '', realName: row.realName, role: row.role }
  } else {
    editId.value = null
    form.value = { username: '', password: '', realName: '', role: 'operator' }
  }
  dialogVisible.value = true
}

async function handleSubmit() {
  submitting.value = true
  try {
    if (editId.value) {
      await updateAdmin(editId.value, { realName: form.value.realName, role: form.value.role })
      ElMessage.success('更新成功')
    } else {
      if (!form.value.username || !form.value.password) { ElMessage.warning('请填写用户名和密码'); submitting.value = false; return }
      await createAdmin(form.value)
      ElMessage.success('创建成功')
    }
    dialogVisible.value = false
    fetchList()
  } catch (e) {}
  submitting.value = false
}

async function handleToggle(row) {
  var word = row.status === 'active' ? '禁用' : '启用'
  await ElMessageBox.confirm('确认' + word + '管理员「' + row.username + '」？', '操作确认', { type: 'warning' })
  await toggleAdminStatus(row.id)
  ElMessage.success(word + '成功')
  fetchList()
}

async function handleReset(row) {
  const { value } = await ElMessageBox.prompt('请输入新密码', '重置密码 — ' + row.username, { inputValue: '123456', inputPlaceholder: '默认 123456' })
  await resetAdminPassword(row.id, value || '123456')
  ElMessage.success('密码已重置')
}

async function handleDelete(row) {
  await ElMessageBox.confirm('确认删除管理员「' + row.username + '」？此操作不可恢复。', '删除确认', { type: 'danger' })
  await deleteAdmin(row.id)
  ElMessage.success('删除成功')
  fetchList()
}

onMounted(fetchList)
</script>

<style scoped>
.card-header { display: flex; justify-content: space-between; align-items: center; }
.pagination-wrap { display: flex; justify-content: flex-end; margin-top: 16px; }
</style>
