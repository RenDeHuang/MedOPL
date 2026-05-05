<template>
  <AppLayout title="系统状态" subtitle="Portal、OPL、Trace、Adapter 与内部诊断状态">
    <div class="space-y-6">
      <div v-if="!payload" class="card p-8 text-sm text-gray-500 dark:text-slate-400">正在加载系统摘要...</div>
      <template v-else>
        <section class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="服务数量" :value="payload.serviceStatuses?.length ?? 0" hint="当前纳管服务数量" />
          <MetricCard label="异常服务" :value="failedServices" hint="当前探测异常的服务" />
          <MetricCard label="安全缺口" :value="payload.summaries?.security?.failedCount ?? 0" hint="默认 secret / 默认口令 / 配置卫生问题" />
          <MetricCard label="MAS 首次回复" :value="masReplyLabel" hint="最近成功样本的平均近似值" />
        </section>

        <section class="grid grid-cols-1 gap-6 xl:grid-cols-[1.2fr_1fr]">
          <div class="card p-6">
            <div class="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <h2 class="panel-title">产品系统状态</h2>
                <p class="panel-subtitle">聚焦 Portal、OPL、Trace、Adapter 等商业化主链路。</p>
              </div>
              <RouterLink class="btn btn-secondary" to="/admin/ops">云资源状态</RouterLink>
            </div>

            <div class="mt-6 grid gap-3 md:grid-cols-2">
              <div v-for="item in serviceCards" :key="item.name" class="rounded-2xl border border-gray-100 p-4 dark:border-slate-700">
                <div class="flex items-center justify-between gap-4">
                  <div class="font-medium text-gray-950 dark:text-white">{{ item.name }}</div>
                  <span class="badge" :class="item.ok ? 'badge-success' : 'badge-danger'">{{ item.ok ? "可用" : "异常" }}</span>
                </div>
                <div class="mt-2 text-sm text-gray-500 dark:text-slate-400">状态：{{ item.status || "-" }}</div>
                <div class="mt-1 text-xs text-gray-500 dark:text-slate-400">来源：{{ item.source }}</div>
                <div class="mt-1 text-xs text-gray-500 dark:text-slate-400">类型：{{ item.kind }}</div>
                <div class="mt-1 text-xs text-gray-500 dark:text-slate-400">响应：{{ responseLabel(item.responseMs) }}</div>
              </div>
            </div>
          </div>

          <div class="space-y-6">
            <div class="card p-6">
              <h2 class="panel-title">宿主摘要</h2>
              <div class="mt-4 space-y-3 text-sm">
                <div class="muted-kv"><span class="muted-kv-label">主机名</span><span class="muted-kv-value">{{ payload.systemMetrics?.hostname || "-" }}</span></div>
                <div class="muted-kv"><span class="muted-kv-label">运行时长</span><span class="muted-kv-value">{{ payload.systemMetrics?.uptimeHours ?? '-' }} h</span></div>
                <div class="muted-kv"><span class="muted-kv-label">可用内存</span><span class="muted-kv-value">{{ payload.systemMetrics?.freeMemoryGb ?? '-' }} GB</span></div>
                <div class="muted-kv"><span class="muted-kv-label">存储模式</span><span class="muted-kv-value">{{ payload.systemMetrics?.dbMode || "-" }}</span></div>
              </div>
            </div>

            <div class="card p-6">
              <h2 class="panel-title">安全配置健康</h2>
              <div class="mt-4 space-y-3">
                <div v-for="item in payload.summaries?.security?.checks || []" :key="item.key" class="rounded-2xl border border-gray-100 px-4 py-4 dark:border-slate-700">
                  <div class="flex items-center justify-between gap-4">
                    <div class="font-medium text-gray-950 dark:text-white">{{ item.key }}</div>
                    <span class="badge" :class="item.healthy ? 'badge-success' : 'badge-danger'">{{ item.healthy ? '健康' : '待处理' }}</span>
                  </div>
                  <div class="mt-2 text-sm text-gray-500 dark:text-slate-400">{{ item.detail }}</div>
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
import { computed, onMounted, ref } from "vue";
import AppLayout from "@/layouts/AppLayout.vue";
import MetricCard from "@/components/common/MetricCard.vue";
import { fetchAdminSystem } from "@/api/portal";

const payload = ref<any>(null);
const failedServices = computed(() => (payload.value?.serviceStatuses || []).filter((item: any) => !item.ok).length);
const masReplyLabel = computed(() => {
  const value = Number(payload.value?.summaries?.performance?.masFirstReplyApproxMs || 0);
  return value ? `${value} ms` : "-";
});

const productSystemNames = new Set(["Portal", "OPL", "Trace", "Adapter", "Runtime Bridge", "Gateway", "Portal OPL Adapter"]);
const serviceCards = computed(() => (payload.value?.serviceStatuses || [])
  .filter((item: any) => productSystemNames.has(String(item.name || "")))
  .map((item: any) => ({
    ...item,
    source: "内部诊断",
    kind: "主链路探测",
  })));

function responseLabel(value: number | null | undefined) {
  if (value == null || Number.isNaN(Number(value))) return "-";
  return `${Number(value)} ms`;
}

onMounted(async () => {
  payload.value = await fetchAdminSystem();
});
</script>
