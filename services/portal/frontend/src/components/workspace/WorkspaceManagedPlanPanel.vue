<template>
  <section data-route-id="workspace" data-component-id="workspace.managed_plan" class="card p-5">
    <div class="mb-3 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 class="panel-title">托管运行环境</h2>
        <p class="panel-subtitle">
          这里展示托管运行环境的计划快照；当前为计划视图，不代表真实资源已创建。
        </p>
      </div>
      <span class="badge" :class="statusBadge(managedPlan?.status)">{{ humanizeStatus(managedPlan?.status || "not_started") }}</span>
    </div>
    <div v-if="managedPlan" class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      <div class="rounded-2xl border border-gray-100 px-4 py-3 dark:border-slate-700">
        <div class="text-xs text-gray-500 dark:text-slate-400">区域</div>
        <div class="mt-1 font-medium text-gray-950 dark:text-white">{{ managedPlan.regionLabel }}</div>
      </div>
      <div class="rounded-2xl border border-gray-100 px-4 py-3 dark:border-slate-700">
        <div class="text-xs text-gray-500 dark:text-slate-400">规格</div>
        <div class="mt-1 font-medium text-gray-950 dark:text-white">{{ managedPlan.planSpec }}</div>
      </div>
      <div class="rounded-2xl border border-gray-100 px-4 py-3 dark:border-slate-700">
        <div class="text-xs text-gray-500 dark:text-slate-400">预计费用</div>
        <div class="mt-1 font-medium text-gray-950 dark:text-white">{{ money(managedPlan.estimatedCost.amount, managedPlan.estimatedCost.currency) }}</div>
        <div class="mt-1 text-xs text-gray-500 dark:text-slate-400">不做真实扣费</div>
      </div>
      <div class="rounded-2xl border border-gray-100 px-4 py-3 dark:border-slate-700">
        <div class="text-xs text-gray-500 dark:text-slate-400">释放策略</div>
        <div class="mt-1 font-medium text-gray-950 dark:text-white">{{ releasePolicyText(managedPlan.releasePolicy.status) }}</div>
        <div class="mt-1 text-xs text-gray-500 dark:text-slate-400">{{ managedPlan.releasePolicy.stopBillingConfirmWithinMinutes }} 分钟内确认停止计费</div>
      </div>
      <div class="rounded-2xl border border-gray-100 px-4 py-3 dark:border-slate-700">
        <div class="text-xs text-gray-500 dark:text-slate-400">审计状态</div>
        <div class="mt-1 font-medium text-gray-950 dark:text-white">{{ auditStatusText(managedPlan.auditStatus.status) }}</div>
        <div class="mt-1 text-xs text-gray-500 dark:text-slate-400">{{ managedPlan.auditStatus.policy }}</div>
      </div>
      <div class="rounded-2xl border border-gray-100 px-4 py-3 dark:border-slate-700">
        <div class="text-xs text-gray-500 dark:text-slate-400">状态</div>
        <div class="mt-1 font-medium text-gray-950 dark:text-white">{{ snapshotText(managedPlan.snapshot.realResourceCreated) }}</div>
        <div class="mt-1 text-xs text-gray-500 dark:text-slate-400">计划快照</div>
      </div>
    </div>
    <div v-else class="empty-state">当前工作空间还没有托管运行环境计划。</div>
  </section>
</template>

<script setup lang="ts">
import type { ManagedResourceBindingPlanPayload } from "@/api/portal/workspace";

defineProps<{
  auditStatusText: (value?: string) => string;
  humanizeStatus: (status?: string) => string;
  managedPlan: ManagedResourceBindingPlanPayload | null;
  money: (value?: number, currency?: string) => string;
  releasePolicyText: (value?: string) => string;
  snapshotText: (realResourceCreated?: boolean) => string;
  statusBadge: (status?: string) => string;
}>();
</script>
