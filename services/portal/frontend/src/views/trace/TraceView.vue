<template>
  <AppLayout title="会话轨迹" subtitle="查看自己的会话、文件、运行、费用和资源状态">
    <div class="space-y-4">
      <div v-if="loading" class="card p-6 text-sm text-gray-500 dark:text-slate-400">正在加载会话轨迹...</div>
      <div v-else-if="error" class="card p-6 text-sm text-red-600 dark:text-red-400">{{ error }}</div>
      <template v-else-if="payload">
        <section class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="会话数" :value="payload.pagination.total" hint="当前筛选命中总数" />
          <MetricCard label="运行数" :value="runCount" hint="关联 run 的会话" />
          <MetricCard label="输出文件" :value="outputCount" hint="可在任务空间下载" />
          <MetricCard label="已结算" :value="exactCostLabel" hint="仅统计 exact cost" />
        </section>

        <section class="card p-5">
          <div class="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <h2 class="panel-title">筛选</h2>
              <p class="panel-subtitle">用户侧只返回当前账号可见数据。</p>
            </div>
            <div class="grid gap-3 md:grid-cols-3">
              <input v-model.trim="filters.workspaceId" class="input" type="text" placeholder="workspace" />
              <input v-model.trim="filters.sessionId" class="input" type="text" placeholder="session" />
              <select v-model="filters.status" class="input">
                <option value="">全部状态</option>
                <option value="active">active</option>
                <option value="running">running</option>
                <option value="completed">completed</option>
                <option value="failed">failed</option>
                <option value="released">released</option>
                <option value="settled">settled</option>
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
              <h2 class="panel-title">会话列表</h2>
              <p class="panel-subtitle">业务视角优先；技术 trace 信息默认折叠到详情。</p>
            </div>
            <span class="badge badge-primary">{{ payload.summary.traceCount || 0 }} 条</span>
          </div>

          <div class="table-shell">
            <table class="text-sm">
              <thead>
                <tr class="table-head">
                  <th class="px-4 py-3">会话</th>
                  <th class="px-4 py-3">workspace</th>
                  <th class="px-4 py-3">run</th>
                  <th class="px-4 py-3">文件</th>
                  <th class="px-4 py-3">费用</th>
                  <th class="px-4 py-3">状态</th>
                  <th class="px-4 py-3">时间</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in payload.items" :key="item.traceId || item.sessionId" class="table-row">
                  <td class="px-4 py-3">
                    <div class="font-medium text-gray-950 dark:text-white">{{ item.title || item.traceName || item.sessionId || "会话" }}</div>
                    <div class="mt-1 font-mono text-[11px] text-gray-500 dark:text-slate-400">{{ item.traceId || "-" }}</div>
                  </td>
                  <td class="px-4 py-3 text-gray-700 dark:text-slate-300">{{ item.workspaceId || "-" }}</td>
                  <td class="px-4 py-3 font-mono text-xs text-gray-700 dark:text-slate-300">{{ item.runId || "-" }}</td>
                  <td class="px-4 py-3 text-gray-700 dark:text-slate-300">
                    {{ item.files?.inputsCount || 0 }} 入 / {{ item.files?.outputsCount || 0 }} 出
                  </td>
                  <td class="px-4 py-3 text-gray-700 dark:text-slate-300">
                    pending ¥{{ money(item.billing?.pendingCost) }} / exact ¥{{ money(item.billing?.exactCost) }}
                  </td>
                  <td class="px-4 py-3">
                    <span class="badge" :class="statusBadge(item.businessStatus || item.status)">{{ item.businessStatus || item.status || "recorded" }}</span>
                  </td>
                  <td class="px-4 py-3 text-gray-500 dark:text-slate-400">{{ item.startedAt || "-" }}</td>
                </tr>
                <tr v-if="!payload.items.length">
                  <td colspan="7" class="px-4 py-6 text-center text-sm text-gray-500 dark:text-slate-400">当前暂无会话轨迹</td>
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
import type { SessionTracesPayload } from "@/api/portal";
import { fetchSessionTraces } from "@/api/portal";

const route = useRoute();
const router = useRouter();
const loading = ref(true);
const error = ref("");
const payload = ref<SessionTracesPayload | null>(null);
const filters = reactive({ workspaceId: "", sessionId: "", status: "" });

const runCount = computed(() => new Set((payload.value?.items || []).map((item: any) => item.runId).filter(Boolean)).size);
const outputCount = computed(() => (payload.value?.items || []).reduce((sum: number, item: any) => sum + Number(item.files?.outputsCount || 0), 0));
const exactCostLabel = computed(() => `¥${money((payload.value?.items || []).reduce((sum: number, item: any) => sum + Number(item.billing?.exactCost || 0), 0))}`);

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
  if (["completed", "success", "settled"].includes(normalized)) return "badge-success";
  if (["failed", "error"].includes(normalized)) return "badge-danger";
  if (["running", "active"].includes(normalized)) return "badge-primary";
  return "badge-warning";
}

function money(value: unknown) {
  return Number(value || 0).toFixed(2);
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
    const data = await fetchSessionTraces({
      workspaceId: readQueryValue("workspaceId"),
      sessionId: readQueryValue("sessionId"),
      status: readQueryValue("status"),
      page: readQueryValue("page"),
      page_size: 10,
      limit: 100,
    });
    if (current !== requestId) return;
    payload.value = data;
    filters.workspaceId = String(readQueryValue("workspaceId") || "");
    filters.sessionId = String(readQueryValue("sessionId") || "");
    filters.status = String(readQueryValue("status") || "");
  } catch (err: any) {
    if (current !== requestId) return;
    error.value = err?.message || "会话轨迹加载失败";
  } finally {
    if (current === requestId) loading.value = false;
  }
}

watch(() => route.fullPath, () => {
  void load();
}, { immediate: true });
</script>
