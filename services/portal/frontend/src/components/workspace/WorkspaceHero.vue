<template>
  <section data-route-id="workspace" data-component-id="workspace.hero" class="space-y-4">
    <DetailPageLayout>
      <template #primary>
        <div class="card p-5">
          <div class="flex flex-wrap items-start justify-between gap-4">
            <div class="max-w-2xl">
              <div class="flex items-center gap-2">
                <span class="badge badge-primary">工作空间文件夹</span>
                <span class="badge" :class="statusBadge(payload.workspace.status)">{{ humanizeStatus(payload.workspace.status) }}</span>
              </div>
              <h2 class="mt-3 text-xl font-semibold tracking-tight text-gray-950 dark:text-white">{{ payload.workspace.title }}</h2>
              <p class="mt-2 text-sm leading-6 text-gray-600 dark:text-slate-300">
                当前页面用于管理工作空间文件夹、输入文件、输出文件和输出结果，并查看文件空间状态。
              </p>
            </div>
            <div class="flex flex-wrap gap-2">
              <a class="btn btn-primary" :href="workspaceMasHref(payload.workspace.slug)" target="_blank" rel="noreferrer">进入 OPL 工作台</a>
              <a class="btn btn-secondary" :href="downloadAllHref('inputs')">打包下载输入文件</a>
              <a class="btn btn-secondary" :href="downloadAllHref('outputs')">打包下载输出文件</a>
            </div>
          </div>
        </div>
      </template>

      <template #secondary>
        <div class="card p-5">
          <div class="flex items-center justify-between gap-3">
            <div>
              <h2 class="panel-title">空间管理</h2>
              <p class="panel-subtitle">创建、归档、恢复、删除。</p>
            </div>
            <span class="badge badge-warning">操作</span>
          </div>
          <form class="mt-4 space-y-3" method="post" action="/portal/workspaces/create">
            <input class="input" name="title" type="text" placeholder="新工作空间名称" required />
            <button class="btn btn-primary w-full justify-center" type="submit">创建工作空间</button>
          </form>
          <div class="mt-4 space-y-2">
            <form v-if="isActiveWorkspace" method="post" action="/portal/workspaces/archive">
              <input type="hidden" name="task" :value="payload.workspace.slug" />
              <button class="btn btn-secondary w-full justify-center" type="submit">归档当前空间</button>
            </form>
            <form v-if="isArchivedWorkspace" method="post" action="/portal/workspaces/restore">
              <input type="hidden" name="task" :value="payload.workspace.slug" />
              <button class="btn btn-secondary w-full justify-center" type="submit">恢复当前空间</button>
            </form>
            <form method="post" action="/portal/workspaces/delete">
              <input type="hidden" name="task" :value="payload.workspace.slug" />
              <button class="btn btn-secondary w-full justify-center" type="submit">删除当前空间</button>
            </form>
          </div>
        </div>
      </template>
    </DetailPageLayout>

    <section class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      <MetricCard label="输入文件" :value="payload.counts.inputs" hint="输入文件数" />
      <MetricCard label="输出文件" :value="payload.counts.outputs" hint="输出文件数" />
      <MetricCard label="任务数" :value="payload.counts.runs" hint="当前空间任务总数" />
      <MetricCard label="费用估算" :value="estimatedCostText" hint="余额和充值状态只作估算关联" />
    </section>
  </section>
</template>

<script setup lang="ts">
import type { WorkspacePayload } from "@/api/portal/workspace";
import MetricCard from "@/components/common/MetricCard.vue";
import DetailPageLayout from "@/layouts/DetailPageLayout.vue";

defineProps<{
  downloadAllHref: (kind: "inputs" | "outputs") => string;
  estimatedCostText: string;
  humanizeStatus: (status?: string) => string;
  isActiveWorkspace: boolean;
  isArchivedWorkspace: boolean;
  payload: WorkspacePayload;
  statusBadge: (status?: string) => string;
  workspaceMasHref: (task?: string) => string;
}>();
</script>
