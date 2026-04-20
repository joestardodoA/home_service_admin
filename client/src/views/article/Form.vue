<template>
  <el-card>
    <template #header>
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <span>{{ isEdit ? '编辑文章' : '创建文章' }}</span>
        <el-button @click="$router.back()">返回</el-button>
      </div>
    </template>
    <el-form ref="formRef" :model="form" :rules="rules" label-width="100px" style="max-width:800px;">
      <el-form-item label="标题" prop="title">
        <el-input v-model="form.title" placeholder="文章标题" />
      </el-form-item>
      <el-form-item label="分类">
        <el-select v-model="form.category">
          <el-option v-for="c in categories" :key="c" :label="c" :value="c" />
        </el-select>
      </el-form-item>
      <el-form-item label="标签">
        <el-select v-model="form.tags" multiple filterable allow-create placeholder="输入标签" style="width:100%;" />
      </el-form-item>
      <el-form-item label="摘要">
        <el-input v-model="form.summary" type="textarea" :rows="2" placeholder="文章摘要（展示在列表中）" />
      </el-form-item>
      <el-form-item label="封面图">
        <ImageUpload v-model="form.coverImage" placeholder="上传封面图" />
        <div style="font-size:12px;color:#999;margin-top:4px;">推荐 750 × 400 px，显示在知识列表页</div>
      </el-form-item>
      <el-form-item label="正文内容" prop="content">
        <el-input v-model="form.content" type="textarea" :rows="12" placeholder="文章正文内容" />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" :loading="saving" @click="handleSubmit('draft')">保存草稿</el-button>
        <el-button type="success" :loading="saving" @click="handleSubmit('published')">保存并发布</el-button>
        <el-button @click="$router.back()">取消</el-button>
      </el-form-item>
    </el-form>
  </el-card>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getArticle, createArticle, updateArticle } from '../../api/articles.js'
import { ElMessage } from 'element-plus'
import ImageUpload from '../../components/ImageUpload.vue'

const route = useRoute()
const router = useRouter()
const formRef = ref(null)
const saving = ref(false)
const isEdit = computed(() => !!route.params.id)
const categories = ['保洁', '育婴', '月嫂', '养老', '职场']
const form = reactive({ title: '', category: '保洁', tags: [], summary: '', coverImage: '', content: '', status: 'draft' })
const rules = { title: [{ required: true, message: '请输入标题', trigger: 'blur' }], content: [{ required: true, message: '请输入正文', trigger: 'blur' }] }

onMounted(async () => {
  if (isEdit.value) { try { const res = await getArticle(route.params.id); Object.assign(form, res.data) } catch(e) {} }
})

async function handleSubmit(status) {
  if (!formRef.value) return
  await formRef.value.validate()
  saving.value = true
  try {
    form.status = status
    if (status === 'published' && !form.publishedAt) form.publishedAt = new Date().toISOString()
    if (isEdit.value) { await updateArticle(route.params.id, form); ElMessage.success('更新成功') }
    else { await createArticle(form); ElMessage.success('创建成功') }
    router.push('/articles')
  } catch(e) {} finally { saving.value = false }
}
</script>
