<template>
  <div>
    <!-- 搜索栏 -->
    <el-card class="filter-card">
      <el-row :gutter="16" align="middle">
        <el-col :span="6">
          <el-input v-model="query.keyword" placeholder="搜索券名称" clearable prefix-icon="Search" @clear="fetchList" @keyup.enter="fetchList" />
        </el-col>
        <el-col :span="4">
          <el-select v-model="query.status" placeholder="状态筛选" clearable @change="fetchList">
            <el-option label="草稿" value="draft" />
            <el-option label="已上架" value="online" />
            <el-option label="已下架" value="offline" />
          </el-select>
        </el-col>
        <el-col :span="4">
          <el-button type="primary" @click="fetchList">查询</el-button>
          <el-button @click="resetQuery">重置</el-button>
        </el-col>
        <el-col :span="10" style="text-align:right;">
          <el-button type="primary" icon="Plus" @click="$router.push('/coupons/create')">新建优惠券</el-button>
        </el-col>
      </el-row>
    </el-card>

    <!-- 数据表格 -->
    <el-card style="margin-top:16px;">
      <!-- 批量操作栏 -->
      <div v-if="selectedRows.length > 0" class="batch-bar">
        <span class="batch-count">已选 {{ selectedRows.length }} 条</span>
        <el-button size="small" type="success" @click="handleBatchStatus('online')">批量上架</el-button>
        <el-button size="small" type="warning" @click="handleBatchStatus('offline')">批量下架</el-button>
        <el-button size="small" type="danger" @click="handleBatchDelete">批量删除</el-button>
      </div>

      <el-table :data="list" v-loading="loading" stripe @selection-change="onSelectionChange">
        <el-table-column type="selection" width="40" />
        <el-table-column prop="id" label="ID" width="60" />
        <el-table-column prop="title" label="券名称" min-width="180" />
        <el-table-column prop="type" label="类型" width="90">
          <template #default="{ row }">
            <el-tag size="small" :type="row.type === 'free' ? 'success' : 'warning'">{{ typeMap[row.type] }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="valueText" label="面值" width="80" />
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <el-tag size="small" :type="statusType[row.status]">{{ statusMap[row.status] }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="库存" width="120">
          <template #default="{ row }">
            {{ row.remainCount }} / {{ row.totalCount }}
          </template>
        </el-table-column>
        <el-table-column prop="claimedCount" label="已领" width="70" />
        <el-table-column prop="expireDate" label="有效期至" width="120" />
        <el-table-column label="操作" width="260" fixed="right">
          <template #default="{ row }">
            <el-button size="small" type="primary" @click="$router.push('/coupons/edit/' + row.id)">编辑</el-button>
            <el-button v-if="row.status !== 'online'" size="small" type="success" @click="changeStatus(row, 'online')">上架</el-button>
            <el-button v-if="row.status === 'online'" size="small" type="warning" @click="changeStatus(row, 'offline')">下架</el-button>
            <el-button v-if="row.status === 'draft'" size="small" type="danger" @click="handleDelete(row)">删除</el-button>
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
import { getCoupons, deleteCoupon, updateCouponStatus } from '../../api/coupons.js'
import { ElMessage, ElMessageBox } from 'element-plus'

const list = ref([])
const total = ref(0)
const loading = ref(false)
const selectedRows = ref([])
const query = reactive({ keyword: '', status: '', page: 1, pageSize: 10 })
const typeMap = { free: '免费', discount: '折扣', cash: '现金' }
const statusMap = { draft: '草稿', online: '已上架', offline: '已下架' }
const statusType = { draft: 'info', online: 'success', offline: 'warning' }

async function fetchList() {
  loading.value = true
  try {
    const res = await getCoupons(query)
    list.value = res.data.list
    total.value = res.data.total
  } catch (e) {} finally { loading.value = false }
}

function resetQuery() { query.keyword = ''; query.status = ''; query.page = 1; fetchList() }

function onSelectionChange(rows) { selectedRows.value = rows }

async function changeStatus(row, status) {
  await updateCouponStatus(row.id, status)
  ElMessage.success('操作成功')
  fetchList()
}

async function handleDelete(row) {
  await ElMessageBox.confirm('确认删除「' + row.title + '」？', '警告', { type: 'warning' })
  await deleteCoupon(row.id)
  ElMessage.success('已删除')
  fetchList()
}

// 批量操作
async function handleBatchStatus(status) {
  var label = status === 'online' ? '上架' : '下架'
  await ElMessageBox.confirm('确认批量' + label + ' ' + selectedRows.value.length + ' 张优惠券？', '批量' + label, { type: 'warning' })
  var success_count = 0
  for (var i = 0; i < selectedRows.value.length; i++) {
    try {
      await updateCouponStatus(selectedRows.value[i].id, status)
      success_count++
    } catch (e) {}
  }
  ElMessage.success('批量' + label + '完成，成功 ' + success_count + ' 条')
  fetchList()
}

async function handleBatchDelete() {
  var drafts = selectedRows.value.filter(function(r) { return r.status === 'draft' })
  if (drafts.length === 0) { ElMessage.warning('只有草稿状态的优惠券可以删除'); return }
  await ElMessageBox.confirm('确认批量删除 ' + drafts.length + ' 张草稿优惠券？', '批量删除', { type: 'warning' })
  var success_count = 0
  for (var i = 0; i < drafts.length; i++) {
    try {
      await deleteCoupon(drafts[i].id)
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
  padding: 8px 12px; background: #f0f9eb; border-radius: 6px;
}
.batch-count { color: #67c23a; font-size: 13px; font-weight: 500; }
</style>
