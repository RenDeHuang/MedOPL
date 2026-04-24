<template>
  <AppLayout title="K8s运维与分发" subtitle="user sandbox、镜像版本、运行状态与最近活动">
    <div class="space-y-6">
      <div v-if="!payload" class="card p-8 text-sm text-gray-500 dark:text-slate-400">正在加载沙箱数据...</div>
      <template v-else>
        <section class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="沙箱总数" :value="items.length" hint="当前登记的运行时" />
          <MetricCard label="运行中" :value="runningCount" hint="活跃中的沙箱" />
          <MetricCard label="异常" :value="errorCount" hint="状态异常或需要关注" />
          <MetricCard label="最近空间" :value="activeWorkspaceCount" hint="存在最近 workspace 记录" />
        </section>

        <section class="card p-6">
          <div class="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <h2 class="panel-title">沙箱列表</h2>
              <p class="panel-subtitle">按用户、状态、镜像和最近空间查看当前沙箱分发情况。</p>
            </div>
            <div class="flex flex-wrap gap-3">
              <input v-model.trim="filters.user" class="input w-[220px]" type="text" placeholder="按用户筛选" />
              <select v-model="filters.status" class="input w-[180px]">
                <option value="">全部状态</option>
                <option value="running">运行中</option>
                <option value="idle">空闲</option>
                <option value="error">异常</option>
                <option value="terminated">已回收</option>
              </select>
              <select v-model="pageSize" class="input w-[120px]">
                <option :value="5">5 行</option>
                <option :value="10">10 行</option>
                <option :value="20">20 行</option>
              </select>
            </div>
          </div>

          <div class="mt-6 table-shell">
            <table class="text-sm">
              <thead>
                <tr class="table-head">
                  <th class="px-4 py-3">用户</th>
                  <th class="px-4 py-3">容器 / 命名空间</th>
                  <th class="px-4 py-3">任务空间</th>
                  <th class="px-4 py-3">镜像</th>
                  <th class="px-4 py-3">状态</th>
                  <th class="px-4 py-3">最近活动</th>
                  <th class="px-4 py-3">操作</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in pagedItems" :key="item.id" class="table-row">
                  <td class="px-4 py-3">
                    <div class="font-medium text-gray-950 dark:text-white">{{ item.userName || "-" }}</div>
                    <div class="mt-1 text-xs text-gray-500 dark:text-slate-400">{{ item.userId || "-" }}</div>
                  </td>
                  <td class="px-4 py-3">
                    <div class="font-mono text-xs text-gray-700 dark:text-slate-300">{{ item.containerName || "-" }}</div>
                    <div class="mt-1 text-xs text-gray-500 dark:text-slate-400">{{ item.namespace || "-" }}</div>
                  </td>
                  <td class="px-4 py-3 text-gray-700 dark:text-slate-300">{{ item.lastWorkspaceId || "-" }}</td>
                  <td class="px-4 py-3 text-gray-700 dark:text-slate-300">{{ shortImageTag(item.imageTag) }}</td>
                  <td class="px-4 py-3">
                    <span class="badge" :class="statusBadge(item.status)">{{ item.statusLabel || item.status }}</span>
                  </td>
                  <td class="px-4 py-3 text-gray-700 dark:text-slate-300">{{ item.updatedAtLabel || "-" }}</td>
                  <td class="px-4 py-3">
                    <button class="btn btn-secondary" type="button" @click="openDetail(item)">详情</button>
                  </td>
                </tr>
                <tr v-if="!pagedItems.length">
                  <td colspan="7" class="px-4 py-8 text-center text-sm text-gray-500 dark:text-slate-400">暂无沙箱记录</td>
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

    <BaseDialog
      v-model="showDetailModal"
      title="沙箱详情"
      :description="selectedItem ? `查看 ${selectedItem.userName || selectedItem.userId} 的沙箱详情。` : '查看沙箱详情。'"
    >
      <div v-if="selectedItem" class="grid gap-4 md:grid-cols-2">
        <div class="rounded-2xl border border-gray-100 px-4 py-4 dark:border-slate-700"><div class="text-xs font-semibold uppercase tracking-[0.14em] text-gray-400 dark:text-slate-500">用户</div><div class="mt-2 text-sm font-medium text-gray-950 dark:text-white">{{ selectedItem.userName || "-" }}</div><div class="mt-1 text-sm text-gray-500 dark:text-slate-400">{{ selectedItem.userId || "-" }}</div></div>
        <div class="rounded-2xl border border-gray-100 px-4 py-4 dark:border-slate-700"><div class="text-xs font-semibold uppercase tracking-[0.14em] text-gray-400 dark:text-slate-500">状态</div><div class="mt-2 text-sm font-medium text-gray-950 dark:text-white">{{ selectedItem.statusLabel || selectedItem.status }}</div><div class="mt-1 text-sm text-gray-500 dark:text-slate-400">{{ selectedItem.updatedAtLabel || "-" }}</div></div>
        <div class="rounded-2xl border border-gray-100 px-4 py-4 dark:border-slate-700"><div class="text-xs font-semibold uppercase tracking-[0.14em] text-gray-400 dark:text-slate-500">容器</div><div class="mt-2 text-sm font-medium text-gray-950 dark:text-white">{{ selectedItem.containerName || "-" }}</div><div class="mt-1 text-sm text-gray-500 dark:text-slate-400">{{ selectedItem.namespace || "-" }}</div></div>
        <div class="rounded-2xl border border-gray-100 px-4 py-4 dark:border-slate-700"><div class="text-xs font-semibold uppercase tracking-[0.14em] text-gray-400 dark:text-slate-500">镜像</div><div class="mt-2 text-sm font-medium text-gray-950 dark:text-white">{{ selectedItem.imageTag || "-" }}</div><div class="mt-1 text-sm text-gray-500 dark:text-slate-400">{{ runtimeTypeLabel(selectedItem.runtimeType) }}</div></div>
        <div class="rounded-2xl border border-gray-100 px-4 py-4 dark:border-slate-700"><div class="text-xs font-semibold uppercase tracking-[0.14em] text-gray-400 dark:text-slate-500">最近任务空间</div><div class="mt-2 text-sm font-medium text-gray-950 dark:text-white">{{ selectedItem.lastWorkspaceId || "-" }}</div></div>
        <div class="rounded-2xl border border-gray-100 px-4 py-4 dark:border-slate-700"><div class="text-xs font-semibold uppercase tracking-[0.14em] text-gray-400 dark:text-slate-500">最近错误</div><div class="mt-2 text-sm font-medium text-gray-950 dark:text-white">{{ selectedItem.lastError || "-" }}</div></div>
      </div>
    </BaseDialog>
  </AppLayout>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import AppLayout from "@/layouts/AppLayout.vue";
import MetricCard from "@/components/common/MetricCard.vue";
import BaseDialog from "@/components/common/BaseDialog.vue";
import { fetchAdminSandboxes } from "@/api/portal";

const payload = ref<any>(null);
const filters = ref({ user: "", status: "" });
const pageSize = ref(5);
const currentPage = ref(1);
const showDetailModal = ref(false);
const selectedItem = ref<any>(null);

const items = computed(() => payload.value?.items || []);
const runningCount = computed(() => items.value.filter((item: any) => ["running", "active", "provisioning"].includes(String(item.status || "").toLowerCase())).length);
const errorCount = computed(() => items.value.filter((item: any) => ["error"].includes(String(item.status || "").toLowerCase()) || item.lastError).length);
const activeWorkspaceCount = computed(() => items.value.filter((item: any) => item.lastWorkspaceId).length);

const filteredItems = computed(() => {
  return items.value.filter((item: any) => {
    const userText = `${item.userName || ""} ${item.userId || ""}`.toLowerCase();
    const matchesUser = !filters.value.user || userText.includes(filters.value.user.toLowerCase());
    const normalizedStatus = String(item.status || "").toLowerCase();
    const matchesStatus = !filters.value.status || normalizedStatus === filters.value.status;
    return matchesUser && matchesStatus;
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

function openDetail(item: any) {
  selectedItem.value = item;
  showDetailModal.value = true;
}

function statusBadge(status = "") {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "error") return "badge-danger";
  if (["running", "active", "provisioning"].includes(normalized)) return "badge-primary";
  if (["idle", "hibernated"].includes(normalized)) return "badge-warning";
  return "badge-success";
}

function shortImageTag(value = "") {
  const text = String(value || "").trim();
  if (!text) return "-";
  return text.length > 42 ? `${text.slice(0, 42)}...` : text;
}

function runtimeTypeLabel(value = "") {
  const normalized = String(value || "").toLowerCase();
  if (normalized === "docker") return "容器";
  if (normalized === "k8s") return "集群";
  return value || "-";
}

onMounted(async () => {
  payload.value = await fetchAdminSandboxes();
});
</script>
