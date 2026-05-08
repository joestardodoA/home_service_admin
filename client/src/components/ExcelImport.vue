<template>
  <div>
    <el-dialog v-model="visible" title="Excel 数据导入" width="640px" @close="handleClose">
      <!-- 上传区域 -->
      <div v-if="!previewData.length" class="upload-area">
        <el-upload drag accept=".xlsx,.xls,.csv" :auto-upload="false" :show-file-list="false" :on-change="handleFileChange">
          <el-icon :size="40" style="color:#c0c4cc;"><Upload /></el-icon>
          <div style="margin-top:8px;color:#999;">点击或拖拽 Excel/CSV 文件到此处</div>
          <div style="margin-top:4px;color:#bbb;font-size:12px;">支持 .xlsx / .xls / .csv 格式</div>
        </el-upload>
        <div v-if="templateUrl" style="margin-top:12px;text-align:center;">
          <el-button link type="primary" @click="downloadTemplate">下载导入模板</el-button>
        </div>
      </div>
      <!-- 预览表格 -->
      <div v-else>
        <div style="margin-bottom:12px;display:flex;justify-content:space-between;align-items:center;">
          <span>共解析 <b>{{ previewData.length }}</b> 条数据</span>
          <el-button size="small" @click="resetFile">重新选择</el-button>
        </div>
        <el-table :data="previewData.slice(0, 20)" max-height="320" border size="small">
          <el-table-column v-for="col in previewColumns" :key="col" :prop="col" :label="col" min-width="120" show-overflow-tooltip />
        </el-table>
        <div v-if="previewData.length > 20" style="color:#999;font-size:12px;margin-top:8px;">仅预览前 20 行，实际导入 {{ previewData.length }} 行</div>
      </div>
      <template #footer>
        <el-button @click="visible = false">取消</el-button>
        <el-button type="primary" :disabled="!previewData.length" :loading="importing" @click="handleImport">确认导入</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { Upload } from '@element-plus/icons-vue'
import * as XLSX from 'xlsx'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  // 上传处理函数，接收数据数组，返回 Promise
  onImport: { type: Function, required: true },
  // 模板下载 URL（可选）
  templateUrl: { type: String, default: '' }
})
const emit = defineEmits(['update:modelValue', 'success'])

const visible = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v)
})

const previewData = ref([])
const previewColumns = ref([])
const importing = ref(false)

function handleFileChange(file) {
  var reader = new FileReader()
  reader.onload = function(e) {
    try {
      var workbook = XLSX.read(e.target.result, { type: 'binary' })
      var sheetName = workbook.SheetNames[0]
      var sheet = workbook.Sheets[sheetName]
      var data = XLSX.utils.sheet_to_json(sheet)
      if (!data.length) { ElMessage.warning('文件中没有数据'); return }
      previewData.value = data
      previewColumns.value = Object.keys(data[0])
    } catch (err) { ElMessage.error('文件解析失败: ' + err.message) }
  }
  reader.readAsBinaryString(file.raw)
}

function resetFile() { previewData.value = []; previewColumns.value = [] }
function handleClose() { resetFile() }

async function handleImport() {
  importing.value = true
  try {
    await props.onImport(previewData.value)
    ElMessage.success('导入成功')
    visible.value = false
    emit('success')
  } catch (err) {
    ElMessage.error('导入失败: ' + (err.message || ''))
  }
  importing.value = false
}

function downloadTemplate() {
  if (props.templateUrl) window.open(props.templateUrl)
}
</script>

<style scoped>
.upload-area { padding: 20px 0; text-align: center; }
</style>
