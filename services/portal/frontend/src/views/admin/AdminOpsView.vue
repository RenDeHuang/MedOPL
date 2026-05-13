<template>
  <AppLayout title="服务状态" subtitle="管理员只读视图">
    <div class="space-y-6">
      <div v-if="!payload" class="card p-8 text-sm text-gray-500 dark:text-slate-400">正在加载运营数据...</div>
      <template v-else>
        <section class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="账号" :value="payload.summary.accountCount" hint="纳入运营视图" />
          <MetricCard label="工作空间" :value="payload.summary.workspaceCount" hint="全部可见归属" />
          <MetricCard label="当前运行" :value="payload.summary.currentRunCount" hint="进行中的会话 / 任务" />
          <MetricCard label="费用估算" :value="money(payload.summary.estimatedCost)" hint="只读估算，不扣费" />
        </section>

        <section class="grid grid-cols-1 gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <div class="card p-6">
            <div class="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 class="panel-title">账号状态</h2>
                <p class="panel-subtitle">账号状态、工作空间数量和余额摘要。</p>
              </div>
              <span class="badge badge-primary">只读</span>
            </div>
            <div class="mt-5 mobile-card-list">
              <div v-for="item in payload.accountOperations.accounts" :key="item.accountId" class="mobile-only-card">
                <div class="flex items-start justify-between gap-3">
                  <div class="min-w-0">
                    <div class="font-medium text-gray-950 dark:text-white">{{ item.accountName }}</div>
                    <div class="mt-1 truncate text-xs text-gray-500 dark:text-slate-400">{{ item.email }}</div>
                  </div>
                  <span class="badge shrink-0" :class="item.accessStatus === '开通' ? 'badge-success' : 'badge-warning'">{{ item.accessStatus }}</span>
                </div>
                <div class="mt-3 grid grid-cols-2 gap-2 text-xs text-gray-500 dark:text-slate-400">
                  <div><span class="block text-gray-400 dark:text-slate-500">工作空间</span>{{ item.workspaceCount }}</div>
                  <div><span class="block text-gray-400 dark:text-slate-500">余额</span>{{ money(item.wallet.balance) }}</div>
                  <div><span class="block text-gray-400 dark:text-slate-500">冻结金额</span>{{ money(item.wallet.frozenAmount) }}</div>
                </div>
              </div>
              <div v-if="!payload.accountOperations.accounts.length" class="empty-state">暂无账号记录</div>
            </div>
            <div class="mt-5 desktop-table-shell">
              <table class="min-w-[720px] text-sm">
                <thead>
                  <tr class="table-head">
                    <th class="px-4 py-3">账号</th>
                    <th class="px-4 py-3">状态</th>
                    <th class="px-4 py-3">工作空间</th>
                    <th class="px-4 py-3">余额</th>
                    <th class="px-4 py-3">冻结金额</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="item in payload.accountOperations.accounts" :key="item.accountId" class="table-row">
                    <td class="px-4 py-3">
                      <div class="font-medium text-gray-950 dark:text-white">{{ item.accountName }}</div>
                      <div class="text-xs text-gray-500 dark:text-slate-400">{{ item.email }}</div>
                    </td>
                    <td class="px-4 py-3"><span class="badge" :class="item.accessStatus === '开通' ? 'badge-success' : 'badge-warning'">{{ item.accessStatus }}</span></td>
                    <td class="px-4 py-3">{{ item.workspaceCount }}</td>
                    <td class="px-4 py-3">{{ money(item.wallet.balance) }}</td>
                    <td class="px-4 py-3">{{ money(item.wallet.frozenAmount) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div class="card p-6">
            <h2 class="panel-title">账单对账</h2>
            <div class="mt-4 space-y-3">
              <div class="muted-kv"><span class="muted-kv-label">费用估算</span><span class="muted-kv-value">{{ money(payload.costReconciliation.estimatedCost.amount) }}</span></div>
              <div class="muted-kv"><span class="muted-kv-label">冻结金额</span><span class="muted-kv-value">{{ money(payload.costReconciliation.frozenAmount) }}</span></div>
              <div class="muted-kv"><span class="muted-kv-label">T+1 对账状态</span><span class="muted-kv-value">{{ payload.costReconciliation.tPlus1Status }}</span></div>
            </div>
            <div class="mt-5 space-y-3">
              <div v-for="item in payload.costReconciliation.costAllocationTags.slice(0, 4)" :key="item.resourceBindingId" class="rounded-xl border border-gray-100 p-3 text-xs dark:border-slate-700">
                <div class="font-medium text-gray-950 dark:text-white">{{ item.resourceBindingId }}</div>
                <div class="mt-2 grid grid-cols-2 gap-2 text-gray-500 dark:text-slate-400">
                  <span>runId: {{ item.runId || "未归因" }}</span>
                  <span>serverPlanId: {{ item.serverPlanId || "-" }}</span>
                  <span>accountId: {{ item.accountId || "-" }}</span>
                  <span>workspaceId: {{ item.workspaceId || "-" }}</span>
                  <span>billingAttributionId: {{ item.billingAttributionId || "-" }}</span>
                  <span>environmentId: {{ item.environmentId || "-" }}</span>
                </div>
              </div>
              <div v-if="!payload.costReconciliation.costAllocationTags.length" class="empty-state">暂无对账标签</div>
            </div>
          </div>
        </section>

        <section class="card p-6">
          <div class="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 class="panel-title">工作空间状态</h2>
              <p class="panel-subtitle">套餐、计算规格、文件空间、并发、队列和状态。</p>
            </div>
            <span class="badge badge-success">账号与工作空间</span>
          </div>
          <div class="mt-5 mobile-card-list">
            <div v-for="item in payload.workspaceOperations.workspaces" :key="item.workspaceId" class="mobile-only-card">
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0">
                  <div class="font-medium text-gray-950 dark:text-white">{{ item.workspaceName || item.workspaceId }}</div>
                  <div class="mt-1 truncate text-xs text-gray-500 dark:text-slate-400">{{ item.accountName }}</div>
                </div>
                <span class="badge shrink-0" :class="statusClass(item.status)">{{ item.status }}</span>
              </div>
              <div class="mt-3 grid grid-cols-2 gap-2 text-xs text-gray-500 dark:text-slate-400">
                <div><span class="block text-gray-400 dark:text-slate-500">套餐</span>{{ item.planLabel }}</div>
                <div><span class="block text-gray-400 dark:text-slate-500">规格</span>{{ item.cpuCores }} 核，{{ item.memoryGb }}GB</div>
                <div><span class="block text-gray-400 dark:text-slate-500">文件空间</span>{{ item.fileSpaceGb }}GB</div>
                <div><span class="block text-gray-400 dark:text-slate-500">并发数</span>{{ item.concurrency }}</div>
                <div><span class="block text-gray-400 dark:text-slate-500">队列容量</span>{{ item.queueCapacity }}</div>
                <div><span class="block text-gray-400 dark:text-slate-500">审计</span>{{ item.auditStatus || "未开始" }}</div>
              </div>
            </div>
            <div v-if="!payload.workspaceOperations.workspaces.length" class="empty-state">暂无工作空间记录</div>
          </div>
          <div class="mt-5 desktop-table-shell">
            <table class="min-w-[900px] text-sm">
              <thead>
                <tr class="table-head">
                  <th class="px-4 py-3">工作空间</th>
                  <th class="px-4 py-3">账号</th>
                  <th class="px-4 py-3">套餐</th>
                  <th class="px-4 py-3">规格</th>
                  <th class="px-4 py-3">并发数</th>
                  <th class="px-4 py-3">队列容量</th>
                  <th class="px-4 py-3">状态</th>
                  <th class="px-4 py-3">审计</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in payload.workspaceOperations.workspaces" :key="item.workspaceId" class="table-row">
                  <td class="px-4 py-3 font-medium text-gray-950 dark:text-white">{{ item.workspaceName || item.workspaceId }}</td>
                  <td class="px-4 py-3">{{ item.accountName }}</td>
                  <td class="px-4 py-3">{{ item.planLabel }}</td>
                  <td class="px-4 py-3">{{ item.cpuCores }} 核，{{ item.memoryGb }}GB，{{ item.fileSpaceGb }}GB 文件空间</td>
                  <td class="px-4 py-3">{{ item.concurrency }}</td>
                  <td class="px-4 py-3">{{ item.queueCapacity }}</td>
                  <td class="px-4 py-3"><span class="badge" :class="statusClass(item.status)">{{ item.status }}</span></td>
                  <td class="px-4 py-3">{{ item.auditStatus || "未开始" }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section class="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <div class="card p-6">
            <h2 class="panel-title">当前运行</h2>
            <div class="mt-4 space-y-3">
              <div v-for="item in payload.currentRuns.items" :key="item.runId || `${item.workspaceId}-${item.task}`" class="rounded-xl border border-gray-100 p-4 text-sm dark:border-slate-700">
                <div class="flex items-center justify-between gap-3">
                  <div class="font-medium text-gray-950 dark:text-white">{{ item.task }}</div>
                  <span class="badge badge-warning">{{ item.status }}</span>
                </div>
                <div class="mt-2 grid grid-cols-1 gap-2 text-xs text-gray-500 dark:text-slate-400 md:grid-cols-2">
                  <span>账号：{{ item.accountName }}</span>
                  <span>工作空间：{{ item.workspaceId }}</span>
                  <span>runId：{{ item.runId || "未归因" }}</span>
                  <span>费用估算：{{ money(item.estimatedCost) }}</span>
                </div>
              </div>
              <div v-if="!payload.currentRuns.items.length" class="empty-state">暂无当前运行</div>
            </div>
          </div>

          <div class="card p-6">
            <h2 class="panel-title">文件空间状态</h2>
            <div class="mt-4 space-y-3">
              <div v-for="item in payload.fileSpaceOperations.items" :key="item.workspaceId" class="rounded-xl border border-gray-100 p-4 text-sm dark:border-slate-700">
                <div class="flex items-center justify-between gap-3">
                  <div>
                    <div class="font-medium text-gray-950 dark:text-white">{{ item.workspaceName || item.workspaceId }}</div>
                    <div class="text-xs text-gray-500 dark:text-slate-400">{{ item.accountName }}</div>
                  </div>
                  <span class="badge" :class="item.protectedGb > 0 ? 'badge-warning' : 'badge-success'">{{ item.deleteProtectionStatus }}</span>
                </div>
                <div class="mt-3 grid grid-cols-2 gap-2 text-xs text-gray-500 dark:text-slate-400">
                  <span>容量：{{ item.capacityGb }}GB</span>
                  <span>已用：{{ item.usedGb }}GB</span>
                  <span>保护期占用：{{ item.protectedGb }}GB</span>
                  <span>保护期：{{ item.retentionDays }} 天</span>
                  <span>输出文件：{{ item.outputFileCount }}</span>
                </div>
              </div>
              <div v-if="!payload.fileSpaceOperations.items.length" class="empty-state">暂无文件空间记录</div>
            </div>
          </div>
        </section>

        <section class="card p-6">
          <div class="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 class="panel-title">审计事项</h2>
              <p class="panel-subtitle">只读查看审计事件、异常、释放失败、账单异常和公告。</p>
            </div>
            <span class="badge badge-primary">不执行真实资源操作</span>
          </div>
          <div class="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-4">
            <div class="rounded-xl border border-gray-100 p-4 dark:border-slate-700">
              <div class="text-sm font-medium text-gray-950 dark:text-white">审计事件</div>
              <div class="mt-2 text-2xl font-semibold">{{ payload.auditAndAnnouncements.auditEvents.length }}</div>
            </div>
            <div class="rounded-xl border border-gray-100 p-4 dark:border-slate-700">
              <div class="text-sm font-medium text-gray-950 dark:text-white">异常</div>
              <div class="mt-2 text-2xl font-semibold">{{ payload.auditAndAnnouncements.exceptions.length }}</div>
            </div>
            <div class="rounded-xl border border-gray-100 p-4 dark:border-slate-700">
              <div class="text-sm font-medium text-gray-950 dark:text-white">释放失败</div>
              <div class="mt-2 text-2xl font-semibold">{{ payload.auditAndAnnouncements.releaseFailures.length }}</div>
            </div>
            <div class="rounded-xl border border-gray-100 p-4 dark:border-slate-700">
              <div class="text-sm font-medium text-gray-950 dark:text-white">账单异常</div>
              <div class="mt-2 text-2xl font-semibold">{{ payload.auditAndAnnouncements.billingExceptions.length }}</div>
            </div>
          </div>
          <div class="mt-5 space-y-3">
            <div v-for="item in payload.auditAndAnnouncements.announcements" :key="item.id" class="rounded-xl border border-gray-100 p-4 text-sm dark:border-slate-700">
              <div class="font-medium text-gray-950 dark:text-white">{{ item.title }}</div>
              <div class="mt-1 text-xs text-gray-500 dark:text-slate-400">公告状态：{{ item.status }}</div>
            </div>
            <div v-if="!payload.auditAndAnnouncements.announcements.length" class="empty-state">暂无公告</div>
          </div>
        </section>
      </template>
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import MetricCard from "@/components/common/MetricCard.vue";
import AppLayout from "@/layouts/AppLayout.vue";
import { fetchAdminOps } from "@/api/portal/admin";

const payload = ref<any>(null);

function money(value = 0) {
  return `¥${Number(value || 0).toFixed(2)}`;
}

function statusClass(status = "") {
  if (["可用", "已释放"].includes(status)) return "badge-success";
  if (["准备中", "释放中", "计划中"].includes(status)) return "badge-warning";
  return "badge-danger";
}

onMounted(async () => {
  payload.value = await fetchAdminOps();
});
</script>
