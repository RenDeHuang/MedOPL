<template>
  <section data-route-id="admin.usage" data-component-id="admin.usage.table" class="space-y-6">
    <section class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      <MetricCard label="记录数" :value="payload.pagination?.total ?? 0" hint="最近可检索运行" />
      <MetricCard label="当前页" :value="payload.pagination?.page ?? 1" hint="分页浏览" />
      <MetricCard label="每页数量" :value="payload.pagination?.pageSize ?? 10" hint="列表密度" />
      <MetricCard label="失败运行" :value="failedCount" hint="当前页失败记录" />
    </section>

    <section class="grid grid-cols-1 gap-6 xl:grid-cols-[1.2fr_1fr]">
      <PageSection title="运行列表" subtitle="统一查看客户、空间、状态和成本。">
        <template #actions>
          <RouterLink class="btn btn-secondary" to="/admin/billing-ops">账单管理</RouterLink>
        </template>
        <DataTable :empty="!(payload.items || []).length" empty-text="暂无使用记录" :columns="6">
          <template #head>
            <th class="px-4 py-3">客户</th>
            <th class="px-4 py-3">工作空间</th>
            <th class="px-4 py-3">运行编号</th>
            <th class="px-4 py-3">状态</th>
            <th class="px-4 py-3">成本</th>
            <th class="px-4 py-3">详情</th>
          </template>
          <tr v-for="item in payload.items || []" :key="item.runId" class="table-row">
            <td class="px-4 py-3">
              <div class="font-medium text-gray-950 dark:text-white">{{ item.userName }}</div>
              <div class="mt-1 text-xs text-gray-500 dark:text-slate-400">{{ item.userId || "-" }}</div>
            </td>
            <td class="px-4 py-3 text-gray-700 dark:text-slate-300">{{ item.workspaceId }}</td>
            <td class="px-4 py-3 font-mono text-xs text-gray-700 dark:text-slate-300">{{ item.runId }}</td>
            <td class="px-4 py-3">
              <StatusBadge :tone="statusTone(item.status)" :label="statusLabel(item.status)" />
            </td>
            <td class="px-4 py-3 font-medium text-gray-950 dark:text-white">{{ money(item.totalCost) }}</td>
            <td class="px-4 py-3">
              <RouterLink class="text-sm font-medium text-primary-600 hover:text-primary-500 dark:text-primary-400" :to="{ path: '/admin/run', query: { runId: item.runId } }">查看</RouterLink>
            </td>
          </tr>
        </DataTable>
      </PageSection>

      <div class="space-y-6">
        <PageSection title="当前页概览" subtitle="快速判断运行质量和成本分布。">
          <div class="space-y-3 text-sm">
            <div class="muted-kv"><span class="muted-kv-label">成功运行</span><span class="muted-kv-value">{{ successCount }}</span></div>
            <div class="muted-kv"><span class="muted-kv-label">失败运行</span><span class="muted-kv-value">{{ failedCount }}</span></div>
            <div class="muted-kv"><span class="muted-kv-label">平均成本</span><span class="muted-kv-value">{{ money(averageCost) }}</span></div>
          </div>
        </PageSection>

        <PageSection title="常用入口" subtitle="继续排查成本、运行与待处理事项。">
          <div class="grid gap-3">
            <RouterLink class="btn btn-secondary justify-start" to="/admin/billing-ops">账单管理</RouterLink>
            <RouterLink v-if="opsSurfaceEnabled" class="btn btn-secondary justify-start" to="/admin/ops">服务状态</RouterLink>
            <RouterLink class="btn btn-secondary justify-start" to="/admin/alerts">待处理事项</RouterLink>
          </div>
        </PageSection>
      </div>
    </section>
  </section>
</template>

<script setup lang="ts">
import DataTable from "@/components/common/DataTable.vue";
import MetricCard from "@/components/common/MetricCard.vue";
import PageSection from "@/components/common/PageSection.vue";
import StatusBadge from "@/components/common/StatusBadge.vue";

defineProps<{
  averageCost: number;
  failedCount: number;
  money: (value: number | undefined) => string;
  opsSurfaceEnabled: boolean;
  payload: Record<string, any>;
  statusLabel: (value?: string) => string;
  statusTone: (value?: string) => "success" | "warning" | "danger" | "primary";
  successCount: number;
}>();
</script>
