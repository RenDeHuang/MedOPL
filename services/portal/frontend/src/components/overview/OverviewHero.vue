<template>
  <section data-route-id="overview" data-component-id="overview.hero" class="grid grid-cols-1 gap-4 xl:grid-cols-[1.35fr_0.95fr]">
    <div class="card p-5">
      <div class="grid gap-5 lg:grid-cols-[1fr_260px]">
        <div>
          <div class="flex flex-wrap items-center gap-2">
            <span class="badge badge-primary">托管 OPL 工作台</span>
            <span class="badge" :class="canEnterWorkbench ? 'badge-success' : 'badge-danger'">
              {{ canEnterWorkbench ? "工作台可用" : "工作台受限" }}
            </span>
            <span class="badge" :class="serverPlansReady ? 'badge-success' : 'badge-warning'">
              {{ serverPlansReady ? "套餐已同步" : "等待套餐同步" }}
            </span>
          </div>
          <div data-design-quality="service-summary" class="mt-3">
            <h2 class="text-xl font-semibold tracking-tight text-gray-950 dark:text-white">{{ serviceSummary }}</h2>
            <p class="mt-2 max-w-2xl text-sm leading-6 text-gray-600 dark:text-slate-300">
              你购买的是托管科研工作台服务。MedOPL 为你开通、隔离、计费、审计和释放工作台；你在 OPL runtime 中上传文件、运行任务并取回结果。
            </p>
          </div>
          <div class="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3" data-design-quality="readiness-checks">
            <div class="rounded-lg border border-gray-100 px-3 py-2 dark:border-slate-700">
              <div class="text-xs text-gray-500 dark:text-slate-400">当前套餐 / 算力</div>
              <div class="mt-1 text-sm font-semibold text-gray-950 dark:text-white">{{ selectedPlanName || "未选择套餐" }}</div>
              <div class="mt-0.5 text-xs text-gray-500 dark:text-slate-400">{{ computeSummary }}</div>
            </div>
            <div class="rounded-lg border border-gray-100 px-3 py-2 dark:border-slate-700">
              <div class="text-xs text-gray-500 dark:text-slate-400">文件空间 / 结果</div>
              <div class="mt-1 text-sm font-semibold text-gray-950 dark:text-white">{{ storageSummary }}</div>
              <div class="mt-0.5 text-xs text-gray-500 dark:text-slate-400">输入文件和输出结果归工作空间</div>
            </div>
            <div class="rounded-lg border border-gray-100 px-3 py-2 dark:border-slate-700">
              <div class="text-xs text-gray-500 dark:text-slate-400">释放 / 审计</div>
              <div class="mt-1 text-sm font-semibold text-gray-950 dark:text-white">{{ releaseStatus }}</div>
              <div class="mt-0.5 text-xs text-gray-500 dark:text-slate-400">释放计算资源可保留文件空间</div>
            </div>
          </div>
        </div>
        <div data-design-quality="next-action" class="rounded-lg border border-primary-100 bg-primary-50/70 p-4 dark:border-primary-900/40 dark:bg-primary-950/20">
          <div class="text-xs font-medium uppercase text-primary-700 dark:text-primary-300">下一步</div>
          <div class="mt-2 text-base font-semibold text-gray-950 dark:text-white">{{ nextActionLabel }}</div>
          <p class="mt-2 text-sm leading-5 text-gray-600 dark:text-slate-300">{{ nextActionDetail }}</p>
          <RouterLink class="btn btn-primary mt-4 w-full" :to="nextActionHref">{{ nextActionLabel }}</RouterLink>
        </div>
      </div>
    </div>

    <div class="card p-5" data-design-quality="responsibility-boundary">
      <div class="flex items-center justify-between gap-3">
        <div>
          <h2 class="panel-title">谁负责什么</h2>
          <p class="panel-subtitle">Portal 管理服务状态，OPL runtime 承担科研执行</p>
        </div>
        <span class="badge" :class="canStartChargeableRun ? 'badge-success' : 'badge-warning'">
          {{ canStartChargeableRun ? "可启动运行" : "需处理" }}
        </span>
      </div>
      <div class="mt-4 space-y-3 text-sm">
        <div class="rounded-lg border border-gray-100 px-3 py-2.5 dark:border-slate-700">
          <div class="text-xs text-gray-500 dark:text-slate-400">Portal 负责</div>
          <div class="mt-1 font-medium text-gray-950 dark:text-white">开通、隔离、套餐、账单、文件空间、审计和释放</div>
        </div>
        <div class="rounded-lg border border-gray-100 px-3 py-2.5 dark:border-slate-700">
          <div class="text-xs text-gray-500 dark:text-slate-400">OPL runtime 负责</div>
          <div class="mt-1 font-medium text-gray-950 dark:text-white">聊天、agent、文件理解、任务运行和结果生成</div>
        </div>
        <div class="grid grid-cols-3 gap-2 text-xs">
          <div class="muted-kv block">
            <div class="muted-kv-label">账号</div>
            <div class="muted-kv-value mt-1">{{ accountStatus }}</div>
          </div>
          <div class="muted-kv block">
            <div class="muted-kv-label">计费</div>
            <div class="muted-kv-value mt-1">{{ billingStatus }}</div>
          </div>
          <div class="muted-kv block">
            <div class="muted-kv-label">权益</div>
            <div class="muted-kv-value mt-1">{{ entitlementStatus }}</div>
          </div>
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
  computeSummary: string;
  entitlementStatus: string;
  nextActionDetail: string;
  nextActionHref: string;
  nextActionLabel: string;
  releaseStatus: string;
  selectedPlanName?: string;
  serverPlansReady: boolean;
  serviceSummary: string;
  storageSummary: string;
}>();
</script>
