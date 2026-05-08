<template>
  <div>
    <el-tabs v-model="activeTab" type="card">
      <!-- 推荐统计概览 -->
      <el-tab-pane label="推荐概览" name="overview">
        <el-row :gutter="16" style="margin-bottom:20px;">
          <el-col :span="8">
            <div class="stat-mini">
              <div class="sm-value">{{ stats.totalReferred || 0 }}</div>
              <div class="sm-label">被推荐用户总数</div>
            </div>
          </el-col>
          <el-col :span="16">
            <el-card shadow="never">
              <template #header><span style="font-weight:600;">推荐排行 TOP 10</span></template>
              <el-table :data="stats.topReferrers || []" stripe size="small">
                <el-table-column label="排名" width="60" type="index" />
                <el-table-column label="推荐人" min-width="150">
                  <template #default="{ row }">
                    <span v-if="row.user">{{ row.user.nickname }} ({{ row.user.phone || '-' }})</span>
                    <span v-else style="color:#ccc;">已注销</span>
                  </template>
                </el-table-column>
                <el-table-column label="推荐人数" width="100" align="center">
                  <template #default="{ row }">
                    <el-tag size="small" type="success">{{ row.count }} 人</el-tag>
                  </template>
                </el-table-column>
                <el-table-column label="操作" width="100">
                  <template #default="{ row }">
                    <el-button size="small" link type="primary" @click="viewChain(row.referrerId)">查看关系链</el-button>
                  </template>
                </el-table-column>
              </el-table>
            </el-card>
          </el-col>
        </el-row>

        <!-- 推荐关系查看 -->
        <el-card shadow="never">
          <template #header>
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <span style="font-weight:600;">推荐关系链查询</span>
              <div style="display:flex;gap:8px;">
                <el-input v-model="chainUserId" placeholder="输入用户ID" style="width:160px;" @keyup.enter="viewChain(chainUserId)" />
                <el-button type="primary" @click="viewChain(chainUserId)">查询</el-button>
              </div>
            </div>
          </template>
          <div v-if="chain" class="chain-view">
            <!-- 上线 -->
            <div class="chain-row" v-if="chain.referrer">
              <div class="chain-label">上线推荐人</div>
              <div class="chain-user">
                <el-avatar :src="chain.referrer.avatar" :size="36">{{ chain.referrer.nickname ? chain.referrer.nickname.charAt(0) : '?' }}</el-avatar>
                <div class="cu-info">
                  <div class="cu-name">{{ chain.referrer.nickname }}</div>
                  <div class="cu-meta">ID: {{ chain.referrer.id }} · {{ chain.referrer.phone || '-' }}</div>
                </div>
              </div>
            </div>
            <div class="chain-arrow" v-if="chain.referrer">↓ 推荐了</div>
            <!-- 当前用户 -->
            <div class="chain-row chain-current">
              <div class="chain-label">当前用户</div>
              <div class="chain-user">
                <el-avatar :src="chain.user.avatar" :size="40">{{ chain.user.nickname ? chain.user.nickname.charAt(0) : '?' }}</el-avatar>
                <div class="cu-info">
                  <div class="cu-name" style="font-weight:700;">{{ chain.user.nickname }}</div>
                  <div class="cu-meta">ID: {{ chain.user.id }} · {{ chain.user.phone || '-' }} · {{ formatDate(chain.user.createdAt) }}注册</div>
                </div>
              </div>
            </div>
            <div class="chain-arrow" v-if="chain.referrals && chain.referrals.length > 0">↓ 推荐了 {{ chain.totalReferrals }} 人</div>
            <!-- 下线 -->
            <div class="chain-row" v-for="ref in chain.referrals" :key="ref.id">
              <div class="chain-user">
                <el-avatar :src="ref.avatar" :size="32">{{ ref.nickname ? ref.nickname.charAt(0) : '?' }}</el-avatar>
                <div class="cu-info">
                  <div class="cu-name">{{ ref.nickname }}</div>
                  <div class="cu-meta">ID: {{ ref.id }} · {{ ref.phone || '-' }} · {{ formatDate(ref.createdAt) }}</div>
                </div>
                <el-button size="small" link type="primary" @click="viewChain(ref.id)">展开</el-button>
              </div>
            </div>
            <div v-if="!chain.referrer && (!chain.referrals || chain.referrals.length === 0)" style="color:#999;text-align:center;padding:20px;">此用户无推荐关系</div>
          </div>
        </el-card>
      </el-tab-pane>

      <!-- 分享记录 -->
      <el-tab-pane label="分享记录" name="records">
        <el-card>
          <el-row :gutter="16" style="margin-bottom:16px;" align="middle">
            <el-col :span="4">
              <el-select v-model="shareQuery.shareType" placeholder="分享类型" clearable @change="fetchShares">
                <el-option label="优惠券" value="coupon" />
                <el-option label="服务订单" value="service_order" />
                <el-option label="文章" value="article" />
                <el-option label="小程序" value="app" />
              </el-select>
            </el-col>
            <el-col :span="4">
              <el-button type="primary" @click="fetchShares">查询</el-button>
              <el-button @click="shareQuery.shareType = ''; shareQuery.page = 1; fetchShares()">重置</el-button>
            </el-col>
          </el-row>

          <el-table :data="shareList" v-loading="shareLoading" stripe>
            <el-table-column prop="id" label="ID" width="60" />
            <el-table-column label="分享人" width="150">
              <template #default="{ row }">
                <span v-if="row.sharer">{{ row.sharer.nickname }} ({{ row.sharer.phone || '-' }})</span>
                <span v-else style="color:#ccc;">-</span>
              </template>
            </el-table-column>
            <el-table-column label="类型" width="100">
              <template #default="{ row }">
                <el-tag size="small">{{ { coupon:'优惠券', service_order:'订单', article:'文章', app:'小程序' }[row.shareType] || row.shareType }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="目标ID" width="80">
              <template #default="{ row }">{{ row.targetId || '-' }}</template>
            </el-table-column>
            <el-table-column label="点击量" width="80" align="center">
              <template #default="{ row }">{{ row.clickCount || 0 }}</template>
            </el-table-column>
            <el-table-column label="转化量" width="80" align="center">
              <template #default="{ row }">{{ row.convertCount || 0 }}</template>
            </el-table-column>
            <el-table-column label="分享时间" width="170">
              <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
            </el-table-column>
          </el-table>
          <div style="margin-top:16px;text-align:right;">
            <el-pagination v-model:current-page="shareQuery.page" :page-size="10" :total="shareTotal" layout="total, prev, pager, next" @current-change="fetchShares" />
          </div>
        </el-card>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { getShareRecords, getReferralStats, getReferralChain } from '../../api/shares.js'

const activeTab = ref('overview')
const stats = ref({})
const chain = ref(null)
const chainUserId = ref('')

async function fetchStats() {
  try {
    var res = await getReferralStats()
    stats.value = res.data || {}
  } catch (e) {}
}

async function viewChain(userId) {
  if (!userId) return
  chainUserId.value = String(userId)
  try {
    var res = await getReferralChain(userId)
    chain.value = res.data
  } catch (e) { chain.value = null }
}

// 分享记录
const shareList = ref([])
const shareLoading = ref(false)
const shareTotal = ref(0)
const shareQuery = reactive({ shareType: '', page: 1 })

async function fetchShares() {
  shareLoading.value = true
  try {
    var res = await getShareRecords({ ...shareQuery, pageSize: 10 })
    shareList.value = res.data.list || res.data || []
    shareTotal.value = res.data.total || 0
  } catch (e) {} finally { shareLoading.value = false }
}

function formatDate(d) {
  if (!d) return ''
  var dt = new Date(d)
  return dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0') + '-' + String(dt.getDate()).padStart(2, '0') + ' ' + String(dt.getHours()).padStart(2, '0') + ':' + String(dt.getMinutes()).padStart(2, '0')
}

onMounted(() => {
  fetchStats()
  fetchShares()
})
</script>

<style scoped>
.stat-mini { background:linear-gradient(135deg,#667eea 0%,#764ba2 100%); border-radius:12px; padding:30px; text-align:center; color:#fff; }
.sm-value { font-size:36px; font-weight:800; }
.sm-label { font-size:13px; opacity:0.8; margin-top:6px; }

.chain-view { padding:16px 0; }
.chain-row { padding:12px 16px; border-radius:10px; background:#f9f9fb; margin-bottom:8px; }
.chain-row.chain-current { background:#e8f4ff; border:1px solid #b3d8ff; }
.chain-label { font-size:12px; color:#999; margin-bottom:6px; }
.chain-user { display:flex; align-items:center; gap:12px; }
.cu-info { flex:1; }
.cu-name { font-size:14px; color:#333; }
.cu-meta { font-size:12px; color:#999; margin-top:2px; }
.chain-arrow { text-align:center; color:#999; font-size:18px; padding:4px 0; }
</style>
