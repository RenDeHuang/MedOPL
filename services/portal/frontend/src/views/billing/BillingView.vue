<template>
  <AppLayout title="账单" subtitle="余额、冻结金额、消费记录与账户流水">
    <div class="space-y-4">
      <div v-if="summaryLoading && !summaryPayload" class="card p-6 text-sm text-gray-500 dark:text-slate-400">正在加载账单摘要...</div>
      <div v-else-if="error" class="card p-6 text-sm text-red-600 dark:text-red-400">{{ error }}</div>
      <template v-else-if="payload">
        <BillingHero
          :billing-export-href="billingExportHref"
          :micro-money="microMoney"
          :money="money"
          :payload="payload"
          :task-export-href="taskExportHref"
        />

        <BillingCostBreakdownPanel
          :component-cost-hint="componentCostHint"
          :micro-money="microMoney"
          :payload="payload"
          :source-backfilled-value="sourceBackfilledValue"
          :source-backfill-hint="sourceBackfillHint"
        />

        <BillingTrendAndFilterPanel
          :current-from="payload.filter.from"
          :current-to="payload.filter.to"
          :filter-from="filterDraft.from"
          :filter-to="filterDraft.to"
          :loading="detailsLoading && !detailsPayload"
          :trend-chart-data="trendChartData"
          @update:filter-from="filterDraft.from = $event"
          @update:filter-to="filterDraft.to = $event"
          @apply="applyFilter"
          @reset="resetFilter"
        />

        <BillingWorkspaceCostPanel
          :billing-query="billingQuery"
          :items="payload.taskCosts"
          :loading="detailsLoading && !detailsPayload"
          :micro-money="microMoney"
          :next-page="nextPage"
          :pagination="payload.taskPagination"
          :previous-page="previousPage"
        />

        <section class="grid grid-cols-1 gap-4 xl:grid-cols-[1.2fr_1fr]">
          <BillingRunCostPanel
            :billing-query="billingQuery"
            :humanize-status="humanizeStatus"
            :items="payload.runCosts"
            :loading="detailsLoading && !detailsPayload"
            :micro-money="microMoney"
            :next-page="nextPage"
            :pagination="payload.runPagination"
            :previous-page="previousPage"
            :status-badge="statusBadge"
          />

          <BillingLedgerPanel
            :billing-query="billingQuery"
            :humanize-ledger-type="humanizeLedgerType"
            :items="payload.ledger"
            :loading="detailsLoading && !detailsPayload"
            :money="money"
            :next-page="nextPage"
            :pagination="payload.ledgerPagination"
            :previous-page="previousPage"
          />
        </section>
      </template>
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { useRoute, useRouter } from "vue-router";
import AppLayout from "@/layouts/AppLayout.vue";
import BillingCostBreakdownPanel from "@/components/billing/BillingCostBreakdownPanel.vue";
import BillingHero from "@/components/billing/BillingHero.vue";
import BillingLedgerPanel from "@/components/billing/BillingLedgerPanel.vue";
import BillingRunCostPanel from "@/components/billing/BillingRunCostPanel.vue";
import BillingTrendAndFilterPanel from "@/components/billing/BillingTrendAndFilterPanel.vue";
import BillingWorkspaceCostPanel from "@/components/billing/BillingWorkspaceCostPanel.vue";
import { useBillingSurface } from "@/composables/useBillingSurface";

const route = useRoute();
const router = useRouter();

const {
  billingExportHref,
  billingQuery,
  componentCostHint,
  detailsLoading,
  detailsPayload,
  error,
  filterDraft,
  humanizeLedgerType,
  humanizeStatus,
  microMoney,
  money,
  nextPage,
  payload,
  previousPage,
  resetFilter,
  sourceBackfilledValue,
  sourceBackfillHint,
  statusBadge,
  summaryLoading,
  summaryPayload,
  taskExportHref,
  trendChartData,
  applyFilter,
} = useBillingSurface(route, router);
</script>
