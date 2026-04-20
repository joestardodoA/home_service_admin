<template>
  <el-card>
    <template #header>
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <span>工种管理</span>
        <el-button type="primary" icon="Plus" @click="showDialog()">新增工种</el-button>
      </div>
    </template>

    <el-table :data="list" v-loading="loading" stripe>
      <el-table-column prop="id" label="ID" width="60" />
      <el-table-column label="图标" width="80">
        <template #default="{ row }">
          <el-image v-if="row.icon" :src="row.icon" style="width:36px;height:36px;border-radius:6px;" fit="cover" />
          <span v-else style="font-size:24px;">{{ emojiMap[row.code] || '📋' }}</span>
        </template>
      </el-table-column>
      <el-table-column prop="name" label="名称" width="120" />
      <el-table-column prop="code" label="编码" width="120" />
      <el-table-column prop="description" label="描述" min-width="200" show-overflow-tooltip />
      <el-table-column label="状态" width="80">
        <template #default="{ row }">
          <el-switch :model-value="row.status === 'active'" @change="toggleStatus(row)" />
        </template>
      </el-table-column>
      <el-table-column prop="sortOrder" label="排序" width="70" />
      <el-table-column label="操作" width="150" fixed="right">
        <template #default="{ row }">
          <el-button size="small" @click="showDialog(row)">编辑</el-button>
          <el-button size="small" type="danger" @click="handleDelete(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>
  </el-card>

  <!-- 编辑弹窗 -->
  <el-dialog v-model="dialogVisible" :title="editId ? '编辑工种' : '新增工种'" width="500px">
    <el-form :model="form" label-width="90px">
      <el-form-item label="名称">
        <el-input v-model="form.name" placeholder="如：月嫂" />
      </el-form-item>
      <el-form-item label="编码">
        <el-input v-model="form.code" placeholder="如：yuesao（英文标识）" :disabled="!!editId" />
      </el-form-item>
      <el-form-item label="图标">
        <ImageUpload v-model="form.icon" placeholder="上传图标" />
        <div style="font-size:12px;color:#999;margin-top:4px;">📐 推荐 144 × 144 px 正方形 PNG 透明底。上传后将替代 emoji 显示。</div>
      </el-form-item>
      <el-form-item label="描述">
        <el-input v-model="form.description" type="textarea" :rows="2" placeholder="工种简要描述" />
      </el-form-item>
      <el-form-item label="排序">
        <el-input-number v-model="form.sortOrder" :min="0" />
        <span style="margin-left:8px;font-size:12px;color:#999;">数字越大越靠前</span>
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="dialogVisible = false">取消</el-button>
      <el-button type="primary" :loading="saving" @click="handleSave">保存</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import request from '../../api/request.js'
import ImageUpload from '../../components/ImageUpload.vue'

// emoji 降级映射（当未上传图标时显示）
const emojiMap = { yuesao: '🤱', yuer: '👶', baojie: '🧹', yanglao: '👴', chankang: '💆', jiawu: '🏠', zhonggong: '⏰', other: '📋' }

const list = ref([])
const loading = ref(false)
const dialogVisible = ref(false)
const saving = ref(false)
const editId = ref(null)
const form = reactive({ name: '', code: '', icon: '', description: '', sortOrder: 0 })

async function fetchList() {
  loading.value = true
  try {
    const res = await request.get('/system/job-types')
    list.value = res.data
  } catch (e) {} finally { loading.value = false }
}

function showDialog(row) {
  if (row) {
    editId.value = row.id
    Object.assign(form, { name: row.name, code: row.code, icon: row.icon || '', description: row.description || '', sortOrder: row.sortOrder || 0 })
  } else {
    editId.value = null
    form.name = ''; form.code = ''; form.icon = ''; form.description = ''; form.sortOrder = 0
  }
  dialogVisible.value = true
}

async function handleSave() {
  if (!form.name) { ElMessage.warning('请输入工种名称'); return }
  saving.value = true
  try {
    if (editId.value) {
      await request.put('/system/job-types/' + editId.value, form)
    } else {
      await request.post('/system/job-types', form)
    }
    ElMessage.success('保存成功')
    dialogVisible.value = false
    fetchList()
  } catch (e) {} finally { saving.value = false }
}

async function toggleStatus(row) {
  var newStatus = row.status === 'active' ? 'disabled' : 'active'
  await request.put('/system/job-types/' + row.id, { status: newStatus })
  fetchList()
}

async function handleDelete(row) {
  await ElMessageBox.confirm('删除工种「' + row.name + '」？', '警告', { type: 'warning' })
  try {
    await request.delete('/system/job-types/' + row.id)
    ElMessage.success('已删除')
    fetchList()
  } catch (e) {}
}

onMounted(fetchList)
</script>
