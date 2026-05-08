<template>
  <div class="report-page">
    <!-- 顶部筛选栏 -->
    <el-card shadow="never" class="filter-card">
      <div class="filter-bar">
        <div class="filter-left">
          <el-select v-model="filters.type" placeholder="报告类型" clearable size="default" style="width:120px">
            <el-option label="周报" value="weekly" />
            <el-option label="月报" value="monthly" />
          </el-select>
          <el-select v-model="filters.scope" placeholder="报告范围" clearable size="default" style="width:120px">
            <el-option label="全平台" value="all" />
            <el-option label="个人" value="personal" />
          </el-select>
          <el-button type="primary" @click="fetchList" :icon="Search">查询</el-button>
        </div>
        <el-button @click="router.push('/dashboard')">← 返回看板</el-button>
      </div>
    </el-card>

    <!-- 报告列表 -->
    <el-card shadow="never" style="margin-top:16px">
      <el-table :data="list" v-loading="loading" stripe>
        <el-table-column label="生成时间" prop="createdAt" width="180">
          <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="类型" width="90" align="center">
          <template #default="{ row }">
            <el-tag :type="row.type === 'weekly' ? '' : 'warning'" size="small">
              {{ row.type === 'weekly' ? '周报' : '月报' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="范围" width="90" align="center">
          <template #default="{ row }">
            <el-tag :type="row.scope === 'all' ? 'success' : 'info'" size="small">
              {{ row.scope === 'all' ? '全平台' : '个人' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="周期" prop="periodLabel" width="200" />
        <el-table-column label="生成者" width="120">
          <template #default="{ row }">{{ row.admin ? (row.admin.realName || row.admin.username) : '-' }}</template>
        </el-table-column>
        <el-table-column label="操作" width="200" align="center">
          <template #default="{ row }">
            <el-button type="primary" link size="small" @click="viewReport(row.id)">查看</el-button>
            <el-button type="primary" link size="small" @click="exportWord(row.id)">导出 Word</el-button>
            <el-popconfirm title="确认删除此报告？" @confirm="handleDelete(row.id)">
              <template #reference>
                <el-button type="danger" link size="small">删除</el-button>
              </template>
            </el-popconfirm>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination-wrap">
        <el-pagination
          v-model:current-page="page"
          :page-size="pageSize"
          :total="total"
          layout="total, prev, pager, next"
          @current-change="fetchList"
        />
      </div>
    </el-card>

    <!-- 报告详情弹窗 -->
    <el-dialog v-model="detailVisible" :title="detailTitle" width="750px" top="3vh">
      <div v-if="detailLoading" style="text-align:center;padding:40px;color:#999">加载中...</div>
      <div v-else-if="detailContent" class="report-content" v-html="renderMd(detailContent)"></div>
      <template #footer>
        <el-button @click="copyContent">📋 复制</el-button>
        <el-button type="primary" @click="exportCurrentWord">📄 导出 Word</el-button>
        <el-button @click="detailVisible = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { Search } from '@element-plus/icons-vue'
import { getReportList, getReportDetail, deleteReport } from '../../api/ai.js'
import { Marked } from 'marked'
import { ElMessage } from 'element-plus'

const marked = new Marked({ breaks: true, gfm: true })
const router = useRouter()

// 列表状态
const list = ref([])
const loading = ref(false)
const page = ref(1)
const pageSize = ref(10)
const total = ref(0)
const filters = ref({ type: '', scope: '' })

// 详情弹窗状态
const detailVisible = ref(false)
const detailContent = ref('')
const detailTitle = ref('')
const detailLoading = ref(false)
const currentDetailId = ref(null)

function formatDate(str) {
  if (!str) return '-'
  var d = new Date(str)
  return d.getFullYear() + '-'
    + String(d.getMonth() + 1).padStart(2, '0') + '-'
    + String(d.getDate()).padStart(2, '0') + ' '
    + String(d.getHours()).padStart(2, '0') + ':'
    + String(d.getMinutes()).padStart(2, '0')
}

async function fetchList() {
  loading.value = true
  try {
    var result = await getReportList({
      page: page.value,
      pageSize: pageSize.value,
      type: filters.value.type || undefined,
      scope: filters.value.scope || undefined
    })
    list.value = result.list
    total.value = result.total
  } catch (e) {
    ElMessage.error(e.message)
  } finally {
    loading.value = false
  }
}

async function viewReport(id) {
  detailVisible.value = true
  detailLoading.value = true
  detailContent.value = ''
  currentDetailId.value = id
  try {
    var report = await getReportDetail(id)
    detailContent.value = report.content || '（报告内容为空）'
    var typeLabel = report.type === 'weekly' ? '周报' : '月报'
    var scopeLabel = report.scope === 'all' ? '全平台' : '个人'
    detailTitle.value = '📊 ' + scopeLabel + '运营' + typeLabel + ' — ' + report.periodLabel
  } catch (e) {
    detailContent.value = '⚠️ 加载失败: ' + e.message
  } finally {
    detailLoading.value = false
  }
}

async function handleDelete(id) {
  try {
    await deleteReport(id)
    ElMessage.success('已删除')
    fetchList()
  } catch (e) {
    ElMessage.error(e.message)
  }
}

function renderMd(text) {
  try { return marked.parse(text) } catch(e) { return text }
}

function copyContent() {
  if (!detailContent.value) return
  navigator.clipboard.writeText(detailContent.value)
    .then(function() { ElMessage.success('已复制到剪贴板') })
    .catch(function() { ElMessage.error('复制失败') })
}

/**
 * 将 Markdown 内容转为 Word (.docx) 下载
 * 方案：Markdown → HTML → Blob（Word 可识别的 HTML 格式）
 * 无需额外依赖，Word 原生支持打开 HTML 文件并渲染为文档
 */
function downloadAsWord(mdContent, filename) {
  var html = marked.parse(mdContent)

  // 构造 Word 可识别的 HTML 文档
  var wordHtml = [
    '<html xmlns:o="urn:schemas-microsoft-com:office:office" ',
    'xmlns:w="urn:schemas-microsoft-com:office:word" ',
    'xmlns="http://www.w3.org/TR/REC-html40">',
    '<head><meta charset="utf-8">',
    '<style>',
    'body { font-family: "微软雅黑", "Microsoft YaHei", sans-serif; font-size: 14px; line-height: 1.8; color: #333; padding: 20px; }',
    'h1 { font-size: 22px; color: #1d1d1f; border-bottom: 2px solid #409eff; padding-bottom: 8px; margin-top: 24px; }',
    'h2 { font-size: 18px; color: #1d1d1f; margin-top: 20px; }',
    'h3 { font-size: 15px; color: #333; margin-top: 16px; }',
    'table { width: 100%; border-collapse: collapse; margin: 12px 0; }',
    'th, td { border: 1px solid #d0d0d0; padding: 8px 12px; text-align: left; font-size: 13px; }',
    'th { background: #f0f2f5; font-weight: bold; }',
    'ul, ol { padding-left: 24px; }',
    'strong { color: #409eff; }',
    'code { background: #f5f5f7; padding: 2px 6px; border-radius: 3px; font-size: 13px; }',
    '</style></head><body>',
    html,
    '</body></html>'
  ].join('')

  var blob = new Blob([wordHtml], { type: 'application/msword' })
  var url = URL.createObjectURL(blob)
  var a = document.createElement('a')
  a.href = url
  a.download = filename + '.doc'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
  ElMessage.success('Word 文件已下载')
}

async function exportWord(id) {
  try {
    var report = await getReportDetail(id)
    var typeLabel = report.type === 'weekly' ? '周报' : '月报'
    var scopeLabel = report.scope === 'all' ? '全平台' : '个人'
    var filename = scopeLabel + '运营' + typeLabel + '_' + report.periodLabel.replace(/[\/\s]/g, '-')
    downloadAsWord(report.content, filename)
  } catch (e) {
    ElMessage.error('导出失败: ' + e.message)
  }
}

function exportCurrentWord() {
  if (!detailContent.value) return
  downloadAsWord(detailContent.value, '运营报告_' + new Date().toLocaleDateString().replace(/\//g, '-'))
}

onMounted(fetchList)
</script>

<style scoped>
.report-page { padding: 0; }
.filter-card { margin-bottom: 0; }
.filter-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
}
.filter-left {
  display: flex;
  gap: 10px;
  align-items: center;
  flex-wrap: wrap;
}
.pagination-wrap {
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;
}

/* 报告内容渲染 */
.report-content {
  max-height: 65vh;
  overflow-y: auto;
  padding: 20px;
  background: #fafbfc;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
  font-size: 14px;
  line-height: 1.8;
  color: #333;
}
.report-content :deep(h1) { font-size: 20px; color: #1d1d1f; border-bottom: 2px solid #409eff; padding-bottom: 6px; margin-top: 16px; }
.report-content :deep(h2) { font-size: 17px; color: #1d1d1f; margin-top: 14px; }
.report-content :deep(h3) { font-size: 15px; margin-top: 12px; }
.report-content :deep(table) { width: 100%; border-collapse: collapse; margin: 12px 0; }
.report-content :deep(th), .report-content :deep(td) { border: 1px solid #e5e7eb; padding: 8px 12px; text-align: left; font-size: 13px; }
.report-content :deep(th) { background: #f0f2f5; font-weight: 600; }
.report-content :deep(strong) { color: #409eff; }
.report-content :deep(ul), .report-content :deep(ol) { padding-left: 20px; margin: 8px 0; }
</style>
