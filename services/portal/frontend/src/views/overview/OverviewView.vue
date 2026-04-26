<template>
  <AppLayout title="MedOPL" subtitle="实验室、任务空间、费用">
    <div class="space-y-4">
      <div v-if="loading" class="card p-6 text-sm text-gray-500 dark:text-slate-400">正在加载总览...</div>
      <div v-else-if="error" class="card p-6 text-sm text-red-600 dark:text-red-400">{{ error }}</div>

      <template v-else-if="payload">
        <section class="grid grid-cols-1 gap-4 xl:grid-cols-[1.45fr_0.9fr]">
          <div class="card p-5">
            <div class="flex flex-wrap items-start justify-between gap-4">
              <div class="max-w-2xl">
                <div class="flex flex-wrap items-center gap-2">
                  <span class="badge badge-primary">研究工作台</span>
                  <span class="badge" :class="payload.commercial.canEnterWorkbench ? 'badge-success' : 'badge-danger'">
                    {{ payload.commercial.canEnterWorkbench ? "可进入" : "账号受限" }}
                  </span>
                  <span class="badge" :class="payload.commercial.canStartChargeableRun ? 'badge-success' : 'badge-warning'">
                    {{ payload.commercial.canStartChargeableRun ? "可运行" : "需充值或试用额度" }}
                  </span>
                </div>
                <h2 class="mt-3 text-xl font-semibold tracking-tight text-gray-950 dark:text-white">进入实验室，按需使用算力</h2>
                <p class="mt-2 text-sm leading-6 text-gray-600 dark:text-slate-300">
                  任务空间保存数据，服务器按运行选择，费用以腾讯云账单回补为准。
                </p>
              </div>
              <div class="flex flex-wrap gap-2">
                <a class="btn btn-primary" :href="workbenchHref">进入工作台</a>
                <RouterLink class="btn btn-secondary" to="/servers">服务器与费用</RouterLink>
                <RouterLink class="btn btn-secondary" to="/billing">账单</RouterLink>
              </div>
            </div>
          </div>

          <div class="card p-5">
            <div class="flex items-center justify-between gap-3">
              <div>
                <h2 class="panel-title">账户</h2>
                <p class="panel-subtitle">余额、试用和运行权限</p>
              </div>
              <span class="badge" :class="payload.commercial.canStartChargeableRun ? 'badge-success' : 'badge-warning'">
                {{ payload.commercial.canStartChargeableRun ? "可运行" : "待处理" }}
              </span>
            </div>
            <div class="mt-4 space-y-2.5 text-sm">
              <div class="muted-kv">
                <span class="muted-kv-label">账号状态</span>
                <span class="muted-kv-value">{{ commercialText(payload.kpis.accountStatus) }}</span>
              </div>
              <div class="muted-kv">
                <span class="muted-kv-label">钱包余额</span>
                <span class="muted-kv-value">{{ money(payload.kpis.balance) }}</span>
              </div>
              <div class="muted-kv">
                <span class="muted-kv-label">计费状态</span>
                <span class="muted-kv-value">{{ commercialText(payload.kpis.billingStatus) }}</span>
              </div>
              <div class="muted-kv">
                <span class="muted-kv-label">权益状态</span>
                <span class="muted-kv-value">{{ commercialText(payload.kpis.entitlementStatus) }}</span>
              </div>
            </div>
          </div>
        </section>

        <section class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="余额" :value="money(payload.kpis.balance)" hint="可用于冻结和结算" />
          <MetricCard label="任务空间" :value="payload.kpis.workspaceCount" hint="当前可用空间" />
          <MetricCard label="今日费用" :value="microMoney(payload.kpis.todayCost)" hint="今日资源消耗" />
          <MetricCard label="历史费用" :value="microMoney(payload.kpis.historicalCost)" hint="累计资源账单" />
        </section>

        <section v-if="payload.commercial.chargeBlockedReasons.length" class="card p-5">
          <div class="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 class="panel-title">运行受限</h2>
              <p class="mt-2 text-sm leading-6 text-gray-600 dark:text-slate-300">
                {{ payload.commercial.chargeBlockedReasons.join("；") }}
              </p>
            </div>
            <RouterLink class="btn btn-primary" to="/billing">查看账单</RouterLink>
          </div>
        </section>

        <section class="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_1fr]">
          <div class="card p-5">
            <div class="mb-3 flex items-center justify-between gap-3">
              <div>
                <h2 class="panel-title">服务器与费用</h2>
                <p class="panel-subtitle">透明价格，按选择运行。</p>
              </div>
              <RouterLink class="btn btn-secondary" to="/servers">选择规格</RouterLink>
            </div>
            <div class="grid grid-cols-2 gap-3 text-sm">
              <div class="rounded-2xl border border-gray-100 px-4 py-3 dark:border-slate-700">
                <div class="text-xs text-gray-500 dark:text-slate-400">可售规格</div>
                <div class="mt-2 text-lg font-semibold text-gray-950 dark:text-white">{{ payload.serverPlansSummary.salableCount }}</div>
              </div>
              <div class="rounded-2xl border border-gray-100 px-4 py-3 dark:border-slate-700">
                <div class="text-xs text-gray-500 dark:text-slate-400">最低小时价</div>
                <div class="mt-2 text-lg font-semibold text-gray-950 dark:text-white">{{ money(payload.serverPlansSummary.lowestHourlyPrice) }}</div>
              </div>
              <div class="rounded-2xl border border-gray-100 px-4 py-3 dark:border-slate-700">
                <div class="text-xs text-gray-500 dark:text-slate-400">报价状态</div>
                <div class="mt-2 font-medium text-gray-950 dark:text-white">{{ commercialText(payload.serverPlansSummary.priceStatus) }}</div>
              </div>
              <div class="rounded-2xl border border-gray-100 px-4 py-3 dark:border-slate-700">
                <div class="text-xs text-gray-500 dark:text-slate-400">当前规格</div>
                <div class="mt-2 font-medium text-gray-950 dark:text-white">{{ payload.selectedServerPlan?.name || "默认" }}</div>
              </div>
            </div>
          </div>

          <div class="card p-5">
            <div class="mb-3 flex items-center justify-between gap-3">
              <div>
                <h2 class="panel-title">任务空间</h2>
                <p class="panel-subtitle">数据、trace 和运行记录都归属任务空间。</p>
              </div>
              <RouterLink class="btn btn-secondary" to="/workspace">查看空间</RouterLink>
            </div>
            <div class="space-y-2.5">
              <div v-for="item in payload.taskCards.slice(0, 3)" :key="item.slug" class="rounded-2xl border border-gray-100 px-4 py-3 dark:border-slate-700">
                <div class="flex items-start justify-between gap-3">
                  <div>
                    <div class="font-medium text-gray-950 dark:text-white">{{ item.title || item.slug }}</div>
                    <div class="mt-1 text-xs text-gray-500 dark:text-slate-400">{{ item.slug }}</div>
                  </div>
                  <span class="badge" :class="statusBadge(item.status)">{{ humanizeStatus(item.status) }}</span>
                </div>
                <div class="mt-2 flex items-center justify-between gap-3 text-xs text-gray-500 dark:text-slate-400">
                  <span>{{ item.runCount || 0 }} 次运行</span>
                  <span>{{ item.updatedAt || "-" }}</span>
                </div>
              </div>
              <div v-if="!payload.taskCards.length" class="empty-state">还没有任务空间。</div>
            </div>
          </div>
        </section>

        <section class="card p-5">
          <div class="mb-3 flex items-center justify-between gap-3">
            <div>
              <h2 class="panel-title">最近运行</h2>
              <p class="panel-subtitle">最近 5 条运行记录。</p>
            </div>
            <span class="badge badge-primary">{{ payload.latestRunsPagination.total }} 条</span>
          </div>

          <div class="table-shell">
            <table class="text-sm">
              <thead>
                <tr class="table-head">
                  <th class="px-4 py-3">运行编号</th>
                  <th class="px-4 py-3">任务空间</th>
                  <th class="px-4 py-3">状态</th>
                  <th class="px-4 py-3">时间</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in payload.latestRuns" :key="item.runId" class="table-row">
                  <td class="px-4 py-3 font-mono text-xs text-gray-700 dark:text-slate-300">{{ item.runId || "-" }}</td>
                  <td class="px-4 py-3">
                    <div class="font-medium text-gray-950 dark:text-white">{{ item.workspaceTitle || item.workspaceId || "-" }}</div>
                    <div class="mt-1 text-xs text-gray-500 dark:text-slate-400">{{ item.workspaceId || "-" }}</div>
                  </td>
                  <td class="px-4 py-3">
                    <span class="badge" :class="statusBadge(item.status)">{{ humanizeStatus(item.status) }}</span>
                  </td>
                  <td class="px-4 py-3 text-gray-500 dark:text-slate-400">{{ item.displayTime || "-" }}</td>
                </tr>
                <tr v-if="!payload.latestRuns.length">
                  <td colspan="4" class="px-4 py-6 text-center text-sm text-gray-500 dark:text-slate-400">暂无运行记录</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="pager-bar">
            <span>第 {{ payload.latestRunsPagination.page }} / {{ payload.latestRunsPagination.totalPages }} 页</span>
            <div class="flex gap-2">
              <RouterLink class="btn btn-secondary" :to="overviewQuery({ runs_page: previousPage(payload.latestRunsPagination.page) })">上一页</RouterLink>
              <RouterLink class="btn btn-secondary" :to="overviewQuery({ runs_page: nextPage(payload.latestRunsPagination.page, payload.latestRunsPagination.totalPages) })">下一页</RouterLink>
            </div>
          </div>
        </section>
      </template>
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";
import { useRoute } from "vue-router";
import AppLayout from "@/layouts/AppLayout.vue";
import MetricCard from "@/components/common/MetricCard.vue";
import type { OverviewPayload } from "@/api/portal";
import { fetchOverview } from "@/api/portal";

const route = useRoute();
const loading = ref(true);
const error = ref("");
const payload = ref<OverviewPayload | null>(null);

function money(value: number | undefined) {
  return `CNY ${Number(value || 0).toFixed(2)}`;
}

function microMoney(value: number | undefined) {
  return `CNY ${Number(value || 0).toFixed(5)}`;
}

function statusBadge(status?: string) {
  const normalized = String(status || "").toLowerCase();
  if (["completed", "success", "finished", "active"].includes(normalized)) return "badge-success";
  if (["failed", "error", "disabled"].includes(normalized)) return "badge-danger";
  if (["running", "recorded"].includes(normalized)) return "badge-primary";
  return "badge-warning";
}

function humanizeStatus(status?: string) {
  const normalized = String(status || "").toLowerCase();
  if (["completed", "success", "finished"].includes(normalized)) return "已完成";
  if (normalized === "running") return "运行中";
  if (normalized === "active") return "活跃";
  if (normalized === "archived") return "已归档";
  if (["failed", "error", "disabled"].includes(normalized)) return "异常";
  return status || "未知";
}

function commercialText(status?: string) {
  const normalized = String(status || "").toLowerCase();
  const labels: Record<string, string> = {
    active: "正常",
    wallet_available: "钱包可用",
    trial_only: "试用额度",
    payment_required: "需充值",
    below_balance_floor: "低于余额门槛",
    account_blocked: "账号受限",
    trial_active: "试用中",
    trial_expired: "试用过期",
    none: "未配置",
    quoted: "已报价",
    pending: "待刷新",
    unavailable: "不可用",
    done: "完成",
    ready: "可用",
    attention: "注意",
  };
  return labels[normalized] || status || "-";
}

function routeQueryObject() {
  const query: Record<string, string> = {};
  for (const [key, value] of Object.entries(route.query)) {
    const normalized = Array.isArray(value) ? value[0] : value;
    if (normalized != null) query[key] = String(normalized);
  }
  return query;
}

function overviewQuery(updates: Record<string, string | number | undefined>) {
  const query = routeQueryObject();
  for (const [key, value] of Object.entries(updates)) {
    if (value === undefined || value === null || value === "") delete query[key];
    else query[key] = String(value);
  }
  return { path: route.path, query };
}

function readQueryValue(key: string) {
  const value = route.query[key];
  const normalized = Array.isArray(value) ? value[0] : value;
  return normalized ?? undefined;
}

function previousPage(page: number) {
  return Math.max(1, Number(page || 1) - 1);
}

function nextPage(page: number, totalPages: number) {
  return Math.min(Number(totalPages || 1), Number(page || 1) + 1);
}

const workbenchHref = "/portal/opl";
let requestId = 0;

async function load() {
  const current = ++requestId;
  loading.value = true;
  error.value = "";
  try {
    const overviewData = await fetchOverview({
      tasks_page: readQueryValue("tasks_page"),
      runs_page: readQueryValue("runs_page"),
    });
    if (current !== requestId) return;
    payload.value = overviewData;
  } catch (err: any) {
    if (current !== requestId) return;
    error.value = err?.message || "总览加载失败";
  } finally {
    if (current === requestId) loading.value = false;
  }
}

watch(() => route.fullPath, () => {
  void load();
}, { immediate: true });
</script>
