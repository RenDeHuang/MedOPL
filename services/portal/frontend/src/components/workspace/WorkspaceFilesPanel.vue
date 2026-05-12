<template>
  <section data-route-id="workspace" data-component-id="workspace.files">
    <DetailPageLayout>
      <template #primary>
        <div class="card p-5">
          <div class="mb-3 flex items-center justify-between gap-3">
            <div>
              <h2 class="panel-title">输入文件</h2>
              <p class="panel-subtitle">当前工作空间文件夹中的输入文件。</p>
            </div>
            <button v-if="payload.storageEntitlement?.enabled" class="btn btn-secondary" type="button" @click="$emit('triggerUpload')">上传文件到当前文件夹</button>
            <RouterLink v-else class="btn btn-secondary" to="/packages">去套餐页</RouterLink>
            <form class="hidden" method="post" :action="uploadAction" enctype="multipart/form-data">
              <input ref="uploadInput" class="hidden" name="file" type="file" @change="$emit('submitUpload')" />
            </form>
          </div>
          <div class="space-y-2.5">
            <div v-for="item in payload.files" :key="item.name" class="rounded-2xl border border-gray-100 px-4 py-3 dark:border-slate-700">
              <div class="font-medium text-gray-950 dark:text-white">{{ item.name }}</div>
              <div class="mt-2">
                <a class="text-sm font-medium text-primary-600 hover:text-primary-500 dark:text-primary-400" :href="downloadFileHref('inputs', item.name)">下载</a>
              </div>
            </div>
            <div v-if="!payload.files.length" class="empty-state">当前没有输入文件。</div>
            <div v-if="!payload.storageEntitlement?.enabled" class="empty-state">当前工作空间还不能写入文件，请先到套餐页开通或扩容。</div>
          </div>
        </div>
      </template>

      <template #secondary>
        <div class="card p-5">
          <div class="mb-3 flex items-center justify-between gap-3">
            <div>
              <h2 class="panel-title">输出文件</h2>
              <p class="panel-subtitle">当前工作空间文件夹中的输出文件和输出结果。</p>
            </div>
            <span class="badge badge-success">{{ payload.counts.outputs }} 个</span>
          </div>
          <div class="space-y-2.5">
            <div v-for="item in payload.outputs" :key="item.name" class="rounded-2xl border border-gray-100 px-4 py-3 dark:border-slate-700">
              <div class="font-medium text-gray-950 dark:text-white">{{ item.name }}</div>
              <div v-if="item.artifactRef || hasLinkedTask(item)" class="mt-1 text-xs text-gray-500 dark:text-slate-400">
                输出文件来自运行轨迹；关联任务 {{ linkedTaskText(item) }}
              </div>
              <div class="mt-1 text-xs text-gray-500 dark:text-slate-400">
                资源用量 {{ item.resourceUsage?.outputFileCount || 0 }} 个输出文件；费用估算 {{ costEstimateText(item) }}。
              </div>
              <div class="mt-1 text-xs text-gray-500 dark:text-slate-400">
                余额关联 {{ item.balanceLink?.linkedToBalance ? "已关联" : "待估算" }}，充值状态 {{ rechargeStatusText(item.balanceLink?.rechargeStatus) }}。
              </div>
              <div class="mt-2">
                <a class="text-sm font-medium text-primary-600 hover:text-primary-500 dark:text-primary-400" :href="downloadFileHref('outputs', item.name)">下载</a>
              </div>
            </div>
            <div v-if="!payload.outputs.length" class="empty-state">当前没有输出文件。</div>
          </div>
        </div>
      </template>
    </DetailPageLayout>
  </section>
</template>

<script setup lang="ts">
import type { Ref } from "vue";
import type { WorkspacePayload } from "@/api/portal/workspace";
import DetailPageLayout from "@/layouts/DetailPageLayout.vue";

defineProps<{
  costEstimateText: (item: { costEstimate?: { amount?: number; currency?: string } }) => string;
  downloadFileHref: (kind: "inputs" | "outputs", fileName: string) => string;
  hasLinkedTask: (item: { runId?: string }) => boolean;
  linkedTaskText: (item: { runId?: string }) => string;
  payload: WorkspacePayload;
  rechargeStatusText: (value?: string) => string;
  uploadAction: string;
  uploadInput: Ref<HTMLInputElement | null>;
}>();

defineEmits<{
  submitUpload: [];
  triggerUpload: [];
}>();
</script>
