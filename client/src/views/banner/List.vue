<template>
  <el-card>
    <template #header>
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <span>Banner 管理</span>
        <el-button type="primary" icon="Plus" @click="showDialog()">新建 Banner</el-button>
      </div>
    </template>

    <el-alert type="info" :closable="false" style="margin-bottom: 16px;">
      <template #title>
        <span style="font-weight:600;">📐 图片资源尺寸规范</span>
      </template>
      <div style="line-height:1.8;font-size:13px;color:#666;">
        Banner 封面图推荐尺寸：<strong>1064 × 300 px</strong>（宽高比 3.55:1），支持 JPG / PNG 格式。<br/>
        工种图标推荐尺寸：<strong>144 × 144 px</strong>（正方形，PNG 透明底）。
      </div>
    </el-alert>

    <el-table :data="list" v-loading="loading" stripe>
      <el-table-column prop="id" label="ID" width="60" />
      <el-table-column label="封面图" width="100">
        <template #default="{ row }">
          <el-image v-if="row.imageUrl" :src="row.imageUrl" style="width:60px;height:36px;border-radius:4px;" fit="cover" />
          <span v-else style="color:#ccc;font-size:12px;">无图</span>
        </template>
      </el-table-column>
      <el-table-column prop="title" label="标题" min-width="140" />
      <el-table-column prop="subtitle" label="副标题" min-width="160" show-overflow-tooltip />
      <el-table-column label="跳转类型" width="100">
        <template #default="{ row }"><el-tag size="small">{{ linkTypeMap[row.linkType] }}</el-tag></template>
      </el-table-column>
      <el-table-column prop="linkValue" label="跳转目标" width="120" />
      <el-table-column label="展示位置" width="110">
        <template #default="{ row }">
          <el-tag size="small" :type="positionTagType(row.position)">{{ positionMap[row.position] || '所有页面' }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="状态" width="80">
        <template #default="{ row }">
          <el-switch :model-value="row.status === 'active'" @change="toggleStatus(row)" />
        </template>
      </el-table-column>
      <el-table-column prop="sortOrder" label="排序" width="70" />
      <el-table-column label="操作" width="150" fixed="right">
        <template #default="{ row }">
          <el-button size="small" type="primary" @click="showDialog(row)">编辑</el-button>
          <el-button size="small" type="danger" @click="handleDelete(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>
  </el-card>

  <!-- 编辑弹窗 -->
  <el-dialog v-model="dialogVisible" :title="editId ? '编辑 Banner' : '新建 Banner'" width="500px">
    <el-form :model="form" label-width="90px">
      <el-form-item label="标题"><el-input v-model="form.title" /></el-form-item>
      <el-form-item label="副标题"><el-input v-model="form.subtitle" /></el-form-item>
      <el-form-item label="跳转类型">
        <el-select v-model="form.linkType">
          <el-option label="无" value="none" /><el-option label="优惠券" value="coupon" />
          <el-option label="机构" value="agency" /><el-option label="文章" value="article" />
          <el-option label="链接" value="url" />
        </el-select>
      </el-form-item>
      <el-form-item label="目标值" v-if="form.linkType !== 'none'"><el-input v-model="form.linkValue" placeholder="ID 或 URL" /></el-form-item>
      <el-form-item label="封面图">
        <ImageUpload v-model="form.imageUrl" placeholder="上传封面图" />
        <div style="font-size:12px;color:#999;margin-top:4px;">📐 推荐尺寸：<strong>1064 × 300 px</strong>（宽高比 3.55:1），JPG / PNG</div>
      </el-form-item>
      <el-form-item label="展示位置">
        <el-select v-model="form.position" style="width:100%;">
          <el-option label="所有页面（首页+订单页）" value="all" />
          <el-option label="仅首页" value="home" />
          <el-option label="仅订单页" value="orders" />
        </el-select>
      </el-form-item>
      <el-form-item label="排序"><el-input-number v-model="form.sortOrder" :min="0" /></el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="dialogVisible = false">取消</el-button>
      <el-button type="primary" :loading="saving" @click="handleSave">保存</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { getBanners, createBanner, updateBanner, deleteBanner } from '../../api/banners.js'
import { ElMessage, ElMessageBox } from 'element-plus'
import ImageUpload from '../../components/ImageUpload.vue'

const list = ref([])
const loading = ref(false)
const dialogVisible = ref(false)
const saving = ref(false)
const editId = ref(null)
const linkTypeMap = { none: '无', coupon: '优惠券', agency: '机构', article: '文章', url: '链接' }
const positionMap = { all: '所有页面', home: '仅首页', orders: '仅订单页' }
function positionTagType(p) { return { all: '', home: 'success', orders: 'warning' }[p] || '' }
const form = reactive({ title: '', subtitle: '', linkType: 'none', linkValue: '', imageUrl: '', sortOrder: 0, position: 'all' })

async function fetchList() {
  loading.value = true
  try { const res = await getBanners(); list.value = res.data } catch(e) {} finally { loading.value = false }
}

function showDialog(row) {
  if (row) { editId.value = row.id; Object.assign(form, row); if (!form.position) form.position = 'all' }
  else { editId.value = null; form.title = ''; form.subtitle = ''; form.linkType = 'none'; form.linkValue = ''; form.imageUrl = ''; form.sortOrder = 0; form.position = 'all' }
  dialogVisible.value = true
}

async function handleSave() {
  if (!form.title) { ElMessage.warning('请输入标题'); return }
  saving.value = true
  try {
    if (editId.value) { await updateBanner(editId.value, form) } else { await createBanner(form) }
    ElMessage.success('保存成功'); dialogVisible.value = false; fetchList()
  } catch(e) {} finally { saving.value = false }
}

async function toggleStatus(row) {
  var newStatus = row.status === 'active' ? 'inactive' : 'active'
  await updateBanner(row.id, { status: newStatus }); fetchList()
}

async function handleDelete(row) {
  await ElMessageBox.confirm('删除此 Banner？', '警告', { type: 'warning' })
  await deleteBanner(row.id); ElMessage.success('已删除'); fetchList()
}

onMounted(fetchList)
</script>
