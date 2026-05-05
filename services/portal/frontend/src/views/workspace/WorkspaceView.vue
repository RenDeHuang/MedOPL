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
                  <span class="badge badge-primary">当前工作空间</span>
                  <span class="badge" :class="statusBadge(payload.workspace.status)">{{ humanizeStatus(payload.workspace.status) }}</span>
                </div>
                <h2 class="mt-3 text-xl font-semibold tracking-tight text-gray-950 dark:text-white">{{ payload.workspace.title }}</h2>
                <p class="mt-2 text-sm leading-6 text-gray-600 dark:text-slate-300">
                  当前页面用于管理上传文件与下载结果，并查看空间状态。
                </p>
              </div>
              <div class="flex flex-wrap gap-2">
                <a class="btn btn-primary" :href="workspaceMasHref(payload.workspace.slug)" target="_blank" rel="noreferrer">进入工作台</a>
                <a class="btn btn-secondary" :href="downloadAllHref('inputs')">打包下载 inputs</a>
                <a class="btn btn-secondary" :href="downloadAllHref('outputs')">打包下载 outputs</a>
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
          <MetricCard label="输入文件" :value="payload.counts.inputs" hint="inputs 文件数" />
          <MetricCard label="输出文件" :value="payload.counts.outputs" hint="outputs 文件数" />
          <MetricCard label="任务编号数" :value="payload.counts.runs" hint="当前空间任务编号总数" />
          <MetricCard label="文件权限" :value="payload.storageEntitlement?.enabled ? `${payload.storageEntitlement.storageSizeGb}GB` : '未开通'" hint="在套餐页开通后可上传和保存结果" />
        </section>

        <section class="card p-5">
          <div class="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div class="flex flex-wrap items-center gap-2">
                <span class="badge" :class="storageEntitlement.enabled ? 'badge-success' : 'badge-warning'">
                  {{ storageEntitlement.enabled ? "文件写入已开启" : "文件写入未开启" }}
                </span>
                <span class="badge badge-primary">套餐控制</span>
              </div>
              <h2 class="mt-3 panel-title">文件写入权限</h2>
              <p class="mt-2 panel-subtitle">
                工作空间只管理文件和结果。需要购买、升级或扩容时，请到套餐页处理。
              </p>
            </div>
            <div class="flex flex-wrap items-center gap-3">
              <span class="text-sm text-gray-600 dark:text-slate-300">当前：{{ storageEntitlement.enabled ? `${storageEntitlement.storageSizeGb}GB` : "未开通" }}</span>
              <RouterLink class="btn btn-secondary" to="/packages">去套餐页</RouterLink>
            </div>
          </div>
        </section>

        <section class="card p-5">
          <div class="mb-3 flex items-center justify-between gap-3">
            <div>
              <h2 class="panel-title">工作空间列表</h2>
              <p class="panel-subtitle">统一展示上传文件、下载结果、任务编号、状态和更新时间。</p>
            </div>
            <span class="badge badge-primary">{{ payload.tasksPagination.total }} 个</span>
          </div>

          <div class="table-shell">
            <table class="text-sm">
              <thead>
                <tr class="table-head">
                  <th class="px-4 py-3">工作空间</th>
                  <th class="px-4 py-3">输入</th>
                  <th class="px-4 py-3">输出</th>
                  <th class="px-4 py-3">任务编号</th>
                  <th class="px-4 py-3">状态</th>
                  <th class="px-4 py-3">最近更新</th>
                  <th class="px-4 py-3">操作</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in payload.tasksPageRows" :key="item.slug" class="table-row">
                  <td class="px-4 py-3">
                    <div class="font-medium text-gray-950 dark:text-white">{{ item.title || item.slug }}</div>
                    <div class="mt-1 text-xs text-gray-500 dark:text-slate-400">{{ item.slug }}</div>
                  </td>
                  <td class="px-4 py-3 text-gray-700 dark:text-slate-300">{{ item.inputs }}</td>
                  <td class="px-4 py-3 text-gray-700 dark:text-slate-300">{{ item.outputs }}</td>
                  <td class="px-4 py-3 text-gray-700 dark:text-slate-300">{{ item.runs }}</td>
                  <td class="px-4 py-3">
                    <span class="badge" :class="statusBadge(item.status)">{{ humanizeStatus(item.status) }}</span>
                  </td>
                  <td class="px-4 py-3 text-gray-500 dark:text-slate-400">{{ item.updatedAt || "-" }}</td>
                  <td class="px-4 py-3">
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
                <p class="panel-subtitle">当前空间 inputs。</p>
              </div>
              <button v-if="payload.storageEntitlement?.enabled" class="btn btn-secondary" type="button" @click="triggerUpload">上传文件</button>
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
                <p class="panel-subtitle">当前空间 outputs。</p>
              </div>
              <span class="badge badge-success">{{ payload.counts.outputs }} 个</span>
            </div>
            <div class="space-y-2.5">
              <div v-for="item in payload.outputs" :key="item.name" class="rounded-2xl border border-gray-100 px-4 py-3 dark:border-slate-700">
                <div class="font-medium text-gray-950 dark:text-white">{{ item.name }}</div>
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
import { fetchWorkspace } from "@/api/portal";

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
const storageEntitlement = computed(() => payload.value?.storageEntitlement || payload.value?.workspace.storageEntitlement || {
  enabled: false,
  status: "disabled",
  freeQuotaGb: 0,
  minimumPurchaseGb: 10,
  storageBackend: "portal_storage",
  retentionPolicy: "order_lifecycle",
  cosPrefix: "",
  resourceOrderId: "",
  storagePlanId: "",
  storageSizeGb: 0,
  message: "storage_required",
});

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
