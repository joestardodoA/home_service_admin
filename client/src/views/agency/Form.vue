<template>
  <el-card>
    <template #header>
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <span>{{ isEdit ? '编辑机构' : '创建机构' }}</span>
        <el-button @click="$router.back()">返回</el-button>
      </div>
    </template>

    <el-form ref="formRef" :model="form" :rules="rules" label-width="120px" style="max-width:700px;">
      <el-divider content-position="left">基础信息</el-divider>
      <el-form-item label="机构名称" prop="name">
        <el-input v-model="form.name" placeholder="如：安心家政培训中心" />
      </el-form-item>
      <el-form-item label="地址">
        <el-input v-model="form.address" placeholder="详细地址" />
      </el-form-item>
      <el-form-item label="经纬度">
        <el-row :gutter="12">
          <el-col :span="12">
            <el-input v-model="form.lat" placeholder="纬度 (如: 20.017)" type="number" step="0.000001">
              <template #prepend>纬度</template>
            </el-input>
          </el-col>
          <el-col :span="12">
            <el-input v-model="form.lng" placeholder="经度 (如: 110.349)" type="number" step="0.000001">
              <template #prepend>经度</template>
            </el-input>
          </el-col>
        </el-row>
        <div style="margin-top:4px;font-size:12px;color:#909399;">
          💡 可在<a href="https://lbs.qq.com/getPoint/" target="_blank" style="color:#409eff;">腾讯地图坐标拾取</a>获取经纬度
        </div>
      </el-form-item>
      <el-form-item label="联系电话">
        <el-input v-model="form.phone" placeholder="400-xxx-xxxx" />
      </el-form-item>
      <el-form-item label="营业时间">
        <el-input v-model="form.businessHours" placeholder="如：周一至周日 08:30-18:00" />
      </el-form-item>
      <el-form-item label="预约说明">
        <el-input v-model="form.bookingNote" placeholder="如：建议提前2-3天进行预约" />
      </el-form-item>
      <el-form-item label="评分">
        <el-rate v-model="scoreNum" allow-half show-score />
      </el-form-item>
      <el-form-item label="状态">
        <el-radio-group v-model="form.status">
          <el-radio value="active">正常</el-radio>
          <el-radio value="inactive">停用</el-radio>
        </el-radio-group>
      </el-form-item>
      <el-form-item label="标签">
        <el-select v-model="form.tags" multiple filterable allow-create placeholder="输入标签" style="width:100%;">
          <el-option v-for="t in defaultTags" :key="t" :label="t" :value="t" />
        </el-select>
      </el-form-item>
      <el-form-item label="排序权重">
        <el-input-number v-model="form.sortOrder" :min="0" :max="999" />
        <span style="margin-left:8px;font-size:12px;color:#909399;">数字越大越靠前</span>
      </el-form-item>

      <el-divider content-position="left">详细介绍</el-divider>
      <el-form-item label="机构简介">
        <el-input v-model="form.intro" type="textarea" :rows="4" placeholder="机构详细介绍" />
      </el-form-item>
      <el-form-item label="资质认证">
        <el-input v-model="form.qualification" placeholder="如：营业执照已验证" />
      </el-form-item>
      <el-form-item label="机构Logo">
        <ImageUpload v-model="form.logo" placeholder="上传 Logo" />
        <div style="font-size:12px;color:#999;margin-top:4px;">推荐 200 × 200 px 正方形 PNG</div>
      </el-form-item>
      <el-form-item label="封面图">
        <ImageUpload v-model="form.coverImage" placeholder="上传封面" />
        <div style="font-size:12px;color:#999;margin-top:4px;">推荐 750 × 400 px，JPG / PNG</div>
      </el-form-item>
      <el-form-item label="机构相册">
        <ImageUpload v-model="form.gallery" :multiple="true" :max-count="9" placeholder="上传相册" />
        <div style="font-size:12px;color:#999;margin-top:4px;">最多 9 张，推荐 750 × 500 px</div>
      </el-form-item>
      <el-form-item label="兑换须知">
        <div v-for="(note, idx) in exchangeNotesList" :key="idx" style="display:flex;margin-bottom:8px;">
          <el-input v-model="exchangeNotesList[idx]" placeholder="兑换须知条目" style="flex:1;" />
          <el-button type="danger" text @click="exchangeNotesList.splice(idx, 1)" style="margin-left:8px;">删除</el-button>
        </div>
        <el-button type="primary" text @click="exchangeNotesList.push('')" size="small">+ 添加条目</el-button>
      </el-form-item>

      <!-- 课程管理（编辑模式） -->
      <template v-if="isEdit">
        <el-divider content-position="left">课程管理</el-divider>
        <el-table :data="courses" border size="small" style="margin-bottom:16px;">
          <el-table-column prop="name" label="课程名称" />
          <el-table-column prop="desc" label="描述" show-overflow-tooltip />
          <el-table-column prop="duration" label="时长" width="100" />
          <el-table-column prop="discount" label="优惠" width="100" />
          <el-table-column label="操作" width="120">
            <template #default="{ row }">
              <el-button size="small" type="danger" @click="removeCourse(row)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
        <el-row :gutter="8">
          <el-col :span="6"><el-input v-model="newCourse.name" placeholder="课程名称" size="small" /></el-col>
          <el-col :span="6"><el-input v-model="newCourse.desc" placeholder="描述" size="small" /></el-col>
          <el-col :span="4"><el-input v-model="newCourse.duration" placeholder="时长" size="small" /></el-col>
          <el-col :span="4"><el-input v-model="newCourse.discount" placeholder="优惠" size="small" /></el-col>
          <el-col :span="4"><el-button type="primary" size="small" @click="handleAddCourse">添加课程</el-button></el-col>
        </el-row>
      </template>

      <el-divider />
      <el-form-item>
        <el-button type="primary" :loading="saving" @click="handleSubmit">{{ isEdit ? '保存修改' : '创建机构' }}</el-button>
        <el-button @click="$router.back()">取消</el-button>
      </el-form-item>
    </el-form>
  </el-card>
</template>

<script setup>
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getAgency, createAgency, updateAgency, addCourse, deleteCourse } from '../../api/agencies.js'
import { ElMessage } from 'element-plus'
import ImageUpload from '../../components/ImageUpload.vue'

const route = useRoute()
const router = useRouter()
const formRef = ref(null)
const saving = ref(false)
const isEdit = computed(() => !!route.params.id)
const courses = ref([])
const scoreNum = ref(5)
const exchangeNotesList = ref([])
const defaultTags = ['平台认证', '专业师资', '金牌服务', '养老护理', '高级育婴', '专业保洁', '月嫂培训', '育儿嫂', '产康师']

const form = reactive({
  name: '', address: '', lat: '', lng: '', phone: '', businessHours: '', bookingNote: '',
  score: 5.0, status: 'active', tags: [], intro: '', qualification: '',
  logo: '', coverImage: '', sortOrder: 0, exchangeNotes: []
})

const newCourse = reactive({ name: '', desc: '', duration: '', discount: '' })

const rules = {
  name: [{ required: true, message: '请输入机构名称', trigger: 'blur' }]
}

watch(scoreNum, (v) => { form.score = v })

onMounted(async () => {
  if (isEdit.value) {
    try {
      const res = await getAgency(route.params.id)
      Object.assign(form, res.data)
      scoreNum.value = parseFloat(form.score) || 5
      courses.value = res.data.courses || []
      // 解析兑换须知
      var notes = res.data.exchangeNotes
      if (Array.isArray(notes)) {
        exchangeNotesList.value = [...notes]
      } else if (typeof notes === 'string') {
        try { exchangeNotesList.value = JSON.parse(notes) } catch(e) { exchangeNotesList.value = [] }
      }
    } catch (e) {}
  }
})

async function handleSubmit() {
  if (!formRef.value) return
  await formRef.value.validate()
  saving.value = true
  try {
    form.score = scoreNum.value
    // 转换经纬度为数字
    if (form.lat) form.lat = parseFloat(form.lat)
    if (form.lng) form.lng = parseFloat(form.lng)
    // 兑换须知
    form.exchangeNotes = exchangeNotesList.value.filter(n => n.trim())
    if (isEdit.value) {
      await updateAgency(route.params.id, form)
      ElMessage.success('更新成功')
    } else {
      await createAgency(form)
      ElMessage.success('创建成功')
    }
    router.push('/agencies')
  } catch (e) {} finally { saving.value = false }
}

async function handleAddCourse() {
  if (!newCourse.name) { ElMessage.warning('请输入课程名称'); return }
  try {
    const res = await addCourse(route.params.id, { ...newCourse })
    courses.value.push(res.data)
    newCourse.name = ''; newCourse.desc = ''; newCourse.duration = ''; newCourse.discount = ''
    ElMessage.success('课程已添加')
  } catch (e) {}
}

async function removeCourse(row) {
  try {
    await deleteCourse(route.params.id, row.id)
    courses.value = courses.value.filter(c => c.id !== row.id)
    ElMessage.success('课程已删除')
  } catch (e) {}
}
</script>
