<template>
  <section data-route-id="billing" data-component-id="billing.ledger" class="card p-5">
    <div class="mb-3 flex items-center justify-between gap-3">
      <div>
        <h2 class="panel-title">账户流水</h2>
        <p class="panel-subtitle">充值、资源扣费、退款和补扣。</p>
      </div>
      <span class="badge badge-success">{{ pagination.total }} 条</span>
    </div>
    <div class="space-y-2.5">
      <div v-if="loading" class="empty-state">正在加载账户流水...</div>
      <div v-for="item in items" :key="item.id || `${item.type}-${item.createdAt}`" class="rounded-2xl border border-gray-100 px-4 py-3 dark:border-slate-700">
        <div class="flex items-start justify-between gap-3">
          <div>
            <div class="font-medium text-gray-950 dark:text-white">{{ humanizeLedgerType(item.type) }}</div>
            <div class="mt-1 text-xs text-gray-500 dark:text-slate-400">{{ item.createdAt || "-" }}</div>
          </div>
          <div class="text-right">
            <div class="font-medium text-gray-950 dark:text-white">{{ money(item.amount) }}</div>
            <div class="mt-1 text-xs text-gray-500 dark:text-slate-400">{{ item.reason || "-" }}</div>
          </div>
        </div>
      </div>
      <div v-if="!items.length" class="empty-state">当前窗口暂无账户流水</div>
    </div>

    <div class="pager-bar">
      <span>第 {{ pagination.page }} / {{ pagination.totalPages }} 页</span>
      <div class="flex gap-2">
        <RouterLink class="btn btn-secondary" :to="billingQuery({ ledger_page: previousPage(pagination.page) })">上一页</RouterLink>
        <RouterLink class="btn btn-secondary" :to="billingQuery({ ledger_page: nextPage(pagination.page, pagination.totalPages) })">下一页</RouterLink>
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
  humanizeLedgerType: (type?: string) => string;
  items: BillingPayload["ledger"];
  loading: boolean;
  money: (value: number | undefined) => string;
  nextPage: (page: number, totalPages: number) => number;
  pagination: PortalPagination;
  previousPage: (page: number) => number;
}>();
</script>
