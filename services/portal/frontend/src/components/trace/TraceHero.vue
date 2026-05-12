<template>
  <section data-route-id="trace" data-component-id="trace.hero" class="space-y-4">
    <div class="card p-5">
      <div class="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 class="panel-title">运行轨迹</h2>
          <p class="panel-subtitle">运行记录为准，观测摘要只作补充。</p>
        </div>
        <div v-if="businessFactSource && customerDefaultLangfuseUi === false" class="text-right text-xs text-gray-500 dark:text-slate-400">
          默认在 Portal 查看，不跳转外部观测台
        </div>
      </div>
    </div>

    <section class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      <MetricCard label="会话数" :value="sessionCount" hint="当前筛选命中总数" />
      <MetricCard label="任务数" :value="runCount" hint="关联任务的会话" />
      <MetricCard label="输出文件" :value="outputCount" hint="可在工作空间下载" />
      <MetricCard label="费用估算" :value="estimatedCostText" hint="只关联余额展示，不做真实扣费" />
    </section>

    <div class="card p-5">
      <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 class="panel-title">运行轨迹</h2>
          <p class="panel-subtitle">
            运行轨迹只展示会话、工作空间、任务、输出文件引用、状态、观测摘要和时间；不会展示不适合普通用户查看的内部信息。
          </p>
          <p class="panel-subtitle">
            余额和充值状态只用于查看费用估算关联，当前页面不会执行真实扣费。
          </p>
        </div>
        <RouterLink class="btn btn-secondary" to="/workspace">查看文件空间</RouterLink>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import MetricCard from "@/components/common/MetricCard.vue";

defineProps<{
  businessFactSource?: string;
  customerDefaultLangfuseUi?: boolean;
  estimatedCostText: string;
  outputCount: number;
  runCount: number;
  sessionCount: number;
}>();
</script>
