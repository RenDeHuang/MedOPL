<template>
  <AppLayout title="账务" subtitle="余额、冻结金额、消费记录与账户流水">
    <div class="space-y-4">
      <div v-if="summaryLoading && !summaryPayload" class="card p-6 text-sm text-gray-500 dark:text-slate-400">正在加载账单摘要...</div>
      <div v-else-if="error" class="card p-6 text-sm text-red-600 dark:text-red-400">{{ error }}</div>
      <template v-else-if="payload">
        <section class="card p-5">
          <div class="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div class="max-w-2xl">
              <div class="flex items-center gap-2">
                <span class="badge badge-primary">账务</span>
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
        </section>

        <section v-if="payload.supportBoundary" class="card p-5">
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
        </section>

        <section class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <MetricCard label="计算消费" :value="microMoney(payload.breakdown.cpuCost)" :hint="componentCostHint" />
          <MetricCard label="加速消费" :value="microMoney(payload.breakdown.gpuCost)" :hint="componentCostHint" />
          <MetricCard label="文件空间消费" :value="microMoney(payload.breakdown.storageCost)" :hint="componentCostHint" />
          <MetricCard label="网络服务消费" :value="sourceBackfilledValue(payload.breakdown.vpnCost)" :hint="sourceBackfillHint" />
          <MetricCard label="流量消费" :value="sourceBackfilledValue(payload.breakdown.trafficCost)" :hint="sourceBackfillHint" />
          <MetricCard label="其他服务消费" :value="sourceBackfilledValue(payload.breakdown.otherCloudCost)" :hint="sourceBackfillHint" />
        </section>

        <section class="grid grid-cols-1 gap-4 xl:grid-cols-[1.3fr_1fr]">
          <div class="card p-5">
            <div class="mb-3 flex items-center justify-between gap-3">
              <div>
                <h2 class="panel-title">成本趋势</h2>
                <p class="panel-subtitle">按日查看总成本与主要成本项变化。</p>
              </div>
              <span class="badge badge-primary">7 天</span>
            </div>
            <div class="h-[260px]">
              <div v-if="detailsLoading && !detailsPayload" class="flex h-full items-center justify-center text-sm text-gray-500 dark:text-slate-400">正在加载趋势...</div>
              <Bar v-if="trendChartData" :data="trendChartData" :options="barOptions" />
              <div v-else-if="!detailsLoading" class="flex h-full items-center justify-center text-sm text-gray-500 dark:text-slate-400">暂无趋势数据</div>
            </div>
          </div>

          <div class="card p-5">
            <div class="mb-3 flex items-center justify-between gap-3">
              <div>
                <h2 class="panel-title">筛选窗口</h2>
                <p class="panel-subtitle">按日期查看账单窗口。</p>
              </div>
            </div>
            <div class="space-y-3">
              <label class="text-sm text-gray-600 dark:text-slate-300">
                <span class="mb-1.5 block text-xs text-gray-500 dark:text-slate-400">开始日期</span>
                <input v-model="filterDraft.from" class="input" type="date" />
              </label>
              <label class="text-sm text-gray-600 dark:text-slate-300">
                <span class="mb-1.5 block text-xs text-gray-500 dark:text-slate-400">结束日期</span>
                <input v-model="filterDraft.to" class="input" type="date" />
              </label>
              <div class="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-gray-600 dark:bg-slate-900/70 dark:text-slate-300">
                当前窗口：{{ payload.filter.from }} 至 {{ payload.filter.to }}
              </div>
              <div class="flex gap-2">
                <button class="btn btn-primary flex-1 justify-center" type="button" @click="applyFilter">应用</button>
                <button class="btn btn-secondary flex-1 justify-center" type="button" @click="resetFilter">重置</button>
              </div>
            </div>
          </div>
        </section>

        <section class="card p-5">
            <div class="mb-3 flex items-center justify-between gap-3">
              <div>
                <h2 class="panel-title">工作空间成本明细</h2>
                <p class="panel-subtitle">按工作空间查看计算、加速、文件空间和总消费。</p>
            </div>
            <span class="badge badge-warning">{{ payload.taskPagination.total }} 项</span>
          </div>

          <div v-if="detailsLoading && !detailsPayload" class="empty-state">正在加载工作空间成本明细...</div>
          <div class="mobile-card-list">
            <div v-for="item in payload.taskCosts" :key="item.slug" class="mobile-only-card">
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0">
                  <div class="font-medium text-gray-950 dark:text-white">{{ item.title || item.slug }}</div>
                  <div class="mt-1 truncate text-xs text-gray-500 dark:text-slate-400">{{ item.slug }}</div>
                </div>
                <div class="shrink-0 text-right text-sm font-medium text-gray-950 dark:text-white">{{ microMoney(item.totalCost) }}</div>
              </div>
              <div class="mt-3 grid grid-cols-2 gap-2 text-xs text-gray-500 dark:text-slate-400">
                <div><span class="block text-gray-400 dark:text-slate-500">任务数</span>{{ item.runCount }}</div>
                <div><span class="block text-gray-400 dark:text-slate-500">计算</span>{{ microMoney(item.cpuCost) }}</div>
                <div><span class="block text-gray-400 dark:text-slate-500">加速</span>{{ microMoney(item.gpuCost) }}</div>
                <div><span class="block text-gray-400 dark:text-slate-500">文件空间</span>{{ microMoney(item.storageCost) }}</div>
              </div>
            </div>
            <div v-if="!payload.taskCosts.length" class="empty-state">当前窗口暂无任务空间成本</div>
          </div>
          <div class="desktop-table-shell">
            <table class="min-w-[760px] text-sm">
              <thead>
                <tr class="table-head">
                  <th class="px-4 py-3">工作空间</th>
                  <th class="px-4 py-3">任务数</th>
                  <th class="px-4 py-3">计算</th>
                  <th class="px-4 py-3">加速</th>
                  <th class="px-4 py-3">文件空间</th>
                  <th class="px-4 py-3">总消费</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in payload.taskCosts" :key="item.slug" class="table-row">
                  <td class="px-4 py-3">
                    <div class="font-medium text-gray-950 dark:text-white">{{ item.title || item.slug }}</div>
                    <div class="mt-1 text-xs text-gray-500 dark:text-slate-400">{{ item.slug }}</div>
                  </td>
                  <td class="px-4 py-3 text-gray-700 dark:text-slate-300">{{ item.runCount }}</td>
                  <td class="px-4 py-3 text-gray-700 dark:text-slate-300">{{ microMoney(item.cpuCost) }}</td>
                  <td class="px-4 py-3 text-gray-700 dark:text-slate-300">{{ microMoney(item.gpuCost) }}</td>
                  <td class="px-4 py-3 text-gray-700 dark:text-slate-300">{{ microMoney(item.storageCost) }}</td>
                  <td class="px-4 py-3 font-medium text-gray-950 dark:text-white">{{ microMoney(item.totalCost) }}</td>
                </tr>
                <tr v-if="!payload.taskCosts.length">
                  <td colspan="6" class="px-4 py-6 text-center text-sm text-gray-500 dark:text-slate-400">当前窗口暂无任务空间成本</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="pager-bar">
            <span>第 {{ payload.taskPagination.page }} / {{ payload.taskPagination.totalPages }} 页</span>
            <div class="flex gap-2">
              <RouterLink class="btn btn-secondary" :to="billingQuery({ tasks_page: previousPage(payload.taskPagination.page) })">上一页</RouterLink>
              <RouterLink class="btn btn-secondary" :to="billingQuery({ tasks_page: nextPage(payload.taskPagination.page, payload.taskPagination.totalPages) })">下一页</RouterLink>
            </div>
          </div>
        </section>

        <section class="grid grid-cols-1 gap-4 xl:grid-cols-[1.2fr_1fr]">
          <div class="card p-5">
            <div class="mb-3 flex items-center justify-between gap-3">
              <div>
                <h2 class="panel-title">任务明细</h2>
                <p class="panel-subtitle">单次任务的状态、账单来源与总消费。</p>
              </div>
              <span class="badge badge-primary">{{ payload.runPagination.total }} 条</span>
            </div>

            <div v-if="detailsLoading && !detailsPayload" class="empty-state">正在加载运行明细...</div>
            <div class="mobile-card-list">
              <div v-for="(item, index) in payload.runCosts" :key="item.runId" class="mobile-only-card">
                <div class="flex items-start justify-between gap-3">
                  <div class="min-w-0">
                    <div class="font-medium text-gray-950 dark:text-white">任务 {{ index + 1 }}</div>
                    <div class="mt-1 text-xs text-gray-500 dark:text-slate-400">工作空间 {{ index + 1 }}</div>
                  </div>
                  <span class="badge shrink-0" :class="statusBadge(item.runStatus)">{{ humanizeStatus(item.runStatus) }}</span>
                </div>
                <div class="mt-3 grid grid-cols-2 gap-2 text-xs text-gray-500 dark:text-slate-400">
                  <div><span class="block text-gray-400 dark:text-slate-500">账单来源</span>{{ item.pricingSource || "-" }}</div>
                  <div><span class="block text-gray-400 dark:text-slate-500">总消费</span>{{ microMoney(item.totalCost) }}</div>
                </div>
              </div>
              <div v-if="!payload.runCosts.length" class="empty-state">当前窗口暂无运行明细</div>
            </div>
            <div class="desktop-table-shell">
              <table class="min-w-[680px] text-sm">
                <thead>
                  <tr class="table-head">
                    <th class="px-4 py-3">任务</th>
                    <th class="px-4 py-3">工作空间</th>
                    <th class="px-4 py-3">状态</th>
                    <th class="px-4 py-3">账单来源</th>
                    <th class="px-4 py-3">总消费</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(item, index) in payload.runCosts" :key="item.runId" class="table-row">
                    <td class="px-4 py-3 text-xs text-gray-700 dark:text-slate-300">任务 {{ index + 1 }}</td>
                    <td class="px-4 py-3 text-gray-700 dark:text-slate-300">工作空间 {{ index + 1 }}</td>
                    <td class="px-4 py-3">
                      <span class="badge" :class="statusBadge(item.runStatus)">{{ humanizeStatus(item.runStatus) }}</span>
                    </td>
                    <td class="px-4 py-3 text-gray-500 dark:text-slate-400">{{ item.pricingSource || "-" }}</td>
                    <td class="px-4 py-3 font-medium text-gray-950 dark:text-white">{{ microMoney(item.totalCost) }}</td>
                  </tr>
                  <tr v-if="!payload.runCosts.length">
                    <td colspan="5" class="px-4 py-6 text-center text-sm text-gray-500 dark:text-slate-400">当前窗口暂无运行明细</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div class="pager-bar">
              <span>第 {{ payload.runPagination.page }} / {{ payload.runPagination.totalPages }} 页</span>
              <div class="flex gap-2">
                <RouterLink class="btn btn-secondary" :to="billingQuery({ runs_page: previousPage(payload.runPagination.page) })">上一页</RouterLink>
                <RouterLink class="btn btn-secondary" :to="billingQuery({ runs_page: nextPage(payload.runPagination.page, payload.runPagination.totalPages) })">下一页</RouterLink>
              </div>
            </div>
          </div>

          <div class="card p-5">
            <div class="mb-3 flex items-center justify-between gap-3">
              <div>
                <h2 class="panel-title">账户流水</h2>
                <p class="panel-subtitle">充值、资源扣费、退款和补扣。</p>
              </div>
              <span class="badge badge-success">{{ payload.ledgerPagination.total }} 条</span>
            </div>
            <div class="space-y-2.5">
              <div v-if="detailsLoading && !detailsPayload" class="empty-state">正在加载账户流水...</div>
              <div v-for="item in payload.ledger" :key="item.id || `${item.type}-${item.createdAt}`" class="rounded-2xl border border-gray-100 px-4 py-3 dark:border-slate-700">
                <div class="flex items-start justify-between gap-3">
                  <div>
                    <div class="font-medium text-gray-950 dark:text-white">{{ humanizeLedgerType(item.type) }}</div>
                    <div class="mt-1 text-xs text-gray-500 dark:text-slate-400">{{ item.createdAt || "-" }}</div>
                  </div>
                  <div class="text-right">
                    <div class="font-medium text-gray-950 dark:text-white">¥{{ Number(item.amount || 0).toFixed(2) }}</div>
                    <div class="mt-1 text-xs text-gray-500 dark:text-slate-400">{{ item.reason || "-" }}</div>
                  </div>
                </div>
              </div>
              <div v-if="!payload.ledger.length" class="empty-state">当前窗口暂无账户流水</div>
            </div>

            <div class="pager-bar">
              <span>第 {{ payload.ledgerPagination.page }} / {{ payload.ledgerPagination.totalPages }} 页</span>
              <div class="flex gap-2">
                <RouterLink class="btn btn-secondary" :to="billingQuery({ ledger_page: previousPage(payload.ledgerPagination.page) })">上一页</RouterLink>
                <RouterLink class="btn btn-secondary" :to="billingQuery({ ledger_page: nextPage(payload.ledgerPagination.page, payload.ledgerPagination.totalPages) })">下一页</RouterLink>
              </div>
            </div>
          </div>
        </section>
      </template>
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { useRoute, useRouter } from "vue-router";
import { Bar } from "vue-chartjs";
import { BarElement, CategoryScale, Chart as ChartJS, Legend, LinearScale, Tooltip } from "chart.js";
import AppLayout from "@/layouts/AppLayout.vue";
import MetricCard from "@/components/common/MetricCard.vue";
import { useBillingSurface } from "@/composables/useBillingSurface";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

const route = useRoute();
const router = useRouter();

const barOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: "bottom" as const,
      labels: { color: "#64748b" },
    },
  },
  scales: {
    x: { ticks: { color: "#64748b" }, grid: { color: "rgba(148,163,184,0.12)" } },
    y: { ticks: { color: "#64748b" }, grid: { color: "rgba(148,163,184,0.12)" } },
  },
};

const {
  billingExportHref,
  billingQuery,
  componentCostHint,
  detailsLoading,
  detailsPayload,
  error,
  filterDraft,
  humanizeLedgerType,
  humanizeStatus,
  microMoney,
  money,
  nextPage,
  payload,
  previousPage,
  resetFilter,
  sourceBackfilledValue,
  sourceBackfillHint,
  statusBadge,
  summaryLoading,
  summaryPayload,
  taskExportHref,
  trendChartData,
  applyFilter,
} = useBillingSurface(route, router);
</script>
