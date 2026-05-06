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
                    {{ payload.serverPlansSummary.quotedCount > 0 ? "服务套餐已同步" : "等待套餐同步" }}
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
          <MetricCard label="运行环境" :value="resourceBindingCount" hint="平台代开隔离运行环境与文件空间" />
        </section>

        <section class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="今日运行中预扣" :value="money(pendingToday)" hint="今日运行中预扣" />
          <MetricCard label="今日实际结算" :value="money(exactToday)" hint="今日已核算金额" />
          <MetricCard label="本月运行中预扣" :value="money(pendingMonth)" hint="本月累计运行中预扣" />
          <MetricCard label="本月实际结算" :value="money(exactMonth)" hint="本月累计已核算金额" />
        </section>

        <section class="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_1fr]">
          <div class="card p-5">
            <div class="mb-3 flex items-center justify-between gap-3">
              <div>
                <h2 class="panel-title">我的资源</h2>
                <p class="panel-subtitle">平台代开隔离运行环境、文件空间与保护金状态</p>
              </div>
              <RouterLink class="btn btn-secondary" to="/resources">去开通</RouterLink>
            </div>
            <div class="space-y-2.5">
              <div v-if="resourcePanelLoading" class="empty-state">正在加载资源绑定...</div>
              <div
                v-for="item in recentBindings"
                :key="item.id"
                class="rounded-2xl border border-gray-100 px-4 py-3 dark:border-slate-700"
              >
                <div class="flex items-start justify-between gap-3">
                  <div>
                    <div class="font-medium text-gray-950 dark:text-white">{{ item.workspaceId || item.id }}</div>
                    <div class="mt-1 text-xs text-gray-500 dark:text-slate-400">
                      OPL Full Runtime · 运行环境 {{ item.status || "-" }}
                    </div>
                  </div>
                  <span class="badge" :class="statusBadge(item.status)">{{ humanizeStatus(item.status) }}</span>
                </div>
                <div class="mt-3 grid grid-cols-2 gap-3 text-xs text-gray-500 dark:text-slate-400">
                  <div>保护金 {{ money(item.protection?.frozenAmount) }}</div>
                  <div>已消耗 {{ money(item.protection?.consumedAmount) }}</div>
                </div>
              </div>
              <div v-if="!resourcePanelLoading && !recentBindings.length" class="empty-state">暂无运行环境，仍可使用 OPL Lite。</div>
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
                <div class="mt-2 text-lg font-semibold text-gray-950 dark:text-white">{{ payload.serverPlansSummary.purchasableCount }}</div>
              </div>
              <div class="rounded-2xl border border-gray-100 px-4 py-3 dark:border-slate-700">
                <div class="text-xs text-gray-500 dark:text-slate-400">已同步套餐</div>
                <div class="mt-2 text-lg font-semibold text-gray-950 dark:text-white">{{ payload.serverPlansSummary.quotedCount }}</div>
              </div>
              <div class="rounded-2xl border border-gray-100 px-4 py-3 dark:border-slate-700">
                <div class="text-xs text-gray-500 dark:text-slate-400">入门估算</div>
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
import type { OverviewPayload, PlatformProvisionedResourcesPayload, WorkspaceResourceBinding } from "@/api/portal";
import { fetchMyResources, fetchOverview } from "@/api/portal";

const route = useRoute();
const overviewLoading = ref(true);
const resourcePanelLoading = ref(false);
const error = ref("");
const payload = ref<OverviewPayload | null>(null);
const platformProvisionedResources = ref<PlatformProvisionedResourcesPayload | null>(null);

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
const recentBindings = computed<WorkspaceResourceBinding[]>(() => (platformProvisionedResources.value?.bindings || []).slice(0, 4));
const frozenAmount = computed(() => Number(payload.value?.kpis.frozenAmount ?? recentBindings.value.reduce((sum, item) => sum + Number(item.protection?.frozenAmount || 0), 0)));
const availableBalance = computed(() => Number(payload.value?.kpis.availableBalance ?? (payload.value?.kpis.balance || 0) - frozenAmount.value));
const pendingToday = computed(() => Number(payload.value?.kpis.pendingCostToday ?? 0));
const exactToday = computed(() => Number(payload.value?.kpis.exactCostToday ?? payload.value?.kpis.todayCost ?? 0));
const pendingMonth = computed(() => Number(payload.value?.kpis.pendingCostMonth ?? 0));
const exactMonth = computed(() => Number(payload.value?.kpis.exactCostMonth ?? payload.value?.kpis.historicalCost ?? 0));
const resourceBindingCount = computed(() => Number(platformProvisionedResources.value?.summary?.bindingCount ?? recentBindings.value.length));

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
    void loadPlatformProvisionedResources(current);
  } catch (err: any) {
    if (current !== requestId) return;
    error.value = err?.message || "总览加载失败";
  } finally {
    if (current === requestId) overviewLoading.value = false;
  }
}

async function loadPlatformProvisionedResources(current: number) {
  resourcePanelLoading.value = true;
  try {
    const resources = await fetchMyResources();
    if (current !== requestId) return;
    platformProvisionedResources.value = resources;
  } catch {
    if (current !== requestId) return;
    platformProvisionedResources.value = null;
  } finally {
    if (current === requestId) resourcePanelLoading.value = false;
  }
}

watch(() => route.fullPath, () => {
  void load();
}, { immediate: true });
</script>
