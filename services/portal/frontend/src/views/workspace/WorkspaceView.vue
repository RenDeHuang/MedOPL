<template>
  <AppLayout title="工作空间" subtitle="上传文件、下载结果与空间管理">
    <div class="space-y-4">
      <div v-if="loading" class="card p-6 text-sm text-gray-500 dark:text-slate-400">正在加载工作空间...</div>
      <div v-else-if="error" class="card p-6 text-sm text-red-600 dark:text-red-400">{{ error }}</div>
      <template v-else-if="payload">
        <section class="grid grid-cols-1 gap-4 xl:grid-cols-[1.45fr_1fr]">
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

          <div class="card p-5">
            <div class="flex items-center justify-between gap-3">
              <div>
                <h2 class="panel-title">空间管理</h2>
                <p class="panel-subtitle">创建、归档、恢复、删除。</p>
              </div>
              <span class="badge badge-warning">操作</span>
            </div>
            <form class="mt-4 space-y-3" method="post" action="/portal/tasks/create">
              <input class="input" name="title" type="text" placeholder="新工作空间名称" required />
              <button class="btn btn-primary w-full justify-center" type="submit">创建工作空间</button>
            </form>
            <div class="mt-4 space-y-2">
              <form v-if="isActiveWorkspace" method="post" action="/portal/tasks/archive">
                <input type="hidden" name="task" :value="payload.workspace.slug" />
                <button class="btn btn-secondary w-full justify-center" type="submit">归档当前空间</button>
              </form>
              <form v-if="isArchivedWorkspace" method="post" action="/portal/tasks/restore">
                <input type="hidden" name="task" :value="payload.workspace.slug" />
                <button class="btn btn-secondary w-full justify-center" type="submit">恢复当前空间</button>
              </form>
              <form method="post" action="/portal/tasks/delete">
                <input type="hidden" name="task" :value="payload.workspace.slug" />
                <button class="btn btn-secondary w-full justify-center" type="submit">删除当前空间</button>
              </form>
            </div>
          </div>
        </section>

        <section class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="输入文件" :value="payload.counts.inputs" hint="输入文件数" />
          <MetricCard label="输出文件" :value="payload.counts.outputs" hint="输出文件数" />
          <MetricCard label="任务数" :value="payload.counts.runs" hint="当前空间任务总数" />
          <MetricCard label="费用估算" :value="money(totalEstimatedCost)" hint="余额和充值状态只作估算关联" />
        </section>

        <section class="card p-5">
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
                <button class="btn btn-secondary" type="button" :disabled="!payload.fileSpace.actions.moveFileOrFolder">移动文件/文件夹</button>
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
                  <button class="btn btn-secondary" type="button" :disabled="!payload.fileSpace.actions.deleteFileOrFolder">删除文件/文件夹</button>
                  <button class="btn btn-secondary" type="button" :disabled="!payload.fileSpace.actions.permanentDeleteRequiresConfirmation">永久删除 <span class="text-[11px] text-amber-700 dark:text-amber-300">需二次确认</span></button>
                  <button class="btn btn-secondary" type="button" :disabled="!payload.fileSpace.actions.clearFileSpaceRequiresConfirmation">清空文件空间 <span class="text-[11px] text-amber-700 dark:text-amber-300">需二次确认</span></button>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section class="card p-5">
          <div class="mb-3 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 class="panel-title">托管运行环境</h2>
              <p class="panel-subtitle">
                这里展示托管运行环境的计划快照；当前为计划视图，不代表真实资源已创建。
              </p>
            </div>
            <span class="badge" :class="statusBadge(managedPlan?.status)">{{ humanizeStatus(managedPlan?.status || "not_started") }}</span>
          </div>
          <div v-if="managedPlan" class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <div class="rounded-2xl border border-gray-100 px-4 py-3 dark:border-slate-700">
              <div class="text-xs text-gray-500 dark:text-slate-400">区域</div>
              <div class="mt-1 font-medium text-gray-950 dark:text-white">{{ managedPlan.regionLabel }}</div>
            </div>
            <div class="rounded-2xl border border-gray-100 px-4 py-3 dark:border-slate-700">
              <div class="text-xs text-gray-500 dark:text-slate-400">规格</div>
              <div class="mt-1 font-medium text-gray-950 dark:text-white">{{ managedPlan.planSpec }}</div>
            </div>
            <div class="rounded-2xl border border-gray-100 px-4 py-3 dark:border-slate-700">
              <div class="text-xs text-gray-500 dark:text-slate-400">预计费用</div>
              <div class="mt-1 font-medium text-gray-950 dark:text-white">{{ money(managedPlan.estimatedCost.amount, managedPlan.estimatedCost.currency) }}</div>
              <div class="mt-1 text-xs text-gray-500 dark:text-slate-400">不做真实扣费</div>
            </div>
            <div class="rounded-2xl border border-gray-100 px-4 py-3 dark:border-slate-700">
              <div class="text-xs text-gray-500 dark:text-slate-400">释放策略</div>
              <div class="mt-1 font-medium text-gray-950 dark:text-white">{{ releasePolicyText(managedPlan.releasePolicy.status) }}</div>
              <div class="mt-1 text-xs text-gray-500 dark:text-slate-400">{{ managedPlan.releasePolicy.stopBillingConfirmWithinMinutes }} 分钟内确认停止计费</div>
            </div>
            <div class="rounded-2xl border border-gray-100 px-4 py-3 dark:border-slate-700">
              <div class="text-xs text-gray-500 dark:text-slate-400">审计状态</div>
              <div class="mt-1 font-medium text-gray-950 dark:text-white">{{ auditStatusText(managedPlan.auditStatus.status) }}</div>
              <div class="mt-1 text-xs text-gray-500 dark:text-slate-400">{{ managedPlan.auditStatus.policy }}</div>
            </div>
            <div class="rounded-2xl border border-gray-100 px-4 py-3 dark:border-slate-700">
              <div class="text-xs text-gray-500 dark:text-slate-400">状态</div>
              <div class="mt-1 font-medium text-gray-950 dark:text-white">{{ snapshotText(managedPlan.snapshot.realResourceCreated) }}</div>
              <div class="mt-1 text-xs text-gray-500 dark:text-slate-400">计划快照</div>
            </div>
          </div>
          <div v-else class="empty-state">当前工作空间还没有托管运行环境计划。</div>
        </section>

        <section class="card p-5">
          <div class="mb-3 flex items-center justify-between gap-3">
            <div>
              <h2 class="panel-title">工作空间列表</h2>
              <p class="panel-subtitle">统一展示上传文件、下载结果、任务、状态和更新时间。</p>
            </div>
            <span class="badge badge-primary">{{ payload.tasksPagination.total }} 个</span>
          </div>

          <div class="mobile-card-list">
            <div v-for="item in payload.tasksPageRows" :key="item.slug" class="mobile-only-card">
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0">
                  <div class="font-medium text-gray-950 dark:text-white">{{ item.title || item.slug }}</div>
                  <div class="mt-1 truncate text-xs text-gray-500 dark:text-slate-400">{{ item.slug }}</div>
                </div>
                <span class="badge shrink-0" :class="statusBadge(item.status)">{{ humanizeStatus(item.status) }}</span>
              </div>
              <div class="mt-3 grid grid-cols-3 gap-2 text-xs text-gray-500 dark:text-slate-400">
                <div><span class="block text-gray-400 dark:text-slate-500">输入文件</span>{{ item.inputs }}</div>
                <div><span class="block text-gray-400 dark:text-slate-500">输出文件</span>{{ item.outputs }}</div>
                <div><span class="block text-gray-400 dark:text-slate-500">任务</span>{{ item.runs }}</div>
              </div>
              <div class="mt-3 flex items-center justify-between gap-3">
                <span class="truncate text-xs text-gray-500 dark:text-slate-400">{{ item.updatedAt || "-" }}</span>
                <RouterLink class="text-sm font-medium text-primary-600 hover:text-primary-500 dark:text-primary-400" :to="{ path: '/workspace', query: { task: item.slug } }">
                  打开
                </RouterLink>
              </div>
            </div>
            <div v-if="!payload.tasksPageRows.length" class="empty-state">暂无工作空间</div>
          </div>

          <div class="desktop-table-shell">
            <table class="min-w-[760px] text-sm">
              <thead>
                <tr class="table-head">
                  <th class="px-4 py-3">工作空间</th>
                  <th class="px-4 py-3">输入文件</th>
                  <th class="px-4 py-3">输出文件</th>
                  <th class="px-4 py-3">任务</th>
                  <th class="px-4 py-3">状态</th>
                  <th class="px-4 py-3">最近更新</th>
                  <th class="px-4 py-3">操作</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in payload.tasksPageRows" :key="item.slug" class="table-row">
                  <td class="px-4 py-3">
                    <div class="font-medium text-gray-950 dark:text-white">{{ item.title || item.slug }}</div>
                    <div class="mt-1 whitespace-nowrap text-xs text-gray-500 dark:text-slate-400">{{ item.slug }}</div>
                  </td>
                  <td class="whitespace-nowrap px-4 py-3 text-gray-700 dark:text-slate-300">{{ item.inputs }}</td>
                  <td class="whitespace-nowrap px-4 py-3 text-gray-700 dark:text-slate-300">{{ item.outputs }}</td>
                  <td class="whitespace-nowrap px-4 py-3 text-gray-700 dark:text-slate-300">{{ item.runs }}</td>
                  <td class="px-4 py-3">
                    <span class="badge" :class="statusBadge(item.status)">{{ humanizeStatus(item.status) }}</span>
                  </td>
                  <td class="whitespace-nowrap px-4 py-3 text-gray-500 dark:text-slate-400">{{ item.updatedAt || "-" }}</td>
                  <td class="whitespace-nowrap px-4 py-3">
                    <RouterLink class="text-sm font-medium text-primary-600 hover:text-primary-500 dark:text-primary-400" :to="{ path: '/workspace', query: { task: item.slug } }">
                      打开
                    </RouterLink>
                  </td>
                </tr>
                <tr v-if="!payload.tasksPageRows.length">
                  <td colspan="7" class="px-4 py-6 text-center text-sm text-gray-500 dark:text-slate-400">暂无工作空间</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="pager-bar">
            <span>第 {{ payload.tasksPagination.page }} / {{ payload.tasksPagination.totalPages }} 页</span>
            <div class="flex gap-2">
              <RouterLink class="btn btn-secondary" :to="workspaceQuery({ tasks_page: previousPage(payload.tasksPagination.page) })">上一页</RouterLink>
              <RouterLink class="btn btn-secondary" :to="workspaceQuery({ tasks_page: nextPage(payload.tasksPagination.page, payload.tasksPagination.totalPages) })">下一页</RouterLink>
            </div>
          </div>
        </section>

        <section class="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <div class="card p-5">
            <div class="mb-3 flex items-center justify-between gap-3">
              <div>
                <h2 class="panel-title">输入文件</h2>
                <p class="panel-subtitle">当前工作空间文件夹中的输入文件。</p>
              </div>
              <button v-if="payload.storageEntitlement?.enabled" class="btn btn-secondary" type="button" @click="triggerUpload">上传文件到当前文件夹</button>
              <RouterLink v-else class="btn btn-secondary" to="/packages">去套餐页</RouterLink>
              <form class="hidden" method="post" :action="uploadAction" enctype="multipart/form-data">
                <input ref="uploadInput" class="hidden" name="file" type="file" @change="submitUpload" />
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
        </section>
      </template>
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRoute } from "vue-router";
import AppLayout from "@/layouts/AppLayout.vue";
import MetricCard from "@/components/common/MetricCard.vue";
import type { WorkspacePayload } from "@/api/portal";
import { disabledStorageEntitlement, fetchWorkspace } from "@/api/portal";

const route = useRoute();
const loading = ref(true);
const error = ref("");
const payload = ref<WorkspacePayload | null>(null);
const uploadInput = ref<HTMLInputElement | null>(null);

const currentTask = computed(() => {
  const value = route.query.task;
  return Array.isArray(value) ? String(value[0] || "") : String(value || "default");
});

const isActiveWorkspace = computed(() => String(payload.value?.workspace.status || "").toLowerCase() === "active");
const isArchivedWorkspace = computed(() => String(payload.value?.workspace.status || "").toLowerCase() === "archived");
const uploadAction = computed(() => `/portal/workspace/upload?task=${encodeURIComponent(payload.value?.workspace.slug || currentTask.value || "default")}`);
const emptyStorageEntitlement = computed(() => disabledStorageEntitlement());
const storageEntitlement = computed(() => payload.value?.storageEntitlement || payload.value?.workspace.storageEntitlement || emptyStorageEntitlement.value);
const totalEstimatedCost = computed(() => (payload.value?.outputs || []).reduce((sum, item) => sum + Number(item.costEstimate?.amount || 0), 0));
const managedPlan = computed(() => payload.value?.managedResourceBindingPlan || null);
const fileSpace = computed(() => payload.value?.fileSpace || null);
const selectedFileCount = computed(() => fileSpace.value?.selectedFileRefs.length || 0);
const currentFolderName = computed(() => {
  const current = fileSpace.value?.folders.find((folder) => folder.folderRef === fileSpace.value?.currentFolderRef);
  return current?.name || "全部文件";
});
const fileSpaceUsageText = computed(() => {
  if (!fileSpace.value) return storageEntitlement.value.enabled ? `${storageEntitlement.value.storageSizeGb}GB 文件空间` : "文件空间未开通";
  return `${fileSpace.value.usedGb}GB / ${fileSpace.value.capacityGb}GB`;
});
const ordinaryDeleteRequiresConfirmation = computed(() => Boolean(fileSpace.value?.deletePolicy.ordinaryDeleteRequiresConfirmation));
const fileSpaceRetentionDays = computed(() => fileSpace.value?.deletePolicy.retentionDays || 7);

function routeQueryObject() {
  const query: Record<string, string> = {};
  for (const [key, value] of Object.entries(route.query)) {
    const normalized = Array.isArray(value) ? value[0] : value;
    if (normalized != null) query[key] = String(normalized);
  }
  return query;
}

function workspaceQuery(updates: Record<string, string | number | undefined>) {
  const query = routeQueryObject();
  for (const [key, value] of Object.entries(updates)) {
    if (value === undefined || value === null || value === "") delete query[key];
    else query[key] = String(value);
  }
  return { path: route.path, query };
}

function readQueryValue(key: string) {
  const value = route.query[key];
  const normalized = Array.isArray(value) ? value[0] : value;
  return normalized ?? undefined;
}

function previousPage(page: number) {
  return Math.max(1, Number(page || 1) - 1);
}

function nextPage(page: number, totalPages: number) {
  return Math.min(Number(totalPages || 1), Number(page || 1) + 1);
}

function statusBadge(status?: string) {
  const normalized = String(status || "").toLowerCase();
  if (["active", "running", "completed", "success", "finished"].includes(normalized)) return "badge-success";
  if (["failed", "error", "deleted"].includes(normalized)) return "badge-danger";
  if (["archived", "deleting"].includes(normalized)) return "badge-warning";
  return "badge-primary";
}

function humanizeStatus(status?: string) {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "active") return "运行中";
  if (normalized === "archived") return "已归档";
  if (normalized === "deleted") return "已删除";
  if (normalized === "deleting") return "删除中";
  if (["completed", "success", "finished"].includes(normalized)) return "已完成";
  return status || "未知";
}

function taskDisplayName(value?: string) {
  return value ? "已关联" : "已记录";
}

function hasLinkedTask(item: { runId?: string }) {
  return Boolean(item.runId);
}

function linkedTaskText(item: { runId?: string }) {
  return taskDisplayName(item.runId);
}

function money(value?: number, currency = "CNY") {
  return `${Number(value || 0).toFixed(2)} ${currency}`;
}

function costEstimateText(item: { costEstimate?: { amount?: number; currency?: string } }) {
  return money(item.costEstimate?.amount, item.costEstimate?.currency || "CNY");
}

function rechargeStatusText(value?: string) {
  return value === "display_only" ? "仅展示" : "待估算";
}

function fileKindText(value?: string) {
  return value === "output" ? "输出文件" : "输入文件";
}

function fileSourceText(file: { source?: string; artifactRef?: string }) {
  if (file.source === "runtime_output" || file.artifactRef) return "运行轨迹";
  return "上传文件";
}

function fileProtectionText(file: { status?: string; retentionUntil?: string }) {
  if (String(file.status || "").toLowerCase() === "retention_protected") return file.retentionUntil ? `保护期至 ${file.retentionUntil}` : "保护期";
  return humanizeStatus(file.status || "active");
}

function releasePolicyText(value?: string) {
  return value === "not_released" ? "未释放" : "释放处理中";
}

function auditStatusText(value?: string) {
  if (value === "audit_pending") return "待审计";
  if (value === "audit_ready") return "可审计";
  if (value === "audited") return "已审计";
  return "未开始";
}

function snapshotText(realResourceCreated?: boolean) {
  return realResourceCreated ? "已创建" : "计划快照";
}

function workspaceMasHref(task?: string) {
  const params = new URLSearchParams();
  if (task) params.set("task", task);
  return `/portal/opl${params.toString() ? `?${params}` : ""}`;
}

function downloadAllHref(kind: "inputs" | "outputs") {
  return `/portal/workspace/download-all?task=${encodeURIComponent(payload.value?.workspace.slug || currentTask.value || "default")}&kind=${encodeURIComponent(kind)}`;
}

function downloadFileHref(kind: "inputs" | "outputs", fileName: string) {
  return `/portal/workspace/download-file?task=${encodeURIComponent(payload.value?.workspace.slug || currentTask.value || "default")}&kind=${encodeURIComponent(kind)}&file=${encodeURIComponent(fileName)}`;
}

function submitUpload() {
  const input = uploadInput.value;
  if (!input?.files?.length) return;
  const form = input.closest("form");
  form?.submit();
}

function triggerUpload() {
  uploadInput.value?.click();
}

let requestId = 0;

async function load() {
  const current = ++requestId;
  loading.value = true;
  error.value = "";
  try {
    const data = await fetchWorkspace({
      task: readQueryValue("task"),
      tasks_page: readQueryValue("tasks_page"),
      runs_page: readQueryValue("runs_page"),
      inputs_page: readQueryValue("inputs_page"),
      outputs_page: readQueryValue("outputs_page"),
    });
    if (current !== requestId) return;
    payload.value = data;
  } catch (err: any) {
    if (current !== requestId) return;
    error.value = err?.message || "工作空间加载失败";
  } finally {
    if (current === requestId) loading.value = false;
  }
}

watch(() => route.fullPath, () => {
  void load();
}, { immediate: true });
</script>
