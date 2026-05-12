<template>
  <section data-route-id="billing" data-component-id="billing.trend_filter" class="grid grid-cols-1 gap-4 xl:grid-cols-[1.3fr_1fr]">
    <div class="card p-5">
      <div class="mb-3 flex items-center justify-between gap-3">
        <div>
          <h2 class="panel-title">成本趋势</h2>
          <p class="panel-subtitle">按日查看总成本与主要成本项变化。</p>
        </div>
        <span class="badge badge-primary">7 天</span>
      </div>
      <div class="h-[260px]">
        <div v-if="loading" class="flex h-full items-center justify-center text-sm text-gray-500 dark:text-slate-400">正在加载趋势...</div>
        <Bar v-if="trendChartData" :data="trendChartData" :options="barOptions" />
        <div v-else-if="!loading" class="flex h-full items-center justify-center text-sm text-gray-500 dark:text-slate-400">暂无趋势数据</div>
      </div>
    </div>

    <div class="card p-5">
      <div class="mb-3 flex items-center justify-between gap-3">
        <div>
          <h2 class="panel-title">筛选窗口</h2>
          <p class="panel-subtitle">按日期查看账单窗口。</p>
        </div>
      </div>
      <div class="space-y-3">
        <DateRangeFilter
          :from="filterFrom"
          :to="filterTo"
          @update:from="$emit('update:filterFrom', $event)"
          @update:to="$emit('update:filterTo', $event)"
          @apply="$emit('apply')"
          @reset="$emit('reset')"
        />
        <div class="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-gray-600 dark:bg-slate-900/70 dark:text-slate-300">
          当前窗口：{{ currentFrom }} 至 {{ currentTo }}
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { ChartData, ChartOptions } from "chart.js";
import { BarElement, CategoryScale, Chart as ChartJS, Legend, LinearScale, Tooltip } from "chart.js";
import { Bar } from "vue-chartjs";
import DateRangeFilter from "@/components/common/DateRangeFilter.vue";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

defineProps<{
  currentFrom: string;
  currentTo: string;
  filterFrom: string;
  filterTo: string;
  loading: boolean;
  trendChartData: ChartData<"bar"> | null;
}>();

defineEmits<{
  "update:filterFrom": [value: string];
  "update:filterTo": [value: string];
  apply: [];
  reset: [];
}>();

const barOptions: ChartOptions<"bar"> = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: "bottom",
      labels: { color: "#64748b" },
    },
  },
  scales: {
    x: { ticks: { color: "#64748b" }, grid: { color: "rgba(148,163,184,0.12)" } },
    y: { ticks: { color: "#64748b" }, grid: { color: "rgba(148,163,184,0.12)" } },
  },
};
</script>
