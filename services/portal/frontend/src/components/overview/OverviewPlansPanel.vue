<template>
  <section data-route-id="overview" data-component-id="overview.plans" class="card p-5">
    <div class="mb-3 flex items-center justify-between gap-3">
      <div>
        <h2 class="panel-title">套餐与文件空间</h2>
        <p class="panel-subtitle">查看当前套餐、托管运行环境和文件空间容量</p>
      </div>
      <RouterLink class="btn btn-secondary" to="/packages">查看套餐</RouterLink>
    </div>
    <div class="grid grid-cols-2 gap-3 text-sm">
      <div class="rounded-2xl border border-gray-100 px-4 py-3 dark:border-slate-700">
        <div class="text-xs text-gray-500 dark:text-slate-400">可选套餐</div>
        <div class="mt-2 text-lg font-semibold text-gray-950 dark:text-white">{{ purchasableCount }}</div>
      </div>
      <div class="rounded-2xl border border-gray-100 px-4 py-3 dark:border-slate-700">
        <div class="text-xs text-gray-500 dark:text-slate-400">已同步套餐</div>
        <div class="mt-2 text-lg font-semibold text-gray-950 dark:text-white">{{ quotedCount }}</div>
      </div>
      <div class="rounded-2xl border border-gray-100 px-4 py-3 dark:border-slate-700">
        <div class="text-xs text-gray-500 dark:text-slate-400">入门预估消费</div>
        <div class="mt-2 text-lg font-semibold text-gray-950 dark:text-white">{{ lowestHourlyPrice }}</div>
      </div>
      <div class="rounded-2xl border border-gray-100 px-4 py-3 dark:border-slate-700">
        <div class="text-xs text-gray-500 dark:text-slate-400">当前套餐</div>
        <div class="mt-2 font-medium text-gray-950 dark:text-white">{{ selectedPlanName || "未选择" }}</div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
defineProps<{
  lowestHourlyPrice: string;
  purchasableCount: number;
  quotedCount: number;
  selectedPlanName?: string;
}>();
</script>
