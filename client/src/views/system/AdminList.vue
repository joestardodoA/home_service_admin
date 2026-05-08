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
            <el-tag :type="row.role === 'super' ? 'danger' : ''" size="small">{{ row.role }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="权限数" min-width="80" align="center">
          <template #default="{ row }">
            <span v-if="row.role === 'super'" style="color: var(--apple-blue); font-weight: 600;">全部</span>
            <span v-else>{{ (row.permissions || []).length }}</span>
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
    <el-dialog :title="editId ? '编辑管理员' : '新建管理员'" v-model="dialogVisible" width="640px" destroy-on-close>
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
        <el-form-item label="角色名称">
          <el-input v-model="form.role" placeholder="如：销售总监、销售、审核员、运营..." :disabled="editId && editRow && editRow.role === 'super'" />
          <div class="form-tip">自定义角色名，超级管理员角色不可修改</div>
        </el-form-item>
        <el-form-item label="权限分配" v-if="form.role !== 'super'">
          <div class="perm-panel">
            <div class="perm-actions">
              <el-button link type="primary" size="small" @click="selectAll">全选</el-button>
              <el-button link type="info" size="small" @click="clearAll">清空</el-button>
            </div>
            <div v-for="(perms, group) in groupedPerms" :key="group" class="perm-group">
              <div class="pg-header">
                <el-checkbox :model-value="isGroupChecked(group)" :indeterminate="isGroupIndeterminate(group)" @change="toggleGroup(group, $event)">
                  {{ group }}
                </el-checkbox>
              </div>
              <div class="pg-items">
                <el-checkbox v-for="p in perms" :key="p.code" :model-value="form.permissions.indexOf(p.code) !== -1" @change="togglePerm(p.code, $event)">
                  {{ p.name }}
                </el-checkbox>
              </div>
            </div>
          </div>
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
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getAdmins, createAdmin, updateAdmin, toggleAdminStatus, deleteAdmin, resetAdminPassword, getPermissions } from '../../api/system.js'

const list = ref([])
const loading = ref(false)
const page = ref(1)
const pageSize = 10
const total = ref(0)
const dialogVisible = ref(false)
const editId = ref(null)
const editRow = ref(null)
const submitting = ref(false)
const form = ref({ username: '', password: '', realName: '', role: '运营', permissions: [] })
const groupedPerms = ref({})

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

async function fetchPermissions() {
  try {
    var res = await getPermissions()
    groupedPerms.value = res.data.grouped || {}
  } catch (e) {}
}

function openDialog(row) {
  if (row) {
    editId.value = row.id
    editRow.value = row
    form.value = {
      username: row.username,
      password: '',
      realName: row.realName,
      role: row.role,
      permissions: Array.isArray(row.permissions) ? [...row.permissions] : []
    }
  } else {
    editId.value = null
    editRow.value = null
    form.value = { username: '', password: '', realName: '', role: '运营', permissions: [] }
  }
  dialogVisible.value = true
}

// 权限勾选操作
function togglePerm(code, checked) {
  var idx = form.value.permissions.indexOf(code)
  if (checked && idx === -1) form.value.permissions.push(code)
  if (!checked && idx !== -1) form.value.permissions.splice(idx, 1)
}

function isGroupChecked(group) {
  var perms = groupedPerms.value[group] || []
  return perms.every(function(p) { return form.value.permissions.indexOf(p.code) !== -1 })
}

function isGroupIndeterminate(group) {
  var perms = groupedPerms.value[group] || []
  var count = perms.filter(function(p) { return form.value.permissions.indexOf(p.code) !== -1 }).length
  return count > 0 && count < perms.length
}

function toggleGroup(group, checked) {
  var perms = groupedPerms.value[group] || []
  perms.forEach(function(p) {
    var idx = form.value.permissions.indexOf(p.code)
    if (checked && idx === -1) form.value.permissions.push(p.code)
    if (!checked && idx !== -1) form.value.permissions.splice(idx, 1)
  })
}

function selectAll() {
  var all = []
  Object.values(groupedPerms.value).forEach(function(perms) { perms.forEach(function(p) { all.push(p.code) }) })
  form.value.permissions = all
}

function clearAll() { form.value.permissions = [] }

async function handleSubmit() {
  submitting.value = true
  try {
    if (editId.value) {
      await updateAdmin(editId.value, {
        realName: form.value.realName,
        role: form.value.role,
        permissions: form.value.permissions
      })
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

onMounted(() => {
  fetchList()
  fetchPermissions()
})
</script>

<style scoped>
.card-header { display: flex; justify-content: space-between; align-items: center; }
.pagination-wrap { display: flex; justify-content: flex-end; margin-top: 16px; }
.form-tip { font-size: 12px; color: var(--gray-400); margin-top: 4px; }

/* 权限面板 */
.perm-panel {
  border: 1px solid var(--gray-200);
  border-radius: var(--radius-sm);
  padding: 16px;
  max-height: 400px;
  overflow-y: auto;
}
.perm-actions { display: flex; gap: 12px; margin-bottom: 12px; padding-bottom: 12px; border-bottom: 1px solid var(--gray-100); }
.perm-group { margin-bottom: 16px; }
.perm-group:last-child { margin-bottom: 0; }
.pg-header {
  background: var(--gray-50);
  padding: 8px 12px;
  border-radius: 6px;
  margin-bottom: 8px;
  font-weight: 600;
}
.pg-items {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 16px;
  padding-left: 24px;
}
</style>
