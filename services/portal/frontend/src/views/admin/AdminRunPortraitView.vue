<template>
  <AppLayout title="运行详情" subtitle="运行上下文、计费来源与五条真链路">
    <div v-if="payload" class="space-y-6">
      <section class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="运行编号" :value="payload.run.runId" hint="运行唯一标识" />
        <MetricCard label="用户" :value="payload.run.userName" hint="触发用户" />
        <MetricCard label="工作空间" :value="payload.run.workspaceTitle" hint="归属 workspace" />
        <MetricCard label="状态" :value="payload.run.status" hint="当前运行状态" />
      </section>

      <section class="grid grid-cols-1 gap-6 xl:grid-cols-[1.1fr_1fr]">
        <div class="card p-6">
          <div class="mb-4 flex items-center justify-between gap-4">
            <div>
              <h2 class="panel-title">运行上下文</h2>
              <p class="panel-subtitle">从业务对象回看当前 run 的来源与归属。</p>
            </div>
            <RouterLink class="btn btn-secondary" to="/admin/usage">返回使用记录</RouterLink>
          </div>

          <div class="space-y-3 text-sm">
            <div class="muted-kv"><span class="muted-kv-label">用户 ID</span><span class="muted-kv-value">{{ payload.run.userId || '-' }}</span></div>
            <div class="muted-kv"><span class="muted-kv-label">用户邮箱</span><span class="muted-kv-value">{{ payload.run.userEmail || '-' }}</span></div>
            <div class="muted-kv"><span class="muted-kv-label">工作空间 ID</span><span class="muted-kv-value">{{ payload.run.workspaceId || '-' }}</span></div>
            <div class="muted-kv"><span class="muted-kv-label">Workspace Session</span><span class="muted-kv-value">{{ payload.workspaceSession?.id || payload.run.workspaceSessionId || '-' }}</span></div>
            <div class="muted-kv"><span class="muted-kv-label">Session 状态</span><span class="muted-kv-value">{{ payload.workspaceSession?.status || '-' }}</span></div>
            <div class="muted-kv"><span class="muted-kv-label">最后活跃</span><span class="muted-kv-value">{{ payload.workspaceSession?.lastUsedAt || '-' }}</span></div>
            <div class="muted-kv"><span class="muted-kv-label">来源</span><span class="muted-kv-value">{{ payload.run.source || '-' }}</span></div>
          </div>
        </div>

        <div class="card p-6">
          <h2 class="panel-title">计费链路</h2>
          <div class="mt-4 space-y-3 text-sm">
            <div class="muted-kv"><span class="muted-kv-label">CPU</span><span class="muted-kv-value">¥{{ Number(payload.billing.cpuCost || 0).toFixed(5) }}</span></div>
            <div class="muted-kv"><span class="muted-kv-label">GPU</span><span class="muted-kv-value">¥{{ Number(payload.billing.gpuCost || 0).toFixed(5) }}</span></div>
            <div class="muted-kv"><span class="muted-kv-label">存储</span><span class="muted-kv-value">¥{{ Number(payload.billing.storageCost || 0).toFixed(5) }}</span></div>
            <div class="muted-kv"><span class="muted-kv-label">总成本</span><span class="muted-kv-value">¥{{ Number(payload.billing.totalCost || 0).toFixed(5) }}</span></div>
            <div class="muted-kv"><span class="muted-kv-label">计价来源</span><span class="muted-kv-value">{{ payload.billing.pricingSource }}</span></div>
            <div class="muted-kv"><span class="muted-kv-label">开始</span><span class="muted-kv-value">{{ payload.billing.start || '-' }}</span></div>
            <div class="muted-kv"><span class="muted-kv-label">结束</span><span class="muted-kv-value">{{ payload.billing.end || '-' }}</span></div>
          </div>
        </div>
      </section>

      <section class="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <div class="card p-6">
          <h2 class="panel-title">输出产物</h2>
          <div class="mt-4 space-y-3">
            <div v-for="item in payload.outputs || []" :key="item.name" class="rounded-2xl border border-gray-100 px-4 py-4 dark:border-slate-700">
              <div class="font-medium text-gray-950 dark:text-white">{{ item.name }}</div>
              <div class="mt-2 text-xs text-gray-500 dark:text-slate-400">{{ item.fullPath }}</div>
            </div>
            <div v-if="!(payload.outputs || []).length" class="empty-state">当前未识别到与该 run 直接匹配的输出文件</div>
          </div>
        </div>

        <div class="card p-6">
          <h2 class="panel-title">Trace 链路</h2>
          <div class="mt-4 space-y-3 text-sm">
            <div class="muted-kv"><span class="muted-kv-label">Trace 条数</span><span class="muted-kv-value">{{ payload.trace?.count ?? 0 }}</span></div>
            <div class="muted-kv"><span class="muted-kv-label">来源</span><span class="muted-kv-value">{{ payload.trace?.source || '-' }}</span></div>
            <div class="muted-kv"><span class="muted-kv-label">类型</span><span class="muted-kv-value">{{ payload.trace?.type || '-' }}</span></div>
          </div>
          <div class="mt-4 space-y-3">
            <div v-for="item in payload.trace?.rows || []" :key="item.traceId" class="rounded-2xl border border-gray-100 px-4 py-4 dark:border-slate-700">
              <div class="font-medium text-gray-950 dark:text-white">{{ item.traceId }}</div>
              <div class="mt-1 text-xs text-gray-500 dark:text-slate-400">{{ item.startedAt || '-' }}</div>
              <a v-if="item.url" class="mt-3 inline-flex text-sm font-medium text-primary-600 hover:text-primary-500 dark:text-primary-400" :href="item.url" target="_blank" rel="noreferrer">打开 Langfuse</a>
            </div>
            <div v-if="!(payload.trace?.rows || []).length" class="empty-state">当前未查询到与该 run 关联的 trace</div>
          </div>
        </div>
      </section>
    </div>
    <div v-else class="card p-8 text-sm text-gray-500 dark:text-slate-400">Run 详情加载中...</div>
  </AppLayout>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRoute } from "vue-router";
import MetricCard from "@/components/common/MetricCard.vue";
import AppLayout from "@/layouts/AppLayout.vue";
import { fetchAdminRunPortrait } from "@/api/portal/admin";

const route = useRoute();
const payload = ref<any>(null);

onMounted(async () => {
  payload.value = await fetchAdminRunPortrait(String(route.query.runId || ""));
});
</script>
