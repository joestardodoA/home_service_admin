<template>
  <div>
    <el-card>
      <el-row :gutter="16" align="middle">
        <el-col :span="5"><el-input v-model="query.keyword" placeholder="搜索标题" clearable prefix-icon="Search" @clear="fetchList" @keyup.enter="fetchList" /></el-col>
        <el-col :span="4"><el-select v-model="query.category" placeholder="分类" clearable @change="fetchList">
          <el-option v-for="c in categories" :key="c" :label="c" :value="c" /></el-select></el-col>
        <el-col :span="4"><el-select v-model="query.status" placeholder="状态" clearable @change="fetchList">
          <el-option label="草稿" value="draft" /><el-option label="已发布" value="published" /><el-option label="已归档" value="archived" /></el-select></el-col>
        <el-col :span="3"><el-button type="primary" @click="fetchList">查询</el-button></el-col>
        <el-col :span="8" style="text-align:right;"><el-button type="primary" icon="Plus" @click="$router.push('/articles/create')">新建文章</el-button></el-col>
      </el-row>
    </el-card>

    <el-card style="margin-top:16px;">
      <el-table :data="list" v-loading="loading" stripe>
        <el-table-column prop="id" label="ID" width="60" />
        <el-table-column prop="title" label="标题" min-width="220" show-overflow-tooltip />
        <el-table-column prop="category" label="分类" width="80">
          <template #default="{ row }"><el-tag size="small">{{ row.category }}</el-tag></template>
        </el-table-column>
        <el-table-column label="状态" width="90">
          <template #default="{ row }"><el-tag size="small" :type="statusType[row.status]">{{ statusMap[row.status] }}</el-tag></template>
        </el-table-column>
        <el-table-column prop="reads" label="阅读" width="70" />
        <el-table-column prop="publishedAt" label="发布时间" width="170" />
        <el-table-column label="操作" width="260" fixed="right">
          <template #default="{ row }">
            <el-button size="small" @click="$router.push('/articles/edit/' + row.id)">编辑</el-button>
            <el-button v-if="row.status !== 'published'" size="small" type="success" @click="changeStatus(row, 'published')">发布</el-button>
            <el-button v-if="row.status === 'published'" size="small" type="warning" @click="changeStatus(row, 'archived')">归档</el-button>
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
import { getArticles, deleteArticle, updateArticleStatus } from '../../api/articles.js'
import { ElMessage, ElMessageBox } from 'element-plus'

const list = ref([])
const total = ref(0)
const loading = ref(false)
const query = reactive({ keyword: '', category: '', status: '', page: 1, pageSize: 10 })
const categories = ['保洁', '育婴', '月嫂', '养老', '职场']
const statusMap = { draft: '草稿', published: '已发布', archived: '已归档' }
const statusType = { draft: 'info', published: 'success', archived: 'warning' }

async function fetchList() {
  loading.value = true
  try { const res = await getArticles(query); list.value = res.data.list; total.value = res.data.total } catch(e) {} finally { loading.value = false }
}
async function changeStatus(row, status) { await updateArticleStatus(row.id, status); ElMessage.success('操作成功'); fetchList() }
async function handleDelete(row) {
  await ElMessageBox.confirm('删除「' + row.title + '」？', '警告', { type: 'warning' })
  await deleteArticle(row.id); ElMessage.success('已删除'); fetchList()
}
onMounted(fetchList)
</script>
