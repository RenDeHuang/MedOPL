<template>
  <AppLayout title="工作台资源" subtitle="查看套餐、文件空间、费用估算与释放策略">
    <div class="space-y-4">
      <section v-if="actionFeedback" class="card p-4">
        <div class="text-sm text-emerald-700 dark:text-emerald-300">{{ actionFeedback }}</div>
      </section>

      <section v-if="errorMessage" class="card p-4">
        <div class="text-sm text-red-600 dark:text-red-400">{{ errorMessage }}</div>
      </section>

      <section v-if="resourcesLoading" class="card p-5">
        <div class="text-sm text-gray-600 dark:text-slate-300">正在加载工作台资源...</div>
      </section>

      <DashboardPageLayout>
        <template #hero>
          <ResourcesHero
            :balance-freeze-status="balanceFreezeStatus"
            :current-concurrency-text="currentConcurrencyText"
            :current-compute-spec="currentComputeSpec"
            :current-file-space-text="currentFileSpaceText"
            :current-plan-name="currentPlanName"
            :estimated-cost-text="money(estimatedCost)"
            :resources-loading="resourcesLoading"
            @reload="reload"
          />
        </template>

        <template #primary>
          <DetailPageLayout>
            <template #primary>
              <ResourcesPlanSelectionPanel
                :current-plan-id="currentPlanId"
                :plan-cards="planCards"
                @set-adjustment-plan="setAdjustmentPlan"
              />
            </template>

            <template #secondary>
              <ResourcesAdjustmentPanel @set-adjustment-plan="setAdjustmentPlan" />
            </template>
          </DetailPageLayout>
        </template>

        <template #secondary>
          <DetailPageLayout>
            <template #primary>
              <ResourcesCurrentPanel
                :compute-spec-text="computeSpecText"
                :concurrency-text="concurrencyText"
                :current-status="currentStatus"
                :items="items"
                :plan-label="planLabel"
                :protection-estimate-text="protectionEstimateText"
                :status-badge="statusBadge"
                :status-text="statusText"
                :storage-capacity-text="storageCapacityText"
                :workspace-display-name="workspaceDisplayName"
              />
            </template>

            <template #secondary>
              <ResourcesReleaseAuditPanel
                :audit-status-text="auditStatusText"
                :current-protection="currentProtection"
                :release-policy-text="releasePolicyText"
                :stop-billing-text="stopBillingText"
              />
            </template>
          </DetailPageLayout>
        </template>
      </DashboardPageLayout>
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import AppLayout from "@/layouts/AppLayout.vue";
import DashboardPageLayout from "@/layouts/DashboardPageLayout.vue";
import DetailPageLayout from "@/layouts/DetailPageLayout.vue";
import ResourcesAdjustmentPanel from "@/components/resources/ResourcesAdjustmentPanel.vue";
import ResourcesCurrentPanel from "@/components/resources/ResourcesCurrentPanel.vue";
import ResourcesHero from "@/components/resources/ResourcesHero.vue";
import ResourcesPlanSelectionPanel from "@/components/resources/ResourcesPlanSelectionPanel.vue";
import ResourcesReleaseAuditPanel from "@/components/resources/ResourcesReleaseAuditPanel.vue";
import { useResourcesSurface } from "@/composables/useResourcesSurface";

const {
  actionFeedback,
  auditStatusText,
  balanceFreezeStatus,
  computeSpecText,
  concurrencyText,
  currentConcurrencyText,
  currentComputeSpec,
  currentFileSpaceText,
  currentPlanId,
  currentPlanName,
  currentProtection,
  currentStatus,
  errorMessage,
  estimatedCost,
  items,
  money,
  planCards,
  planLabel,
  protectionEstimateText,
  releasePolicyText,
  reload,
  resourcesLoading,
  setAdjustmentPlan,
  statusBadge,
  statusText,
  stopBillingText,
  storageCapacityText,
  workspaceDisplayName,
} = useResourcesSurface();
</script>
