<template>
  <section data-route-id="billing" data-component-id="billing.workspace_costs" class="card p-5">
    <div class="mb-3 flex items-center justify-between gap-3">
      <div>
        <h2 class="panel-title">工作空间成本明细</h2>
        <p class="panel-subtitle">按工作空间查看计算、加速、文件空间和总消费。</p>
      </div>
      <span class="badge badge-warning">{{ pagination.total }} 项</span>
    </div>

    <div v-if="loading" class="empty-state">正在加载工作空间成本明细...</div>
    <div class="mobile-card-list">
      <div v-for="item in items" :key="item.slug" class="mobile-only-card">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <div class="font-medium text-gray-950 dark:text-white">{{ item.title || item.slug }}</div>
            <div class="mt-1 truncate text-xs text-gray-500 dark:text-slate-400">{{ item.slug }}</div>
          </div>
          <div class="shrink-0 text-right text-sm font-medium text-gray-950 dark:text-white">{{ microMoney(item.totalCost) }}</div>
        </div>
        <div class="mt-3 grid grid-cols-2 gap-2 text-xs text-gray-500 dark:text-slate-400">
          <div><span class="block text-gray-400 dark:text-slate-500">任务数</span>{{ item.runCount }}</div>
          <div><span class="block text-gray-400 dark:text-slate-500">计算</span>{{ microMoney(item.cpuCost) }}</div>
          <div><span class="block text-gray-400 dark:text-slate-500">加速</span>{{ microMoney(item.gpuCost) }}</div>
          <div><span class="block text-gray-400 dark:text-slate-500">文件空间</span>{{ microMoney(item.storageCost) }}</div>
        </div>
      </div>
      <div v-if="!items.length" class="empty-state">当前窗口暂无工作空间成本</div>
    </div>
    <div class="desktop-table-shell">
      <table class="min-w-[760px] text-sm">
        <thead>
          <tr class="table-head">
            <th class="px-4 py-3">工作空间</th>
            <th class="px-4 py-3">任务数</th>
            <th class="px-4 py-3">计算</th>
            <th class="px-4 py-3">加速</th>
            <th class="px-4 py-3">文件空间</th>
            <th class="px-4 py-3">总消费</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in items" :key="item.slug" class="table-row">
            <td class="px-4 py-3">
              <div class="font-medium text-gray-950 dark:text-white">{{ item.title || item.slug }}</div>
              <div class="mt-1 text-xs text-gray-500 dark:text-slate-400">{{ item.slug }}</div>
            </td>
            <td class="px-4 py-3 text-gray-700 dark:text-slate-300">{{ item.runCount }}</td>
            <td class="px-4 py-3 text-gray-700 dark:text-slate-300">{{ microMoney(item.cpuCost) }}</td>
            <td class="px-4 py-3 text-gray-700 dark:text-slate-300">{{ microMoney(item.gpuCost) }}</td>
            <td class="px-4 py-3 text-gray-700 dark:text-slate-300">{{ microMoney(item.storageCost) }}</td>
            <td class="px-4 py-3 font-medium text-gray-950 dark:text-white">{{ microMoney(item.totalCost) }}</td>
          </tr>
          <tr v-if="!items.length">
            <td colspan="6" class="px-4 py-6 text-center text-sm text-gray-500 dark:text-slate-400">当前窗口暂无工作空间成本</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="pager-bar">
      <span>第 {{ pagination.page }} / {{ pagination.totalPages }} 页</span>
      <div class="flex gap-2">
        <RouterLink class="btn btn-secondary" :to="billingQuery({ tasks_page: previousPage(pagination.page) })">上一页</RouterLink>
        <RouterLink class="btn btn-secondary" :to="billingQuery({ tasks_page: nextPage(pagination.page, pagination.totalPages) })">下一页</RouterLink>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { RouteLocationRaw } from "vue-router";
import type { BillingPayload } from "@/api/portal/billing";
import type { PortalPagination, PortalQueryValue } from "@/api/portal/common";

defineProps<{
  billingQuery: (updates: Record<string, PortalQueryValue>) => RouteLocationRaw;
  items: BillingPayload["taskCosts"];
  loading: boolean;
  microMoney: (value: number | undefined) => string;
  nextPage: (page: number, totalPages: number) => number;
  pagination: PortalPagination;
  previousPage: (page: number) => number;
}>();
</script>
