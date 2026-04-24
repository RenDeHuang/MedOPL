<template>
  <AppLayout title="账单" subtitle="钱包余额、今日消费、趋势、workspace 成本与账户流水">
    <div class="space-y-4">
      <div v-if="loading" class="card p-6 text-sm text-gray-500 dark:text-slate-400">正在加载账单数据...</div>
      <div v-else-if="error" class="card p-6 text-sm text-red-600 dark:text-red-400">{{ error }}</div>
      <template v-else-if="payload">
        <section class="card p-5">
          <div class="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div class="max-w-2xl">
              <div class="flex items-center gap-2">
                <span class="badge badge-primary">真实账单</span>
                <span class="badge" :class="payload.breakdown.cloudSource === 'not_connected' ? 'badge-warning' : 'badge-success'">
                  {{ payload.breakdown.cloudSource === "not_connected" ? "云账单未接入" : "云账单已接入" }}
                </span>
              </div>
              <h2 class="mt-3 text-xl font-semibold tracking-tight text-gray-950 dark:text-white">当前账户的资源成本与流水</h2>
              <p class="mt-2 text-sm leading-6 text-gray-600 dark:text-slate-300">
                当前优先展示 CPU、GPU、存储等已接入账单。VPN、流量和其他云成本如果未接云账单，会明确标记为未接入。
              </p>
            </div>
            <div class="flex flex-wrap gap-2">
              <a class="btn btn-secondary" :href="billingExportHref">导出运行明细</a>
              <a class="btn btn-secondary" :href="taskExportHref">导出空间汇总</a>
            </div>
          </div>

          <div class="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="钱包余额" :value="money(payload.wallet.balance)" hint="当前账户余额" />
            <MetricCard label="今日消费" :value="microMoney(payload.todayCost)" hint="今日真实资源消费" />
            <MetricCard label="窗口总计" :value="microMoney(payload.summary.selectedCost)" hint="当前筛选窗口总成本" />
            <MetricCard label="账户流水" :value="payload.ledgerPagination.total" hint="当前窗口内流水数" />
          </div>
        </section>

        <section class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <MetricCard label="CPU 成本" :value="microMoney(payload.breakdown.cpuCost)" hint="OpenCost 聚合" />
          <MetricCard label="GPU 成本" :value="microMoney(payload.breakdown.gpuCost)" hint="OpenCost 聚合" />
          <MetricCard label="存储成本" :value="microMoney(payload.breakdown.storageCost)" hint="PVC / 存储类成本" />
          <MetricCard label="VPN 成本" :value="cloudValue(payload.breakdown.vpnCost)" :hint="cloudHint" />
          <MetricCard label="流量成本" :value="cloudValue(payload.breakdown.trafficCost)" :hint="cloudHint" />
          <MetricCard label="其他云成本" :value="cloudValue(payload.breakdown.otherCloudCost)" :hint="cloudHint" />
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
              <Bar v-if="trendChartData" :data="trendChartData" :options="barOptions" />
              <div v-else class="flex h-full items-center justify-center text-sm text-gray-500 dark:text-slate-400">暂无趋势数据</div>
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
              <h2 class="panel-title">任务空间成本明细</h2>
              <p class="panel-subtitle">按 workspace 查看 CPU、GPU、存储和总成本。</p>
            </div>
            <span class="badge badge-warning">{{ payload.taskPagination.total }} 项</span>
          </div>

          <div class="table-shell">
            <table class="text-sm">
              <thead>
                <tr class="table-head">
                  <th class="px-4 py-3">任务空间</th>
                  <th class="px-4 py-3">run</th>
                  <th class="px-4 py-3">CPU</th>
                  <th class="px-4 py-3">GPU</th>
                  <th class="px-4 py-3">存储</th>
                  <th class="px-4 py-3">总成本</th>
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
                <h2 class="panel-title">运行明细</h2>
                <p class="panel-subtitle">单次运行的状态、计价来源与总成本。</p>
              </div>
              <span class="badge badge-primary">{{ payload.runPagination.total }} 条</span>
            </div>

            <div class="table-shell">
              <table class="text-sm">
                <thead>
                  <tr class="table-head">
                    <th class="px-4 py-3">运行编号</th>
                    <th class="px-4 py-3">任务空间</th>
                    <th class="px-4 py-3">状态</th>
                    <th class="px-4 py-3">计价来源</th>
                    <th class="px-4 py-3">总成本</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="item in payload.runCosts" :key="item.runId" class="table-row">
                    <td class="px-4 py-3 font-mono text-xs text-gray-700 dark:text-slate-300">{{ item.runId }}</td>
                    <td class="px-4 py-3 text-gray-700 dark:text-slate-300">{{ item.workspaceId || "-" }}</td>
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
import { computed, reactive, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { Bar } from "vue-chartjs";
import { BarElement, CategoryScale, Chart as ChartJS, Legend, LinearScale, Tooltip } from "chart.js";
import AppLayout from "@/layouts/AppLayout.vue";
import MetricCard from "@/components/common/MetricCard.vue";
import type { BillingPayload, PortalQueryValue } from "@/api/portal";
import { fetchBilling } from "@/api/portal";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

const route = useRoute();
const router = useRouter();
const loading = ref(true);
const error = ref("");
const payload = ref<BillingPayload | null>(null);
const filterDraft = reactive({ from: "", to: "" });

const cloudHint = computed(() => payload.value?.breakdown.cloudSource === "not_connected" ? "当前仓库未接云账单" : "云账单聚合");
const trendChartData = computed(() => {
  const trend = payload.value?.trend;
  if (!trend?.labels?.length) return null;
  return {
    labels: trend.labels,
    datasets: [
      { label: "总成本", data: trend.total, backgroundColor: "#0f766e" },
      { label: "CPU", data: trend.cpu, backgroundColor: "#0ea5e9" },
      { label: "GPU", data: trend.gpu, backgroundColor: "#8b5cf6" },
      { label: "存储", data: trend.storage, backgroundColor: "#10b981" },
    ],
  };
});

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

function money(value: number | undefined) {
  return `¥${Number(value || 0).toFixed(2)}`;
}

function microMoney(value: number | undefined) {
  return `¥${Number(value || 0).toFixed(5)}`;
}

function cloudValue(value: number | undefined) {
  return payload.value?.breakdown.cloudSource === "not_connected" ? "未接入" : microMoney(value);
}

function humanizeStatus(status?: string) {
  const normalized = String(status || "").toLowerCase();
  if (["completed", "success", "finished"].includes(normalized)) return "已完成";
  if (normalized === "running") return "运行中";
  if (normalized === "active") return "活跃";
  if (["failed", "error"].includes(normalized)) return "失败";
  return status || "未知";
}

function statusBadge(status?: string) {
  const normalized = String(status || "").toLowerCase();
  if (["completed", "success", "finished"].includes(normalized)) return "badge-success";
  if (["failed", "error"].includes(normalized)) return "badge-danger";
  if (["running", "active"].includes(normalized)) return "badge-primary";
  return "badge-warning";
}

function humanizeLedgerType(type = "") {
  if (type === "topup") return "充值";
  if (type === "resource_charge") return "资源扣费";
  if (type === "refund") return "退款";
  if (type === "makeup_charge") return "补扣";
  return type || "-";
}

function routeQueryObject() {
  const query: Record<string, string> = {};
  for (const [key, value] of Object.entries(route.query)) {
    const normalized = Array.isArray(value) ? value[0] : value;
    if (normalized != null) query[key] = String(normalized);
  }
  return query;
}

function readQueryValue(key: string) {
  const value = route.query[key];
  const normalized = Array.isArray(value) ? value[0] : value;
  return normalized ?? undefined;
}

function billingQuery(updates: Record<string, PortalQueryValue>) {
  const query = routeQueryObject();
  for (const [key, value] of Object.entries(updates)) {
    if (value === undefined || value === null || value === "") delete query[key];
    else query[key] = String(value);
  }
  return { path: route.path, query };
}

function previousPage(page: number) {
  return Math.max(1, Number(page || 1) - 1);
}

function nextPage(page: number, totalPages: number) {
  return Math.min(Number(totalPages || 1), Number(page || 1) + 1);
}

function applyFilter() {
  router.push({
    path: route.path,
    query: {
      ...routeQueryObject(),
      from: filterDraft.from || undefined,
      to: filterDraft.to || undefined,
      tasks_page: undefined,
      runs_page: undefined,
      ledger_page: undefined,
    },
  });
}

function resetFilter() {
  filterDraft.from = "";
  filterDraft.to = "";
  router.push({ path: route.path, query: {} });
}

const billingExportHref = computed(() => {
  const params = new URLSearchParams();
  if (filterDraft.from) params.set("from", filterDraft.from);
  if (filterDraft.to) params.set("to", filterDraft.to);
  return `/portal/billing/export.csv${params.toString() ? `?${params}` : ""}`;
});

const taskExportHref = computed(() => {
  const params = new URLSearchParams();
  if (filterDraft.from) params.set("from", filterDraft.from);
  if (filterDraft.to) params.set("to", filterDraft.to);
  return `/portal/billing/tasks-export.csv${params.toString() ? `?${params}` : ""}`;
});

let requestId = 0;

async function load() {
  const current = ++requestId;
  loading.value = true;
  error.value = "";
  try {
    const data = await fetchBilling({
      from: readQueryValue("from"),
      to: readQueryValue("to"),
      tasks_page: readQueryValue("tasks_page"),
      runs_page: readQueryValue("runs_page"),
      ledger_page: readQueryValue("ledger_page"),
    });
    if (current !== requestId) return;
    payload.value = data;
    filterDraft.from = data.filter.from || "";
    filterDraft.to = data.filter.to || "";
  } catch (err: any) {
    if (current !== requestId) return;
    error.value = err?.message || "账单加载失败";
  } finally {
    if (current === requestId) loading.value = false;
  }
}

watch(() => route.fullPath, () => {
  void load();
}, { immediate: true });
</script>
