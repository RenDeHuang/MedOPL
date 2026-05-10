<template>
  <AppLayout title="审计日志" subtitle="管理动作、配置变更与关键链路留痕">
    <div class="space-y-6">
      <div v-if="!payload" class="card p-8 text-sm text-gray-500 dark:text-slate-400">正在加载审计日志...</div>
      <template v-else>
        <section class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="审计条数" :value="payload.pagination?.total ?? 0" hint="当前总记录数" />
          <MetricCard label="配置变更" :value="settingsCount" hint="settings / theme 相关" />
          <MetricCard label="任务空间事件" :value="workspaceCount" hint="workspace 生命周期" />
          <MetricCard label="运行事件" :value="runCount" hint="run / runtime 相关" />
        </section>

        <section class="card p-6">
          <div class="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <h2 class="panel-title">审计记录</h2>
              <p class="panel-subtitle">当前页面展示 Portal 的关键审计事件。</p>
            </div>
            <div class="flex flex-wrap gap-3">
              <input v-model.trim="keyword" class="input w-[220px]" type="text" placeholder="按事件关键词筛选" />
              <select v-model="pageSize" class="input w-[120px]">
                <option :value="10">10 行</option>
                <option :value="20">20 行</option>
                <option :value="50">50 行</option>
              </select>
            </div>
          </div>

          <div class="mt-6 table-shell">
            <table class="text-sm">
              <thead>
                <tr class="table-head">
                  <th class="px-4 py-3">事件</th>
                  <th class="px-4 py-3">来源</th>
                  <th class="px-4 py-3">用户</th>
                  <th class="px-4 py-3">操作人</th>
                  <th class="px-4 py-3">任务空间</th>
                  <th class="px-4 py-3">时间</th>
                  <th class="px-4 py-3">详情</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in pagedItems" :key="`${item.type}-${item.occurredAt}-${item.userId}`" class="table-row">
                  <td class="px-4 py-3 font-medium text-gray-950 dark:text-white">{{ humanizeAuditType(item.type) }}</td>
                  <td class="px-4 py-3 text-gray-700 dark:text-slate-300">{{ sourceLabel(item.type) }}</td>
                  <td class="px-4 py-3 text-gray-700 dark:text-slate-300">{{ item.userId || "-" }}</td>
                  <td class="px-4 py-3 text-gray-700 dark:text-slate-300">{{ item.operatorId || "-" }}</td>
                  <td class="px-4 py-3 text-gray-700 dark:text-slate-300">{{ item.workspaceId || "-" }}</td>
                  <td class="px-4 py-3 text-gray-700 dark:text-slate-300">{{ item.occurredAt || "-" }}</td>
                  <td class="px-4 py-3 text-xs text-gray-500 dark:text-slate-400">{{ shortDetail(item.detail) }}</td>
                </tr>
                <tr v-if="!pagedItems.length">
                  <td colspan="7" class="px-4 py-8 text-center text-sm text-gray-500 dark:text-slate-400">暂无审计记录</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="pager-bar">
            <span>第 {{ currentPage }} / {{ totalPages }} 页</span>
            <div class="flex gap-3">
              <button class="btn btn-secondary" type="button" :disabled="currentPage === 1" @click="currentPage -= 1">上一页</button>
              <button class="btn btn-secondary" type="button" :disabled="currentPage === totalPages" @click="currentPage += 1">下一页</button>
            </div>
          </div>
        </section>
      </template>
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import AppLayout from "@/layouts/AppLayout.vue";
import MetricCard from "@/components/common/MetricCard.vue";
import { fetchAdminAudit } from "@/api/portal/admin";

const payload = ref<any>(null);
const keyword = ref("");
const pageSize = ref(10);
const currentPage = ref(1);

const settingsCount = computed(() => (payload.value?.items || []).filter((item: any) => /settings|theme/i.test(String(item.type || ""))).length);
const workspaceCount = computed(() => (payload.value?.items || []).filter((item: any) => /workspace/i.test(String(item.type || ""))).length);
const runCount = computed(() => (payload.value?.items || []).filter((item: any) => /run|runtime/i.test(String(item.type || ""))).length);

const filteredItems = computed(() => {
  const query = keyword.value.trim().toLowerCase();
  if (!query) return payload.value?.items || [];
  return (payload.value?.items || []).filter((item: any) => {
    const haystack = `${item.type || ""} ${item.userId || ""} ${item.operatorId || ""} ${item.workspaceId || ""} ${item.detail || ""}`.toLowerCase();
    return haystack.includes(query);
  });
});

const totalPages = computed(() => Math.max(1, Math.ceil(filteredItems.value.length / pageSize.value)));
const pagedItems = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value;
  return filteredItems.value.slice(start, start + pageSize.value);
});

watch([filteredItems, pageSize], () => {
  currentPage.value = 1;
});

function shortDetail(value = "") {
  const text = String(value || "").trim();
  if (!text) return "-";
  return text.length > 84 ? `${text.slice(0, 84)}...` : text;
}

function sourceLabel(value = "") {
  const normalized = String(value || "").toLowerCase();
  if (normalized.includes("theme") || normalized.includes("settings")) return "Portal 配置";
  if (normalized.includes("workspace")) return "任务空间";
  if (normalized.includes("run")) return "运行时";
  if (normalized.includes("user")) return "账户";
  return "Portal";
}

function humanizeAuditType(value = "") {
  const normalized = String(value || "").toLowerCase();
  if (normalized.includes("theme")) return "主题变更";
  if (normalized.includes("settings")) return "配置变更";
  if (normalized.includes("workspace_created")) return "任务空间创建";
  if (normalized.includes("workspace_archived")) return "任务空间归档";
  if (normalized.includes("workspace_deleted")) return "任务空间删除";
  if (normalized.includes("workspace")) return "任务空间事件";
  if (normalized.includes("run")) return "运行事件";
  return value || "事件";
}

async function load() {
  payload.value = await fetchAdminAudit();
}

onMounted(async () => {
  await load();
});
</script>
