<template>
  <el-card>
    <template #header>
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <span>{{ isEdit ? '编辑优惠券' : '创建优惠券' }}</span>
        <el-button @click="$router.back()">返回</el-button>
      </div>
    </template>

    <el-form ref="formRef" :model="form" :rules="rules" label-width="120px" style="max-width:700px;">
      <el-divider content-position="left">基础信息</el-divider>
      <el-form-item label="券名称" prop="title">
        <el-input v-model="form.title" placeholder="如：政府免费培训券" />
      </el-form-item>
      <el-form-item label="券类型" prop="type">
        <el-radio-group v-model="form.type">
          <el-radio value="free">免费</el-radio>
          <el-radio value="cash">现金抵用</el-radio>
          <el-radio value="discount">折扣</el-radio>
        </el-radio-group>
      </el-form-item>
      <el-form-item label="面值" v-if="form.type !== 'free'">
        <el-input-number v-model="form.value" :min="0" :max="10000" />
      </el-form-item>
      <el-form-item label="面值文本">
        <el-input v-model="form.valueText" placeholder="如：免费、¥200" style="width:200px;" />
      </el-form-item>
      <el-form-item label="使用条件">
        <el-input v-model="form.condition" placeholder="如：满1000元可用" />
      </el-form-item>
      <el-form-item label="标签">
        <el-select v-model="form.tags" multiple filterable allow-create placeholder="输入标签按回车" style="width:100%;">
          <el-option v-for="t in defaultTags" :key="t" :label="t" :value="t" />
        </el-select>
      </el-form-item>

      <el-divider content-position="left">库存与时间</el-divider>
      <el-form-item label="发行总量">
        <el-input-number v-model="form.totalCount" :min="0" :max="100000" />
      </el-form-item>
      <el-form-item label="每人限领">
        <el-input-number v-model="form.limitPerUser" :min="1" :max="10" />
      </el-form-item>
      <el-form-item label="有效期" prop="expireDate">
        <el-date-picker v-model="dateRange" type="daterange" range-separator="至" start-placeholder="开始日期" end-placeholder="结束日期" value-format="YYYY-MM-DD" />
      </el-form-item>

      <el-divider content-position="left">图片配置</el-divider>
      <el-form-item label="列表图标">
        <ImageUpload v-model="form.icon" placeholder="上传图标" />
        <div style="font-size:12px;color:#999;margin-top:4px;">推荐 144 × 144 px 正方形 PNG</div>
      </el-form-item>
      <el-form-item label="详情封面">
        <ImageUpload v-model="form.coverImage" placeholder="上传封面" />
        <div style="font-size:12px;color:#999;margin-top:4px;">推荐 750 × 400 px，JPG / PNG</div>
      </el-form-item>

      <el-divider content-position="left">分享与奖励</el-divider>
      <el-form-item label="分享奖励金">
        <el-input-number v-model="form.shareRewardAmount" :min="0" :max="10000" :precision="2" />
        <span style="margin-left:8px;font-size:12px;color:#999;">元（分享人在该券被核销后获得的现金奖励）</span>
      </el-form-item>
      <el-form-item label="核销积分">
        <el-input-number v-model="form.shareRewardPoints" :min="0" :max="99999" />
        <span style="margin-left:8px;font-size:12px;color:#999;">分（分享人在该券被核销后获得的积分奖励）</span>
      </el-form-item>

      <el-divider content-position="left">描述</el-divider>
      <el-form-item label="简要描述">
        <el-input v-model="form.description" type="textarea" :rows="3" placeholder="券的简要说明" />
      </el-form-item>

      <el-form-item>
        <el-button type="primary" :loading="saving" @click="handleSubmit">{{ isEdit ? '保存修改' : '创建优惠券' }}</el-button>
        <el-button @click="$router.back()">取消</el-button>
      </el-form-item>
    </el-form>
  </el-card>
</template>

<script setup>
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getCoupon, createCoupon, updateCoupon } from '../../api/coupons.js'
import { ElMessage } from 'element-plus'
import ImageUpload from '../../components/ImageUpload.vue'

const route = useRoute()
const router = useRouter()
const formRef = ref(null)
const saving = ref(false)
const isEdit = computed(() => !!route.params.id)
const dateRange = ref([])
const defaultTags = ['官方认证', '完全免费', '就近学习', '优质商户', '全城通用', '限时特惠', '新人专享']

const form = reactive({
  title: '', type: 'free', value: 0, valueText: '免费', condition: '',
  description: '', tags: [], totalCount: 100, limitPerUser: 1,
  startDate: '', expireDate: '', sortOrder: 0,
  icon: '', coverImage: '',
  shareRewardAmount: 0, shareRewardPoints: 0
})

const rules = {
  title: [{ required: true, message: '请输入券名称', trigger: 'blur' }],
  expireDate: [{ required: true, message: '请选择有效期', trigger: 'change' }]
}

watch(dateRange, (val) => {
  if (val && val.length === 2) {
    form.startDate = val[0]
    form.expireDate = val[1]
  }
})

onMounted(async () => {
  if (isEdit.value) {
    try {
      const res = await getCoupon(route.params.id)
      Object.assign(form, res.data)
      if (form.startDate && form.expireDate) {
        dateRange.value = [form.startDate, form.expireDate]
      }
    } catch (e) {}
  }
})

async function handleSubmit() {
  if (!formRef.value) return
  await formRef.value.validate()
  saving.value = true
  try {
    if (isEdit.value) {
      await updateCoupon(route.params.id, form)
      ElMessage.success('更新成功')
    } else {
      form.remainCount = form.totalCount
      await createCoupon(form)
      ElMessage.success('创建成功')
    }
    router.push('/coupons')
  } catch (e) {} finally { saving.value = false }
}
</script>
