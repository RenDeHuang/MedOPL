<template>
  <section data-route-id="overview" data-component-id="overview.plans" class="card p-5">
    <div class="mb-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h2 class="panel-title">账单风险卡</h2>
        <p class="panel-subtitle">套餐、算力和存储摘要；确认余额、预扣费和冻结金额是否正常</p>
      </div>
      <RouterLink class="btn btn-secondary" to="/packages">查看套餐</RouterLink>
    </div>
    <div data-design-quality="plan-summary" class="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
      <div class="rounded-lg border border-gray-200 px-4 py-3 dark:border-slate-700">
        <div class="text-xs text-gray-500 dark:text-slate-400">当前套餐</div>
        <div class="mt-2 font-medium text-gray-950 dark:text-white">{{ selectedPlanName || "未选择" }}</div>
      </div>
      <div class="rounded-lg border border-gray-200 px-4 py-3 dark:border-slate-700">
        <div class="text-xs text-gray-500 dark:text-slate-400">算力</div>
        <div class="mt-2 font-medium text-gray-950 dark:text-white">{{ computeSummary }}</div>
      </div>
      <div class="rounded-lg border border-gray-200 px-4 py-3 dark:border-slate-700">
        <div class="text-xs text-gray-500 dark:text-slate-400">存储</div>
        <div class="mt-2 font-medium text-gray-950 dark:text-white">{{ storageSummary }}</div>
      </div>
      <div data-design-quality="billing-risk-card" class="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-900/50 dark:bg-amber-950/20">
        <div class="text-xs text-amber-700 dark:text-amber-300">余额、预扣费、冻结金额</div>
        <div class="mt-2 font-medium text-gray-950 dark:text-white">{{ purchasableCount }} 个可选，{{ quotedCount }} 个已同步，入门预估 {{ lowestHourlyPrice }}</div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
defineProps<{
  computeSummary: string;
  lowestHourlyPrice: string;
  purchasableCount: number;
  quotedCount: number;
  selectedPlanName?: string;
  storageSummary: string;
}>();
</script>
