<template>
  <div>
    <el-card class="filter-card">
      <el-row :gutter="16" align="middle">
        <el-col :span="6">
          <el-input v-model="query.keyword" placeholder="搜索机构名称" clearable prefix-icon="Search" @clear="fetchList" @keyup.enter="fetchList" />
        </el-col>
        <el-col :span="4">
          <el-select v-model="query.status" placeholder="状态" clearable @change="fetchList">
            <el-option label="正常" value="active" />
            <el-option label="已停用" value="inactive" />
          </el-select>
        </el-col>
        <el-col :span="4">
          <el-button type="primary" @click="fetchList">查询</el-button>
          <el-button @click="resetQuery">重置</el-button>
        </el-col>
        <el-col :span="10" style="text-align:right;">
          <el-button type="primary" icon="Plus" @click="$router.push('/agencies/create')">新建机构</el-button>
        </el-col>
      </el-row>
    </el-card>

    <el-card style="margin-top:16px;">
      <!-- 批量操作栏 -->
      <div v-if="selectedRows.length > 0" class="batch-bar">
        <span class="batch-count">已选 {{ selectedRows.length }} 条</span>
        <el-button size="small" type="danger" @click="handleBatchDelete">批量删除</el-button>
      </div>

      <el-table :data="list" v-loading="loading" stripe @selection-change="onSelectionChange">
        <el-table-column type="selection" width="40" />
        <el-table-column prop="id" label="ID" width="60" />
        <el-table-column prop="name" label="机构名称" min-width="200" />
        <el-table-column prop="address" label="地址" min-width="200" show-overflow-tooltip />
        <el-table-column prop="phone" label="电话" width="130" />
        <el-table-column prop="score" label="评分" width="70" />
        <el-table-column label="坐标" width="90">
          <template #default="{ row }">
            <el-tag v-if="row.lat && row.lng" size="small" type="success">已设置</el-tag>
            <el-tag v-else size="small" type="warning">未设置</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="课程数" width="80">
          <template #default="{ row }">{{ row.courses ? row.courses.length : 0 }}</template>
        </el-table-column>
        <el-table-column label="状态" width="80">
          <template #default="{ row }">
            <el-tag size="small" :type="row.status === 'active' ? 'success' : 'info'">{{ row.status === 'active' ? '正常' : '停用' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button size="small" type="primary" @click="$router.push('/agencies/edit/' + row.id)">编辑</el-button>
            <el-button size="small" type="danger" @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
      <div style="margin-top:16px;text-align:right;">
        <el-pagination v-model:current-page="query.page" :page-size="query.pageSize" :total="total" layout="total, prev, pager, next" @current-change="fetchList" />
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { getAgencies, deleteAgency } from '../../api/agencies.js'
import { ElMessage, ElMessageBox } from 'element-plus'

const list = ref([])
const total = ref(0)
const loading = ref(false)
const selectedRows = ref([])
const query = reactive({ keyword: '', status: '', page: 1, pageSize: 10 })

async function fetchList() {
  loading.value = true
  try {
    const res = await getAgencies(query)
    list.value = res.data.list
    total.value = res.data.total
  } catch (e) {} finally { loading.value = false }
}

function resetQuery() { query.keyword = ''; query.status = ''; query.page = 1; fetchList() }

function onSelectionChange(rows) { selectedRows.value = rows }

async function handleDelete(row) {
  await ElMessageBox.confirm('确认删除「' + row.name + '」？删除后相关课程也会被清除。', '警告', { type: 'warning' })
  await deleteAgency(row.id)
  ElMessage.success('已删除')
  fetchList()
}

// 批量删除
async function handleBatchDelete() {
  await ElMessageBox.confirm('确认批量删除 ' + selectedRows.value.length + ' 个机构？相关课程也会被清除。', '批量删除', { type: 'warning' })
  var success_count = 0
  for (var i = 0; i < selectedRows.value.length; i++) {
    try {
      await deleteAgency(selectedRows.value[i].id)
      success_count++
    } catch (e) {}
  }
  ElMessage.success('批量删除完成，成功 ' + success_count + ' 条')
  fetchList()
}

onMounted(fetchList)
</script>

<style scoped>
.filter-card { margin-bottom: 0; }
.batch-bar {
  margin-bottom: 12px; display: flex; align-items: center; gap: 8px;
  padding: 8px 12px; background: #fef0f0; border-radius: 6px;
}
.batch-count { color: #f56c6c; font-size: 13px; font-weight: 500; }
</style>
