<template>
  <section data-route-id="billing" data-component-id="billing.hero" class="space-y-4">
    <div class="card p-5">
      <div class="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div class="max-w-2xl">
          <div class="flex items-center gap-2">
            <span class="badge badge-primary">账单</span>
            <span class="badge" :class="payload.breakdown.cloudSource === 'tencent_cloud' ? 'badge-success' : 'badge-warning'">
              {{ payload.breakdown.cloudSource === "tencent_cloud" ? "账单核对已接入" : "等待账单核对" }}
            </span>
          </div>
          <h2 class="mt-3 text-xl font-semibold tracking-tight text-gray-950 dark:text-white">余额、消费和账单核对</h2>
          <p class="mt-2 text-sm leading-6 text-gray-600 dark:text-slate-300">
            当前优先展示钱花在哪里、运行中预扣费、文件空间消费和账单摘要。释放托管运行环境后会显示停止计费与审计状态。
          </p>
        </div>
        <div class="flex flex-wrap gap-2">
          <a class="btn btn-secondary" :href="billingExportHref">导出运行明细</a>
          <a class="btn btn-secondary" :href="taskExportHref">导出空间汇总</a>
        </div>
      </div>

      <div class="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="余额" :value="money(payload.wallet.balance)" hint="当前账户余额" />
        <MetricCard label="可用余额" :value="money(payload.wallet.availableBalance)" hint="扣除冻结金额后的可用余额" />
        <MetricCard label="冻结金额" :value="money(payload.wallet.activeFreeze)" hint="运行中的冻结金额" />
        <MetricCard label="今日消费" :value="microMoney(payload.todayCost)" hint="今日已核算消费" />
        <MetricCard label="钱花在哪里" :value="microMoney(payload.summary.selectedCost)" hint="当前筛选窗口消费" />
        <MetricCard label="账户流水" :value="payload.ledgerPagination.total" hint="当前窗口内流水数" />
      </div>
    </div>

    <div v-if="payload.supportBoundary" class="card p-5">
      <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 class="panel-title">余额与服务状态</h2>
          <p class="panel-subtitle">{{ payload.supportBoundary.userCopy }}</p>
          <p class="mt-2 text-sm text-gray-600 dark:text-slate-300">{{ payload.supportBoundary.billingCopy }}</p>
        </div>
        <div class="flex flex-wrap gap-2">
          <span class="badge" :class="payload.supportBoundary.canStartPaidRun ? 'badge-success' : 'badge-warning'">
            {{ payload.supportBoundary.canStartPaidRun ? "可启动新任务" : "暂不能启动新任务" }}
          </span>
          <span class="badge" :class="payload.supportBoundary.canDownloadExistingOutput ? 'badge-success' : 'badge-danger'">
            {{ payload.supportBoundary.canDownloadExistingOutput ? "可下载已有结果" : "结果已过保留期" }}
          </span>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { BillingPayload } from "@/api/portal/billing";
import MetricCard from "@/components/common/MetricCard.vue";

defineProps<{
  billingExportHref: string;
  microMoney: (value: number | undefined) => string;
  money: (value: number | undefined) => string;
  payload: BillingPayload;
  taskExportHref: string;
}>();
</script>
