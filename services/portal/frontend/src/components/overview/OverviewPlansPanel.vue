<template>
  <section data-route-id="overview" data-component-id="overview.plans" class="card p-5">
    <div class="mb-3 flex items-center justify-between gap-3">
      <div>
        <h2 class="panel-title">套餐、算力和存储摘要</h2>
        <p class="panel-subtitle">确认你购买的托管工作台规格，不进入云资源控制台</p>
      </div>
      <RouterLink class="btn btn-secondary" to="/packages">查看套餐</RouterLink>
    </div>
    <div data-design-quality="plan-summary" class="grid grid-cols-2 gap-3 text-sm">
      <div class="rounded-lg border border-gray-100 px-4 py-3 dark:border-slate-700">
        <div class="text-xs text-gray-500 dark:text-slate-400">当前套餐</div>
        <div class="mt-2 font-medium text-gray-950 dark:text-white">{{ selectedPlanName || "未选择" }}</div>
      </div>
      <div class="rounded-lg border border-gray-100 px-4 py-3 dark:border-slate-700">
        <div class="text-xs text-gray-500 dark:text-slate-400">算力</div>
        <div class="mt-2 font-medium text-gray-950 dark:text-white">{{ computeSummary }}</div>
      </div>
      <div class="rounded-lg border border-gray-100 px-4 py-3 dark:border-slate-700">
        <div class="text-xs text-gray-500 dark:text-slate-400">存储</div>
        <div class="mt-2 font-medium text-gray-950 dark:text-white">{{ storageSummary }}</div>
      </div>
      <div class="rounded-lg border border-gray-100 px-4 py-3 dark:border-slate-700">
        <div class="text-xs text-gray-500 dark:text-slate-400">可选 / 已同步 / 入门预估</div>
        <div class="mt-2 font-medium text-gray-950 dark:text-white">{{ purchasableCount }} / {{ quotedCount }} / {{ lowestHourlyPrice }}</div>
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
