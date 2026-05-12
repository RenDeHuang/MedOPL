<template>
  <section data-route-id="resources" data-component-id="resources.plan_selection" class="card p-5">
    <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
      <div>
        <h2 class="panel-title">套餐选择</h2>
        <p class="panel-subtitle">选择套餐后生成 dry-run 调整计划，不会真实开通资源。</p>
      </div>
      <span class="badge badge-primary">dry-run</span>
    </div>
    <div class="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
      <article
        v-for="plan in planCards"
        :key="plan.id"
        class="rounded-2xl border border-gray-100 p-4 dark:border-slate-700"
      >
        <div class="flex items-start justify-between gap-3">
          <div>
            <h3 class="text-base font-semibold text-gray-950 dark:text-white">{{ plan.name }}</h3>
            <p class="mt-1 text-xs text-gray-500 dark:text-slate-400">{{ plan.description }}</p>
          </div>
          <span class="badge" :class="plan.id === currentPlanId ? 'badge-success' : 'badge-primary'">
            {{ plan.id === currentPlanId ? "当前套餐" : "可选套餐" }}
          </span>
        </div>
        <dl class="mt-4 grid grid-cols-2 gap-2 text-sm">
          <div class="muted-kv">
            <dt class="muted-kv-label">计算规格</dt>
            <dd class="muted-kv-value">{{ plan.computeSpec }}</dd>
          </div>
          <div class="muted-kv">
            <dt class="muted-kv-label">文件空间</dt>
            <dd class="muted-kv-value">{{ plan.fileSpace }}</dd>
          </div>
          <div class="muted-kv">
            <dt class="muted-kv-label">并发数</dt>
            <dd class="muted-kv-value">{{ plan.concurrency }}</dd>
          </div>
          <div class="muted-kv">
            <dt class="muted-kv-label">预计费用</dt>
            <dd class="muted-kv-value">{{ plan.estimatedCost }}</dd>
          </div>
        </dl>
        <button class="btn btn-secondary mt-4 w-full" type="button" @click="$emit('setAdjustmentPlan', plan.name)">
          生成套餐调整计划
        </button>
      </article>
    </div>
  </section>
</template>

<script setup lang="ts">
interface PlanCard {
  id: string;
  name: string;
  description: string;
  computeSpec: string;
  fileSpace: string;
  concurrency: string;
  estimatedCost: string;
}

defineProps<{
  currentPlanId: string;
  planCards: PlanCard[];
}>();

defineEmits<{
  setAdjustmentPlan: [label: string];
}>();
</script>
