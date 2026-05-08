<template>
  <div>
    <!-- 业绩概览（有 dispatch 权限的销售可见） -->
    <div class="perf-cards" v-if="can('service_orders:dispatch') || can('service_orders:view_own')">
      <div class="perf-card">
        <div class="pc-label">我的进行中</div>
        <div class="pc-value">{{ perf.activeOrders || 0 }}</div>
      </div>
      <div class="perf-card">
        <div class="pc-label">本月完成</div>
        <div class="pc-value">{{ perf.monthCompleted || 0 }}</div>
      </div>
      <div class="perf-card">
        <div class="pc-label">本月金额</div>
        <div class="pc-value">¥{{ (perf.monthAmount || 0).toLocaleString() }}</div>
      </div>
      <div class="perf-card">
        <div class="pc-label">累计完成</div>
        <div class="pc-value">{{ perf.totalCompleted || 0 }}</div>
      </div>
      <div class="perf-card">
        <div class="pc-label">累计金额</div>
        <div class="pc-value">¥{{ (perf.totalAmount || 0).toLocaleString() }}</div>
      </div>
    </div>

    <el-card class="filter-card">
      <el-row :gutter="16" align="middle">
        <el-col :xl="5" :lg="6" :md="12" :sm="24" :xs="24">
          <el-input v-model="query.keyword" placeholder="搜索订单号/联系人/电话" clearable prefix-icon="Search" @clear="fetchList" @keyup.enter="fetchList" />
        </el-col>
        <el-col :xl="3" :lg="4" :md="6" :sm="12" :xs="12">
          <el-select v-model="query.type" placeholder="订单类型" clearable @change="fetchList">
            <el-option label="雇主发单" value="employer" />
            <el-option label="阿姨求职" value="worker" />
          </el-select>
        </el-col>
        <el-col :xl="3" :lg="4" :md="6" :sm="12" :xs="12">
          <el-select v-model="query.status" placeholder="状态" clearable @change="fetchList">
            <el-option label="待审核" value="pending" />
            <el-option label="公域池" value="approved" />
            <el-option label="已分配" value="assigned" />
            <el-option label="匹配中" value="matching" />
            <el-option label="已派单" value="matched" />
            <el-option label="已完成" value="completed" />
            <el-option label="已拒绝" value="rejected" />
          </el-select>
        </el-col>
        <el-col :xl="5" :lg="6" :md="12" :sm="24" :xs="24">
          <el-date-picker v-model="dateRange" type="daterange" range-separator="至" start-placeholder="开始" end-placeholder="结束" value-format="YYYY-MM-DD" @change="onDateChange" style="width:100%;" />
        </el-col>
        <el-col :xl="4" :lg="4" :md="24" :sm="24" :xs="24">
          <el-button type="primary" @click="fetchList">查询</el-button>
          <el-button @click="resetQuery">重置</el-button>
          <el-button v-if="can('service_orders:view_all')" type="success" plain icon="Download" @click="handleExport">导出</el-button>
        </el-col>
      </el-row>
    </el-card>

    <el-card style="margin-top:16px;">
      <!-- 批量操作栏 -->
      <div v-if="selectedIds.length > 0" style="margin-bottom:12px;display:flex;align-items:center;gap:8px;">
        <span style="color:#999;font-size:13px;">已选 {{ selectedIds.length }} 条</span>
        <el-button v-if="can('service_orders:audit')" size="small" type="success" @click="handleBatchApprove">批量通过</el-button>
        <el-button v-if="can('service_orders:cancel')" size="small" type="danger" @click="handleBatchReject">批量拒绝</el-button>
      </div>

      <el-table :data="list" v-loading="loading" stripe @selection-change="onSelectionChange">
        <el-table-column type="selection" width="40" />
        <el-table-column label="订单号" width="160">
          <template #default="{ row }">
            <span class="order-link" @click="showDetail(row)">{{ row.orderNo }}</span>
          </template>
        </el-table-column>
        <el-table-column label="类型" width="100">
          <template #default="{ row }">
            <el-tag size="small" :type="row.type === 'worker' ? 'success' : 'primary'">{{ row.type === 'worker' ? '阿姨求职' : '雇主发单' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="工种" width="90">
          <template #default="{ row }">{{ row.jobType ? row.jobType.name : '-' }}</template>
        </el-table-column>
        <el-table-column label="发布人" width="100">
          <template #default="{ row }">{{ row.publisher ? row.publisher.nickname : '-' }}</template>
        </el-table-column>
        <el-table-column prop="city" label="城市" width="80" />
        <el-table-column label="薪资" width="140">
          <template #default="{ row }">{{ row.salaryMin }}-{{ row.salaryMax }}元/{{ row.salaryType === 'monthly' ? '月' : '日' }}</template>
        </el-table-column>
        <el-table-column label="负责销售" width="100">
          <template #default="{ row }">
            <span v-if="row.assignedAdmin">{{ row.assignedAdmin.realName || row.assignedAdmin.username }}</span>
            <span v-else style="color:#ccc;">未分配</span>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <el-tag size="small" :type="statusType[row.status]">{{ statusMap[row.status] }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="申请数" width="70" align="center">
          <template #default="{ row }">
            <el-badge :value="row.applicationCount" :max="99" v-if="row.applicationCount > 0" />
            <span v-else style="color:#ccc;">0</span>
          </template>
        </el-table-column>
        <el-table-column label="创建时间" width="160">
          <template #default="{ row }">
            <div style="display:flex;align-items:center;gap:6px;">
              <span>{{ formatDate(row.createdAt) }}</span>
              <el-tag v-if="isOverdue(row)" size="small" type="danger" effect="dark" style="font-size:10px;">超时</el-tag>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="300" fixed="right">
          <template #default="{ row }">
            <el-button v-if="row.status === 'pending' && can('service_orders:audit')" size="small" type="success" @click="handleApprove(row)">通过</el-button>
            <el-button v-if="row.status === 'pending' && can('service_orders:cancel')" size="small" type="danger" @click="handleReject(row)">拒绝</el-button>
            <el-button v-if="row.status === 'approved' && (can('service_orders:assign') || userStore.isSuper)" size="small" type="warning" @click="openAssign(row)">分配</el-button>
            <el-button v-if="(row.status === 'assigned' || row.status === 'matching') && (can('service_orders:dispatch') || userStore.isSuper)" size="small" type="primary" style="background:#5E9FFF !important;color:#fff !important;border:none !important;" @click="showDetail(row, 'ai')">派单</el-button>
            <el-button v-if="row.status === 'matched' && can('service_orders:complete')" size="small" type="primary" style="background:#5E9FFF !important;color:#fff !important;border:none !important;" @click="handleComplete(row)">完成</el-button>
            <el-button v-if="row.status !== 'completed' && row.status !== 'cancelled' && row.status !== 'rejected'" size="small" type="danger" plain @click="handleCancel(row)">取消</el-button>
            <el-button size="small" type="primary" style="background:#5E9FFF !important;color:#fff !important;border:none !important;" @click="showDetail(row)">详情</el-button>
          </template>
        </el-table-column>
      </el-table>
      <div style="margin-top:16px;text-align:right;">
        <el-pagination v-model:current-page="query.page" :page-size="query.pageSize" :total="total" layout="total, prev, pager, next" @current-change="fetchList" />
      </div>
    </el-card>

    <!-- 分配弹窗 -->
    <el-dialog title="分配订单给销售" v-model="assignDialogVisible" width="400px">
      <el-form label-width="80px">
        <el-form-item label="订单号">{{ assignOrder ? assignOrder.orderNo : '' }}</el-form-item>
        <el-form-item label="选择销售" required>
          <el-select v-model="assignAdminId" placeholder="请选择销售" style="width:100%;" filterable>
            <el-option v-for="a in salesAdmins" :key="a.id" :label="(a.realName || a.username) + ' (' + a.role + ')'" :value="a.id" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="assignDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleAssign" :loading="assigning">确认分配</el-button>
      </template>
    </el-dialog>

    <!-- 详情抽屉（含 AI 推荐） -->
    <el-drawer v-model="drawerVisible" title="服务订单详情" size="620px">
      <template v-if="detail">
        <el-tabs v-model="detailTab" @tab-change="onDetailTabChange">
          <!-- Tab 1: 基本信息 -->
          <el-tab-pane label="基本信息" name="info">
            <el-descriptions :column="1" border>
              <el-descriptions-item label="订单号">{{ detail.orderNo }}</el-descriptions-item>
              <el-descriptions-item label="类型">
                <el-tag size="small" :type="detail.type === 'worker' ? 'success' : 'primary'">{{ detail.type === 'worker' ? '阿姨求职' : '雇主发单' }}</el-tag>
              </el-descriptions-item>
              <el-descriptions-item label="工种">{{ detail.jobType ? detail.jobType.name : '-' }}</el-descriptions-item>
              <el-descriptions-item label="发布人">{{ detail.publisher ? detail.publisher.nickname + (detail.publisher.phone ? ' (' + detail.publisher.phone + ')' : '') : '-' }}</el-descriptions-item>
              <el-descriptions-item label="城市">{{ detail.city }}</el-descriptions-item>
              <el-descriptions-item label="薪资">{{ detail.salaryMin }}-{{ detail.salaryMax }}元/{{ detail.salaryType === 'monthly' ? '月' : '日' }}</el-descriptions-item>
              <el-descriptions-item label="服务日期">{{ detail.serviceDate || '-' }}</el-descriptions-item>
              <el-descriptions-item label="联系人">{{ detail.contactName }}</el-descriptions-item>
              <el-descriptions-item label="联系电话">{{ detail.contactPhone }}</el-descriptions-item>
              <el-descriptions-item label="状态">
                <el-tag :type="statusType[detail.status]">{{ statusMap[detail.status] }}</el-tag>
              </el-descriptions-item>
              <el-descriptions-item label="负责销售">
                <span v-if="detail.assignedAdmin">{{ detail.assignedAdmin.realName || detail.assignedAdmin.username }} ({{ detail.assignedAdmin.role }})</span>
                <span v-else style="color:#ccc;">未分配</span>
              </el-descriptions-item>
              <el-descriptions-item label="分配时间" v-if="detail.assignedAt">{{ formatDate(detail.assignedAt) }}</el-descriptions-item>
              <el-descriptions-item label="实际金额" v-if="detail.actualAmount">¥{{ detail.actualAmount }}</el-descriptions-item>
              <el-descriptions-item label="完成时间" v-if="detail.completedAt">{{ formatDate(detail.completedAt) }}</el-descriptions-item>
              <el-descriptions-item label="备注">{{ detail.remark || '-' }}</el-descriptions-item>
              <el-descriptions-item label="匹配阿姨" v-if="detail.acceptedUser">
                {{ detail.acceptedUser.nickname }} ({{ detail.acceptedUser.phone }})
              </el-descriptions-item>
              <el-descriptions-item label="申请数">{{ detail.applicationCount }}</el-descriptions-item>
              <el-descriptions-item label="管理员备注">
                <div v-if="!editingNote" style="display:flex;align-items:center;gap:8px;">
                  <span>{{ detail.adminNote || '-' }}</span>
                  <el-button size="small" link type="primary" @click="editingNote = true; noteText = detail.adminNote || ''">编辑</el-button>
                </div>
                <div v-else style="display:flex;align-items:center;gap:8px;">
                  <el-input v-model="noteText" size="small" style="width:300px;" />
                  <el-button size="small" type="primary" @click="handleSaveNote">保存</el-button>
                  <el-button size="small" @click="editingNote = false">取消</el-button>
                </div>
              </el-descriptions-item>
            </el-descriptions>
            <!-- 操作按钮 -->
            <div style="margin-top:16px;display:flex;gap:8px;flex-wrap:wrap;" v-if="detail.status !== 'completed' && detail.status !== 'cancelled'">
              <el-button type="primary" plain @click="openEditDialog">编辑订单</el-button>
              <el-button type="danger" plain @click="handleCancel(detail)">取消订单</el-button>
            </div>
          </el-tab-pane>

          <!-- Tab: 状态时间线 -->
          <el-tab-pane label="操作时间线" name="timeline">
            <el-timeline>
              <el-timeline-item timestamp="" placement="top" color="#34C759" v-if="detail.createdAt">
                <div class="tl-title">订单创建</div>
                <div class="tl-desc">用户提交了{{ detail.type === 'worker' ? '求职意向' : '用工需求' }}</div>
                <div class="tl-time">{{ formatDate(detail.createdAt) }}</div>
              </el-timeline-item>
              <el-timeline-item v-if="detail.status !== 'pending'" color="#5E9FFF" placement="top">
                <div class="tl-title">{{ detail.status === 'rejected' ? '审核拒绝' : '审核通过' }}</div>
                <div class="tl-desc" v-if="detail.rejectReason">原因：{{ detail.rejectReason }}</div>
                <div class="tl-time">{{ formatDate(detail.approvedAt || detail.updatedAt) }}</div>
              </el-timeline-item>
              <el-timeline-item v-if="detail.assignedAt" color="#FF9F0A" placement="top">
                <div class="tl-title">分配销售</div>
                <div class="tl-desc">分配给 {{ detail.assignedAdmin ? (detail.assignedAdmin.realName || detail.assignedAdmin.username) : '-' }}</div>
                <div class="tl-time">{{ formatDate(detail.assignedAt) }}</div>
              </el-timeline-item>
              <el-timeline-item v-if="detail.acceptedUser" color="#AF52DE" placement="top">
                <div class="tl-title">已派单</div>
                <div class="tl-desc">匹配阿姨：{{ detail.acceptedUser.nickname }} {{ detail.acceptedUser.phone ? '(' + detail.acceptedUser.phone + ')' : '' }}</div>
              </el-timeline-item>
              <el-timeline-item v-if="detail.completedAt" color="#34C759" placement="top">
                <div class="tl-title">订单完成</div>
                <div class="tl-desc" v-if="detail.actualAmount">实际金额：¥{{ detail.actualAmount }}</div>
                <div class="tl-time">{{ formatDate(detail.completedAt) }}</div>
              </el-timeline-item>
              <el-timeline-item v-if="detail.status === 'cancelled'" color="#FF3B30" placement="top">
                <div class="tl-title">订单取消</div>
                <div class="tl-desc" v-if="detail.cancelReason">原因：{{ detail.cancelReason }}</div>
              </el-timeline-item>
              <el-timeline-item v-if="isOverdue(detail)" color="#FF3B30" placement="top">
                <div class="tl-title" style="color:#FF3B30;">⚠️ 超时预警</div>
                <div class="tl-desc" style="color:#FF3B30;">{{ getOverdueText(detail) }}</div>
              </el-timeline-item>
            </el-timeline>
          </el-tab-pane>

          <!-- Tab 2: 接单申请 -->
          <el-tab-pane name="applications">
            <template #label>
              接单申请 <el-badge :value="detail.applicationCount" :max="99" v-if="detail.applicationCount > 0" style="margin-left:4px;" />
            </template>
            <div v-if="applications.length === 0" style="text-align:center;color:#999;padding:40px 0;">暂无接单申请</div>
            <div v-for="app in applications" :key="app.id" class="app-card">
              <div class="app-header">
                <div class="app-user">
                  <el-avatar :src="app.applicant ? app.applicant.avatar : ''" :size="36">{{ app.applicant ? app.applicant.nickname.charAt(0) : '?' }}</el-avatar>
                  <div class="app-info">
                    <div class="app-name">{{ app.applicant ? app.applicant.nickname : '未知' }} <el-tag v-if="app.applicant && app.applicant.isRealAuth" size="small" type="success">已实名</el-tag></div>
                    <div class="app-meta">{{ app.applicant ? app.applicant.city : '' }} · 历史接单 {{ app.historyAccepted || 0 }} 次</div>
                  </div>
                </div>
                <el-tag size="small" :type="app.status === 'accepted' ? 'success' : app.status === 'rejected' ? 'danger' : 'warning'">{{ {pending:'待处理',accepted:'已接受',rejected:'已拒绝'}[app.status] }}</el-tag>
              </div>
              <div v-if="app.message" class="app-message">留言：{{ app.message }}</div>
              <div class="app-actions" v-if="app.status === 'pending' && can('service_orders:dispatch')">
                <el-button size="small" type="success" @click="handleAcceptApp(app)">确认派单</el-button>
                <el-button size="small" type="danger" @click="handleRejectApp(app)">拒绝</el-button>
              </div>
            </div>
          </el-tab-pane>

          <!-- Tab 3: AI 智能推荐 -->
          <el-tab-pane name="ai">
            <template #label>
              <span>🤖 AI 推荐</span>
            </template>
            <div class="ai-header">
              <div class="ai-title">智能候选人推荐</div>
              <div style="display:flex;gap:8px;">
                <el-button size="small" @click="fetchRecommendations" :loading="aiLoading">规则推荐</el-button>
                <el-button size="small" type="success" @click="fetchAIRecommendations" :loading="aiSmartLoading">⚡ AI 智能推荐</el-button>
              </div>
            </div>
            <div class="ai-desc">
              <span v-if="!aiSummary">基于工种、城市、薪资、历史成功率、闺蜜圈等多维度综合评分。点击「⚡ AI 智能推荐」获取 AI 生成的个性化推荐理由。</span>
              <span v-else style="color:#409eff;">🤖 {{ aiSummary }}</span>
            </div>

            <div v-loading="aiLoading || aiSmartLoading" :element-loading-text="aiSmartLoading ? 'AI 正在分析候选人...' : '加载中...'">
              <div v-if="recommendations.length === 0 && !aiLoading && !aiSmartLoading" style="text-align:center;color:#999;padding:40px 0;">暂无推荐候选人</div>
              <div v-for="(rec, idx) in recommendations" :key="rec.userId" class="rec-card" :class="{ 'rec-unavailable': !rec.available }">
                <div class="rec-rank">{{ idx + 1 }}</div>
                <div class="rec-body">
                  <div class="rec-top">
                    <div class="rec-user">
                      <el-avatar :src="rec.avatar" :size="40">{{ rec.nickname ? rec.nickname.charAt(0) : '?' }}</el-avatar>
                      <div class="rec-info">
                        <div class="rec-name">
                          {{ rec.nickname || '未知' }}
                          <el-tag v-if="rec.isGuimiMember" size="small" type="danger" effect="plain" style="margin-left:4px;">👭 闺蜜圈</el-tag>
                          <el-tag v-if="rec.isRealAuth" size="small" type="success" effect="plain" style="margin-left:4px;">已实名</el-tag>
                        </div>
                        <div class="rec-meta">{{ rec.city || '未设置城市' }}</div>
                      </div>
                    </div>
                    <div class="rec-score">
                      <div class="rec-percent" :style="{ color: rec.matchPercent >= 70 ? '#67c23a' : rec.matchPercent >= 40 ? '#e6a23c' : '#f56c6c' }">{{ rec.matchPercent }}%</div>
                      <div class="rec-score-label">匹配度</div>
                    </div>
                  </div>
                  <!-- AI 推荐理由 -->
                  <div v-if="rec.aiReason" class="rec-ai-reason">
                    <span class="rec-ai-badge">🤖 AI</span>
                    <span>{{ rec.aiReason }}</span>
                    <el-tag v-if="rec.aiHighlight" size="small" effect="dark" type="warning" style="margin-left:6px;">{{ rec.aiHighlight }}</el-tag>
                  </div>
                  <div class="rec-tags">
                    <el-tag v-for="tag in rec.tags" :key="tag" size="small" effect="plain" style="margin:2px;">{{ tag }}</el-tag>
                    <el-tag v-if="!rec.available" size="small" type="danger" effect="plain" style="margin:2px;">⚠️ 有进行中订单({{ rec.activeOrderCount }})</el-tag>
                  </div>
                  <!-- 点击展开联系方式 + 评分明细 -->
                  <el-collapse v-model="rec._expanded" style="margin-top:8px;">
                    <el-collapse-item title="📞 联系方式 & 评分明细" :name="rec.userId">
                      <div v-if="rec.detail" class="rec-contact">
                        <div>📱 手机: <strong>{{ rec.detail.phone || '未设置' }}</strong></div>
                        <div>📌 真实姓名: <strong>{{ rec.detail.realName || '未实名' }}</strong></div>
                        <div>⭐ 管理评分: {{ rec.detail.adminScore || 0 }}/100</div>
                      </div>
                      <div v-else class="rec-contact">
                        <div>📱 手机: <strong>{{ rec.phone || '未设置' }}</strong></div>
                        <div v-if="rec.realName">📌 真实姓名: <strong>{{ rec.realName }}</strong></div>
                      </div>
                      <div class="rec-breakdown" v-if="rec.breakdown || (rec.detail && rec.detail.breakdown)">
                        <div class="bd-item" v-for="(val, key) in (rec.detail ? rec.detail.breakdown : rec.breakdown)" :key="key">
                          <span class="bd-label">{{ {jobType:'工种',city:'城市',salary:'薪资',successRate:'成功率',auth:'实名',adminScore:'管理评',guimiCircle:'闺蜜圈'}[key] || key }}</span>
                          <el-progress :percentage="Math.min(100, Math.round(val.score / (key === 'jobType' ? 25 : key === 'city' ? 20 : key === 'salary' ? 15 : key === 'successRate' ? 15 : key === 'adminScore' ? 15 : key === 'guimiCircle' ? 15 : 10) * 100))" :stroke-width="8" style="flex:1;margin:0 8px;" />
                          <span class="bd-reason">{{ val.reason }}</span>
                        </div>
                      </div>
                    </el-collapse-item>
                  </el-collapse>
                  <div class="rec-actions" v-if="rec.available && can('service_orders:dispatch')">
                    <el-button size="small" type="primary" @click="handleQuickDispatch(rec)">确认派单给TA</el-button>
                  </div>
                </div>
              </div>
            </div>

            <div v-if="aiMeta.totalCandidates" class="ai-footer">
              共扫描 {{ aiMeta.totalCandidates }} 位候选人，展示 TOP {{ recommendations.length }} 推荐
              <span v-if="aiMeta.guimiCircleMemberCount > 0">· 闺蜜圈成员 {{ aiMeta.guimiCircleMemberCount }} 人</span>
            </div>
          </el-tab-pane>

          <!-- Tab: 跟进记录 -->
          <el-tab-pane name="followup">
            <template #label>
              <span>跟进记录</span>
              <el-badge v-if="followUps.length > 0" :value="followUps.length" :max="99" style="margin-left:4px;" />
            </template>
            <!-- 添加跟进表单 -->
            <div class="followup-input">
              <el-input v-model="followUpText" type="textarea" :rows="2" placeholder="输入跟进内容（如：已联系客户，确认需求）" maxlength="500" show-word-limit />
              <div style="margin-top:8px;display:flex;justify-content:flex-end;">
                <el-button type="primary" size="small" :loading="followUpSubmitting" @click="handleAddFollowUp" :disabled="!followUpText.trim()">添加跟进</el-button>
              </div>
            </div>
            <!-- 跟进列表 -->
            <div v-loading="followUpLoading">
              <div v-if="followUps.length === 0 && !followUpLoading" style="text-align:center;color:#999;padding:30px 0;">暂无跟进记录</div>
              <div v-for="f in followUps" :key="f.id" class="followup-card">
                <div class="fu-header">
                  <span class="fu-admin">{{ f.adminName }}</span>
                  <span class="fu-time">{{ formatDate(f.createdAt) }}</span>
                </div>
                <div class="fu-content">{{ f.content }}</div>
                <div v-if="f.attachments && f.attachments.length > 0" class="fu-attachments">
                  <el-tag v-for="(a, idx) in f.attachments" :key="idx" size="small" effect="plain" style="margin:2px;">
                    <a :href="a" target="_blank" style="text-decoration:none;color:inherit;">附件{{ idx + 1 }}</a>
                  </el-tag>
                </div>
              </div>
            </div>
          </el-tab-pane>
        </el-tabs>
      </template>
    </el-drawer>

    <!-- 编辑订单弹窗 -->
    <el-dialog title="编辑订单" v-model="editDialogVisible" width="500px">
      <el-form :model="editForm" label-width="90px">
        <el-form-item label="联系人">
          <el-input v-model="editForm.contactName" />
        </el-form-item>
        <el-form-item label="联系电话">
          <el-input v-model="editForm.contactPhone" />
        </el-form-item>
        <el-form-item label="城市">
          <el-input v-model="editForm.city" />
        </el-form-item>
        <el-form-item label="最低薪资">
          <el-input-number v-model="editForm.salaryMin" :min="0" style="width:100%;" />
        </el-form-item>
        <el-form-item label="最高薪资">
          <el-input-number v-model="editForm.salaryMax" :min="0" style="width:100%;" />
        </el-form-item>
        <el-form-item label="服务日期">
          <el-input v-model="editForm.serviceDate" placeholder="如：2026-05-01起" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="editForm.remark" type="textarea" :rows="2" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSaveEdit" :loading="editSaving">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, watch } from 'vue'
import { getAiRecommendations } from '../../api/ai.js'
import { useRoute } from 'vue-router'
import {
  getServiceOrders, getServiceOrder, approveServiceOrder,
  rejectServiceOrder, completeServiceOrder, assignServiceOrder,
  getMyPerformance, getRecommendations, getApplications,
  acceptApplication, rejectApplication,
  editServiceOrder, cancelServiceOrder, updateOrderNote,
  quickDispatch, batchApprove, batchReject,
  getFollowUps, addFollowUp
} from '../../api/serviceOrders.js'
import { getSalesAdmins } from '../../api/system.js'
import { useUserStore, hasPermission } from '../../store/user.js'
import { ElMessage, ElMessageBox } from 'element-plus'

const userStore = useUserStore()
function can(code) { return hasPermission(userStore, code) }

const list = ref([])
const total = ref(0)
const loading = ref(false)
const drawerVisible = ref(false)
const detail = ref(null)
const dateRange = ref([])
const perf = ref({})
const salesAdmins = ref([])
const assignDialogVisible = ref(false)
const assignOrder = ref(null)
const assignAdminId = ref(null)
const assigning = ref(false)

const query = reactive({ keyword: '', type: '', status: '', startDate: '', endDate: '', page: 1, pageSize: 10 })
const statusMap = { pending: '待审核', approved: '待分配', assigned: '待派单', matching: '匹配中', matched: '已派单', completed: '已完成', rejected: '已拒绝', cancelled: '已取消' }
const statusType = { pending: 'warning', approved: 'info', assigned: 'primary', matching: 'primary', matched: 'success', completed: '', rejected: 'danger', cancelled: 'info' }

function formatDate(d) {
  if (!d) return ''
  var dt = new Date(d)
  return dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0') + '-' + String(dt.getDate()).padStart(2, '0') + ' ' + String(dt.getHours()).padStart(2, '0') + ':' + String(dt.getMinutes()).padStart(2, '0')
}

// 超时判断：待审核>2h、待分配>4h
function isOverdue(row) {
  if (!row || !row.createdAt) return false
  var now = Date.now()
  var created = new Date(row.createdAt).getTime()
  var hoursElapsed = (now - created) / 3600000
  if (row.status === 'pending' && hoursElapsed > 2) return true
  if (row.status === 'approved' && hoursElapsed > 4) return true
  return false
}

function getOverdueText(row) {
  if (!row || !row.createdAt) return ''
  var hours = Math.floor((Date.now() - new Date(row.createdAt).getTime()) / 3600000)
  if (row.status === 'pending') return '待审核已超过 ' + hours + ' 小时（阈值 2 小时）'
  if (row.status === 'approved') return '待分配已超过 ' + hours + ' 小时（阈值 4 小时）'
  return ''
}

function onDateChange(val) {
  if (val && val.length === 2) { query.startDate = val[0]; query.endDate = val[1] }
  else { query.startDate = ''; query.endDate = '' }
  fetchList()
}

async function fetchList() {
  loading.value = true
  try {
    const res = await getServiceOrders(query)
    list.value = res.data.list
    total.value = res.data.total
  } catch (e) { ElMessage.error('加载订单列表失败') } finally { loading.value = false }
}

function resetQuery() {
  query.keyword = ''; query.type = ''; query.status = ''; query.startDate = ''; query.endDate = ''; query.page = 1
  dateRange.value = []
  fetchList()
}

async function fetchPerformance() {
  try {
    const res = await getMyPerformance()
    perf.value = res.data || {}
  } catch (e) { ElMessage.error('加载业绩数据失败') }
}

async function fetchSalesAdmins() {
  try {
    const res = await getSalesAdmins()
    salesAdmins.value = res.data || []
  } catch (e) { ElMessage.error('加载销售列表失败') }
}

async function handleApprove(row) {
  await ElMessageBox.confirm('确认审核通过订单「' + row.orderNo + '」？', '审核确认', { type: 'success' })
  await approveServiceOrder(row.id, {})
  ElMessage({ message: '✅ 审核通过，订单已进入「待分配」状态，请前往待分配列表分配销售', type: 'success', duration: 4000 })
  fetchList()
}

async function handleReject(row) {
  const { value } = await ElMessageBox.prompt('请输入拒绝原因', '拒绝订单 — ' + row.orderNo, { inputPlaceholder: '不符合发布要求' })
  await rejectServiceOrder(row.id, { reason: value || '不符合发布要求' })
  ElMessage.success('已拒绝')
  fetchList()
}

function openAssign(row) {
  assignOrder.value = row
  assignAdminId.value = row.assignedAdminId || null
  assignDialogVisible.value = true
}

async function handleAssign() {
  if (!assignAdminId.value) { ElMessage.warning('请选择销售'); return }
  assigning.value = true
  try {
    await assignServiceOrder(assignOrder.value.id, { adminId: assignAdminId.value })
    var adminName = salesAdmins.value.find(function(a) { return a.id === assignAdminId.value })
    ElMessage({ message: '✅ 已分配给' + (adminName ? (adminName.realName || adminName.username) : '') + '，订单进入「待派单」状态', type: 'success', duration: 4000 })
    assignDialogVisible.value = false
    fetchList()
  } catch (e) { ElMessage.error('分配失败: ' + (e?.response?.data?.msg || e.message || '未知错误')) } finally { assigning.value = false }
}

async function handleComplete(row) {
  try {
    const { value } = await ElMessageBox.prompt('请输入实际服务金额（元）', '完成订单 — ' + row.orderNo, {
      inputValue: '0',
      inputPlaceholder: '实际金额，用于业绩统计',
      inputPattern: /^\d+(\.\d{1,2})?$/,
      inputErrorMessage: '请输入有效金额'
    })
    await completeServiceOrder(row.id, { actualAmount: parseFloat(value || 0) })
    ElMessage.success('已完成')
    fetchList()
    fetchPerformance()
  } catch (e) {}
}

async function showDetail(row, defaultTab) {
  try {
    const res = await getServiceOrder(row.id)
    detail.value = res.data
    detailTab.value = defaultTab || 'info'
    recommendations.value = []
    applications.value = []
    followUps.value = []
    followUpText.value = ''
    drawerVisible.value = true
    // 如果直接打开 AI 推荐 tab，自动加载推荐
    if (defaultTab === 'ai') {
      fetchAIRecommendations()
    }
  } catch (e) {}
}

// ==================== AI 推荐相关 ====================
const detailTab = ref('info')
const recommendations = ref([])
const applications = ref([])
const aiLoading = ref(false)
const aiSmartLoading = ref(false)
const aiMeta = ref({})
const aiSummary = ref('')

function onDetailTabChange(tab) {
  if (tab === 'ai' && recommendations.value.length === 0 && detail.value) {
    fetchRecommendations()
  }
  if (tab === 'applications' && applications.value.length === 0 && detail.value) {
    fetchApplications()
  }
  if (tab === 'followup' && followUps.value.length === 0 && detail.value) {
    fetchFollowUpList()
  }
}

// ==================== 跟进记录 ====================
const followUps = ref([])
const followUpText = ref('')
const followUpLoading = ref(false)
const followUpSubmitting = ref(false)

async function fetchFollowUpList() {
  if (!detail.value) return
  followUpLoading.value = true
  try {
    var res = await getFollowUps(detail.value.id)
    followUps.value = res.data || []
  } catch (e) {} finally { followUpLoading.value = false }
}

async function handleAddFollowUp() {
  if (!detail.value || !followUpText.value.trim()) return
  followUpSubmitting.value = true
  try {
    await addFollowUp(detail.value.id, { content: followUpText.value.trim() })
    ElMessage.success('跟进记录已添加')
    followUpText.value = ''
    await fetchFollowUpList()
  } catch (e) { ElMessage.error('添加失败') }
  finally { followUpSubmitting.value = false }
}

// 规则推荐（复用现有 matchEngine）
async function fetchRecommendations() {
  if (!detail.value) return
  aiLoading.value = true
  aiSummary.value = ''
  try {
    const res = await getRecommendations(detail.value.id)
    var recs = (res.data.recommendations || []).map(function(r) { r._expanded = []; return r })
    recommendations.value = recs
    aiMeta.value = { totalCandidates: res.data.totalCandidates }
  } catch (e) {
    ElMessage.error('推荐加载失败')
  } finally { aiLoading.value = false }
}

// ⚡ AI 智能推荐（调用 OpenClaw 生成推荐理由）
async function fetchAIRecommendations() {
  if (!detail.value) return
  aiSmartLoading.value = true
  aiSummary.value = ''
  try {
    var data = await getAiRecommendations(detail.value.id, 15)
    var recs = (data.recommendations || []).map(function(r) { r._expanded = []; return r })
    recommendations.value = recs
    aiMeta.value = {
      totalCandidates: data.totalCandidates,
      guimiCircleMemberCount: data.guimiCircleMemberCount || 0
    }
    aiSummary.value = data.aiSummary || ''
    ElMessage.success('AI 智能推荐完成')
  } catch (e) {
    ElMessage.error('AI 推荐失败: ' + (e.message || '未知错误'))
  } finally { aiSmartLoading.value = false }
}

async function fetchApplications() {
  if (!detail.value) return
  try {
    const res = await getApplications(detail.value.id)
    applications.value = res.data.list || res.data || []
  } catch (e) {}
}

// 从 AI 推荐直接派单（调用后端 quick-dispatch API）
async function handleQuickDispatch(rec) {
  try {
    await ElMessageBox.confirm(
      '确认将此订单直接派给「' + rec.nickname + '」？\n匹配度: ' + rec.matchPercent + '%',
      'AI 推荐派单', { type: 'warning', confirmButtonText: '确认派单' }
    )
    await quickDispatch(detail.value.id, { userId: rec.userId })
    ElMessage.success('派单成功！已通知「' + rec.nickname + '」')
    // 刷新详情和列表
    var res = await getServiceOrder(detail.value.id)
    detail.value = res.data
    fetchList()
  } catch (e) {
    if (e !== 'cancel' && e?.message) ElMessage.error(e.message || '派单失败')
  }
}

// 接受接单申请
async function handleAcceptApp(app) {
  try {
    await ElMessageBox.confirm('确认接受「' + (app.applicant ? app.applicant.nickname : '') + '」的接单申请？', '派单确认', { type: 'success' })
    await acceptApplication(app.id, {})
    ElMessage.success('派单成功')
    fetchApplications()
    fetchList()
    // 刷新详情
    if (detail.value) {
      const res = await getServiceOrder(detail.value.id)
      detail.value = res.data
    }
  } catch (e) {}
}

// 拒绝接单申请
async function handleRejectApp(app) {
  try {
    const { value } = await ElMessageBox.prompt('请输入拒绝原因（可选）', '拒绝申请')
    await rejectApplication(app.id, { adminNote: value || '' })
    ElMessage.success('已拒绝')
    fetchApplications()
  } catch (e) {}
}

// 导出 CSV
function handleExport() {
  var token = localStorage.getItem('token')
  var params = new URLSearchParams()
  if (query.status) params.append('status', query.status)
  if (query.type) params.append('type', query.type)
  var baseUrl = import.meta.env.VITE_API_BASE || '/api'
  var url = baseUrl + '/service-orders/export/csv?' + params.toString()
  // 通过隐藏 a 标签触发下载
  var a = document.createElement('a')
  // 使用 fetch 带 token 下载
  fetch(url, { headers: { 'Authorization': 'Bearer ' + token } })
    .then(function(res) { return res.blob() })
    .then(function(blob) {
      var link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = 'service_orders_' + Date.now() + '.csv'
      link.click()
      ElMessage.success('导出成功')
    })
    .catch(function() { ElMessage.error('导出失败') })
}

// ==================== 取消订单 ====================
async function handleCancel(row) {
  try {
    const { value } = await ElMessageBox.prompt('请输入取消原因', '取消订单 — ' + row.orderNo, {
      inputPlaceholder: '如：客户主动取消',
      confirmButtonText: '确认取消',
      confirmButtonClass: 'el-button--danger'
    })
    await cancelServiceOrder(row.id, { reason: value || '管理员取消' })
    ElMessage.success('订单已取消')
    fetchList()
    if (detail.value && detail.value.id === row.id) {
      var res = await getServiceOrder(row.id)
      detail.value = res.data
    }
  } catch (e) {}
}

// ==================== 管理员备注编辑 ====================
const editingNote = ref(false)
const noteText = ref('')

async function handleSaveNote() {
  if (!detail.value) return
  try {
    await updateOrderNote(detail.value.id, { adminNote: noteText.value })
    detail.value.adminNote = noteText.value
    editingNote.value = false
    ElMessage.success('备注已保存')
  } catch (e) { ElMessage.error('保存失败') }
}

// ==================== 编辑订单弹窗 ====================
const editDialogVisible = ref(false)
const editForm = reactive({ contactName: '', contactPhone: '', city: '', salaryMin: 0, salaryMax: 0, serviceDate: '', remark: '' })
const editSaving = ref(false)

function openEditDialog() {
  if (!detail.value) return
  Object.assign(editForm, {
    contactName: detail.value.contactName || '',
    contactPhone: detail.value.contactPhone || '',
    city: detail.value.city || '',
    salaryMin: detail.value.salaryMin || 0,
    salaryMax: detail.value.salaryMax || 0,
    serviceDate: detail.value.serviceDate || '',
    remark: detail.value.remark || ''
  })
  editDialogVisible.value = true
}

async function handleSaveEdit() {
  // 薪资非负校验
  if (editForm.salaryMin < 0 || editForm.salaryMax < 0) return ElMessage.warning('薪资不能为负数')
  if (editForm.salaryMin > editForm.salaryMax && editForm.salaryMax > 0) return ElMessage.warning('最低薪资不能高于最高薪资')
  editSaving.value = true
  try {
    await editServiceOrder(detail.value.id, editForm)
    ElMessage.success('订单已更新')
    editDialogVisible.value = false
    // 刷新详情
    var res = await getServiceOrder(detail.value.id)
    detail.value = res.data
    fetchList()
  } catch (e) { ElMessage.error('编辑失败') } finally { editSaving.value = false }
}

// ==================== 批量操作 ====================
const selectedIds = ref([])

function onSelectionChange(rows) {
  selectedIds.value = rows.map(function(r) { return r.id })
}

async function handleBatchApprove() {
  await ElMessageBox.confirm('确认批量审核通过 ' + selectedIds.value.length + ' 条订单？', '批量审核', { type: 'success' })
  try {
    var res = await batchApprove({ ids: selectedIds.value })
    ElMessage.success('批量审核完成，影响 ' + (res.data.affected || 0) + ' 条')
    fetchList()
  } catch (e) {}
}

async function handleBatchReject() {
  try {
    const { value } = await ElMessageBox.prompt('请输入批量拒绝原因', '批量拒绝 ' + selectedIds.value.length + ' 条', {
      inputPlaceholder: '不符合发布要求'
    })
    var res = await batchReject({ ids: selectedIds.value, reason: value || '批量拒绝' })
    ElMessage.success('批量拒绝完成，影响 ' + (res.data.affected || 0) + ' 条')
    fetchList()
  } catch (e) {}
}

const route = useRoute()

// 从 URL query 参数初始化筛选状态
function syncQueryFromRoute() {
  if (route.query.status) {
    query.status = route.query.status
  }
}

// 监听路由 query 变化（侧边栏切换待审核/待派单）
watch(() => route.query, (newQuery) => {
  if (newQuery.status !== undefined) {
    query.status = newQuery.status || ''
  } else {
    query.status = ''
  }
  query.page = 1
  fetchList()
}, { deep: true })

onMounted(() => {
  syncQueryFromRoute()
  fetchList()
  fetchPerformance()
  fetchSalesAdmins()
})
</script>

<style scoped>
.filter-card { margin-bottom: 0; }

/* 订单号链接 */
.order-link {
  color: #409eff;
  cursor: pointer;
  font-weight: 500;
  transition: color 0.2s;
}
.order-link:hover {
  color: #337ecc;
  text-decoration: underline;
}

/* 业绩卡片 */
.perf-cards { display: flex; gap: 16px; margin-bottom: 16px; }
.perf-card {
  flex: 1;
  background: #fff;
  border-radius: var(--radius-md, 12px);
  padding: 20px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.06);
  text-align: center;
}
.pc-label { font-size: 12px; color: var(--gray-400, #999); margin-bottom: 8px; }
.pc-value { font-size: 24px; font-weight: 700; color: var(--gray-900, #1d1d1f); }

/* 接单申请卡片 */
.app-card {
  border: 1px solid #ebeef5;
  border-radius: 8px;
  padding: 12px 16px;
  margin-bottom: 12px;
}
.app-header { display: flex; align-items: center; justify-content: space-between; }
.app-user { display: flex; align-items: center; gap: 10px; }
.app-info { flex: 1; }
.app-name { font-weight: 600; font-size: 14px; display: flex; align-items: center; gap: 6px; }
.app-meta { font-size: 12px; color: #999; margin-top: 2px; }
.app-message { font-size: 13px; color: #666; margin-top: 8px; padding: 6px 8px; background: #f5f7fa; border-radius: 4px; }
.app-actions { margin-top: 10px; display: flex; gap: 8px; justify-content: flex-end; }

/* AI 推荐区域 */
.ai-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px; }
.ai-title { font-weight: 700; font-size: 15px; }
.ai-desc { font-size: 12px; color: #999; margin-bottom: 16px; }
.ai-footer { text-align: center; font-size: 12px; color: #999; margin-top: 16px; padding: 8px; }

/* 推荐候选人卡片 */
.rec-card {
  display: flex;
  border: 1px solid #ebeef5;
  border-radius: 10px;
  padding: 14px;
  margin-bottom: 12px;
  transition: box-shadow 0.2s;
}
.rec-card:hover { box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
.rec-unavailable { opacity: 0.55; }
.rec-rank {
  width: 28px; height: 28px;
  border-radius: 50%;
  background: linear-gradient(135deg, #409eff, #67c23a);
  color: #fff; font-weight: 700; font-size: 13px;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0; margin-right: 12px; margin-top: 6px;
}
.rec-card:nth-child(1) .rec-rank { background: linear-gradient(135deg, #f7ba2a, #ff6b6b); }
.rec-card:nth-child(2) .rec-rank { background: linear-gradient(135deg, #909399, #c0c4cc); }
.rec-card:nth-child(3) .rec-rank { background: linear-gradient(135deg, #cd7f32, #e6a23c); }
.rec-body { flex: 1; min-width: 0; }
.rec-top { display: flex; align-items: center; justify-content: space-between; }
.rec-user { display: flex; align-items: center; gap: 10px; flex: 1; min-width: 0; }
.rec-info { flex: 1; min-width: 0; }
.rec-name { font-weight: 600; font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.rec-meta { font-size: 12px; color: #999; margin-top: 2px; }
.rec-score { text-align: center; flex-shrink: 0; margin-left: 8px; }
.rec-percent { font-size: 22px; font-weight: 800; }
.rec-score-label { font-size: 11px; color: #999; }
.rec-tags { margin-top: 8px; }
.rec-actions { margin-top: 10px; display: flex; justify-content: flex-end; }

/* 评分明细 */
.rec-breakdown { padding: 4px 0; }
.bd-item { display: flex; align-items: center; margin-bottom: 6px; font-size: 12px; }
.bd-label { width: 50px; color: #666; flex-shrink: 0; }
.bd-reason { width: 110px; color: #999; flex-shrink: 0; text-align: right; font-size: 11px; }

/* AI 推荐理由 */
.rec-ai-reason {
  margin-top: 8px; padding: 8px 12px;
  background: linear-gradient(135deg, rgba(103,194,58,0.06), rgba(64,158,255,0.06));
  border: 1px solid rgba(103,194,58,0.15); border-radius: 8px;
  font-size: 13px; color: #333; line-height: 1.6;
  display: flex; align-items: flex-start; gap: 6px; flex-wrap: wrap;
}
.rec-ai-badge {
  background: linear-gradient(135deg, #67c23a, #409eff);
  color: #fff; font-size: 10px; font-weight: 700;
  padding: 2px 6px; border-radius: 4px; flex-shrink: 0;
  line-height: 1.4;
}

/* 联系方式区域 */
.rec-contact {
  background: #f9fafb; border-radius: 6px; padding: 10px 12px;
  margin-bottom: 10px; font-size: 13px; line-height: 2;
  border: 1px dashed #e5e7eb;
}

/* 响应式适配 */
@media (max-width: 1440px) {
  .perf-cards { gap: 12px; }
  .perf-card { padding: 16px; }
  .pc-value { font-size: 20px; }
}

@media (max-width: 1200px) {
  .perf-cards { flex-wrap: wrap; }
  .perf-card { flex: 0 0 calc(33.33% - 8px); }
  .pc-value { font-size: 18px; }
}

@media (max-width: 768px) {
  .perf-card { flex: 0 0 calc(50% - 6px); padding: 12px; }
  .pc-value { font-size: 16px; }
  .pc-label { font-size: 11px; }
}

/* 时间线样式 */
.tl-title { font-weight: 600; font-size: 14px; color: var(--gray-900, #1d1d1f); }
.tl-desc { font-size: 13px; color: var(--gray-500, #8e8e93); margin-top: 4px; }
.tl-time { font-size: 12px; color: var(--gray-400, #aeaeb2); margin-top: 2px; }

/* 跟进记录样式 */
.followup-input {
  background: #f5f7fa; border-radius: 8px; padding: 12px;
  margin-bottom: 16px;
}
.followup-card {
  border-left: 3px solid #409eff; padding: 10px 14px;
  margin-bottom: 10px; background: #fafafa; border-radius: 0 6px 6px 0;
  transition: background 0.2s;
}
.followup-card:hover { background: #f0f7ff; }
.fu-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
.fu-admin { font-weight: 600; font-size: 13px; color: #409eff; }
.fu-time { font-size: 11px; color: #c0c4cc; }
.fu-content { font-size: 13px; color: #303133; line-height: 1.6; white-space: pre-wrap; }
.fu-attachments { margin-top: 6px; }
</style>
