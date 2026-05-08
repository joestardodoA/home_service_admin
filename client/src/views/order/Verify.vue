<template>
  <div class="verify-page">
    <!-- 核销输入区 -->
    <el-card shadow="never" class="verify-input-card">
      <div class="verify-header">
        <el-icon :size="28" color="#409EFF"><CircleCheck /></el-icon>
        <h2>券码核销</h2>
        <p class="verify-desc">输入阿姨提供的6位券码，查询并核销</p>
      </div>
      <div class="verify-input-row">
        <el-input
          v-model="verifyCode"
          placeholder="请输入6位核销码"
          size="large"
          maxlength="6"
          clearable
          @keyup.enter="handleLookup"
          class="code-input"
        >
          <template #prefix>
            <el-icon><Ticket /></el-icon>
          </template>
        </el-input>
        <el-button type="primary" size="large" :loading="looking" @click="handleLookup" class="lookup-btn">
          查询
        </el-button>
      </div>
    </el-card>

    <!-- 查询结果 -->
    <el-card v-if="order" shadow="never" class="verify-result-card">
      <div class="result-status-bar" :class="'status-' + order.status">
        <span class="status-dot"></span>
        <span>{{ statusMap[order.status] || order.status }}</span>
      </div>

      <el-descriptions :column="2" border size="default" class="order-info">
        <el-descriptions-item label="订单号">{{ order.orderNo }}</el-descriptions-item>
        <el-descriptions-item label="核销码">
          <span class="code-highlight">{{ order.verifyCode }}</span>
        </el-descriptions-item>
        <el-descriptions-item label="优惠券">{{ order.coupon?.title || '-' }}</el-descriptions-item>
        <el-descriptions-item label="券面值">{{ order.coupon?.valueText || '-' }}</el-descriptions-item>
        <el-descriptions-item label="用户昵称">{{ order.user?.nickname || '-' }}</el-descriptions-item>
        <el-descriptions-item label="用户手机">{{ order.user?.phone || '-' }}</el-descriptions-item>
        <el-descriptions-item label="领取时间">{{ order.claimDate || '-' }}</el-descriptions-item>
        <el-descriptions-item label="核销机构">{{ order.agency?.name || '-' }}</el-descriptions-item>
      </el-descriptions>

      <!-- 核销按钮 -->
      <div class="verify-action">
        <el-button
          v-if="order.status === 'unused'"
          type="success"
          size="large"
          :loading="verifying"
          @click="handleVerify"
          class="verify-btn"
        >
          <el-icon><CircleCheck /></el-icon>
          确认核销
        </el-button>
        <el-result
          v-else-if="order.status === 'used'"
          icon="warning"
          title="该券已核销"
          :sub-title="'核销时间：' + (order.useDate || '-')"
        />
        <el-result
          v-else-if="order.status === 'cancelled'"
          icon="error"
          title="该券已作废"
        />
        <el-result
          v-else-if="order.status === 'expired'"
          icon="info"
          title="该券已过期"
        />
      </div>
    </el-card>

    <!-- 核销成功提示 -->
    <el-card v-if="verifySuccess" shadow="never" class="verify-success-card">
      <el-result icon="success" title="核销成功！" sub-title="该券码已更新为已使用状态">
        <template #extra>
          <el-button type="primary" @click="handleReset">继续核销下一张</el-button>
        </template>
      </el-result>
    </el-card>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { CircleCheck, Ticket } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { lookupByCode, verifyOrder } from '../../api/orders.js'

const verifyCode = ref('')
const order = ref(null)
const looking = ref(false)
const verifying = ref(false)
const verifySuccess = ref(false)

const statusMap = {
  unused: '待使用',
  used: '已核销',
  cancelled: '已作废',
  expired: '已过期'
}

// 查询券码
async function handleLookup() {
  var code = verifyCode.value.trim()
  if (!code) return ElMessage.warning('请输入券码')
  if (code.length < 4) return ElMessage.warning('券码长度不正确')

  looking.value = true
  verifySuccess.value = false
  try {
    var res = await lookupByCode(code)
    order.value = res.data
  } catch (err) {
    order.value = null
    ElMessage.error(err?.response?.data?.msg || err?.msg || '未找到该券码')
  } finally {
    looking.value = false
  }
}

// 确认核销
async function handleVerify() {
  await ElMessageBox.confirm(
    '确认核销券码「' + order.value.verifyCode + '」？\n用户：' + (order.value.user?.nickname || '-') + '\n优惠券：' + (order.value.coupon?.title || '-'),
    '核销确认',
    { type: 'success', confirmButtonText: '确认核销', cancelButtonText: '取消' }
  )
  verifying.value = true
  try {
    await verifyOrder(order.value.id)
    ElMessage.success('核销成功')
    verifySuccess.value = true
    order.value = null
  } catch (err) {
    ElMessage.error(err?.response?.data?.msg || '核销失败')
  } finally {
    verifying.value = false
  }
}

// 重置继续核销
function handleReset() {
  verifyCode.value = ''
  order.value = null
  verifySuccess.value = false
}
</script>

<style scoped>
.verify-page {
  max-width: 700px;
  margin: 0 auto;
  padding: 20px;
}

.verify-input-card {
  margin-bottom: 20px;
}

.verify-header {
  text-align: center;
  margin-bottom: 24px;
}

.verify-header h2 {
  margin: 8px 0 4px;
  font-size: 22px;
  color: #303133;
}

.verify-desc {
  color: #909399;
  font-size: 14px;
  margin: 0;
}

.verify-input-row {
  display: flex;
  gap: 12px;
}

.code-input {
  flex: 1;
}

.code-input :deep(.el-input__inner) {
  font-size: 20px;
  letter-spacing: 6px;
  font-weight: 600;
  text-align: center;
}

.lookup-btn {
  min-width: 100px;
}

.verify-result-card {
  margin-bottom: 20px;
}

.result-status-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  border-radius: 6px;
  margin-bottom: 16px;
  font-weight: 600;
  font-size: 15px;
}

.status-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.status-unused {
  background: #f0f9eb;
  color: #67c23a;
}
.status-unused .status-dot {
  background: #67c23a;
}

.status-used {
  background: #fdf6ec;
  color: #e6a23c;
}
.status-used .status-dot {
  background: #e6a23c;
}

.status-cancelled {
  background: #fef0f0;
  color: #f56c6c;
}
.status-cancelled .status-dot {
  background: #f56c6c;
}

.status-expired {
  background: #f4f4f5;
  color: #909399;
}
.status-expired .status-dot {
  background: #909399;
}

.code-highlight {
  font-size: 18px;
  font-weight: 700;
  letter-spacing: 4px;
  color: #409EFF;
}

.order-info {
  margin-bottom: 20px;
}

.verify-action {
  text-align: center;
  padding: 16px 0;
}

.verify-btn {
  min-width: 200px;
  font-size: 16px;
  height: 48px;
}

.verify-success-card {
  margin-bottom: 20px;
}
</style>
