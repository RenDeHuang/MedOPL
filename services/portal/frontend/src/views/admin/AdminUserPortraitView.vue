<template>
  <AppLayout title="用户详情" subtitle="账户状态、最近运行、会话、空间与 Trace">
    <div v-if="payload" class="space-y-6">
      <section class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="用户名称" :value="payload.user.name" hint="Portal 用户" />
        <MetricCard label="账户余额" :value="payload.user.balanceLabel" hint="钱包余额" />
        <MetricCard label="分组" :value="payload.user.groupName || '未分组'" hint="当前资源组" />
        <MetricCard label="创建时间" :value="payload.user.createdAtLabel || '-'" hint="账号创建时间" />
      </section>

      <section class="grid grid-cols-1 gap-6 xl:grid-cols-[1.1fr_1fr]">
        <div class="card p-6">
          <div class="mb-4 flex items-center justify-between gap-4">
            <div>
              <h2 class="panel-title">最近运行</h2>
              <p class="panel-subtitle">从用户视角回看最近的任务执行。</p>
            </div>
            <RouterLink class="btn btn-secondary" to="/admin/users">返回用户管理</RouterLink>
          </div>

          <div class="space-y-3">
            <div v-for="item in payload.recentRuns" :key="item.runId" class="rounded-2xl border border-gray-100 px-4 py-4 dark:border-slate-700">
              <div class="flex items-start justify-between gap-4">
                <div>
                  <div class="font-mono text-xs text-gray-950 dark:text-white">{{ item.runId }}</div>
                  <div class="mt-2 text-sm text-gray-600 dark:text-slate-300">{{ item.workspaceTitle }}</div>
                </div>
                <span class="badge" :class="statusBadge(item.status)">{{ item.status }}</span>
              </div>
              <div class="mt-3 flex items-center justify-between gap-3 text-xs text-gray-500 dark:text-slate-400">
                <span>{{ item.createdAtLabel }}</span>
                <RouterLink class="font-medium text-primary-600 hover:text-primary-500 dark:text-primary-400" :to="{ path: '/admin/run', query: { runId: item.runId } }">查看 Run</RouterLink>
              </div>
            </div>
            <div v-if="!payload.recentRuns.length" class="empty-state">暂无最近运行</div>
          </div>
        </div>

        <div class="space-y-6">
          <div class="card p-6">
            <h2 class="panel-title">账户信息</h2>
            <div class="mt-4 space-y-3 text-sm">
              <div class="muted-kv"><span class="muted-kv-label">用户 ID</span><span class="muted-kv-value">{{ payload.user.id }}</span></div>
              <div class="muted-kv"><span class="muted-kv-label">邮箱</span><span class="muted-kv-value">{{ payload.user.email }}</span></div>
            </div>
          </div>

          <div class="card p-6">
            <h2 class="panel-title">资源成本摘要</h2>
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
          <h2 class="panel-title">会话与空间</h2>
          <div class="mt-4 space-y-3">
            <div v-for="item in payload.sessions || []" :key="item.sessionId" class="rounded-2xl border border-gray-100 px-4 py-4 dark:border-slate-700">
              <div class="flex items-center justify-between gap-4">
                <div class="font-medium text-gray-950 dark:text-white">{{ item.sessionType === 'mas' ? 'MAS' : '普通对话' }}</div>
                <span class="badge" :class="item.sessionType === 'mas' ? 'badge-primary' : 'badge-success'">{{ item.status || '-' }}</span>
              </div>
              <div class="mt-2 text-xs text-gray-500 dark:text-slate-400">{{ item.sessionId }}</div>
              <div class="mt-2 text-xs text-gray-500 dark:text-slate-400">{{ item.workspaceId || '-' }}</div>
            </div>
            <div v-if="!(payload.sessions || []).length" class="empty-state">当前用户暂无可见会话</div>
          </div>
          <div class="mt-4 space-y-3">
            <RouterLink v-for="item in payload.workspaces || []" :key="item.slug" class="block rounded-2xl border border-gray-100 px-4 py-4 text-sm font-medium text-gray-950 transition hover:border-primary-200 hover:bg-primary-50 dark:border-slate-700 dark:text-white dark:hover:bg-primary-500/10" :to="item.link">
              {{ item.title }} · {{ item.status }}
            </RouterLink>
          </div>
        </div>

        <div class="card p-6">
          <h2 class="panel-title">Trace 摘要</h2>
          <div class="mt-4 space-y-3 text-sm">
            <div class="muted-kv"><span class="muted-kv-label">Trace 条数</span><span class="muted-kv-value">{{ payload.trace?.count ?? 0 }}</span></div>
            <div class="muted-kv"><span class="muted-kv-label">最新 Trace</span><span class="muted-kv-value">{{ payload.trace?.latest || '-' }}</span></div>
            <div class="muted-kv"><span class="muted-kv-label">来源</span><span class="muted-kv-value">{{ payload.trace?.source || '-' }}</span></div>
          </div>
          <div class="mt-4 space-y-3">
            <div v-for="item in payload.trace?.rows || []" :key="item.traceId" class="rounded-2xl border border-gray-100 px-4 py-4 dark:border-slate-700">
              <div class="font-medium text-gray-950 dark:text-white">{{ item.traceId }}</div>
              <div class="mt-1 text-xs text-gray-500 dark:text-slate-400">{{ item.runId || '-' }} / {{ item.workspaceId || '-' }}</div>
            </div>
            <div v-if="!(payload.trace?.rows || []).length" class="empty-state">当前用户暂无 trace</div>
          </div>
        </div>
      </section>
    </div>
    <div v-else class="card p-8 text-sm text-gray-500 dark:text-slate-400">用户详情加载中...</div>
  </AppLayout>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRoute } from "vue-router";
import MetricCard from "@/components/common/MetricCard.vue";
import AppLayout from "@/layouts/AppLayout.vue";
import { fetchAdminUserPortrait } from "@/api/portal";

const route = useRoute();
const payload = ref<any>(null);

function statusBadge(status = "") {
  if (status.includes("完成")) return "badge-success";
  if (status.includes("失败")) return "badge-danger";
  return "badge-primary";
}

onMounted(async () => {
  payload.value = await fetchAdminUserPortrait(String(route.query.userId || ""));
});
</script>
