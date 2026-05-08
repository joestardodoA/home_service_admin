<template>
  <div>
    <el-card>
      <template #header>
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span>系统配置管理</span>
          <el-button type="primary" @click="handleSave" :loading="saving" icon="Check">保存全部</el-button>
        </div>
      </template>

      <el-tabs v-model="activeTab" type="card">
        <!-- 积分兑换配置 -->
        <el-tab-pane label="积分兑换" name="exchange">
          <el-form label-width="140px" style="max-width:600px;">
            <el-form-item label="兑换地址">
              <el-input v-model="configMap['exchange_address']" placeholder="如：海口市龙华区XX路XX号" />
            </el-form-item>
            <el-form-item label="联系电话">
              <el-input v-model="configMap['exchange_phone']" placeholder="如：0898-12345678" />
            </el-form-item>
            <el-form-item label="营业时间">
              <el-input v-model="configMap['exchange_hours']" placeholder="如：周一至周五 9:00-17:00" />
            </el-form-item>
          </el-form>
        </el-tab-pane>

        <!-- AI匹配权重 -->
        <el-tab-pane label="AI匹配权重" name="match">
          <el-alert type="info" :closable="false" style="margin-bottom:20px;">
            以下权重影响 AI 智能推荐候选人的评分。总分建议保持 100 分。当前总分：<strong>{{ weightTotal }}</strong>
          </el-alert>
          <el-form label-width="140px" style="max-width:600px;">
            <el-form-item label="工种匹配权重">
              <el-input-number v-model.number="configMap['match_weight_jobtype']" :min="0" :max="100" />
              <span style="margin-left:8px;color:#999;font-size:12px;">分</span>
            </el-form-item>
            <el-form-item label="城市匹配权重">
              <el-input-number v-model.number="configMap['match_weight_city']" :min="0" :max="100" />
              <span style="margin-left:8px;color:#999;font-size:12px;">分</span>
            </el-form-item>
            <el-form-item label="薪资匹配权重">
              <el-input-number v-model.number="configMap['match_weight_salary']" :min="0" :max="100" />
              <span style="margin-left:8px;color:#999;font-size:12px;">分</span>
            </el-form-item>
            <el-form-item label="成功率权重">
              <el-input-number v-model.number="configMap['match_weight_success']" :min="0" :max="100" />
              <span style="margin-left:8px;color:#999;font-size:12px;">分</span>
            </el-form-item>
            <el-form-item label="实名认证权重">
              <el-input-number v-model.number="configMap['match_weight_auth']" :min="0" :max="100" />
              <span style="margin-left:8px;color:#999;font-size:12px;">分</span>
            </el-form-item>
            <el-form-item label="闺蜜圈加权">
              <el-input-number v-model.number="configMap['match_weight_guimi']" :min="0" :max="50" />
              <span style="margin-left:8px;color:#999;font-size:12px;">分（额外加分）</span>
            </el-form-item>
          </el-form>
        </el-tab-pane>

        <!-- 闺蜜圈参数 -->
        <el-tab-pane label="闺蜜圈" name="guimi">
          <el-form label-width="160px" style="max-width:600px;">
            <el-form-item label="圈子人数上限">
              <el-input-number v-model.number="configMap['guimi_max_members']" :min="2" :max="9999" />
              <span style="margin-left:8px;color:#999;font-size:12px;">人</span>
            </el-form-item>
            <el-form-item label="临时邀请码有效时长">
              <el-input-number v-model.number="configMap['guimi_code_expire_min']" :min="1" :max="60" />
              <span style="margin-left:8px;color:#999;font-size:12px;">分钟</span>
            </el-form-item>
          </el-form>
        </el-tab-pane>

        <!-- 平台信息 -->
        <el-tab-pane label="平台信息" name="platform">
          <el-form label-width="140px" style="max-width:600px;">
            <el-form-item label="平台名称">
              <el-input v-model="configMap['platform_name']" placeholder="海南椰嫂综合平台" />
            </el-form-item>
            <el-form-item label="客服电话">
              <el-input v-model="configMap['platform_phone']" placeholder="如：400-XXX-XXXX" />
            </el-form-item>
            <el-form-item label="版本号">
              <el-input v-model="configMap['platform_version']" placeholder="如：V2.0.0" />
            </el-form-item>
            <el-form-item label="关于我们">
              <el-input v-model="configMap['platform_about']" type="textarea" :rows="4" placeholder="平台简介" />
            </el-form-item>
          </el-form>
        </el-tab-pane>
      </el-tabs>
    </el-card>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { getSettings, updateSettings } from '../../api/settings.js'
import { ElMessage } from 'element-plus'

const activeTab = ref('exchange')
const saving = ref(false)

// 默认配置值
const DEFAULTS = {
  exchange_address: '', exchange_phone: '', exchange_hours: '',
  match_weight_jobtype: 30, match_weight_city: 25, match_weight_salary: 20,
  match_weight_success: 15, match_weight_auth: 10, match_weight_guimi: 15,
  guimi_max_members: 1000, guimi_code_expire_min: 5,
  platform_name: '海南椰嫂综合平台', platform_phone: '', platform_version: 'V2.0.0', platform_about: ''
}

// 配置键值映射
const configMap = reactive({ ...DEFAULTS })

// 配置键 → 中文标签映射
const LABELS = {
  exchange_address: '兑换地址', exchange_phone: '联系电话', exchange_hours: '营业时间',
  match_weight_jobtype: '工种匹配权重', match_weight_city: '城市匹配权重', match_weight_salary: '薪资匹配权重',
  match_weight_success: '成功率权重', match_weight_auth: '认证权重', match_weight_guimi: '闺蜜圈加权',
  guimi_max_members: '圈子人数上限', guimi_code_expire_min: '临时码有效时长',
  platform_name: '平台名称', platform_phone: '客服电话', platform_version: '版本号', platform_about: '关于我们'
}

// 配置键 → 分组映射
const GROUPS = {
  exchange_address: 'exchange', exchange_phone: 'exchange', exchange_hours: 'exchange',
  match_weight_jobtype: 'match', match_weight_city: 'match', match_weight_salary: 'match',
  match_weight_success: 'match', match_weight_auth: 'match', match_weight_guimi: 'match',
  guimi_max_members: 'guimi', guimi_code_expire_min: 'guimi',
  platform_name: 'platform', platform_phone: 'platform', platform_version: 'platform', platform_about: 'platform'
}

// 匹配权重总分（不含闺蜜圈加权）
const weightTotal = computed(() => {
  return (Number(configMap['match_weight_jobtype']) || 0)
    + (Number(configMap['match_weight_city']) || 0)
    + (Number(configMap['match_weight_salary']) || 0)
    + (Number(configMap['match_weight_success']) || 0)
    + (Number(configMap['match_weight_auth']) || 0)
})

// 加载配置
async function fetchSettings() {
  try {
    const res = await getSettings()
    var list = res.data || []
    list.forEach(function(item) {
      if (item.key in configMap) {
        // 数值型字段转数字
        if (item.key.startsWith('match_weight_') || item.key === 'guimi_max_members' || item.key === 'guimi_code_expire_min') {
          configMap[item.key] = Number(item.value) || DEFAULTS[item.key]
        } else {
          configMap[item.key] = item.value || DEFAULTS[item.key]
        }
      }
    })
  } catch (e) {}
}

// 保存全部配置
async function handleSave() {
  saving.value = true
  try {
    var settings = Object.keys(configMap).map(function(key) {
      return { key: key, value: String(configMap[key]), label: LABELS[key] || key, group: GROUPS[key] || 'general' }
    })
    await updateSettings(settings)
    ElMessage.success('配置已保存')
  } catch (e) {
    ElMessage.error('保存失败')
  } finally { saving.value = false }
}

onMounted(fetchSettings)
</script>
