<template>
  <AppLayout title="轨迹" subtitle="查看自己的 session、model、token、时间、状态与延迟">
    <div class="space-y-4">
      <div v-if="loading" class="card p-6 text-sm text-gray-500 dark:text-slate-400">正在加载轨迹...</div>
      <div v-else-if="error" class="card p-6 text-sm text-red-600 dark:text-red-400">{{ error }}</div>
      <template v-else-if="payload">
        <section class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="轨迹数" :value="payload.pagination.total" hint="当前筛选命中总数" />
          <MetricCard label="模型覆盖" :value="modelCount" hint="命中轨迹的模型数" />
          <MetricCard label="Token 总数" :value="tokenCount" hint="仅统计已记录 token" />
          <MetricCard label="平均延迟" :value="latencyLabel" hint="仅统计已记录延迟" />
        </section>

        <section class="card p-5">
          <div class="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <h2 class="panel-title">轨迹筛选</h2>
              <p class="panel-subtitle">按 workspace、session、状态查看自己的执行轨迹。</p>
            </div>
            <div class="grid gap-3 md:grid-cols-3">
              <label class="text-sm text-gray-600 dark:text-slate-300">
                <span class="mb-1.5 block text-xs text-gray-500 dark:text-slate-400">workspace</span>
                <input v-model.trim="filters.workspaceId" class="input w-full md:w-[220px]" type="text" placeholder="workspace id" />
              </label>
              <label class="text-sm text-gray-600 dark:text-slate-300">
                <span class="mb-1.5 block text-xs text-gray-500 dark:text-slate-400">session</span>
                <input v-model.trim="filters.sessionId" class="input w-full md:w-[220px]" type="text" placeholder="session id" />
              </label>
              <label class="text-sm text-gray-600 dark:text-slate-300">
                <span class="mb-1.5 block text-xs text-gray-500 dark:text-slate-400">状态</span>
                <select v-model="filters.status" class="input w-full md:w-[160px]">
                  <option value="">全部</option>
                  <option value="recorded">recorded</option>
                  <option value="running">running</option>
                  <option value="completed">completed</option>
                </select>
              </label>
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
              <h2 class="panel-title">Session 轨迹</h2>
              <p class="panel-subtitle">如果部分字段未接入事实源，会明确显示为未记录。</p>
            </div>
            <span class="badge badge-primary">{{ payload.summary.traceCount || 0 }} 条</span>
          </div>

          <div class="table-shell">
            <table class="text-sm">
              <thead>
                <tr class="table-head">
                  <th class="px-4 py-3">session</th>
                  <th class="px-4 py-3">workspace</th>
                  <th class="px-4 py-3">模型</th>
                  <th class="px-4 py-3">token</th>
                  <th class="px-4 py-3">时间</th>
                  <th class="px-4 py-3">user-agent</th>
                  <th class="px-4 py-3">状态</th>
                  <th class="px-4 py-3">延迟</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in payload.items" :key="item.traceId" class="table-row">
                  <td class="px-4 py-3">
                    <div class="font-mono text-xs text-gray-700 dark:text-slate-300">{{ item.sessionId || item.workspaceSessionId || "-" }}</div>
                    <div class="mt-1 text-[11px] text-gray-500 dark:text-slate-400">{{ item.traceId }}</div>
                  </td>
                  <td class="px-4 py-3 text-gray-700 dark:text-slate-300">{{ item.workspaceId || "-" }}</td>
                  <td class="px-4 py-3 text-gray-700 dark:text-slate-300">{{ item.model || "未记录" }}</td>
                  <td class="px-4 py-3 text-gray-700 dark:text-slate-300">{{ item.tokenCount || 0 }}</td>
                  <td class="px-4 py-3 text-gray-500 dark:text-slate-400">{{ item.startedAt || "-" }}</td>
                  <td class="px-4 py-3 text-xs text-gray-500 dark:text-slate-400">{{ shorten(item.userAgent || "未记录", 28) }}</td>
                  <td class="px-4 py-3">
                    <span class="badge" :class="statusBadge(item.status)">{{ item.status || "recorded" }}</span>
                  </td>
                  <td class="px-4 py-3 text-gray-700 dark:text-slate-300">{{ item.latencyMs ? `${item.latencyMs} ms` : "未记录" }}</td>
                </tr>
                <tr v-if="!payload.items.length">
                  <td colspan="8" class="px-4 py-6 text-center text-sm text-gray-500 dark:text-slate-400">当前暂无轨迹数据</td>
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
const filters = reactive({ workspaceId: "", sessionId: "", status: "" });

const modelCount = computed(() => new Set((payload.value?.items || []).map((item) => item.model).filter(Boolean)).size);
const tokenCount = computed(() => (payload.value?.items || []).reduce((sum, item) => sum + Number(item.tokenCount || 0), 0));
const latencyLabel = computed(() => {
  const rows = (payload.value?.items || []).filter((item) => Number(item.latencyMs || 0) > 0);
  if (!rows.length) return "未记录";
  const avg = rows.reduce((sum, item) => sum + Number(item.latencyMs || 0), 0) / rows.length;
  return `${Math.round(avg)} ms`;
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

function shorten(value = "", max = 32) {
  const text = String(value || "");
  return text.length > max ? `${text.slice(0, max)}...` : text;
}

function applyFilters() {
  router.push({
    path: route.path,
    query: {
      ...routeQueryObject(),
      workspaceId: filters.workspaceId || undefined,
      sessionId: filters.sessionId || undefined,
      status: filters.status || undefined,
      page: undefined,
    },
  });
}

function resetFilters() {
  filters.workspaceId = "";
  filters.sessionId = "";
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
      workspaceId: readQueryValue("workspaceId"),
      sessionId: readQueryValue("sessionId"),
      status: readQueryValue("status"),
      page: readQueryValue("page"),
      page_size: 5,
      limit: 100,
    });
    if (current !== requestId) return;
    payload.value = data;
    filters.workspaceId = String(readQueryValue("workspaceId") || "");
    filters.sessionId = String(readQueryValue("sessionId") || "");
    filters.status = String(readQueryValue("status") || "");
  } catch (err: any) {
    if (current !== requestId) return;
    error.value = err?.message || "轨迹加载失败";
  } finally {
    if (current === requestId) loading.value = false;
  }
}

watch(() => route.fullPath, () => {
  void load();
}, { immediate: true });
</script>
