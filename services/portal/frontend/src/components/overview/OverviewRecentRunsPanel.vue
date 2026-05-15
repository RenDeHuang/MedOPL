<template>
  <section data-route-id="overview" data-component-id="overview.recent_runs" class="card p-5">
    <div class="mb-3 flex items-center justify-between gap-3">
      <div>
        <h2 class="panel-title">任务执行</h2>
        <p class="panel-subtitle">最近任务和会话状态，输出文件回到工作空间</p>
      </div>
      <span class="badge badge-primary">{{ total }} 条</span>
    </div>

    <div data-design-quality="task-result-flow" class="mb-3 grid grid-cols-3 gap-2 text-xs">
      <div class="rounded-lg border border-gray-100 px-3 py-2 dark:border-slate-700">
        <div class="font-medium text-gray-950 dark:text-white">输入文件</div>
        <div class="mt-1 text-gray-500 dark:text-slate-400">先进工作空间</div>
      </div>
      <div class="rounded-lg border border-gray-100 px-3 py-2 dark:border-slate-700">
        <div class="font-medium text-gray-950 dark:text-white">任务运行</div>
        <div class="mt-1 text-gray-500 dark:text-slate-400">在 OPL runtime 执行</div>
      </div>
      <div class="rounded-lg border border-gray-100 px-3 py-2 dark:border-slate-700">
        <div class="font-medium text-gray-950 dark:text-white">输出结果</div>
        <div class="mt-1 text-gray-500 dark:text-slate-400">回到工作空间</div>
      </div>
    </div>

    <div class="space-y-2.5">
      <div
        v-for="(item, index) in items"
        :key="item.displayTime || `latest-run-${index}`"
        class="rounded-2xl border border-gray-100 px-4 py-3 dark:border-slate-700"
      >
        <div class="flex items-start justify-between gap-3">
          <div>
            <div class="font-medium text-gray-950 dark:text-white">{{ item.workspaceTitle || `工作空间 ${index + 1}` }}</div>
            <div class="mt-1 text-xs text-gray-500 dark:text-slate-400">任务记录 {{ index + 1 }}</div>
          </div>
          <span class="badge" :class="statusBadge(item.status)">{{ humanizeStatus(item.status) }}</span>
        </div>
        <div class="mt-2 text-xs text-gray-500 dark:text-slate-400">{{ item.displayTime || "-" }}</div>
      </div>
      <div v-if="!items.length" class="empty-state">暂无运行记录</div>
    </div>

    <div class="pager-bar">
      <span>第 {{ page }} 页，共 {{ totalPages }} 页</span>
      <div class="flex gap-2">
        <RouterLink class="btn btn-secondary" :to="previousTo">上一页</RouterLink>
        <RouterLink class="btn btn-secondary" :to="nextTo">下一页</RouterLink>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { RouteLocationRaw } from "vue-router";
import type { OverviewPayload } from "@/api/portal/overview";

defineProps<{
  humanizeStatus: (status?: string) => string;
  items: OverviewPayload["latestRuns"];
  nextTo: RouteLocationRaw;
  page: number;
  previousTo: RouteLocationRaw;
  statusBadge: (status?: string) => string;
  total: number;
  totalPages: number;
}>();
</script>
