<template>
  <AppLayout title="运行轨迹" subtitle="查看会话、任务状态、文件结果与审计轨迹">
    <div class="space-y-4">
      <div v-if="loading" class="card p-6 text-sm text-gray-500 dark:text-slate-400">正在加载会话轨迹...</div>
      <div v-else-if="error" class="card p-6 text-sm text-red-600 dark:text-red-400">{{ error }}</div>
      <template v-else-if="payload">
        <section class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="会话数" :value="payload.pagination.total" hint="当前筛选命中总数" />
          <MetricCard label="任务数" :value="runCount" hint="关联任务的会话" />
          <MetricCard label="输出文件" :value="outputCount" hint="可在工作空间下载" />
          <MetricCard label="异常会话" :value="failedCount" hint="需要重试或联系客服" />
        </section>

        <section class="card p-5">
          <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 class="panel-title">运行轨迹</h2>
              <p class="panel-subtitle">
                运行轨迹只展示会话、工作空间、任务、输出文件引用、状态和时间；原始输入和密钥字段不会出现在普通用户界面。
              </p>
            </div>
            <RouterLink class="btn btn-secondary" to="/workspace">查看输出文件</RouterLink>
          </div>
        </section>

        <section class="card p-5">
          <div class="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <h2 class="panel-title">筛选</h2>
              <p class="panel-subtitle">用户侧只返回当前账号可见的运行轨迹。</p>
            </div>
            <div class="grid gap-3 md:grid-cols-3">
              <input v-model.trim="filters.workspaceId" class="input" type="text" placeholder="工作空间" />
              <input v-model.trim="filters.sessionId" class="input" type="text" placeholder="会话" />
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
                  <th class="px-4 py-3">工作空间</th>
                  <th class="px-4 py-3">任务编号</th>
                  <th class="px-4 py-3">文件</th>
                  <th class="px-4 py-3">状态</th>
                  <th class="px-4 py-3">时间</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(item, index) in payload.items" :key="item.traceId || item.sessionId" class="table-row">
                  <td class="px-4 py-3">
                    <div class="font-medium text-gray-950 dark:text-white">{{ item.title || item.traceName || item.sessionId || "会话" }}</div>
                    <div class="mt-1 text-[11px] text-gray-500 dark:text-slate-400">会话 {{ displayIndex(index) }}</div>
                  </td>
                  <td class="px-4 py-3 text-gray-700 dark:text-slate-300">工作空间 {{ displayIndex(index) }}</td>
                  <td class="px-4 py-3 text-xs text-gray-700 dark:text-slate-300">任务 {{ displayIndex(index) }}</td>
                  <td class="px-4 py-3 text-gray-700 dark:text-slate-300">
                    {{ item.files?.inputsCount || 0 }} 入 / {{ item.files?.outputsCount || 0 }} 出
                  </td>
                  <td class="px-4 py-3">
                    <span class="badge" :class="statusBadge(item.businessStatus || item.status)">{{ humanizeStatus(item.businessStatus || item.status) }}</span>
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

type SessionTraceItem = SessionTracesPayload["items"][number];

const route = useRoute();
const router = useRouter();
const loading = ref(true);
const error = ref("");
const payload = ref<SessionTracesPayload | null>(null);
const filters = reactive({ workspaceId: "", sessionId: "", status: "" });

const traceItems = computed<SessionTraceItem[]>(() => payload.value?.items || []);
const runCount = computed(() => new Set(traceItems.value.map((item) => item.runId).filter(Boolean)).size);
const outputCount = computed(() => traceItems.value.reduce((sum, item) => sum + Number(item.files?.outputsCount || 0), 0));
const failedCount = computed(() => traceItems.value.filter((item) => ["failed", "error"].includes(String(item.businessStatus || item.status || "").toLowerCase())).length);

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

function displayIndex(index: number) {
  return String(Number(index || 0) + 1);
}

function statusBadge(status = "") {
  const normalized = String(status || "").toLowerCase();
  if (["completed", "success", "settled"].includes(normalized)) return "badge-success";
  if (["failed", "error"].includes(normalized)) return "badge-danger";
  if (["running", "active"].includes(normalized)) return "badge-primary";
  return "badge-warning";
}

function humanizeStatus(status = "") {
  const normalized = String(status || "").toLowerCase();
  if (["completed", "success", "settled"].includes(normalized)) return "已完成";
  if (["failed", "error"].includes(normalized)) return "失败";
  if (["running", "active"].includes(normalized)) return "运行中";
  if (normalized === "released") return "已释放";
  return status || "已记录";
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
