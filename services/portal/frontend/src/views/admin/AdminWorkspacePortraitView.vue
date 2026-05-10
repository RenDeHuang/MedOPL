<template>
  <AppLayout title="任务空间详情" subtitle="归属、状态、会话、存储、成本与 Trace">
    <div v-if="payload" class="space-y-6">
      <section class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="任务空间" :value="payload.workspace.title" hint="任务空间标题" />
        <MetricCard label="所属用户" :value="payload.user.name" hint="归属账号" />
        <MetricCard label="状态" :value="payload.workspace.statusLabel" hint="当前空间状态" />
        <MetricCard label="活跃会话" :value="payload.activeSession?.id || '未绑定'" hint="任务空间当前会话" />
      </section>

      <section class="grid grid-cols-1 gap-6 xl:grid-cols-[1.1fr_1fr]">
        <div class="card p-6">
          <div class="mb-4 flex items-center justify-between gap-4">
            <div>
              <h2 class="panel-title">最近运行</h2>
              <p class="panel-subtitle">当前 workspace 最近的执行记录。</p>
            </div>
            <RouterLink class="btn btn-secondary" :to="{ path: '/admin/user', query: { userId: payload.user.id } }">返回用户详情</RouterLink>
          </div>

          <div class="space-y-3">
            <div v-for="item in payload.recentRuns" :key="item.runId" class="rounded-2xl border border-gray-100 px-4 py-4 dark:border-slate-700">
              <div class="flex items-start justify-between gap-4">
                <div class="font-mono text-xs text-gray-950 dark:text-white">{{ item.runId }}</div>
                <span class="badge" :class="statusBadge(item.status)">{{ item.status }}</span>
              </div>
              <div class="mt-3 flex items-center justify-between gap-3 text-xs text-gray-500 dark:text-slate-400">
                <span>{{ item.createdAtLabel }}</span>
                <RouterLink class="font-medium text-primary-600 hover:text-primary-500 dark:text-primary-400" :to="{ path: '/admin/run', query: { runId: item.runId } }">查看 Run</RouterLink>
              </div>
            </div>
            <div v-if="!payload.recentRuns.length" class="empty-state">暂无运行记录</div>
          </div>
        </div>

        <div class="space-y-6">
          <div class="card p-6">
            <h2 class="panel-title">任务空间状态</h2>
            <div class="mt-4 space-y-3 text-sm">
              <div class="muted-kv"><span class="muted-kv-label">Slug</span><span class="muted-kv-value">{{ payload.workspace.slug }}</span></div>
              <div class="muted-kv"><span class="muted-kv-label">状态</span><span class="muted-kv-value">{{ payload.workspace.statusLabel }}</span></div>
              <div class="muted-kv"><span class="muted-kv-label">最后活跃</span><span class="muted-kv-value">{{ payload.activeSession?.lastUsedAt || '-' }}</span></div>
              <div class="muted-kv"><span class="muted-kv-label">会话到期</span><span class="muted-kv-value">{{ payload.activeSession?.expiresAt || '-' }}</span></div>
            </div>
          </div>

          <div class="card p-6">
            <h2 class="panel-title">成本摘要</h2>
            <div class="mt-4 space-y-3 text-sm">
              <div class="muted-kv"><span class="muted-kv-label">CPU</span><span class="muted-kv-value">¥{{ Number(payload.costs.cpuCost || 0).toFixed(5) }}</span></div>
              <div class="muted-kv"><span class="muted-kv-label">GPU</span><span class="muted-kv-value">¥{{ Number(payload.costs.gpuCost || 0).toFixed(5) }}</span></div>
              <div class="muted-kv"><span class="muted-kv-label">存储</span><span class="muted-kv-value">¥{{ Number(payload.costs.storageCost || 0).toFixed(5) }}</span></div>
              <div class="muted-kv"><span class="muted-kv-label">总成本</span><span class="muted-kv-value">¥{{ Number(payload.costs.totalCost || 0).toFixed(5) }}</span></div>
            </div>
          </div>
        </div>
      </section>

      <section class="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <div class="card p-6">
          <h2 class="panel-title">存储与同步</h2>
          <div class="mt-4 space-y-3 text-sm">
            <div class="muted-kv"><span class="muted-kv-label">inputs</span><span class="muted-kv-value">{{ payload.storage?.inputsCount ?? 0 }}</span></div>
            <div class="muted-kv"><span class="muted-kv-label">outputs</span><span class="muted-kv-value">{{ payload.storage?.outputsCount ?? 0 }}</span></div>
            <div class="muted-kv"><span class="muted-kv-label">输入体积</span><span class="muted-kv-value">{{ payload.storage?.inputBytes ?? 0 }}</span></div>
            <div class="muted-kv"><span class="muted-kv-label">输出体积</span><span class="muted-kv-value">{{ payload.storage?.outputBytes ?? 0 }}</span></div>
            <div v-if="payload.productProfile?.opsSurfaceEnabled" class="muted-kv"><span class="muted-kv-label">MinIO</span><span class="muted-kv-value">{{ payload.minio?.note || (payload.minio?.synced ? '已同步' : '-') }}</span></div>
          </div>
          <div class="mt-4 space-y-3">
            <div v-for="item in payload.storage?.outputs || []" :key="item.name" class="rounded-2xl border border-gray-100 px-4 py-4 dark:border-slate-700">
              <div class="font-medium text-gray-950 dark:text-white">{{ item.name }}</div>
              <div class="mt-1 text-xs text-gray-500 dark:text-slate-400">{{ item.fullPath }}</div>
            </div>
            <div v-if="!(payload.storage?.outputs || []).length" class="empty-state">当前没有输出文件</div>
          </div>
        </div>

        <div class="card p-6">
          <h2 class="panel-title">Trace 关联</h2>
          <div class="mt-4 space-y-3 text-sm">
            <div class="muted-kv"><span class="muted-kv-label">Trace 条数</span><span class="muted-kv-value">{{ payload.trace?.count ?? 0 }}</span></div>
            <div class="muted-kv"><span class="muted-kv-label">来源</span><span class="muted-kv-value">{{ payload.trace?.source || '-' }}</span></div>
          </div>
          <div class="mt-4 space-y-3">
            <div v-for="item in payload.trace?.rows || []" :key="item.traceId" class="rounded-2xl border border-gray-100 px-4 py-4 dark:border-slate-700">
              <div class="font-medium text-gray-950 dark:text-white">{{ item.traceId }}</div>
              <div class="mt-1 text-xs text-gray-500 dark:text-slate-400">{{ item.runId || '-' }} / {{ item.startedAt || '-' }}</div>
              <a v-if="item.url" class="mt-3 inline-flex text-sm font-medium text-primary-600 hover:text-primary-500 dark:text-primary-400" :href="item.url" target="_blank" rel="noreferrer">打开 Langfuse</a>
            </div>
            <div v-if="!(payload.trace?.rows || []).length" class="empty-state">当前空间暂无 trace</div>
          </div>
        </div>
      </section>
    </div>
    <div v-else class="card p-8 text-sm text-gray-500 dark:text-slate-400">Workspace 详情加载中...</div>
  </AppLayout>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRoute } from "vue-router";
import MetricCard from "@/components/common/MetricCard.vue";
import AppLayout from "@/layouts/AppLayout.vue";
import { fetchAdminWorkspacePortrait } from "@/api/portal/admin";

const route = useRoute();
const payload = ref<any>(null);

function statusBadge(status = "") {
  if (status.includes("完成")) return "badge-success";
  if (status.includes("失败")) return "badge-danger";
  return "badge-primary";
}

onMounted(async () => {
  payload.value = await fetchAdminWorkspacePortrait(String(route.query.userId || ""), String(route.query.workspaceId || ""));
});
</script>
