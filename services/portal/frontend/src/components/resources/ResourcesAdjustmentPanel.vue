<template>
  <section data-route-id="resources" data-component-id="resources.adjustment" class="card p-5">
    <div class="flex items-start justify-between gap-3">
      <div>
        <h2 class="panel-title">调整计划</h2>
        <p class="panel-subtitle">增加资源只生成 dry-run 计划，不会真实开通。</p>
      </div>
      <span class="badge badge-warning shrink-0 whitespace-nowrap">需确认</span>
    </div>
    <div class="mt-4 grid grid-cols-1 gap-3">
      <button class="btn btn-secondary justify-between" type="button" @click="$emit('setAdjustmentPlan', '增加计算资源')">
        <span>增加计算资源</span>
        <span class="text-xs text-gray-500 dark:text-slate-400">dry-run 调整计划</span>
      </button>
      <button class="btn btn-secondary justify-between" type="button" @click="$emit('setAdjustmentPlan', '增加存储资源')">
        <span>增加存储资源</span>
        <span class="text-xs text-gray-500 dark:text-slate-400">dry-run 调整计划</span>
      </button>
    </div>
  </section>
</template>

<script setup lang="ts">
defineEmits<{
  setAdjustmentPlan: [label: string];
}>();
</script>
