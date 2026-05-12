<template>
  <AppLayout title="会话轨迹" subtitle="查看会话、任务状态、文件结果与审计轨迹">
    <div class="space-y-4">
      <div v-if="loading" class="card p-6 text-sm text-gray-500 dark:text-slate-400">正在加载会话轨迹...</div>
      <div v-else-if="error" class="card p-6 text-sm text-red-600 dark:text-red-400">{{ error }}</div>
      <template v-else-if="payload">
        <DashboardPageLayout>
          <template #hero>
            <TraceHero
              :business-fact-source="payload.summary.businessFactSource"
              :customer-default-langfuse-ui="payload.customerDefaultLangfuseUi"
              :estimated-cost-text="money(totalEstimatedCost)"
              :output-count="outputCount"
              :run-count="runCount"
              :session-count="payload.pagination.total"
            />
          </template>

          <template #primary>
            <TablePageLayout>
              <template #filters>
                <TraceFilterPanel
                  :filters="filters"
                  @apply="applyFilters"
                  @reset="resetFilters"
                  @update-filter="updateFilter"
                />
              </template>

              <TraceSessionTablePanel
                :cost-estimate-text="costEstimateText"
                :display-index="displayIndex"
                :humanize-status="humanizeStatus"
                :items="payload.items"
                :linked-output-files="linkedOutputFiles"
                :next-page="nextPage"
                :pagination="payload.pagination"
                :previous-page="previousPage"
                :recharge-status-text="rechargeStatusText"
                :status-badge="statusBadge"
                :trace-count="payload.summary.traceCount || 0"
                :trace-query="traceQuery"
              />
            </TablePageLayout>
          </template>
        </DashboardPageLayout>
      </template>
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { useRoute, useRouter } from "vue-router";
import AppLayout from "@/layouts/AppLayout.vue";
import DashboardPageLayout from "@/layouts/DashboardPageLayout.vue";
import TablePageLayout from "@/layouts/TablePageLayout.vue";
import TraceFilterPanel from "@/components/trace/TraceFilterPanel.vue";
import TraceHero from "@/components/trace/TraceHero.vue";
import TraceSessionTablePanel from "@/components/trace/TraceSessionTablePanel.vue";
import { useTraceSurface } from "@/composables/useTraceSurface";

const route = useRoute();
const router = useRouter();
const {
  applyFilters,
  costEstimateText,
  displayIndex,
  error,
  filters,
  humanizeStatus,
  linkedOutputFiles,
  loading,
  money,
  nextPage,
  outputCount,
  payload,
  previousPage,
  rechargeStatusText,
  resetFilters,
  runCount,
  statusBadge,
  totalEstimatedCost,
  traceQuery,
  updateFilter,
} = useTraceSurface(route, router);
</script>
