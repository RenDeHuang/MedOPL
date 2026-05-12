<template>
  <AppLayout title="工作空间" subtitle="上传文件、下载结果与空间管理">
    <div class="space-y-4">
      <div v-if="loading" class="card p-6 text-sm text-gray-500 dark:text-slate-400">正在加载工作空间...</div>
      <div v-else-if="error" class="card p-6 text-sm text-red-600 dark:text-red-400">{{ error }}</div>
      <template v-else-if="payload">
        <DashboardPageLayout>
          <template #hero>
            <WorkspaceHero
              :download-all-href="downloadAllHref"
              :estimated-cost-text="money(totalEstimatedCost)"
              :humanize-status="humanizeStatus"
              :is-active-workspace="isActiveWorkspace"
              :is-archived-workspace="isArchivedWorkspace"
              :payload="payload"
              :status-badge="statusBadge"
              :workspace-mas-href="workspaceMasHref"
            />
          </template>

          <template #primary>
            <DetailPageLayout>
              <template #primary>
                <WorkspaceFileSpacePanel
                  :current-folder-name="currentFolderName"
                  :file-kind-text="fileKindText"
                  :file-protection-text="fileProtectionText"
                  :file-source-text="fileSourceText"
                  :file-space-retention-days="fileSpaceRetentionDays"
                  :file-space-usage-text="fileSpaceUsageText"
                  :humanize-status="humanizeStatus"
                  :payload="payload"
                  :selected-file-count="selectedFileCount"
                  :storage-entitlement="storageEntitlement"
                />
              </template>

              <template #secondary>
                <WorkspaceManagedPlanPanel
                  :audit-status-text="auditStatusText"
                  :humanize-status="humanizeStatus"
                  :managed-plan="managedPlan"
                  :money="money"
                  :release-policy-text="releasePolicyText"
                  :snapshot-text="snapshotText"
                  :status-badge="statusBadge"
                />
              </template>
            </DetailPageLayout>
          </template>
        </DashboardPageLayout>

        <TablePageLayout>
          <WorkspaceListPanel
            :humanize-status="humanizeStatus"
            :next-page="nextPage"
            :payload="payload"
            :previous-page="previousPage"
            :status-badge="statusBadge"
            :workspace-query="workspaceQuery"
          />
        </TablePageLayout>

        <WorkspaceFilesPanel
          :cost-estimate-text="costEstimateText"
          :download-file-href="downloadFileHref"
          :has-linked-task="hasLinkedTask"
          :linked-task-text="linkedTaskText"
          :payload="payload"
          :recharge-status-text="rechargeStatusText"
          :upload-action="uploadAction"
          :upload-input="uploadInput"
          @submit-upload="submitUpload"
          @trigger-upload="triggerUpload"
        />
      </template>
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { useRoute } from "vue-router";
import AppLayout from "@/layouts/AppLayout.vue";
import DashboardPageLayout from "@/layouts/DashboardPageLayout.vue";
import DetailPageLayout from "@/layouts/DetailPageLayout.vue";
import TablePageLayout from "@/layouts/TablePageLayout.vue";
import WorkspaceFileSpacePanel from "@/components/workspace/WorkspaceFileSpacePanel.vue";
import WorkspaceFilesPanel from "@/components/workspace/WorkspaceFilesPanel.vue";
import WorkspaceHero from "@/components/workspace/WorkspaceHero.vue";
import WorkspaceListPanel from "@/components/workspace/WorkspaceListPanel.vue";
import WorkspaceManagedPlanPanel from "@/components/workspace/WorkspaceManagedPlanPanel.vue";
import { useWorkspaceSurface } from "@/composables/useWorkspaceSurface";

const route = useRoute();
const {
  auditStatusText,
  costEstimateText,
  currentFolderName,
  downloadAllHref,
  downloadFileHref,
  error,
  fileKindText,
  fileProtectionText,
  fileSourceText,
  fileSpaceRetentionDays,
  fileSpaceUsageText,
  hasLinkedTask,
  humanizeStatus,
  isActiveWorkspace,
  isArchivedWorkspace,
  linkedTaskText,
  loading,
  managedPlan,
  money,
  nextPage,
  payload,
  previousPage,
  rechargeStatusText,
  releasePolicyText,
  selectedFileCount,
  snapshotText,
  statusBadge,
  storageEntitlement,
  submitUpload,
  totalEstimatedCost,
  triggerUpload,
  uploadAction,
  uploadInput,
  workspaceMasHref,
  workspaceQuery,
} = useWorkspaceSurface(route);
</script>
