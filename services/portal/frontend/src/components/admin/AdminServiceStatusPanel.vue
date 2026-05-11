<template>
  <section data-route-id="admin.system" data-component-id="admin.system.service_status" class="space-y-6">
    <section class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      <MetricCard label="服务数量" :value="serviceCount" hint="当前纳管服务数量" />
      <MetricCard label="异常服务" :value="failedServices" hint="当前探测异常的服务" />
      <MetricCard label="安全缺口" :value="securityGapCount" hint="默认密钥、默认口令和配置卫生问题" />
      <MetricCard label="MAS 首次回复" :value="masReplyLabel" hint="最近成功样本的平均近似值" />
    </section>

    <section class="grid grid-cols-1 gap-6 xl:grid-cols-[1.2fr_1fr]">
      <div class="card p-6">
        <div class="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h2 class="panel-title">服务状态</h2>
            <p class="panel-subtitle">聚焦 Portal、OPL、Trace、Adapter 等主链路。</p>
          </div>
          <RouterLink v-if="opsSurfaceEnabled" class="btn btn-secondary" to="/admin/ops">查看服务状态</RouterLink>
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
          <div v-if="!serviceCards.length" class="empty-state md:col-span-2">暂无服务状态。</div>
        </div>
      </div>

      <div class="space-y-6">
        <div class="card p-6">
          <h2 class="panel-title">宿主摘要</h2>
          <div class="mt-4 space-y-3 text-sm">
            <div class="muted-kv"><span class="muted-kv-label">主机名</span><span class="muted-kv-value">{{ systemMetrics.hostname || "-" }}</span></div>
            <div class="muted-kv"><span class="muted-kv-label">运行时长</span><span class="muted-kv-value">{{ systemMetrics.uptimeHours ?? '-' }} h</span></div>
            <div class="muted-kv"><span class="muted-kv-label">可用内存</span><span class="muted-kv-value">{{ systemMetrics.freeMemoryGb ?? '-' }} GB</span></div>
            <div class="muted-kv"><span class="muted-kv-label">存储模式</span><span class="muted-kv-value">{{ systemMetrics.dbMode || "-" }}</span></div>
          </div>
        </div>

        <div class="card p-6">
          <h2 class="panel-title">安全配置健康</h2>
          <div class="mt-4 space-y-3">
            <div v-for="item in securityChecks" :key="item.key" class="rounded-2xl border border-gray-100 px-4 py-4 dark:border-slate-700">
              <div class="flex items-center justify-between gap-4">
                <div class="font-medium text-gray-950 dark:text-white">{{ item.key }}</div>
                <span class="badge" :class="item.healthy ? 'badge-success' : 'badge-danger'">{{ item.healthy ? '健康' : '待处理' }}</span>
              </div>
              <div class="mt-2 text-sm text-gray-500 dark:text-slate-400">{{ item.detail }}</div>
            </div>
            <div v-if="!securityChecks.length" class="empty-state">暂无安全配置检查。</div>
          </div>
        </div>
      </div>
    </section>
  </section>
</template>

<script setup lang="ts">
import MetricCard from "@/components/common/MetricCard.vue";

defineProps<{
  failedServices: number;
  masReplyLabel: string;
  opsSurfaceEnabled: boolean;
  responseLabel: (value: number | null | undefined) => string;
  securityChecks: Array<Record<string, any>>;
  securityGapCount: number;
  serviceCards: Array<Record<string, any>>;
  serviceCount: number;
  systemMetrics: Record<string, any>;
}>();
</script>
