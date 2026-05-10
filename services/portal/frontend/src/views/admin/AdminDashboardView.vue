<template>
  <AppLayout title="运营总台" subtitle="客户、账务、资源、轨迹与告警的统一处理入口">
    <div class="space-y-4">
      <div v-if="!payload" class="card p-6 text-sm text-gray-500 dark:text-slate-400">正在加载运行总台...</div>
      <template v-else>
        <section class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <div class="card p-4">
            <div class="text-xs font-semibold uppercase tracking-[0.12em] text-gray-400 dark:text-slate-500">用户总数</div>
            <div class="mt-2 text-2xl font-semibold text-gray-950 dark:text-white">{{ payload.kpis?.todayNewUsers ?? 0 }}</div>
            <div class="mt-1 text-xs text-gray-500 dark:text-slate-400">今日新增</div>
            <div class="mt-2 text-sm text-gray-700 dark:text-slate-300">总用户 {{ payload.kpis?.totalUsers ?? 0 }}</div>
          </div>
          <div class="card p-4">
            <div class="text-xs font-semibold uppercase tracking-[0.12em] text-gray-400 dark:text-slate-500">任务空间数</div>
            <div class="mt-2 text-2xl font-semibold text-gray-950 dark:text-white">{{ payload.kpis?.todayNewWorkspaces ?? 0 }}</div>
            <div class="mt-1 text-xs text-gray-500 dark:text-slate-400">今日新增</div>
            <div class="mt-2 text-sm text-gray-700 dark:text-slate-300">总任务空间 {{ payload.kpis?.workspaceTotal ?? 0 }}</div>
          </div>
          <div class="card p-4">
            <div class="text-xs font-semibold uppercase tracking-[0.12em] text-gray-400 dark:text-slate-500">今日运行</div>
            <div class="mt-2 text-2xl font-semibold text-gray-950 dark:text-white">{{ payload.kpis?.todayRuns ?? 0 }}</div>
            <div class="mt-1 text-xs text-gray-500 dark:text-slate-400">今日新增</div>
            <div class="mt-2 text-sm text-gray-700 dark:text-slate-300">总运行 {{ payload.kpis?.totalRuns ?? 0 }}</div>
          </div>
          <MetricCard label="平均响应" :value="responseLabel" hint="优先取当前性能摘要" />
          <MetricCard label="今日总消费" :value="microMoney(payload.kpis?.todayTotalCost)" hint="今日资源消费" />
          <MetricCard label="历史总消费" :value="microMoney(payload.kpis?.historicalTotalCost)" hint="历史累计资源消费" />
        </section>

        <section class="grid grid-cols-1 gap-4 xl:grid-cols-[1.25fr_1fr]">
          <div class="card p-5">
            <div class="mb-3 flex items-center justify-between gap-3">
              <div>
                <h2 class="panel-title">最近使用记录</h2>
                <p class="panel-subtitle">展示客户、工作空间、时间和资源消费明细。</p>
              </div>
              <RouterLink class="btn btn-secondary" to="/admin/usage">查看全部</RouterLink>
            </div>

            <div class="table-shell">
              <table class="text-sm">
                <thead>
                  <tr class="table-head">
                    <th class="px-4 py-3">谁</th>
                    <th class="px-4 py-3">工作空间</th>
                    <th class="px-4 py-3">时间</th>
                    <th class="px-4 py-3">CPU</th>
                    <th class="px-4 py-3">GPU</th>
                    <th class="px-4 py-3">存储</th>
                    <th class="px-4 py-3">总计</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="item in usageRows" :key="item.runId" class="table-row">
                    <td class="px-4 py-3">
                      <div class="font-medium text-gray-950 dark:text-white">{{ item.userName || item.userId }}</div>
                      <div class="mt-1 text-xs text-gray-500 dark:text-slate-400">{{ item.runId }}</div>
                    </td>
                    <td class="px-4 py-3 text-gray-700 dark:text-slate-300">{{ item.workspaceId || "-" }}</td>
                    <td class="px-4 py-3 text-gray-500 dark:text-slate-400">{{ item.createdAt || "-" }}</td>
                    <td class="px-4 py-3 text-gray-700 dark:text-slate-300">{{ microMoney(item.cpuCost) }}</td>
                    <td class="px-4 py-3 text-gray-700 dark:text-slate-300">{{ microMoney(item.gpuCost) }}</td>
                    <td class="px-4 py-3 text-gray-700 dark:text-slate-300">{{ microMoney(item.storageCost) }}</td>
                    <td class="px-4 py-3 font-medium text-gray-950 dark:text-white">{{ microMoney(item.totalCost) }}</td>
                  </tr>
                  <tr v-if="!usageRows.length">
                    <td colspan="7" class="px-4 py-6 text-center text-sm text-gray-500 dark:text-slate-400">暂无使用记录</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div class="space-y-4">
            <div class="card p-5">
              <div class="mb-3 flex items-center justify-between gap-3">
                <div>
                  <h2 class="panel-title">运营入口</h2>
                  <p class="panel-subtitle">按客户、账务、归因和资源异常继续处理。</p>
                </div>
              </div>
              <div class="grid gap-2">
                <RouterLink class="btn btn-secondary justify-start" to="/admin/users">用户管理</RouterLink>
                <RouterLink class="btn btn-secondary justify-start" to="/admin/billing-ops">客户账务</RouterLink>
                <RouterLink class="btn btn-secondary justify-start" to="/admin/usage">账单归因</RouterLink>
                <RouterLink v-if="opsSurfaceEnabled" class="btn btn-secondary justify-start" to="/admin/ops">云资源状态</RouterLink>
              </div>
            </div>

            <div class="card p-5">
              <div class="mb-3 flex items-center justify-between gap-3">
                <div>
                  <h2 class="panel-title">待处理事项</h2>
                  <p class="panel-subtitle">直接看需要处理的客户和资源异常。</p>
                </div>
                <RouterLink class="btn btn-secondary" to="/admin/alerts">打开告警中心</RouterLink>
              </div>
              <div class="space-y-2.5">
                <div v-for="item in (payload.alerts || []).slice(0, 5)" :key="`${item.category}-${item.title}-${item.runId || ''}`" class="rounded-2xl border border-gray-100 px-4 py-3 dark:border-slate-700">
                  <div class="flex items-start justify-between gap-3">
                    <div>
                      <div class="font-medium text-gray-950 dark:text-white">{{ item.title }}</div>
                      <div class="mt-1 text-xs text-gray-500 dark:text-slate-400">{{ item.detail }}</div>
                    </div>
                    <span class="badge" :class="item.severity === 'danger' ? 'badge-danger' : 'badge-warning'">
                      {{ item.severity === "danger" ? "严重" : "提醒" }}
                    </span>
                  </div>
                </div>
                <div v-if="!(payload.alerts || []).length" class="empty-state">当前暂无告警。</div>
              </div>
            </div>
          </div>
        </section>
      </template>
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import AppLayout from "@/layouts/AppLayout.vue";
import MetricCard from "@/components/common/MetricCard.vue";
import { fetchAdminOverview } from "@/api/portal/admin";

const payload = ref<any>(null);
const opsSurfaceEnabled = computed(() => Boolean(payload.value?.productProfile?.opsSurfaceEnabled));
const usageRows = computed(() => (payload.value?.usageRows || []).slice(0, 5));
const responseLabel = computed(() => {
  const value = Number(payload.value?.kpis?.averageResponseMs || 0);
  return value > 0 ? `${Math.round(value)} ms` : "未记录";
});

function microMoney(value: number | undefined) {
  return `¥${Number(value || 0).toFixed(5)}`;
}

onMounted(async () => {
  payload.value = await fetchAdminOverview();
});
</script>
