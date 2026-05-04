<template>
  <AppLayout title="MedOPL" subtitle="普通用户总览">
    <div class="space-y-4">
      <div v-if="overviewLoading && !payload" class="card p-6 text-sm text-gray-500 dark:text-slate-400">正在加载总览...</div>
      <div v-else-if="error" class="card p-6 text-sm text-red-600 dark:text-red-400">{{ error }}</div>

      <template v-else-if="payload">
        <section class="grid grid-cols-1 gap-4 xl:grid-cols-[1.4fr_0.9fr]">
          <div class="card p-5">
            <div class="flex flex-wrap items-start justify-between gap-4">
              <div class="max-w-2xl">
                <div class="flex flex-wrap items-center gap-2">
                  <span class="badge badge-primary">实验室控制台</span>
                  <span class="badge" :class="payload.commercial.canEnterWorkbench ? 'badge-success' : 'badge-danger'">
                    {{ payload.commercial.canEnterWorkbench ? "工作台可用" : "工作台受限" }}
                  </span>
                  <span class="badge" :class="payload.serverPlansSummary.quotedCount > 0 ? 'badge-success' : 'badge-warning'">
                    {{ payload.serverPlansSummary.quotedCount > 0 ? "腾讯云报价已同步" : "等待腾讯云报价" }}
                  </span>
                </div>
                <h2 class="mt-3 text-xl font-semibold tracking-tight text-gray-950 dark:text-white">账户与任务总览</h2>
                <p class="mt-2 text-sm leading-6 text-gray-600 dark:text-slate-300">查看套餐存储容量、工作空间任务和账单状态。</p>
              </div>
              <div class="flex flex-wrap gap-2">
                <a class="btn btn-primary" :href="workbenchHref">进入工作台</a>
                <RouterLink class="btn btn-secondary" to="/packages">套餐与扩容</RouterLink>
                <RouterLink class="btn btn-secondary" to="/billing">账单</RouterLink>
              </div>
            </div>
          </div>

          <div class="card p-5">
            <div class="flex items-center justify-between gap-3">
              <div>
                <h2 class="panel-title">账户状态</h2>
                <p class="panel-subtitle">当前可用额度与运行状态</p>
              </div>
              <span class="badge" :class="payload.commercial.canStartChargeableRun ? 'badge-success' : 'badge-warning'">
                {{ payload.commercial.canStartChargeableRun ? "可启动运行" : "需处理" }}
              </span>
            </div>
            <div class="mt-4 space-y-2.5 text-sm">
              <div class="muted-kv">
                <span class="muted-kv-label">账号</span>
                <span class="muted-kv-value">{{ commercialText(payload.kpis.accountStatus) }}</span>
              </div>
              <div class="muted-kv">
                <span class="muted-kv-label">计费</span>
                <span class="muted-kv-value">{{ commercialText(payload.kpis.billingStatus) }}</span>
              </div>
              <div class="muted-kv">
                <span class="muted-kv-label">权益</span>
                <span class="muted-kv-value">{{ commercialText(payload.kpis.entitlementStatus) }}</span>
              </div>
              <div class="muted-kv">
                <span class="muted-kv-label">默认规格</span>
                <span class="muted-kv-value">{{ payload.selectedServerPlan?.name || "未选择" }}</span>
              </div>
            </div>
          </div>
        </section>

        <section class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="钱包余额" :value="money(payload.kpis.balance)" hint="账户余额" />
          <MetricCard label="运行中预扣" :value="money(frozenAmount)" hint="运行中预扣金额" />
          <MetricCard label="可用额度" :value="money(availableBalance)" hint="余额 - 冻结 + 试用" />
          <MetricCard label="活跃订单" :value="activeOrderCount" hint="进行中的资源订单" />
        </section>

        <section class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="今日运行中预扣" :value="money(pendingToday)" hint="今日运行中预扣" />
          <MetricCard label="今日 T+1 校准" :value="money(exactToday)" hint="今日 T+1 校准后金额" />
          <MetricCard label="本月运行中预扣" :value="money(pendingMonth)" hint="本月累计运行中预扣" />
          <MetricCard label="本月 T+1 校准" :value="money(exactMonth)" hint="本月累计 T+1 校准后金额" />
        </section>

        <section class="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_1fr]">
          <div class="card p-5">
            <div class="mb-3 flex items-center justify-between gap-3">
              <div>
                <h2 class="panel-title">最近订单</h2>
                <p class="panel-subtitle">报价、冻结、运行、结算状态</p>
              </div>
              <RouterLink class="btn btn-secondary" to="/packages">去扩容</RouterLink>
            </div>
            <div class="space-y-2.5">
              <div v-if="orderPanelLoading" class="empty-state">正在加载最近订单...</div>
              <div
                v-for="item in recentOrders"
                :key="item.id"
                class="rounded-2xl border border-gray-100 px-4 py-3 dark:border-slate-700"
              >
                <div class="flex items-start justify-between gap-3">
                  <div>
                    <div class="font-medium text-gray-950 dark:text-white">{{ item.workspaceTitle || item.workspaceId || item.id }}</div>
                    <div class="mt-1 text-xs text-gray-500 dark:text-slate-400">
                      服务器编号 {{ item.serverPlanId || "-" }} · {{ item.serverPlanName || "未命名规格" }} · {{ item.region || "-" }}
                    </div>
                  </div>
                  <span class="badge" :class="orderStatusBadge(item.status)">{{ orderStatusText(item.status) }}</span>
                </div>
                <div class="mt-3 grid grid-cols-2 gap-3 text-xs text-gray-500 dark:text-slate-400">
                  <div>冻结 {{ money(item.frozenAmount) }}</div>
                  <div>Exact {{ money(item.exactCost) }}</div>
                </div>
              </div>
              <div v-if="!orderPanelLoading && !recentOrders.length" class="empty-state">暂无资源订单</div>
            </div>
          </div>

          <div class="card p-5">
            <div class="mb-3 flex items-center justify-between gap-3">
              <div>
                <h2 class="panel-title">最近运行</h2>
                <p class="panel-subtitle">最近 5 条任务编号记录</p>
              </div>
              <span class="badge badge-primary">{{ payload.latestRunsPagination.total }} 条</span>
            </div>

            <div class="space-y-2.5">
              <div
                v-for="item in payload.latestRuns"
                :key="item.runId"
                class="rounded-2xl border border-gray-100 px-4 py-3 dark:border-slate-700"
              >
                <div class="flex items-start justify-between gap-3">
                  <div>
                    <div class="font-medium text-gray-950 dark:text-white">{{ item.workspaceTitle || item.workspaceId || "-" }}</div>
                    <div class="mt-1 font-mono text-xs text-gray-500 dark:text-slate-400">任务编号 {{ item.runId || "-" }}</div>
                  </div>
                  <span class="badge" :class="statusBadge(item.status)">{{ humanizeStatus(item.status) }}</span>
                </div>
                <div class="mt-2 text-xs text-gray-500 dark:text-slate-400">{{ item.displayTime || "-" }}</div>
              </div>
              <div v-if="!payload.latestRuns.length" class="empty-state">暂无运行记录</div>
            </div>

            <div class="pager-bar">
              <span>第 {{ payload.latestRunsPagination.page }} / {{ payload.latestRunsPagination.totalPages }} 页</span>
              <div class="flex gap-2">
                <RouterLink class="btn btn-secondary" :to="overviewQuery({ runs_page: previousPage(payload.latestRunsPagination.page) })">上一页</RouterLink>
                <RouterLink class="btn btn-secondary" :to="overviewQuery({ runs_page: nextPage(payload.latestRunsPagination.page, payload.latestRunsPagination.totalPages) })">下一页</RouterLink>
              </div>
            </div>
          </div>
        </section>

        <section class="grid grid-cols-1 gap-4 xl:grid-cols-[1.05fr_0.95fr]">
          <div class="card p-5">
            <div class="mb-3 flex items-center justify-between gap-3">
              <div>
                <h2 class="panel-title">套餐容量</h2>
                <p class="panel-subtitle">查看可用规格、套餐存储容量与扩容入口</p>
              </div>
              <RouterLink class="btn btn-secondary" to="/packages">查看套餐</RouterLink>
            </div>
            <div class="grid grid-cols-2 gap-3 text-sm">
              <div class="rounded-2xl border border-gray-100 px-4 py-3 dark:border-slate-700">
                <div class="text-xs text-gray-500 dark:text-slate-400">可选规格</div>
                <div class="mt-2 text-lg font-semibold text-gray-950 dark:text-white">{{ payload.serverPlansSummary.salableCount }}</div>
              </div>
              <div class="rounded-2xl border border-gray-100 px-4 py-3 dark:border-slate-700">
                <div class="text-xs text-gray-500 dark:text-slate-400">已报价规格</div>
                <div class="mt-2 text-lg font-semibold text-gray-950 dark:text-white">{{ payload.serverPlansSummary.quotedCount }}</div>
              </div>
              <div class="rounded-2xl border border-gray-100 px-4 py-3 dark:border-slate-700">
                <div class="text-xs text-gray-500 dark:text-slate-400">最低小时价</div>
                <div class="mt-2 text-lg font-semibold text-gray-950 dark:text-white">{{ money(payload.serverPlansSummary.lowestHourlyPrice) }}</div>
              </div>
              <div class="rounded-2xl border border-gray-100 px-4 py-3 dark:border-slate-700">
                <div class="text-xs text-gray-500 dark:text-slate-400">当前规格</div>
                <div class="mt-2 font-medium text-gray-950 dark:text-white">{{ payload.selectedServerPlan?.name || "未选择" }}</div>
              </div>
            </div>
          </div>

          <div class="card p-5">
            <div class="mb-3 flex items-center justify-between gap-3">
              <div>
                <h2 class="panel-title">工作空间</h2>
                <p class="panel-subtitle">上传文件、下载结果与任务编号都归属工作空间</p>
              </div>
              <RouterLink class="btn btn-secondary" to="/workspace">查看工作空间</RouterLink>
            </div>
            <div class="space-y-2.5">
              <div
                v-for="item in payload.taskCards.slice(0, 3)"
                :key="item.slug"
                class="rounded-2xl border border-gray-100 px-4 py-3 dark:border-slate-700"
              >
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
              <div v-if="!payload.taskCards.length" class="empty-state">还没有任务空间</div>
            </div>
          </div>
        </section>
      </template>
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRoute } from "vue-router";
import AppLayout from "@/layouts/AppLayout.vue";
import MetricCard from "@/components/common/MetricCard.vue";
import type { OverviewPayload, ResourceOrderItem, ResourceOrdersPayload } from "@/api/portal";
import { fetchOverview, fetchResourceOrders } from "@/api/portal";

const route = useRoute();
const overviewLoading = ref(true);
const orderPanelLoading = ref(false);
const error = ref("");
const payload = ref<OverviewPayload | null>(null);
const resourceOrders = ref<ResourceOrdersPayload | null>(null);

function money(value: number | undefined) {
  return `CNY ${Number(value || 0).toFixed(2)}`;
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

function orderStatusBadge(status?: string) {
  const normalized = String(status || "").toLowerCase();
  if (["running", "provisioning"].includes(normalized)) return "badge-primary";
  if (["settled", "released"].includes(normalized)) return "badge-success";
  if (["failed", "cancelled"].includes(normalized)) return "badge-danger";
  return "badge-warning";
}

function orderStatusText(status?: string) {
  const normalized = String(status || "").toLowerCase();
  const labels: Record<string, string> = {
    quoted: "已报价",
    frozen: "已冻结",
    provisioning: "开通中",
    running: "运行中",
    released: "已释放",
    reconciling: "对账中",
    settled: "已结算",
    failed: "失败",
    cancelled: "已取消",
  };
  return labels[normalized] || status || "未知";
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
const recentOrders = computed<ResourceOrderItem[]>(() => (resourceOrders.value?.items || payload.value?.resourceOrders?.items || []).slice(0, 4));
const frozenAmount = computed(() => Number(payload.value?.kpis.frozenAmount ?? resourceOrders.value?.summary?.frozenAmount ?? 0));
const availableBalance = computed(() => Number(payload.value?.kpis.availableBalance ?? (payload.value?.kpis.balance || 0) - frozenAmount.value));
const pendingToday = computed(() => Number(payload.value?.kpis.pendingCostToday ?? 0));
const exactToday = computed(() => Number(payload.value?.kpis.exactCostToday ?? payload.value?.kpis.todayCost ?? 0));
const pendingMonth = computed(() => Number(payload.value?.kpis.pendingCostMonth ?? resourceOrders.value?.summary?.pendingAmount ?? 0));
const exactMonth = computed(() => Number(payload.value?.kpis.exactCostMonth ?? payload.value?.kpis.historicalCost ?? 0));
const activeOrderCount = computed(() => {
  if (typeof resourceOrders.value?.summary?.activeCount === "number") return resourceOrders.value.summary.activeCount;
  return recentOrders.value.filter((item) => ["quoted", "frozen", "provisioning", "running", "reconciling"].includes(String(item.status || "").toLowerCase())).length;
});

let requestId = 0;

async function load() {
  const current = ++requestId;
  overviewLoading.value = true;
  error.value = "";
  try {
    const overviewData = await fetchOverview({
      tasks_page: readQueryValue("tasks_page"),
      runs_page: readQueryValue("runs_page"),
    });
    if (current !== requestId) return;
    payload.value = overviewData;
    void loadResourceOrders(current, overviewData);
  } catch (err: any) {
    if (current !== requestId) return;
    error.value = err?.message || "总览加载失败";
  } finally {
    if (current === requestId) overviewLoading.value = false;
  }
}

async function loadResourceOrders(current: number, overviewData: OverviewPayload) {
  orderPanelLoading.value = true;
  try {
    const orders = await fetchResourceOrders({ limit: 8 });
    if (current !== requestId) return;
    resourceOrders.value = orders;
  } catch {
    if (current !== requestId) return;
    resourceOrders.value = overviewData.resourceOrders || null;
  } finally {
    if (current === requestId) orderPanelLoading.value = false;
  }
}

watch(() => route.fullPath, () => {
  void load();
}, { immediate: true });
</script>
