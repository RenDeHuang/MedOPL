<template>
  <section data-route-id="overview" data-component-id="overview.hero" class="grid grid-cols-1 gap-4 xl:grid-cols-[1.4fr_0.9fr]">
    <div class="card p-5">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div class="max-w-2xl">
          <div class="flex flex-wrap items-center gap-2">
            <span class="badge badge-primary">托管 OPL 工作台</span>
            <span class="badge badge-success">科研用户工作台</span>
            <span class="badge" :class="canEnterWorkbench ? 'badge-success' : 'badge-danger'">
              {{ canEnterWorkbench ? "工作台可用" : "工作台受限" }}
            </span>
            <span class="badge" :class="serverPlansReady ? 'badge-success' : 'badge-warning'">
              {{ serverPlansReady ? "套餐已同步" : "等待套餐同步" }}
            </span>
          </div>
          <h2 class="mt-3 text-xl font-semibold tracking-tight text-gray-950 dark:text-white">工作台总览</h2>
          <p class="mt-2 text-sm leading-6 text-gray-600 dark:text-slate-300">
            MedOPL 提供托管 OPL 工作台，集中查看余额、消费、计算资源、文件空间和任务执行。
          </p>
        </div>
        <div class="flex flex-wrap gap-2">
          <a class="btn btn-primary" :href="workbenchHref">进入 OPL 工作台</a>
          <RouterLink class="btn btn-secondary" to="/packages">查看套餐</RouterLink>
          <RouterLink class="btn btn-secondary" to="/billing">查看账单</RouterLink>
        </div>
      </div>
    </div>

    <div class="card p-5">
      <div class="flex items-center justify-between gap-3">
        <div>
          <h2 class="panel-title">账号状态</h2>
          <p class="panel-subtitle">账号、计费、权益和当前套餐</p>
        </div>
        <span class="badge" :class="canStartChargeableRun ? 'badge-success' : 'badge-warning'">
          {{ canStartChargeableRun ? "可启动运行" : "需处理" }}
        </span>
      </div>
      <div class="mt-4 space-y-2.5 text-sm">
        <div class="muted-kv">
          <span class="muted-kv-label">账号</span>
          <span class="muted-kv-value">{{ accountStatus }}</span>
        </div>
        <div class="muted-kv">
          <span class="muted-kv-label">计费</span>
          <span class="muted-kv-value">{{ billingStatus }}</span>
        </div>
        <div class="muted-kv">
          <span class="muted-kv-label">权益</span>
          <span class="muted-kv-value">{{ entitlementStatus }}</span>
        </div>
        <div class="muted-kv">
          <span class="muted-kv-label">当前套餐</span>
          <span class="muted-kv-value">{{ selectedPlanName || "未选择" }}</span>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
defineProps<{
  accountStatus: string;
  billingStatus: string;
  canEnterWorkbench: boolean;
  canStartChargeableRun: boolean;
  entitlementStatus: string;
  selectedPlanName?: string;
  serverPlansReady: boolean;
  workbenchHref: string;
}>();
</script>
