<template>
  <section data-route-id="workspace" data-component-id="workspace.list" class="card p-5">
    <div class="mb-3 flex items-center justify-between gap-3">
      <div>
        <h2 class="panel-title">工作空间列表</h2>
        <p class="panel-subtitle">统一展示上传文件、下载结果、任务、状态和更新时间。</p>
      </div>
      <span class="badge badge-primary">{{ payload.tasksPagination.total }} 个</span>
    </div>

    <div class="mobile-card-list">
      <div v-for="item in payload.tasksPageRows" :key="item.slug" class="mobile-only-card">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <div class="font-medium text-gray-950 dark:text-white">{{ item.title || item.slug }}</div>
            <div class="mt-1 truncate text-xs text-gray-500 dark:text-slate-400">{{ item.slug }}</div>
          </div>
          <span class="badge shrink-0" :class="statusBadge(item.status)">{{ humanizeStatus(item.status) }}</span>
        </div>
        <div class="mt-3 grid grid-cols-3 gap-2 text-xs text-gray-500 dark:text-slate-400">
          <div><span class="block text-gray-400 dark:text-slate-500">输入文件</span>{{ item.inputs }}</div>
          <div><span class="block text-gray-400 dark:text-slate-500">输出文件</span>{{ item.outputs }}</div>
          <div><span class="block text-gray-400 dark:text-slate-500">任务</span>{{ item.runs }}</div>
        </div>
        <div class="mt-3 flex items-center justify-between gap-3">
          <span class="truncate text-xs text-gray-500 dark:text-slate-400">{{ item.updatedAt || "-" }}</span>
          <RouterLink class="text-sm font-medium text-primary-600 hover:text-primary-500 dark:text-primary-400" :to="{ path: '/workspace', query: { task: item.slug } }">
            打开
          </RouterLink>
        </div>
      </div>
      <div v-if="!payload.tasksPageRows.length" class="empty-state">暂无工作空间</div>
    </div>

    <div class="desktop-table-shell">
      <table class="min-w-[760px] text-sm">
        <thead>
          <tr class="table-head">
            <th class="px-4 py-3">工作空间</th>
            <th class="px-4 py-3">输入文件</th>
            <th class="px-4 py-3">输出文件</th>
            <th class="px-4 py-3">任务</th>
            <th class="px-4 py-3">状态</th>
            <th class="px-4 py-3">最近更新</th>
            <th class="px-4 py-3">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in payload.tasksPageRows" :key="item.slug" class="table-row">
            <td class="px-4 py-3">
              <div class="font-medium text-gray-950 dark:text-white">{{ item.title || item.slug }}</div>
              <div class="mt-1 whitespace-nowrap text-xs text-gray-500 dark:text-slate-400">{{ item.slug }}</div>
            </td>
            <td class="whitespace-nowrap px-4 py-3 text-gray-700 dark:text-slate-300">{{ item.inputs }}</td>
            <td class="whitespace-nowrap px-4 py-3 text-gray-700 dark:text-slate-300">{{ item.outputs }}</td>
            <td class="whitespace-nowrap px-4 py-3 text-gray-700 dark:text-slate-300">{{ item.runs }}</td>
            <td class="px-4 py-3">
              <span class="badge" :class="statusBadge(item.status)">{{ humanizeStatus(item.status) }}</span>
            </td>
            <td class="whitespace-nowrap px-4 py-3 text-gray-500 dark:text-slate-400">{{ item.updatedAt || "-" }}</td>
            <td class="whitespace-nowrap px-4 py-3">
              <RouterLink class="text-sm font-medium text-primary-600 hover:text-primary-500 dark:text-primary-400" :to="{ path: '/workspace', query: { task: item.slug } }">
                打开
              </RouterLink>
            </td>
          </tr>
          <tr v-if="!payload.tasksPageRows.length">
            <td colspan="7" class="px-4 py-6 text-center text-sm text-gray-500 dark:text-slate-400">暂无工作空间</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="pager-bar">
      <span>第 {{ payload.tasksPagination.page }} / {{ payload.tasksPagination.totalPages }} 页</span>
      <div class="flex gap-2">
        <RouterLink class="btn btn-secondary" :to="workspaceQuery({ tasks_page: previousPage(payload.tasksPagination.page) })">上一页</RouterLink>
        <RouterLink class="btn btn-secondary" :to="workspaceQuery({ tasks_page: nextPage(payload.tasksPagination.page, payload.tasksPagination.totalPages) })">下一页</RouterLink>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { RouteLocationRaw } from "vue-router";
import type { PortalQueryValue } from "@/api/portal/common";
import type { WorkspacePayload } from "@/api/portal/workspace";

defineProps<{
  humanizeStatus: (status?: string) => string;
  nextPage: (page: number, totalPages: number) => number;
  payload: WorkspacePayload;
  previousPage: (page: number) => number;
  statusBadge: (status?: string) => string;
  workspaceQuery: (updates: Record<string, PortalQueryValue>) => RouteLocationRaw;
}>();
</script>
