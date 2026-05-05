<template>
  <AppLayout title="使用记录" subtitle="运行记录、成本线索与下钻入口">
    <div class="space-y-6">
      <div v-if="!payload" class="card p-8 text-sm text-gray-500 dark:text-slate-400">正在加载使用记录...</div>
      <template v-else>
        <section class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="记录数" :value="payload.pagination?.total ?? 0" hint="最近可检索运行" />
          <MetricCard label="当前页" :value="payload.pagination?.page ?? 1" hint="分页浏览" />
          <MetricCard label="每页数量" :value="payload.pagination?.pageSize ?? 10" hint="列表密度" />
          <MetricCard label="失败运行" :value="failedCount" hint="当前页失败记录" />
        </section>

        <section class="grid grid-cols-1 gap-6 xl:grid-cols-[1.2fr_1fr]">
          <div class="card p-6">
            <div class="mb-4 flex items-center justify-between gap-4">
              <div>
                <h2 class="panel-title">运行列表</h2>
                <p class="panel-subtitle">统一查看用户、空间、状态和成本。</p>
              </div>
              <RouterLink class="btn btn-secondary" to="/admin/billing-ops">计费运维</RouterLink>
            </div>

            <div class="table-shell">
              <table class="text-sm">
                <thead>
                  <tr class="table-head">
                    <th class="px-4 py-3">用户</th>
                    <th class="px-4 py-3">任务空间</th>
                    <th class="px-4 py-3">运行编号</th>
                    <th class="px-4 py-3">状态</th>
                    <th class="px-4 py-3">成本</th>
                    <th class="px-4 py-3">详情</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="item in payload.items || []" :key="item.runId" class="table-row">
                    <td class="px-4 py-3">
                      <div class="font-medium text-gray-950 dark:text-white">{{ item.userName }}</div>
                      <div class="mt-1 text-xs text-gray-500 dark:text-slate-400">{{ item.userId || "-" }}</div>
                    </td>
                    <td class="px-4 py-3 text-gray-700 dark:text-slate-300">{{ item.workspaceId }}</td>
                    <td class="px-4 py-3 font-mono text-xs text-gray-700 dark:text-slate-300">{{ item.runId }}</td>
                    <td class="px-4 py-3">
                      <span class="badge" :class="statusBadge(item.status)">{{ humanizeStatus(item.status) }}</span>
                    </td>
                    <td class="px-4 py-3 font-medium text-gray-950 dark:text-white">¥{{ Number(item.totalCost || 0).toFixed(5) }}</td>
                    <td class="px-4 py-3">
                      <RouterLink class="text-sm font-medium text-primary-600 hover:text-primary-500 dark:text-primary-400" :to="{ path: '/admin/run', query: { runId: item.runId } }">查看</RouterLink>
                    </td>
                  </tr>
                  <tr v-if="!(payload.items || []).length">
                    <td colspan="6" class="px-4 py-8 text-center text-sm text-gray-500 dark:text-slate-400">暂无使用记录</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div class="space-y-6">
            <div class="card p-6">
              <div class="mb-4 flex items-center justify-between gap-4">
                <div>
                  <h2 class="panel-title">当前页概览</h2>
                  <p class="panel-subtitle">快速判断运行质量和成本分布。</p>
                </div>
              </div>
              <div class="space-y-3 text-sm">
                <div class="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3 dark:bg-slate-900/70">
                  <span class="text-gray-500 dark:text-slate-400">成功运行</span>
                  <span class="font-medium text-gray-950 dark:text-white">{{ successCount }}</span>
                </div>
                <div class="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3 dark:bg-slate-900/70">
                  <span class="text-gray-500 dark:text-slate-400">失败运行</span>
                  <span class="font-medium text-gray-950 dark:text-white">{{ failedCount }}</span>
                </div>
                <div class="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3 dark:bg-slate-900/70">
                  <span class="text-gray-500 dark:text-slate-400">平均成本</span>
                  <span class="font-medium text-gray-950 dark:text-white">¥{{ averageCost.toFixed(5) }}</span>
                </div>
              </div>
            </div>

            <div class="card p-6">
              <div class="mb-4 flex items-center justify-between gap-4">
                <div>
                  <h2 class="panel-title">常用入口</h2>
                  <p class="panel-subtitle">继续排查成本、运行与告警。</p>
                </div>
              </div>
              <div class="grid gap-3">
                <RouterLink class="rounded-2xl border border-gray-100 px-4 py-3 text-sm font-medium text-gray-700 transition hover:border-primary-300 hover:text-primary-700 dark:border-slate-700 dark:text-slate-200 dark:hover:border-primary-400 dark:hover:text-primary-300" to="/admin/billing-ops">计费运维</RouterLink>
                <RouterLink v-if="opsSurfaceEnabled" class="rounded-2xl border border-gray-100 px-4 py-3 text-sm font-medium text-gray-700 transition hover:border-primary-300 hover:text-primary-700 dark:border-slate-700 dark:text-slate-200 dark:hover:border-primary-400 dark:hover:text-primary-300" to="/admin/ops">运维监控</RouterLink>
                <RouterLink class="rounded-2xl border border-gray-100 px-4 py-3 text-sm font-medium text-gray-700 transition hover:border-primary-300 hover:text-primary-700 dark:border-slate-700 dark:text-slate-200 dark:hover:border-primary-400 dark:hover:text-primary-300" to="/admin/alerts">告警中心</RouterLink>
              </div>
            </div>
          </div>
        </section>
      </template>
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import MetricCard from "@/components/common/MetricCard.vue";
import AppLayout from "@/layouts/AppLayout.vue";
import { fetchAdminUsage } from "@/api/portal";

const payload = ref<any>(null);
const opsSurfaceEnabled = computed(() => Boolean(payload.value?.productProfile?.opsSurfaceEnabled));
const failedCount = computed(() => (payload.value?.items || []).filter((item: any) => /fail|error/i.test(String(item.status || ""))).length);
const successCount = computed(() => (payload.value?.items || []).filter((item: any) => /complete|success|finish/i.test(String(item.status || ""))).length);
const averageCost = computed(() => {
  const rows = payload.value?.items || [];
  if (!rows.length) return 0;
  return rows.reduce((sum: number, item: any) => sum + Number(item.totalCost || 0), 0) / rows.length;
});

function statusBadge(status?: string) {
  const normalized = String(status || "").toLowerCase();
  if (["completed", "success", "finished"].includes(normalized)) return "badge-success";
  if (["failed", "error"].includes(normalized)) return "badge-danger";
  if (["running", "active"].includes(normalized)) return "badge-primary";
  return "badge-warning";
}

function humanizeStatus(status?: string) {
  const normalized = String(status || "").toLowerCase();
  if (["completed", "success", "finished"].includes(normalized)) return "已完成";
  if (normalized === "running") return "运行中";
  if (normalized === "active") return "活跃";
  if (["failed", "error"].includes(normalized)) return "失败";
  return status || "未知";
}

onMounted(async () => {
  payload.value = await fetchAdminUsage();
});
</script>
