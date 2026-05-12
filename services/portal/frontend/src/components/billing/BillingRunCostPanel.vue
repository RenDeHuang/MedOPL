<template>
  <section data-route-id="billing" data-component-id="billing.run_costs" class="card p-5">
    <div class="mb-3 flex items-center justify-between gap-3">
      <div>
        <h2 class="panel-title">任务明细</h2>
        <p class="panel-subtitle">单次任务的状态、账单来源与总消费。</p>
      </div>
      <span class="badge badge-primary">{{ pagination.total }} 条</span>
    </div>

    <div v-if="loading" class="empty-state">正在加载运行明细...</div>
    <div class="mobile-card-list">
      <div v-for="(item, index) in items" :key="item.runId" class="mobile-only-card">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <div class="font-medium text-gray-950 dark:text-white">任务 {{ index + 1 }}</div>
            <div class="mt-1 text-xs text-gray-500 dark:text-slate-400">工作空间 {{ index + 1 }}</div>
          </div>
          <span class="badge shrink-0" :class="statusBadge(item.runStatus)">{{ humanizeStatus(item.runStatus) }}</span>
        </div>
        <div class="mt-3 grid grid-cols-2 gap-2 text-xs text-gray-500 dark:text-slate-400">
          <div><span class="block text-gray-400 dark:text-slate-500">账单来源</span>{{ item.pricingSource || "-" }}</div>
          <div><span class="block text-gray-400 dark:text-slate-500">总消费</span>{{ microMoney(item.totalCost) }}</div>
        </div>
      </div>
      <div v-if="!items.length" class="empty-state">当前窗口暂无运行明细</div>
    </div>
    <div class="desktop-table-shell">
      <table class="min-w-[680px] text-sm">
        <thead>
          <tr class="table-head">
            <th class="px-4 py-3">任务</th>
            <th class="px-4 py-3">工作空间</th>
            <th class="px-4 py-3">状态</th>
            <th class="px-4 py-3">账单来源</th>
            <th class="px-4 py-3">总消费</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(item, index) in items" :key="item.runId" class="table-row">
            <td class="px-4 py-3 text-xs text-gray-700 dark:text-slate-300">任务 {{ index + 1 }}</td>
            <td class="px-4 py-3 text-gray-700 dark:text-slate-300">工作空间 {{ index + 1 }}</td>
            <td class="px-4 py-3">
              <span class="badge" :class="statusBadge(item.runStatus)">{{ humanizeStatus(item.runStatus) }}</span>
            </td>
            <td class="px-4 py-3 text-gray-500 dark:text-slate-400">{{ item.pricingSource || "-" }}</td>
            <td class="px-4 py-3 font-medium text-gray-950 dark:text-white">{{ microMoney(item.totalCost) }}</td>
          </tr>
          <tr v-if="!items.length">
            <td colspan="5" class="px-4 py-6 text-center text-sm text-gray-500 dark:text-slate-400">当前窗口暂无运行明细</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="pager-bar">
      <span>第 {{ pagination.page }} / {{ pagination.totalPages }} 页</span>
      <div class="flex gap-2">
        <RouterLink class="btn btn-secondary" :to="billingQuery({ runs_page: previousPage(pagination.page) })">上一页</RouterLink>
        <RouterLink class="btn btn-secondary" :to="billingQuery({ runs_page: nextPage(pagination.page, pagination.totalPages) })">下一页</RouterLink>
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
  humanizeStatus: (status?: string) => string;
  items: BillingPayload["runCosts"];
  loading: boolean;
  microMoney: (value: number | undefined) => string;
  nextPage: (page: number, totalPages: number) => number;
  pagination: PortalPagination;
  previousPage: (page: number) => number;
  statusBadge: (status?: string) => string;
}>();
</script>
