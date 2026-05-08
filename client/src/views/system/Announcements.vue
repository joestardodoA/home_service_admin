<template>
  <div class="announcements">
    <el-card shadow="never">
      <template #header>
        <div class="card-header">
          <span>内部公告</span>
          <el-button type="primary" size="small" @click="handleCreate"><el-icon><Plus /></el-icon> 发布公告</el-button>
        </div>
      </template>
      <!-- 搜索栏 -->
      <el-form :inline="true" :model="query" class="search-form">
        <el-form-item label="类型">
          <el-select v-model="query.type" placeholder="全部" clearable style="width:120px;">
            <el-option label="通知" value="notice" /><el-option label="公告" value="announcement" /><el-option label="紧急" value="urgent" />
          </el-select>
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="query.status" placeholder="全部" clearable style="width:120px;">
            <el-option label="草稿" value="draft" /><el-option label="已发布" value="published" />
          </el-select>
        </el-form-item>
        <el-form-item><el-button type="primary" @click="fetchList">查询</el-button></el-form-item>
      </el-form>
      <!-- 列表 -->
      <el-table :data="list" stripe v-loading="loading">
        <el-table-column label="类型" width="80" align="center">
          <template #default="{ row }">
            <el-tag :type="row.type === 'urgent' ? 'danger' : row.type === 'announcement' ? 'warning' : 'info'" size="small">{{ typeMap[row.type] || row.type }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="title" label="标题" min-width="200" show-overflow-tooltip />
        <el-table-column label="状态" width="80" align="center">
          <template #default="{ row }"><el-tag :type="row.status === 'published' ? 'success' : ''" size="small">{{ row.status === 'published' ? '已发布' : '草稿' }}</el-tag></template>
        </el-table-column>
        <el-table-column label="置顶" width="70" align="center">
          <template #default="{ row }"><span v-if="row.topFlag" style="color:#f56c6c;">📌</span><span v-else>-</span></template>
        </el-table-column>
        <el-table-column label="发布者" width="100">
          <template #default="{ row }">{{ row.publisher ? row.publisher.realName : '-' }}</template>
        </el-table-column>
        <el-table-column label="发布时间" width="170">
          <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="150" align="center">
          <template #default="{ row }">
            <el-button size="small" link type="primary" @click="handleEdit(row)">编辑</el-button>
            <el-popconfirm title="确认删除此公告？" @confirm="handleDelete(row.id)">
              <template #reference><el-button size="small" link type="danger">删除</el-button></template>
            </el-popconfirm>
          </template>
        </el-table-column>
      </el-table>
      <div style="margin-top:16px;text-align:right;">
        <el-pagination background layout="total, prev, pager, next" :total="total" :page-size="query.pageSize" v-model:current-page="query.page" @current-change="fetchList" />
      </div>
    </el-card>

    <!-- 编辑/创建弹窗 -->
    <el-dialog v-model="dialogVisible" :title="isEdit ? '编辑公告' : '发布公告'" width="600px">
      <el-form :model="form" label-width="80px">
        <el-form-item label="标题" required><el-input v-model="form.title" placeholder="请输入标题" /></el-form-item>
        <el-form-item label="类型">
          <el-radio-group v-model="form.type">
            <el-radio value="notice">通知</el-radio><el-radio value="announcement">公告</el-radio><el-radio value="urgent">紧急</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="内容" required><el-input v-model="form.content" type="textarea" :rows="6" placeholder="请输入内容" /></el-form-item>
        <el-form-item label="置顶"><el-switch v-model="form.topFlag" /></el-form-item>
        <el-form-item label="状态">
          <el-radio-group v-model="form.status">
            <el-radio value="draft">保存草稿</el-radio><el-radio value="published">立即发布</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSubmit" :loading="submitting">{{ isEdit ? '更新' : '发布' }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import { getAnnouncements, createAnnouncement, updateAnnouncement, deleteAnnouncement } from '../../api/system.js'

const typeMap = { notice: '通知', announcement: '公告', urgent: '紧急' }
const list = ref([])
const loading = ref(false)
const total = ref(0)
const query = reactive({ type: '', status: '', page: 1, pageSize: 10 })
const dialogVisible = ref(false)
const isEdit = ref(false)
const submitting = ref(false)
const editId = ref(null)
const form = reactive({ title: '', content: '', type: 'notice', status: 'draft', topFlag: false })

function formatDate(d) {
  if (!d) return ''
  var dt = new Date(d)
  return dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0') + '-' + String(dt.getDate()).padStart(2, '0') + ' ' + String(dt.getHours()).padStart(2, '0') + ':' + String(dt.getMinutes()).padStart(2, '0')
}

async function fetchList() {
  loading.value = true
  try {
    var res = await getAnnouncements(query)
    list.value = res.data.list
    total.value = res.data.total
  } catch (e) {}
  loading.value = false
}

function handleCreate() {
  isEdit.value = false; editId.value = null
  form.title = ''; form.content = ''; form.type = 'notice'; form.status = 'draft'; form.topFlag = false
  dialogVisible.value = true
}

function handleEdit(row) {
  isEdit.value = true; editId.value = row.id
  form.title = row.title; form.content = row.content; form.type = row.type; form.status = row.status; form.topFlag = row.topFlag
  dialogVisible.value = true
}

async function handleSubmit() {
  if (!form.title || !form.content) return ElMessage.warning('标题和内容不能为空')
  submitting.value = true
  try {
    if (isEdit.value) { await updateAnnouncement(editId.value, form) }
    else { await createAnnouncement(form) }
    ElMessage.success(isEdit.value ? '更新成功' : '发布成功')
    dialogVisible.value = false
    fetchList()
  } catch (e) {}
  submitting.value = false
}

async function handleDelete(id) {
  await deleteAnnouncement(id)
  ElMessage.success('删除成功')
  fetchList()
}

onMounted(fetchList)
</script>

<style scoped>
.card-header { display: flex; justify-content: space-between; align-items: center; }
.search-form { margin-bottom: 16px; }
</style>
