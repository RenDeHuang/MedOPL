<template>
  <section data-route-id="overview" data-component-id="overview.financial_metrics" class="space-y-4">
    <div class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      <MetricCard label="余额" :value="balance" hint="账户余额" />
      <MetricCard label="可用余额" :value="availableBalance" hint="可用于新任务的金额" />
      <MetricCard label="冻结金额" :value="frozenAmount" hint="运行中的冻结金额" />
      <MetricCard label="累计消费" :value="totalSpend" hint="已核对的累计消费" />
    </div>
    <div class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      <MetricCard label="今日消费" :value="todaySpend" hint="今日已记录消费" />
      <MetricCard label="会话数" :value="sessionCount" hint="最近可见会话记录" />
      <MetricCard label="任务数" :value="taskCount" hint="工作空间任务数量" />
      <MetricCard label="任务进度" :value="taskProgressText" hint="最近任务状态" />
    </div>
  </section>
</template>

<script setup lang="ts">
import MetricCard from "@/components/common/MetricCard.vue";

defineProps<{
  availableBalance: string;
  balance: string;
  frozenAmount: string;
  sessionCount: string | number;
  taskCount: string | number;
  taskProgressText: string;
  todaySpend: string;
  totalSpend: string;
}>();
</script>
