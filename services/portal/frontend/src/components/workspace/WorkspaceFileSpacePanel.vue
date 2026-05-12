<template>
  <section data-route-id="workspace" data-component-id="workspace.file_space" class="card p-5">
    <div class="flex flex-wrap items-start justify-between gap-4">
      <div>
        <div class="flex flex-wrap items-center gap-2">
          <span class="badge" :class="storageEntitlement.enabled ? 'badge-success' : 'badge-warning'">
            {{ storageEntitlement.enabled ? "文件写入已开启" : "文件写入未开启" }}
          </span>
          <span class="badge badge-primary">文件空间</span>
        </div>
        <h2 class="mt-3 panel-title">文件空间管理</h2>
        <p class="mt-2 panel-subtitle">
          工作空间只管理文件空间、文件夹、输入文件、输出文件和运行轨迹关联。需要购买、升级或扩容时，请到套餐页处理。
        </p>
        <p class="panel-subtitle">
          普通删除后进入 {{ fileSpaceRetentionDays }} 天保护期；永久删除或清空文件空间需要二次确认。
        </p>
      </div>
      <div class="flex flex-wrap items-center gap-3">
        <span class="text-sm text-gray-600 dark:text-slate-300">{{ fileSpaceUsageText }}</span>
        <RouterLink class="btn btn-secondary" to="/packages">去套餐页</RouterLink>
      </div>
    </div>

    <div v-if="payload.fileSpace" class="mt-5 grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
      <div class="rounded-2xl border border-gray-100 p-4 dark:border-slate-700">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <h3 class="text-sm font-semibold text-gray-950 dark:text-white">文件夹</h3>
          <span class="badge badge-primary">当前文件夹：{{ currentFolderName }}</span>
        </div>
        <div class="mt-3 grid gap-2">
          <div v-for="folder in payload.fileSpace.folders" :key="folder.folderRef" class="rounded-xl bg-gray-50 px-3 py-2 dark:bg-slate-800">
            <div class="text-sm font-medium text-gray-950 dark:text-white">{{ folder.name }}</div>
            <div class="mt-1 text-xs text-gray-500 dark:text-slate-400">{{ folder.path || "/" }} · {{ humanizeStatus(folder.status) }}</div>
          </div>
        </div>
        <div class="mt-4 flex flex-wrap gap-2">
          <button class="btn btn-secondary" type="button" :disabled="!payload.fileSpace.actions.createFolder">创建文件夹</button>
          <button class="btn btn-secondary" type="button" :disabled="!payload.fileSpace.actions.renameFolder">重命名文件夹</button>
          <button class="btn btn-secondary" type="button" :disabled="!payload.fileSpace.actions.moveFileOrFolder">移动文件或文件夹</button>
        </div>
      </div>

      <div class="rounded-2xl border border-gray-100 p-4 dark:border-slate-700">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <h3 class="text-sm font-semibold text-gray-950 dark:text-white">文件选择</h3>
          <span class="badge badge-success">已选择 {{ selectedFileCount }} 个</span>
        </div>
        <div class="mt-3 space-y-2">
          <label v-for="file in payload.fileSpace.files" :key="file.fileRef" class="flex gap-3 rounded-xl bg-gray-50 px-3 py-2 text-sm dark:bg-slate-800">
            <input class="mt-1 h-4 w-4 rounded border-gray-300 text-primary-600" type="checkbox" :checked="payload.fileSpace.selectedFileRefs.includes(file.fileRef)" :disabled="!payload.fileSpace.actions.selectFiles" />
            <span class="min-w-0 flex-1">
              <span class="block font-medium text-gray-950 dark:text-white">{{ file.name }}</span>
              <span class="mt-1 block text-xs text-gray-500 dark:text-slate-400">
                {{ fileKindText(file.kind) }} · 来源：{{ fileSourceText(file) }} · 状态：{{ fileProtectionText(file) }}
              </span>
              <span v-if="file.kind === 'output' && file.artifactRef" class="mt-1 block text-xs text-gray-500 dark:text-slate-400">
                输出文件已关联运行轨迹。
              </span>
            </span>
          </label>
          <div v-if="!payload.fileSpace.files.length" class="empty-state">当前文件夹没有文件。</div>
        </div>
        <div class="mt-4 flex flex-wrap gap-2">
          <button class="btn btn-secondary" type="button" :disabled="!payload.fileSpace.actions.uploadToCurrentFolder">上传文件到当前文件夹</button>
          <button class="btn btn-secondary" type="button" :disabled="!payload.fileSpace.actions.batchDownload">批量下载</button>
        </div>
        <div class="danger-action-group mt-4">
          <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <div class="text-sm font-semibold text-amber-900 dark:text-amber-200">危险操作</div>
              <p class="mt-1 text-xs text-amber-800 dark:text-amber-300">普通删除不需要二次确认；保护期为 {{ fileSpaceRetentionDays }} 天。</p>
            </div>
            <span class="badge badge-warning">保护期</span>
          </div>
          <div class="flex flex-wrap gap-2">
            <button class="btn btn-secondary" type="button" :disabled="!payload.fileSpace.actions.batchDelete">批量删除</button>
            <button class="btn btn-secondary" type="button" :disabled="!payload.fileSpace.actions.deleteFileOrFolder">删除文件或文件夹</button>
            <button class="btn btn-secondary" type="button" :disabled="!payload.fileSpace.actions.permanentDeleteRequiresConfirmation">永久删除 <span class="text-[11px] text-amber-700 dark:text-amber-300">需二次确认</span></button>
            <button class="btn btn-secondary" type="button" :disabled="!payload.fileSpace.actions.clearFileSpaceRequiresConfirmation">清空文件空间 <span class="text-[11px] text-amber-700 dark:text-amber-300">需二次确认</span></button>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { StorageEntitlementPayload, WorkspacePayload } from "@/api/portal/workspace";

defineProps<{
  currentFolderName: string;
  fileKindText: (value?: string) => string;
  fileProtectionText: (file: { status?: string; retentionUntil?: string }) => string;
  fileSourceText: (file: { source?: string; artifactRef?: string }) => string;
  fileSpaceRetentionDays: number;
  fileSpaceUsageText: string;
  humanizeStatus: (status?: string) => string;
  payload: WorkspacePayload;
  selectedFileCount: number;
  storageEntitlement: StorageEntitlementPayload;
}>();
</script>
