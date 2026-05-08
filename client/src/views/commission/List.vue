<template>
  <div>
    <el-card>
      <el-row :gutter="16" align="middle">
        <el-col :span="6">
          <el-input v-model="searchKeyword" placeholder="搜索用户（手机号/昵称/真实姓名）" clearable @keyup.enter="doSearch">
            <template #append><el-button @click="doSearch">搜索</el-button></template>
          </el-input>
        </el-col>
        <el-col :span="4"><el-select v-model="query.source" placeholder="来源筛选" clearable @change="fetchList">
          <el-option label="全部" value="" />
          <el-option label="优惠券分享" value="coupon_share" />
          <el-option label="订单推荐" value="order_accept" />
          <el-option label="邀请注册" value="invite" />
          <el-option label="手动增加" value="manual_add" />
          <el-option label="手动扣减" value="manual_deduct" />
        </el-select></el-col>
        <el-col :span="4"><el-button type="primary" @click="fetchList">查询</el-button><el-button @click="resetQuery">重置</el-button></el-col>
      </el-row>
    </el-card>

    <!-- 用户搜索结果 -->
    <el-card style="margin-top:16px;" v-if="searchResults.length > 0">
      <h4 style="margin:0 0 12px">搜索结果 — 点击操作积分</h4>
      <el-table :data="searchResults" size="small" stripe>
        <el-table-column prop="id" label="ID" width="60" />
        <el-table-column prop="nickname" label="昵称" width="100" />
        <el-table-column prop="phone" label="手机号" width="130" />
        <el-table-column prop="realName" label="真实姓名" width="100" />
        <el-table-column label="当前积分" width="100"><template #default="{ row }"><strong style="color:#e6a23c;">{{ row.points }}</strong></template></el-table-column>
        <el-table-column label="认证" width="70"><template #default="{ row }"><el-tag :type="row.isRealAuth ? 'success' : 'info'" size="small">{{ row.isRealAuth ? '已认证' : '未认证' }}</el-tag></template></el-table-column>
        <el-table-column label="操作" width="200">
          <template #default="{ row }">
            <el-button size="small" type="success" @click="showAdjust(row, 'add')">增加积分</el-button>
            <el-button size="small" type="warning" @click="showAdjust(row, 'deduct')">扣减积分</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 佣金记录列表 -->
    <el-card style="margin-top:16px;">
      <h4 style="margin:0 0 12px">积分/佣金记录</h4>
      <el-table :data="list" v-loading="loading" stripe>
        <el-table-column prop="id" label="ID" width="60" />
        <el-table-column label="用户" width="120"><template #default="{ row }">{{ row.user ? row.user.nickname : '-' }}</template></el-table-column>
        <el-table-column label="来源" width="120"><template #default="{ row }"><el-tag :type="sourceType[row.source] || 'info'" size="small">{{ sourceMap[row.source] || row.source }}</el-tag></template></el-table-column>
        <el-table-column prop="amount" label="数额" width="80" />
        <el-table-column label="状态" width="80"><template #default="{ row }"><el-tag :type="row.status === 'settled' ? 'success' : 'warning'" size="small">{{ row.status === 'settled' ? '已结算' : '待结算' }}</el-tag></template></el-table-column>
        <el-table-column prop="remark" label="备注" min-width="200" show-overflow-tooltip />
        <el-table-column prop="createdAt" label="创建时间" width="170" />
      </el-table>
      <div style="margin-top:16px;text-align:right;">
        <el-pagination v-model:current-page="query.page" :page-size="query.pageSize" :total="total" layout="total, prev, pager, next" @current-change="fetchList" />
      </div>
    </el-card>

    <!-- 积分调整对话框 -->
    <el-dialog v-model="adjustVisible" :title="adjustType === 'add' ? '增加积分' : '扣减积分（线下兑换）'" width="420px">
      <div v-if="adjustUser" style="margin-bottom:16px;">
        <strong>{{ adjustUser.nickname }}</strong>（{{ adjustUser.phone || '无手机号' }}）
        <el-tag style="margin-left:8px;" type="warning" size="small">当前积分: {{ adjustUser.points }}</el-tag>
      </div>
      <el-form label-width="80px">
        <el-form-item label="积分数额"><el-input-number v-model="adjustForm.amount" :min="1" :max="99999" /></el-form-item>
        <el-form-item label="操作备注"><el-input v-model="adjustForm.remark" type="textarea" :rows="2" placeholder="请输入备注（必填）" maxlength="200" show-word-limit /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="adjustVisible = false">取消</el-button>
        <el-button :type="adjustType === 'add' ? 'success' : 'warning'" @click="submitAdjust">确认{{ adjustType === 'add' ? '增加' : '扣减' }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
/**
 * 后台管理 — 佣金积分管理页
 *
 * 功能:
 *   - 佣金记录列表查询（按来源筛选）
 *   - 搜索用户（按手机号/昵称/真名）
 *   - 手动增减积分（必填备注，积分不能扣为负数）
 *   - 来源类型: invite（邀请注册）、share（分享奖励）、manual_add（手动增加）、manual_deduct（手动扣减）
 *
 * 对应接口:
 *   GET /api/commissions             — 佣金记录列表
 *   GET /api/commissions/search-user — 搜索用户
 *   PUT /api/commissions/adjust      — 手动增减积分
 */
import { ref, reactive, onMounted } from 'vue'
import { getCommissions, searchUser, adjustPoints } from '../../api/commissions.js'
import { ElMessage, ElMessageBox } from 'element-plus'

const list = ref([])
const total = ref(0)
const loading = ref(false)
const searchKeyword = ref('')
const searchResults = ref([])
const query = reactive({ source: '', userId: '', page: 1, pageSize: 10 })

const sourceMap = { coupon_share: '优惠券分享', order_accept: '订单推荐', invite: '邀请注册', manual_add: '手动增加', manual_deduct: '手动扣减' }
const sourceType = { coupon_share: '', order_accept: 'success', invite: 'info', manual_add: 'success', manual_deduct: 'danger' }

const adjustVisible = ref(false)
const adjustType = ref('add')
const adjustUser = ref(null)
const adjustForm = reactive({ amount: 10, remark: '' })

async function fetchList() {
  loading.value = true
  try { const res = await getCommissions(query); list.value = res.data.list; total.value = res.data.total } catch(e) {} finally { loading.value = false }
}
function resetQuery() { query.source = ''; query.userId = ''; query.page = 1; searchResults.value = []; searchKeyword.value = ''; fetchList() }
async function doSearch() {
  if (!searchKeyword.value.trim()) return
  try { const res = await searchUser(searchKeyword.value.trim()); searchResults.value = res.data || [] } catch(e) {}
}
function showAdjust(user, type) { adjustUser.value = user; adjustType.value = type; adjustForm.amount = 10; adjustForm.remark = ''; adjustVisible.value = true }
async function submitAdjust() {
  if (!adjustForm.remark.trim()) return ElMessage.warning('请输入操作备注')
  var amount = adjustType.value === 'add' ? adjustForm.amount : -adjustForm.amount
  await adjustPoints({ userId: adjustUser.value.id, amount: amount, remark: adjustForm.remark })
  ElMessage.success('操作成功')
  adjustVisible.value = false
  doSearch()
  fetchList()
}
onMounted(fetchList)
</script>
