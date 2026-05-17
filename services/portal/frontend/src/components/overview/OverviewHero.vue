<template>
  <section data-route-id="overview" data-component-id="overview.hero" class="space-y-4">
    <div class="card overflow-hidden">
      <div data-design-quality="service-status-strip" class="grid grid-cols-1 border-b border-gray-200 bg-slate-50 text-sm dark:border-slate-800 dark:bg-slate-950/60 md:grid-cols-4">
        <div class="border-b border-gray-200 px-4 py-3 dark:border-slate-800 md:border-b-0 md:border-r">
          <div class="text-xs text-gray-500 dark:text-slate-400">服务状态摘要</div>
          <div class="mt-1 flex items-center gap-2">
            <span class="h-2 w-2 rounded-full" :class="canEnterWorkbench ? 'bg-emerald-500' : 'bg-red-500'"></span>
            <span class="font-semibold text-gray-950 dark:text-white">{{ canEnterWorkbench ? "工作台可用" : "工作台受限" }}</span>
          </div>
        </div>
        <div class="border-b border-gray-200 px-4 py-3 dark:border-slate-800 md:border-b-0 md:border-r">
          <div class="text-xs text-gray-500 dark:text-slate-400">套餐同步</div>
          <div class="mt-1 font-semibold text-gray-950 dark:text-white">{{ serverPlansReady ? "已同步" : "等待同步" }}</div>
        </div>
        <div class="border-b border-gray-200 px-4 py-3 dark:border-slate-800 md:border-b-0 md:border-r">
          <div class="text-xs text-gray-500 dark:text-slate-400">账号与权益</div>
          <div class="mt-1 font-semibold text-gray-950 dark:text-white">{{ accountStatus }} · {{ entitlementStatus }}</div>
        </div>
        <div class="px-4 py-3">
          <div class="text-xs text-gray-500 dark:text-slate-400">计费状态</div>
          <div class="mt-1 font-semibold text-gray-950 dark:text-white">{{ billingStatus }}</div>
        </div>
      </div>

      <div class="grid gap-4 p-5 xl:grid-cols-[1fr_300px]">
        <div data-design-quality="service-summary" class="min-w-0">
          <div class="flex flex-wrap items-center gap-2">
            <span class="badge badge-primary">托管 OPL 科研工作台</span>
            <span class="badge" :class="canStartChargeableRun ? 'badge-success' : 'badge-warning'">
              {{ canStartChargeableRun ? "可启动任务" : "需处理后启动" }}
            </span>
          </div>
          <h2 class="mt-3 text-xl font-semibold text-gray-950 dark:text-white">{{ serviceSummary }}</h2>
          <p class="mt-2 max-w-3xl text-sm leading-6 text-gray-600 dark:text-slate-300">
            你购买的是托管科研工作台服务。平台负责开通、隔离、计费、审计和释放；你进入 OPL 上传文件、运行任务、查看结果。
          </p>

          <div data-design-quality="readiness-checks" class="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
            <div class="rounded-lg border border-gray-200 px-3 py-3 dark:border-slate-700">
              <div class="text-xs text-gray-500 dark:text-slate-400">我买了什么服务</div>
              <div class="mt-1 text-sm font-semibold text-gray-950 dark:text-white">{{ selectedPlanName || "未选择套餐" }}</div>
              <div class="mt-1 text-xs text-gray-500 dark:text-slate-400">{{ computeSummary }}</div>
            </div>
            <div class="rounded-lg border border-gray-200 px-3 py-3 dark:border-slate-700">
              <div class="text-xs text-gray-500 dark:text-slate-400">文件、任务、结果在哪里</div>
              <div class="mt-1 text-sm font-semibold text-gray-950 dark:text-white">{{ storageSummary }}</div>
              <div class="mt-1 text-xs text-gray-500 dark:text-slate-400">都归到工作空间</div>
            </div>
            <div class="rounded-lg border border-gray-200 px-3 py-3 dark:border-slate-700">
              <div class="text-xs text-gray-500 dark:text-slate-400">何时释放运行能力</div>
              <div class="mt-1 text-sm font-semibold text-gray-950 dark:text-white">{{ releaseStatus }}</div>
              <div class="mt-1 text-xs text-gray-500 dark:text-slate-400">任务结束后可停止计费并保留文件</div>
            </div>
          </div>
        </div>

        <div data-design-quality="next-action" class="rounded-lg border border-primary-200 bg-primary-50 p-4 dark:border-primary-900/50 dark:bg-primary-950/20">
          <div class="text-xs font-medium text-primary-700 dark:text-primary-300">下一步行动区</div>
          <div class="mt-2 text-lg font-semibold text-gray-950 dark:text-white">{{ nextActionLabel }}</div>
          <p class="mt-2 text-sm leading-5 text-gray-600 dark:text-slate-300">{{ nextActionDetail }}</p>
          <RouterLink class="btn btn-primary mt-4 w-full" :to="nextActionHref">{{ nextActionLabel }}</RouterLink>
        </div>
      </div>
    </div>

    <div data-design-quality="responsibility-boundary" class="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <div class="card p-5">
        <div class="text-xs font-medium text-gray-500 dark:text-slate-400">Portal 负责</div>
        <div class="mt-2 text-sm font-semibold text-gray-950 dark:text-white">开通、隔离、套餐、账单、文件空间、审计和释放</div>
      </div>
      <div class="card p-5">
        <div class="text-xs font-medium text-gray-500 dark:text-slate-400">OPL runtime 负责</div>
        <div class="mt-2 text-sm font-semibold text-gray-950 dark:text-white">聊天、agent、文件理解、任务运行和结果生成</div>
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
