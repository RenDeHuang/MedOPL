<template>
  <section data-route-id="resources" data-component-id="resources.hero" class="card p-5">
    <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
      <div>
        <h2 class="panel-title">工作台资源</h2>
        <p class="panel-subtitle">用于科研工作台的套餐、计算规格和文件空间。</p>
      </div>
      <button class="btn btn-secondary" :disabled="resourcesLoading" @click="$emit('reload')">刷新</button>
    </div>
    <div class="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3 xl:grid-cols-6">
      <MetricCard label="当前套餐" :value="currentPlanName" hint="工作台资源套餐" />
      <MetricCard label="计算规格" :value="currentComputeSpec" hint="托管运行环境" />
      <MetricCard label="文件空间" :value="currentFileSpaceText" hint="输入文件和输出文件" />
      <MetricCard label="并发数" :value="currentConcurrencyText" hint="可同时运行的任务" />
      <MetricCard label="预计费用" :value="estimatedCostText" hint="只作估算展示" />
      <MetricCard label="余额状态" :value="balanceFreezeStatus" hint="系统自动计算冻结金额" />
    </div>
  </section>
</template>

<script setup lang="ts">
import MetricCard from "@/components/common/MetricCard.vue";

defineProps<{
  balanceFreezeStatus: string;
  currentConcurrencyText: string;
  currentComputeSpec: string;
  currentFileSpaceText: string;
  currentPlanName: string;
  estimatedCostText: string;
  resourcesLoading: boolean;
}>();

defineEmits<{
  reload: [];
}>();
</script>
