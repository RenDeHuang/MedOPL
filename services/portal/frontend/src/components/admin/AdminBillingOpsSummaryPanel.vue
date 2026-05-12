<template>
  <section data-route-id="admin.billing_ops" data-component-id="admin.billing_ops.summary" class="space-y-6">
    <section class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      <MetricCard label="云账单接入" :value="payload.billingSync?.tencentBillingLinked ? '已接入' : '待接入'" hint="真实账单核对状态" />
      <MetricCard label="自动对账" :value="payload.billingSync?.autoReconcileEnabled ? '开启' : '关闭'" hint="自动补齐开关" />
      <MetricCard label="待处理记录" :value="payload.pending?.count ?? 0" hint="待补齐或待人工确认" />
      <MetricCard label="最近调整" :value="payload.adjustments?.length ?? 0" hint="最近账单调整条数" />
    </section>

    <section class="grid grid-cols-1 gap-6 xl:grid-cols-[1.2fr_1fr]">
      <PageSection title="待处理记录" subtitle="识别哪些运行还没有完成成本对账。">
        <template #actions>
          <ActionToolbar>
            <RouterLink class="btn btn-secondary" to="/admin/alerts">待处理事项</RouterLink>
            <RouterLink class="btn btn-secondary" to="/admin/users">客户账户</RouterLink>
          </ActionToolbar>
        </template>
        <DataTable :empty="!(payload.pendingRuns || []).length" empty-text="暂无待处理记录" :columns="5">
          <template #head>
            <th class="px-4 py-3">运行编号</th>
            <th class="px-4 py-3">客户</th>
            <th class="px-4 py-3">工作空间</th>
            <th class="px-4 py-3">待补时长</th>
            <th class="px-4 py-3">来源</th>
          </template>
          <tr v-for="item in payload.pendingRuns || []" :key="item.runId" class="table-row">
            <td class="px-4 py-3 font-mono text-xs text-gray-900 dark:text-white">{{ item.runId || "-" }}</td>
            <td class="px-4 py-3 text-gray-700 dark:text-slate-300">{{ item.customerId || item.userId || "-" }}</td>
            <td class="px-4 py-3 text-gray-700 dark:text-slate-300">{{ item.workspaceId || "-" }}</td>
            <td class="px-4 py-3 font-medium text-gray-950 dark:text-white">{{ Number(item.pendingHours || 0).toFixed(2) }} 小时</td>
            <td class="px-4 py-3 text-gray-700 dark:text-slate-300">{{ sourceLabel(item.pricingSource) }}</td>
          </tr>
        </DataTable>
      </PageSection>

      <div class="space-y-6">
        <PageSection v-if="opsSurfaceEnabled" title="当前状态">
          <div class="space-y-3 text-sm">
            <div class="muted-kv"><span class="muted-kv-label">云账单</span><span class="muted-kv-value">{{ payload.billingSync?.tencentBillingLinked ? "已接入" : "待接入" }}</span></div>
            <div class="muted-kv"><span class="muted-kv-label">最近对账</span><span class="muted-kv-value">{{ payload.billingSync?.lastRunAt || "暂无" }}</span></div>
            <div class="muted-kv"><span class="muted-kv-label">最近错误</span><span class="muted-kv-value">{{ payload.billingSync?.lastError || "无" }}</span></div>
            <div class="muted-kv"><span class="muted-kv-label">最近调整数</span><span class="muted-kv-value">{{ payload.billingSync?.lastAdjustmentCount ?? 0 }}</span></div>
          </div>
        </PageSection>

        <PageSection title="成本构成">
          <div class="space-y-3 text-sm">
            <div class="muted-kv"><span class="muted-kv-label">CPU</span><span class="muted-kv-value">{{ money(payload.summaries?.billing?.cpuCost) }}</span></div>
            <div class="muted-kv"><span class="muted-kv-label">GPU</span><span class="muted-kv-value">{{ money(payload.summaries?.billing?.gpuCost) }}</span></div>
            <div class="muted-kv"><span class="muted-kv-label">存储</span><span class="muted-kv-value">{{ money(payload.summaries?.billing?.storageCost) }}</span></div>
            <div class="muted-kv"><span class="muted-kv-label">总成本</span><span class="muted-kv-value">{{ money(payload.summaries?.billing?.totalCost) }}</span></div>
          </div>
        </PageSection>

        <PageSection title="最近调整">
          <div class="space-y-3">
            <div v-for="item in payload.adjustments || []" :key="`${item.type}-${item.createdAt}-${item.userId}`" class="rounded-2xl border border-gray-100 px-4 py-4 dark:border-slate-700">
              <div class="flex items-start justify-between gap-4">
                <div>
                  <div class="font-medium text-gray-950 dark:text-white">{{ adjustmentLabel(item.type) }}</div>
                  <div class="mt-1 text-sm text-gray-500 dark:text-slate-400">{{ item.userName || item.userId }}</div>
                  <div class="mt-1 text-xs text-gray-500 dark:text-slate-400">{{ item.createdAt || "-" }}</div>
                </div>
                <div class="text-right">
                  <div class="font-medium text-gray-950 dark:text-white">{{ money(item.amount, 2) }}</div>
                  <div class="mt-1 text-xs text-gray-500 dark:text-slate-400">{{ item.workspaceId || "-" }}</div>
                </div>
              </div>
            </div>
            <EmptyState v-if="!(payload.adjustments || []).length" title="暂无调整记录" />
          </div>
        </PageSection>
      </div>
    </section>
  </section>
</template>

<script setup lang="ts">
import ActionToolbar from "@/components/common/ActionToolbar.vue";
import DataTable from "@/components/common/DataTable.vue";
import EmptyState from "@/components/common/EmptyState.vue";
import MetricCard from "@/components/common/MetricCard.vue";
import PageSection from "@/components/common/PageSection.vue";

defineProps<{
  adjustmentLabel: (value?: string) => string;
  money: (value: number | undefined, digits?: number) => string;
  opsSurfaceEnabled: boolean;
  payload: Record<string, any>;
  sourceLabel: (value?: string) => string;
}>();
</script>
