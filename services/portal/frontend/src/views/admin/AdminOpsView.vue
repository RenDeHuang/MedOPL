<template>
  <AppLayout title="运维监控" subtitle="服务状态、并发、性能与异常事件">
    <div class="space-y-6">
      <div v-if="!payload" class="card p-8 text-sm text-gray-500 dark:text-slate-400">正在加载运维数据...</div>
      <template v-else>
        <section class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="并发运行" :value="payload.systemMetrics?.concurrentRuns ?? 0" hint="当前未结束 runs" />
          <MetricCard label="活跃沙箱" :value="payload.systemMetrics?.activeSandboxes ?? 0" hint="当前运行中或活跃沙箱" />
          <MetricCard label="活跃 Session" :value="payload.systemMetrics?.activeWorkspaceSessions ?? 0" hint="当前 workspace session" />
          <MetricCard label="告警事件" :value="payload.alerts?.length ?? 0" hint="当前活跃告警数量" />
        </section>

        <section class="grid grid-cols-1 gap-4 md:grid-cols-3">
          <MetricCard label="MAS 首次回复" :value="masReplyLabel" hint="最近成功样本的平均近似值" />
          <MetricCard label="Warmup 超时" :value="payload.summaries?.performance?.warmupTimeoutCount ?? 0" hint="最近 warmup 超时次数" />
          <MetricCard label="安全缺口" :value="payload.summaries?.security?.failedCount ?? 0" hint="默认 secret / 默认口令 / 配置卫生问题" />
        </section>

        <section class="grid grid-cols-1 gap-6 xl:grid-cols-[1.2fr_1fr]">
          <div class="card p-6">
            <div class="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <h2 class="panel-title">服务状态</h2>
                <p class="panel-subtitle">展示当前探测结果、来源边界与响应时间。</p>
              </div>
              <RouterLink class="btn btn-secondary" to="/admin/system">系统入口</RouterLink>
            </div>

            <div class="mt-6 table-shell">
              <table class="text-sm">
                <thead>
                  <tr class="table-head">
                    <th class="px-4 py-3">服务</th>
                    <th class="px-4 py-3">状态</th>
                    <th class="px-4 py-3">探测结果</th>
                    <th class="px-4 py-3">响应时间</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="item in payload.serviceStatuses || []" :key="item.name" class="table-row">
                    <td class="px-4 py-3 font-medium text-gray-950 dark:text-white">{{ item.name }}</td>
                    <td class="px-4 py-3">
                      <span class="badge" :class="item.ok ? 'badge-success' : 'badge-danger'">{{ item.ok ? "可用" : "异常" }}</span>
                    </td>
                    <td class="px-4 py-3 text-gray-700 dark:text-slate-300">{{ item.status || "-" }}</td>
                    <td class="px-4 py-3 text-gray-700 dark:text-slate-300">{{ responseLabel(item.responseMs) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div class="space-y-6">
            <div class="card p-6">
              <h2 class="panel-title">性能摘要</h2>
              <div class="mt-4 space-y-3 text-sm">
                <div class="muted-kv"><span class="muted-kv-label">MAS 首次回复近似值</span><span class="muted-kv-value">{{ masReplyLabel }}</span></div>
                <div class="muted-kv"><span class="muted-kv-label">成功 MAS Runs</span><span class="muted-kv-value">{{ payload.summaries?.performance?.totalSuccessfulMasRuns ?? 0 }}</span></div>
                <div class="muted-kv"><span class="muted-kv-label">Warmup 超时</span><span class="muted-kv-value">{{ payload.summaries?.performance?.warmupTimeoutCount ?? 0 }}</span></div>
              </div>
            </div>

            <div class="card p-6">
              <h2 class="panel-title">安全与异常事件</h2>
              <div class="mt-4 space-y-3">
                <div v-for="item in payload.warningEvents || []" :key="`${item.type}-${item.occurredAt}-${item.userId}`" class="rounded-2xl border border-gray-100 px-4 py-4 dark:border-slate-700">
                  <div class="font-medium text-gray-950 dark:text-white">{{ item.type }}</div>
                  <div class="mt-1 text-xs text-gray-500 dark:text-slate-400">{{ item.occurredAtLabel || item.occurredAt || '-' }}</div>
                  <div class="mt-2 text-sm text-gray-500 dark:text-slate-400">{{ item.workspaceId || item.userId || '-' }}</div>
                </div>
                <div v-if="!(payload.warningEvents || []).length" class="empty-state">暂无事件</div>
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
import { fetchAdminOps } from "@/api/portal";

const payload = ref<any>(null);

const masReplyLabel = computed(() => {
  const value = Number(payload.value?.summaries?.performance?.masFirstReplyApproxMs || 0);
  return value ? `${value} ms` : "-";
});

function responseLabel(value: number | null | undefined) {
  if (value == null || Number.isNaN(Number(value))) return "-";
  return `${Number(value)} ms`;
}

onMounted(async () => {
  payload.value = await fetchAdminOps();
});
</script>
