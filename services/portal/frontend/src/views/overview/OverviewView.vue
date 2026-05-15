<template>
  <AppLayout title="MedOPL" subtitle="普通用户总览">
    <div class="space-y-4">
      <div v-if="overviewLoading && !payload" class="card p-6 text-sm text-gray-500 dark:text-slate-400">正在加载总览...</div>
      <div v-else-if="error" class="card p-6 text-sm text-red-600 dark:text-red-400">{{ error }}</div>

      <template v-else-if="payload">
        <DashboardPageLayout>
          <template #hero>
            <OverviewHero
              :account-status="commercialText(payload.kpis.accountStatus)"
              :billing-status="commercialText(payload.kpis.billingStatus)"
              :can-enter-workbench="payload.commercial.canEnterWorkbench"
              :can-start-chargeable-run="payload.commercial.canStartChargeableRun"
              :compute-summary="computeSummary"
              :entitlement-status="commercialText(payload.kpis.entitlementStatus)"
              :next-action-detail="nextAction.detail"
              :next-action-href="nextAction.href"
              :next-action-label="nextAction.label"
              :release-status="releaseStatus"
              :selected-plan-name="selectedPlanDisplayName"
              :server-plans-ready="payload.serverPlansSummary.quotedCount > 0"
              :service-summary="serviceSummary"
              :storage-summary="storageSummary"
            />
          </template>

          <template #metrics>
            <OverviewFinancialMetricsPanel
              :available-balance="money(availableBalance)"
              :balance="money(payload.kpis.balance)"
              :frozen-amount="money(frozenAmount)"
              :session-count="sessionCount"
              :task-count="taskCount"
              :task-progress-text="taskProgressText"
              :today-spend="money(todaySpend)"
              :total-spend="money(totalSpend)"
            />
          </template>

          <template #primary>
            <section class="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_1fr]">
              <OverviewManagedEnvironmentPanel
                :audit-status-text="auditStatusText"
                :bindings="recentBindings"
                :display-file-space="displayFileSpace"
                :display-plan="displayPlan"
                :file-space-status="fileSpaceStatus"
                :humanize-status="humanizeStatus"
                :loading="resourcePanelLoading"
                :managed-environment-status="managedEnvironmentStatus"
                :money="money"
                :release-status="releaseStatus"
                :status-badge="statusBadge"
              />
              <OverviewRecentRunsPanel
                :humanize-status="humanizeStatus"
                :items="payload.latestRuns"
                :next-to="overviewQuery({ runs_page: nextPage(payload.latestRunsPagination.page, payload.latestRunsPagination.totalPages) })"
                :page="payload.latestRunsPagination.page"
                :previous-to="overviewQuery({ runs_page: previousPage(payload.latestRunsPagination.page) })"
                :status-badge="statusBadge"
                :total="payload.latestRunsPagination.total"
                :total-pages="payload.latestRunsPagination.totalPages"
              />
            </section>
          </template>

          <template #secondary>
            <section class="grid grid-cols-1 gap-4 xl:grid-cols-[1.05fr_0.95fr]">
              <OverviewPlansPanel
                :compute-summary="computeSummary"
                :lowest-hourly-price="money(payload.serverPlansSummary.lowestHourlyPrice)"
                :purchasable-count="payload.serverPlansSummary.purchasableCount"
                :quoted-count="payload.serverPlansSummary.quotedCount"
                :selected-plan-name="selectedPlanDisplayName"
                :storage-summary="storageSummary"
              />
              <OverviewWorkspacePanel
                :humanize-status="humanizeStatus"
                :items="payload.taskCards"
                :status-badge="statusBadge"
              />
            </section>
          </template>
        </DashboardPageLayout>
      </template>
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { useRoute } from "vue-router";
import AppLayout from "@/layouts/AppLayout.vue";
import DashboardPageLayout from "@/layouts/DashboardPageLayout.vue";
import OverviewFinancialMetricsPanel from "@/components/overview/OverviewFinancialMetricsPanel.vue";
import OverviewHero from "@/components/overview/OverviewHero.vue";
import OverviewManagedEnvironmentPanel from "@/components/overview/OverviewManagedEnvironmentPanel.vue";
import OverviewPlansPanel from "@/components/overview/OverviewPlansPanel.vue";
import OverviewRecentRunsPanel from "@/components/overview/OverviewRecentRunsPanel.vue";
import OverviewWorkspacePanel from "@/components/overview/OverviewWorkspacePanel.vue";
import { useOverviewSurface } from "@/composables/useOverviewSurface";

const route = useRoute();
const {
  auditStatusText,
  availableBalance,
  commercialText,
  computeSummary,
  displayFileSpace,
  displayPlan,
  error,
  exactMonth,
  fileSpaceStatus,
  frozenAmount,
  humanizeStatus,
  managedEnvironmentStatus,
  money,
  nextAction,
  nextPage,
  overviewLoading,
  overviewQuery,
  payload,
  pendingMonth,
  previousPage,
  recentBindings,
  resourcePanelLoading,
  releaseStatus,
  selectedPlanDisplayName,
  serviceSummary,
  sessionCount,
  statusBadge,
  storageSummary,
  taskCount,
  taskProgressText,
  todaySpend,
  totalSpend,
  workbenchHref,
} = useOverviewSurface(route);
</script>
