<template>
  <section data-route-id="admin.dashboard" data-component-id="admin.dashboard.summary" class="space-y-4">
    <section class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      <MetricCard label="今日新增用户" :value="kpis.todayNewUsers ?? 0" :hint="`总用户 ${kpis.totalUsers ?? 0}`" />
      <MetricCard label="今日新增空间" :value="kpis.todayNewWorkspaces ?? 0" :hint="`总工作空间 ${kpis.workspaceTotal ?? 0}`" />
      <MetricCard label="今日运行任务" :value="kpis.todayRuns ?? 0" :hint="`总运行 ${kpis.totalRuns ?? 0}`" />
      <MetricCard label="平均响应" :value="responseLabel" hint="当前性能摘要" />
      <MetricCard label="今日消费" :value="money(kpis.todayTotalCost)" hint="今日资源消费" />
      <MetricCard label="累计消费" :value="money(kpis.historicalTotalCost)" hint="历史资源消费" />
    </section>

    <section class="grid grid-cols-1 gap-4 xl:grid-cols-[1.25fr_1fr]">
      <PageSection title="最近使用记录" subtitle="展示客户、工作空间、时间和资源消费明细。">
        <template #actions>
          <RouterLink class="btn btn-secondary" to="/admin/usage">查看全部</RouterLink>
        </template>
        <DataTable :empty="!usageRows.length" empty-text="暂无使用记录" :columns="7">
          <template #head>
            <th class="px-4 py-3">客户</th>
            <th class="px-4 py-3">工作空间</th>
            <th class="px-4 py-3">时间</th>
            <th class="px-4 py-3">CPU</th>
            <th class="px-4 py-3">GPU</th>
            <th class="px-4 py-3">存储</th>
            <th class="px-4 py-3">总计</th>
          </template>
          <tr v-for="item in usageRows" :key="item.runId" class="table-row">
            <td class="px-4 py-3">
              <div class="font-medium text-gray-950 dark:text-white">{{ item.userName || item.userId }}</div>
              <div class="mt-1 text-xs text-gray-500 dark:text-slate-400">{{ item.runId }}</div>
            </td>
            <td class="px-4 py-3 text-gray-700 dark:text-slate-300">{{ item.workspaceId || "-" }}</td>
            <td class="px-4 py-3 text-gray-500 dark:text-slate-400">{{ item.createdAt || "-" }}</td>
            <td class="px-4 py-3 text-gray-700 dark:text-slate-300">{{ money(item.cpuCost) }}</td>
            <td class="px-4 py-3 text-gray-700 dark:text-slate-300">{{ money(item.gpuCost) }}</td>
            <td class="px-4 py-3 text-gray-700 dark:text-slate-300">{{ money(item.storageCost) }}</td>
            <td class="px-4 py-3 font-medium text-gray-950 dark:text-white">{{ money(item.totalCost) }}</td>
          </tr>
        </DataTable>
      </PageSection>

      <div class="space-y-4">
        <PageSection title="管理入口" subtitle="按客户、账单、归因和资源异常继续处理。">
          <div class="grid gap-2">
            <RouterLink class="btn btn-secondary justify-start" to="/admin/users">客户账户</RouterLink>
            <RouterLink class="btn btn-secondary justify-start" to="/admin/billing-ops">账单管理</RouterLink>
            <RouterLink class="btn btn-secondary justify-start" to="/admin/usage">任务记录</RouterLink>
            <RouterLink v-if="opsSurfaceEnabled" class="btn btn-secondary justify-start" to="/admin/ops">服务状态</RouterLink>
          </div>
        </PageSection>

        <PageSection title="待处理事项" subtitle="直接看需要处理的客户和资源异常。">
          <template #actions>
            <RouterLink class="btn btn-secondary" to="/admin/alerts">查看待处理事项</RouterLink>
          </template>
          <div class="space-y-2.5">
            <div v-for="item in alerts.slice(0, 5)" :key="`${item.category}-${item.title}-${item.runId || ''}`" class="rounded-2xl border border-gray-100 px-4 py-3 dark:border-slate-700">
              <div class="flex items-start justify-between gap-3">
                <div>
                  <div class="font-medium text-gray-950 dark:text-white">{{ item.title }}</div>
                  <div class="mt-1 text-xs text-gray-500 dark:text-slate-400">{{ item.detail }}</div>
                </div>
                <StatusBadge :tone="item.severity === 'danger' ? 'danger' : 'warning'" :label="item.severity === 'danger' ? '严重' : '提醒'" />
              </div>
            </div>
            <EmptyState v-if="!alerts.length" title="当前暂无待处理事项" />
          </div>
        </PageSection>
      </div>
    </section>
  </section>
</template>

<script setup lang="ts">
import DataTable from "@/components/common/DataTable.vue";
import EmptyState from "@/components/common/EmptyState.vue";
import MetricCard from "@/components/common/MetricCard.vue";
import PageSection from "@/components/common/PageSection.vue";
import StatusBadge from "@/components/common/StatusBadge.vue";

defineProps<{
  alerts: Array<Record<string, any>>;
  kpis: Record<string, any>;
  money: (value: number | undefined) => string;
  opsSurfaceEnabled: boolean;
  responseLabel: string;
  usageRows: Array<Record<string, any>>;
}>();
</script>
