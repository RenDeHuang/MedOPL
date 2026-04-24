<template>
  <AppLayout title="Trace" subtitle="管理员查看全局 session / trace / run 关联">
    <div class="space-y-4">
      <div v-if="loading" class="card p-6 text-sm text-gray-500 dark:text-slate-400">正在加载 Trace...</div>
      <div v-else-if="error" class="card p-6 text-sm text-red-600 dark:text-red-400">{{ error }}</div>
      <template v-else-if="payload">
        <section class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Trace 总数" :value="payload.pagination.total" hint="当前筛选命中数" />
          <MetricCard label="用户维度" :value="userCount" hint="命中 trace 的用户数" />
          <MetricCard label="Workspace" :value="workspaceCount" hint="命中 trace 的 workspace 数" />
          <MetricCard label="平均延迟" :value="latencyLabel" hint="仅统计已记录延迟" />
        </section>

        <section class="card p-5">
          <div class="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <h2 class="panel-title">筛选条件</h2>
              <p class="panel-subtitle">按用户、workspace、session、run 和状态筛选。</p>
            </div>
            <div class="grid gap-3 md:grid-cols-5">
              <input v-model.trim="filters.userId" class="input" type="text" placeholder="用户 ID" />
              <input v-model.trim="filters.workspaceId" class="input" type="text" placeholder="workspace" />
              <input v-model.trim="filters.sessionId" class="input" type="text" placeholder="session" />
              <input v-model.trim="filters.runId" class="input" type="text" placeholder="run" />
              <select v-model="filters.status" class="input">
                <option value="">全部状态</option>
                <option value="recorded">recorded</option>
                <option value="running">running</option>
                <option value="completed">completed</option>
              </select>
            </div>
          </div>
          <div class="mt-3 flex gap-2">
            <button class="btn btn-primary" type="button" @click="applyFilters">应用筛选</button>
            <button class="btn btn-secondary" type="button" @click="resetFilters">重置</button>
          </div>
        </section>

        <section class="card p-5">
          <div class="mb-3 flex items-center justify-between gap-3">
            <div>
              <h2 class="panel-title">全局 Trace 列表</h2>
              <p class="panel-subtitle">参考 Langfuse 视角，对齐用户、workspace、run、模型和延迟。</p>
            </div>
            <span class="badge badge-primary">{{ payload.summary.traceCount || 0 }} 条</span>
          </div>

          <div class="table-shell">
            <table class="text-sm">
              <thead>
                <tr class="table-head">
                  <th class="px-4 py-3">用户</th>
                  <th class="px-4 py-3">workspace</th>
                  <th class="px-4 py-3">session</th>
                  <th class="px-4 py-3">run</th>
                  <th class="px-4 py-3">模型</th>
                  <th class="px-4 py-3">输入</th>
                  <th class="px-4 py-3">状态</th>
                  <th class="px-4 py-3">延迟</th>
                  <th class="px-4 py-3">时间</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in payload.items" :key="item.traceId" class="table-row">
                  <td class="px-4 py-3 text-gray-700 dark:text-slate-300">{{ item.userId || "-" }}</td>
                  <td class="px-4 py-3 text-gray-700 dark:text-slate-300">{{ item.workspaceId || "-" }}</td>
                  <td class="px-4 py-3">
                    <div class="font-mono text-xs text-gray-700 dark:text-slate-300">{{ item.sessionId || item.workspaceSessionId || "-" }}</div>
                    <div class="mt-1 text-[11px] text-gray-500 dark:text-slate-400">{{ item.traceId }}</div>
                  </td>
                  <td class="px-4 py-3 font-mono text-xs text-gray-700 dark:text-slate-300">{{ item.runId || "-" }}</td>
                  <td class="px-4 py-3 text-gray-700 dark:text-slate-300">{{ item.model || "未记录" }}</td>
                  <td class="px-4 py-3 text-xs text-gray-500 dark:text-slate-400">{{ shorten(item.inputPreview || "未记录", 24) }}</td>
                  <td class="px-4 py-3">
                    <span class="badge" :class="statusBadge(item.status)">{{ item.status || "recorded" }}</span>
                  </td>
                  <td class="px-4 py-3 text-gray-700 dark:text-slate-300">{{ item.latencyMs ? `${item.latencyMs} ms` : "未记录" }}</td>
                  <td class="px-4 py-3 text-gray-500 dark:text-slate-400">{{ item.startedAt || "-" }}</td>
                </tr>
                <tr v-if="!payload.items.length">
                  <td colspan="9" class="px-4 py-6 text-center text-sm text-gray-500 dark:text-slate-400">当前暂无 Trace 数据</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="pager-bar">
            <span>第 {{ payload.pagination.page }} / {{ payload.pagination.totalPages }} 页</span>
            <div class="flex gap-2">
              <RouterLink class="btn btn-secondary" :to="traceQuery({ page: previousPage(payload.pagination.page) })">上一页</RouterLink>
              <RouterLink class="btn btn-secondary" :to="traceQuery({ page: nextPage(payload.pagination.page, payload.pagination.totalPages) })">下一页</RouterLink>
            </div>
          </div>
        </section>
      </template>
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import AppLayout from "@/layouts/AppLayout.vue";
import MetricCard from "@/components/common/MetricCard.vue";
import type { TracesPayload } from "@/api/portal";
import { fetchTraces } from "@/api/portal";

const route = useRoute();
const router = useRouter();
const loading = ref(true);
const error = ref("");
const payload = ref<TracesPayload | null>(null);
const filters = reactive({ userId: "", workspaceId: "", sessionId: "", runId: "", status: "" });

const userCount = computed(() => new Set((payload.value?.items || []).map((item) => item.userId).filter(Boolean)).size);
const workspaceCount = computed(() => new Set((payload.value?.items || []).map((item) => item.workspaceId).filter(Boolean)).size);
const latencyLabel = computed(() => {
  const rows = (payload.value?.items || []).filter((item) => Number(item.latencyMs || 0) > 0);
  if (!rows.length) return "未记录";
  return `${Math.round(rows.reduce((sum, item) => sum + Number(item.latencyMs || 0), 0) / rows.length)} ms`;
});

function routeQueryObject() {
  const query: Record<string, string> = {};
  for (const [key, value] of Object.entries(route.query)) {
    const normalized = Array.isArray(value) ? value[0] : value;
    if (normalized != null) query[key] = String(normalized);
  }
  return query;
}

function readQueryValue(key: string) {
  const value = route.query[key];
  const normalized = Array.isArray(value) ? value[0] : value;
  return normalized ?? undefined;
}

function traceQuery(updates: Record<string, string | number | undefined>) {
  const query = routeQueryObject();
  for (const [key, value] of Object.entries(updates)) {
    if (value === undefined || value === null || value === "") delete query[key];
    else query[key] = String(value);
  }
  return { path: route.path, query };
}

function previousPage(page: number) {
  return Math.max(1, Number(page || 1) - 1);
}

function nextPage(page: number, totalPages: number) {
  return Math.min(Number(totalPages || 1), Number(page || 1) + 1);
}

function statusBadge(status = "") {
  const normalized = String(status || "").toLowerCase();
  if (["completed", "success"].includes(normalized)) return "badge-success";
  if (["failed", "error"].includes(normalized)) return "badge-danger";
  if (["running"].includes(normalized)) return "badge-primary";
  return "badge-warning";
}

function shorten(value = "", max = 28) {
  const text = String(value || "");
  return text.length > max ? `${text.slice(0, max)}...` : text;
}

function applyFilters() {
  router.push({
    path: route.path,
    query: {
      userId: filters.userId || undefined,
      workspaceId: filters.workspaceId || undefined,
      sessionId: filters.sessionId || undefined,
      runId: filters.runId || undefined,
      status: filters.status || undefined,
      page: undefined,
    },
  });
}

function resetFilters() {
  filters.userId = "";
  filters.workspaceId = "";
  filters.sessionId = "";
  filters.runId = "";
  filters.status = "";
  router.push({ path: route.path, query: {} });
}

let requestId = 0;

async function load() {
  const current = ++requestId;
  loading.value = true;
  error.value = "";
  try {
    const data = await fetchTraces({
      userId: readQueryValue("userId"),
      workspaceId: readQueryValue("workspaceId"),
      sessionId: readQueryValue("sessionId"),
      runId: readQueryValue("runId"),
      status: readQueryValue("status"),
      page: readQueryValue("page"),
      page_size: 5,
      limit: 150,
    });
    if (current !== requestId) return;
    payload.value = data;
    filters.userId = String(readQueryValue("userId") || "");
    filters.workspaceId = String(readQueryValue("workspaceId") || "");
    filters.sessionId = String(readQueryValue("sessionId") || "");
    filters.runId = String(readQueryValue("runId") || "");
    filters.status = String(readQueryValue("status") || "");
  } catch (err: any) {
    if (current !== requestId) return;
    error.value = err?.message || "Trace 加载失败";
  } finally {
    if (current === requestId) loading.value = false;
  }
}

watch(() => route.fullPath, () => {
  void load();
}, { immediate: true });
</script>
