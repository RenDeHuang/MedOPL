<template>
  <section data-route-id="overview" data-component-id="overview.workspace" class="card p-5">
    <div class="mb-3 flex items-center justify-between gap-3">
      <div>
        <h2 class="panel-title">工作空间</h2>
        <p class="panel-subtitle">工作空间文件夹、输入文件、输出文件和输出结果都归属工作空间</p>
      </div>
      <RouterLink class="btn btn-secondary" to="/workspace">查看工作空间</RouterLink>
    </div>
    <div data-design-quality="workspace-file-flow" class="mb-3 rounded-lg border border-gray-100 px-4 py-3 text-sm text-gray-600 dark:border-slate-700 dark:text-slate-300">
      文件进入工作空间后由 OPL runtime 读取，结果回到工作空间；Portal 负责展示、下载、账单关联和释放后的保留状态。
    </div>
    <div class="space-y-2.5">
      <div
        v-for="item in items.slice(0, 3)"
        :key="item.slug"
        class="rounded-2xl border border-gray-100 px-4 py-3 dark:border-slate-700"
      >
        <div class="flex items-start justify-between gap-3">
          <div>
            <div class="font-medium text-gray-950 dark:text-white">{{ item.title || item.slug }}</div>
            <div class="mt-1 text-xs text-gray-500 dark:text-slate-400">工作空间</div>
          </div>
          <span class="badge" :class="statusBadge(item.status)">{{ humanizeStatus(item.status) }}</span>
        </div>
        <div class="mt-2 flex items-center justify-between gap-3 text-xs text-gray-500 dark:text-slate-400">
          <span>{{ item.runCount || 0 }} 次运行</span>
          <span>{{ item.updatedAt || "-" }}</span>
        </div>
      </div>
      <div v-if="!items.length" class="empty-state">还没有工作空间</div>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { OverviewPayload } from "@/api/portal/overview";

defineProps<{
  humanizeStatus: (status?: string) => string;
  items: OverviewPayload["taskCards"];
  statusBadge: (status?: string) => string;
}>();
</script>
