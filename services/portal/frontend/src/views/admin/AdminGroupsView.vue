<template>
  <AppLayout title="分组策略" subtitle="资源配额、成员归属与 MAS 访问能力">
    <div class="space-y-6">
      <div v-if="!payload" class="card p-8 text-sm text-gray-500 dark:text-slate-400">正在加载分组策略...</div>
      <template v-else>
        <section class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="分组数量" :value="payload.groups?.length ?? 0" hint="当前可用策略组" />
          <MetricCard label="启用分组" :value="activeCount" hint="未禁用的分组" />
          <MetricCard label="GPU 分组" :value="gpuCount" hint="GPU 配额大于 0" />
          <MetricCard label="允许 MAS" :value="masCount" hint="允许进入 AionUI/OPL" />
        </section>

        <section class="grid grid-cols-1 gap-6 xl:grid-cols-[1.15fr_1fr]">
          <div class="card p-6">
            <div class="mb-4 flex items-center justify-between gap-4">
              <div>
                <h2 class="panel-title">分组策略表</h2>
                <p class="panel-subtitle">资源边界和成员规模放在同一表里看。</p>
              </div>
              <RouterLink class="btn btn-secondary" to="/admin/users">用户管理</RouterLink>
            </div>

            <div class="table-shell">
              <table class="text-sm">
                <thead>
                  <tr class="table-head">
                    <th class="px-4 py-3">分组</th>
                    <th class="px-4 py-3">Plan</th>
                    <th class="px-4 py-3">成员</th>
                    <th class="px-4 py-3">CPU</th>
                    <th class="px-4 py-3">Memory</th>
                    <th class="px-4 py-3">GPU</th>
                    <th class="px-4 py-3">Storage</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="item in payload.groups || []" :key="item.id" class="table-row">
                    <td class="px-4 py-3">
                      <div class="font-medium text-gray-950 dark:text-white">{{ item.name }}</div>
                      <div class="mt-1 text-xs text-gray-500 dark:text-slate-400">{{ item.status || 'active' }}</div>
                    </td>
                    <td class="px-4 py-3 text-gray-700 dark:text-slate-300">{{ item.plan || "-" }}</td>
                    <td class="px-4 py-3 font-medium text-gray-950 dark:text-white">{{ item.memberCount ?? 0 }}</td>
                    <td class="px-4 py-3 text-gray-700 dark:text-slate-300">{{ rangeLabel(item.cpuRequest, item.cpuLimit) }}</td>
                    <td class="px-4 py-3 text-gray-700 dark:text-slate-300">{{ rangeLabel(item.memoryRequest, item.memoryLimit) }}</td>
                    <td class="px-4 py-3 text-gray-700 dark:text-slate-300">{{ item.gpuCount ?? 0 }}</td>
                    <td class="px-4 py-3 text-gray-700 dark:text-slate-300">{{ rangeLabel(item.storageRequest, item.storageLimit) }}</td>
                  </tr>
                  <tr v-if="!(payload.groups || []).length">
                    <td colspan="7" class="px-4 py-8 text-center text-sm text-gray-500 dark:text-slate-400">暂无分组策略</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div class="space-y-6">
            <div class="card p-6">
              <div class="mb-4 flex items-center justify-between gap-4">
                <div>
                  <h2 class="panel-title">成员归属</h2>
                  <p class="panel-subtitle">查看当前用户落在哪个策略组。</p>
                </div>
              </div>
              <div class="space-y-3">
                <div v-for="item in payload.users || []" :key="item.id" class="rounded-2xl border border-gray-100 px-4 py-4 dark:border-slate-700">
                  <div class="flex items-start justify-between gap-4">
                    <div>
                      <div class="font-medium text-gray-950 dark:text-white">{{ item.name }}</div>
                      <div class="mt-1 text-xs text-gray-500 dark:text-slate-400">{{ item.email }}</div>
                    </div>
                    <div class="text-sm text-gray-600 dark:text-slate-300">{{ groupNameById(item.groupId) }}</div>
                  </div>
                </div>
                <div v-if="!(payload.users || []).length" class="empty-state">
                  暂无成员数据
                </div>
              </div>
            </div>

            <div class="card p-6">
              <div class="mb-4 flex items-center justify-between gap-4">
                <div>
                  <h2 class="panel-title">策略摘要</h2>
                  <p class="panel-subtitle">快速判断资源边界是否合理。</p>
                </div>
              </div>
              <div class="space-y-3 text-sm">
                <div class="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3 dark:bg-slate-900/70">
                  <span class="text-gray-500 dark:text-slate-400">CPU 配额空缺组</span>
                  <span class="font-medium text-gray-950 dark:text-white">{{ cpuUnsetCount }}</span>
                </div>
                <div class="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3 dark:bg-slate-900/70">
                  <span class="text-gray-500 dark:text-slate-400">存储配额空缺组</span>
                  <span class="font-medium text-gray-950 dark:text-white">{{ storageUnsetCount }}</span>
                </div>
                <div class="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3 dark:bg-slate-900/70">
                  <span class="text-gray-500 dark:text-slate-400">允许 MAS 的组</span>
                  <span class="font-medium text-gray-950 dark:text-white">{{ masCount }}</span>
                </div>
              </div>
            </div>
          </div>
        </section>
      </template>
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import AppLayout from "@/layouts/AppLayout.vue";
import MetricCard from "@/components/common/MetricCard.vue";
import { fetchAdminGroups } from "@/api/portal";
import { computed, onMounted, ref } from "vue";

const payload = ref<any>(null);
const activeCount = computed(() => (payload.value?.groups || []).filter((item: any) => item.status !== "disabled").length);
const gpuCount = computed(() => (payload.value?.groups || []).filter((item: any) => Number(item.gpuCount || 0) > 0).length);
const masCount = computed(() => (payload.value?.groups || []).filter((item: any) => item.allowMas !== false).length);
const cpuUnsetCount = computed(() => (payload.value?.groups || []).filter((item: any) => !item.cpuRequest && !item.cpuLimit).length);
const storageUnsetCount = computed(() => (payload.value?.groups || []).filter((item: any) => !item.storageRequest && !item.storageLimit).length);

function rangeLabel(request?: string, limit?: string) {
  if (!request && !limit) return "-";
  return `${request || "-"} ~ ${limit || "-"}`;
}

function groupNameById(groupId = "") {
  const target = (payload.value?.groups || []).find((item: any) => item.id === groupId);
  return target?.name || "未分组";
}

onMounted(async () => {
  payload.value = await fetchAdminGroups();
});
</script>
