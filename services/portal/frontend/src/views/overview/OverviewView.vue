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
                  <span class="badge badge-primary">OPL SaaS 科研托管平台</span>
                  <span class="badge badge-success">面向 AI 小白科研用户</span>
                  <span class="badge badge-warning">科研托管平台控制台</span>
                  <span class="badge" :class="payload.commercial.canEnterWorkbench ? 'badge-success' : 'badge-danger'">
                    {{ payload.commercial.canEnterWorkbench ? "科研工作台可用" : "科研工作台受限" }}
                  </span>
                  <span class="badge" :class="payload.serverPlansSummary.quotedCount > 0 ? 'badge-success' : 'badge-warning'">
                    {{ payload.serverPlansSummary.quotedCount > 0 ? "服务套餐已同步" : "等待套餐同步" }}
                  </span>
                </div>
                <h2 class="mt-3 text-xl font-semibold tracking-tight text-gray-950 dark:text-white">科研托管平台控制台</h2>
                <p class="mt-2 text-sm leading-6 text-gray-600 dark:text-slate-300">
                  MedOPL 是 OPL SaaS 科研托管平台，帮助 AI 小白科研用户查看余额、消费、工作空间、文件空间和运行轨迹。
                </p>
              </div>
              <div class="flex flex-wrap gap-2">
                <a class="btn btn-primary" :href="workbenchHref">进入 OPL 工作台</a>
                <RouterLink class="btn btn-secondary" to="/packages">套餐与扩容</RouterLink>
                <RouterLink class="btn btn-secondary" to="/billing">账单</RouterLink>
              </div>
            </div>
          </div>

          <div class="card p-5">
            <div class="flex items-center justify-between gap-3">
              <div>
                <h2 class="panel-title">产品定位</h2>
                <p class="panel-subtitle">科研工作台、托管运行环境和文件空间统一在 Portal 查看</p>
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
                <span class="muted-kv-label">当前套餐</span>
                <span class="muted-kv-value">{{ payload.selectedServerPlan?.name || "未选择" }}</span>
              </div>
            </div>
          </div>
        </section>

        <section class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="余额" :value="money(payload.kpis.balance)" hint="账户余额" />
          <MetricCard label="预扣费 / 冻结金额" :value="money(frozenAmount)" hint="运行中的冻结金额" />
          <MetricCard label="会话数" :value="sessionCount" hint="最近可见会话记录" />
          <MetricCard label="任务数" :value="taskCount" hint="工作空间任务数量" />
        </section>

        <section class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="钱花在哪里" :value="money(exactMonth + pendingMonth)" hint="工作空间、托管运行环境和文件空间消费" />
          <MetricCard label="科研任务进度" :value="taskProgressText" hint="最近任务状态" />
          <MetricCard label="托管运行环境状态" :value="managedEnvironmentStatus" hint="托管运行环境是否可用" />
          <MetricCard label="文件空间状态" :value="fileSpaceStatus" hint="输入文件 / 输出文件空间" />
        </section>

        <section class="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_1fr]">
          <div class="card p-5">
            <div class="mb-3 flex items-center justify-between gap-3">
              <div>
                <h2 class="panel-title">托管运行环境</h2>
                <p class="panel-subtitle">查看托管运行环境状态、文件空间状态和预扣费 / 冻结金额</p>
              </div>
              <RouterLink class="btn btn-secondary" to="/resources">去开通</RouterLink>
            </div>
            <div class="space-y-2.5">
              <div v-if="resourcePanelLoading" class="empty-state">正在加载资源绑定...</div>
              <div
                v-for="(item, index) in recentBindings"
                :key="item.id"
                class="rounded-2xl border border-gray-100 px-4 py-3 dark:border-slate-700"
              >
                <div class="flex items-start justify-between gap-3">
                  <div>
                    <div class="font-medium text-gray-950 dark:text-white">工作空间 {{ index + 1 }}</div>
                    <div class="mt-1 text-xs text-gray-500 dark:text-slate-400">
                      当前套餐 {{ displayPlan(item) }} · 托管运行环境 {{ humanizeStatus(item.status) }}
                    </div>
                  </div>
                  <span class="badge" :class="statusBadge(item.status)">{{ humanizeStatus(item.status) }}</span>
                </div>
                <div class="mt-3 grid grid-cols-2 gap-3 text-xs text-gray-500 dark:text-slate-400">
                  <div>预扣费 {{ money(item.protection?.frozenAmount) }}</div>
                  <div>消费 {{ money(item.protection?.consumedAmount) }}</div>
                  <div>停止计费 / 审计状态 {{ auditStatusText(item.protection?.tPlus1AuditStatus) }}</div>
                  <div>文件空间 {{ displayFileSpace(item) }}</div>
                </div>
              </div>
              <div v-if="!resourcePanelLoading && !recentBindings.length" class="empty-state">暂无运行环境，仍可使用 OPL Lite。</div>
            </div>
          </div>

          <div class="card p-5">
            <div class="mb-3 flex items-center justify-between gap-3">
              <div>
                <h2 class="panel-title">科研任务进度</h2>
                <p class="panel-subtitle">最近任务 / 会话状态，输出文件回到工作空间</p>
              </div>
              <span class="badge badge-primary">{{ payload.latestRunsPagination.total }} 条</span>
            </div>

            <div class="space-y-2.5">
              <div
                v-for="(item, index) in payload.latestRuns"
                :key="item.displayTime || `latest-run-${index}`"
                class="rounded-2xl border border-gray-100 px-4 py-3 dark:border-slate-700"
              >
                <div class="flex items-start justify-between gap-3">
                  <div>
                    <div class="font-medium text-gray-950 dark:text-white">{{ item.workspaceTitle || `工作空间 ${index + 1}` }}</div>
                    <div class="mt-1 text-xs text-gray-500 dark:text-slate-400">任务记录 {{ index + 1 }}</div>
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
                <h2 class="panel-title">套餐与文件空间</h2>
                <p class="panel-subtitle">查看当前套餐、托管运行环境和文件空间容量</p>
              </div>
              <RouterLink class="btn btn-secondary" to="/packages">查看套餐</RouterLink>
            </div>
            <div class="grid grid-cols-2 gap-3 text-sm">
              <div class="rounded-2xl border border-gray-100 px-4 py-3 dark:border-slate-700">
                <div class="text-xs text-gray-500 dark:text-slate-400">可选套餐</div>
                <div class="mt-2 text-lg font-semibold text-gray-950 dark:text-white">{{ payload.serverPlansSummary.purchasableCount }}</div>
              </div>
              <div class="rounded-2xl border border-gray-100 px-4 py-3 dark:border-slate-700">
                <div class="text-xs text-gray-500 dark:text-slate-400">已同步套餐</div>
                <div class="mt-2 text-lg font-semibold text-gray-950 dark:text-white">{{ payload.serverPlansSummary.quotedCount }}</div>
              </div>
              <div class="rounded-2xl border border-gray-100 px-4 py-3 dark:border-slate-700">
                <div class="text-xs text-gray-500 dark:text-slate-400">入门预估消费</div>
                <div class="mt-2 text-lg font-semibold text-gray-950 dark:text-white">{{ money(payload.serverPlansSummary.lowestHourlyPrice) }}</div>
              </div>
              <div class="rounded-2xl border border-gray-100 px-4 py-3 dark:border-slate-700">
                <div class="text-xs text-gray-500 dark:text-slate-400">当前套餐</div>
                <div class="mt-2 font-medium text-gray-950 dark:text-white">{{ payload.selectedServerPlan?.name || "未选择" }}</div>
              </div>
            </div>
          </div>

          <div class="card p-5">
            <div class="mb-3 flex items-center justify-between gap-3">
              <div>
                <h2 class="panel-title">工作空间</h2>
                <p class="panel-subtitle">工作空间文件夹、输入文件、输出文件和输出结果都归属工作空间</p>
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
import type { OverviewPayload } from "@/api/portal/overview";
import type { PlatformProvisionedResourcesPayload, WorkspaceResourceBinding } from "@/api/portal/resources";
import { fetchOverview } from "@/api/portal/overview";
import { fetchMyResources } from "@/api/portal/resources";

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
  if (normalized === "active") return "可用";
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

function auditStatusText(status?: string) {
  const normalized = String(status || "").trim().toLowerCase();
  const labels: Record<string, string> = {
    audited: "审计完成",
    audit_ready: "审计待确认",
    pending: "审计待处理",
    done: "审计完成",
    matched: "账单已核对",
    released: "已释放",
    skipped: "暂不需要",
  };
  return labels[normalized] || status || "待确认";
}

function displayPlan(item: WorkspaceResourceBinding) {
  return payload.value?.selectedServerPlan?.name
    || planLabel(item.computeInstance?.serverPlanId)
    || planLabel(item.computeInstances[0]?.serverPlanId)
    || "套餐待确认";
}

function planLabel(planId?: string) {
  const normalized = String(planId || "").trim();
  const labels: Record<string, string> = {
    starter_2c4g_10gb: "入门套餐",
    pro_8c16g_100gb: "专业套餐",
  };
  return labels[normalized] || "";
}

function displayFileSpace(item: WorkspaceResourceBinding) {
  const storage = item.storageBucket || item.storageBuckets[0];
  const capacity = Number(storage?.storageCapacityGb || 0);
  return capacity > 0 ? `${capacity} GB` : "状态待确认";
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
const pendingMonth = computed(() => Number(payload.value?.kpis.pendingCostMonth ?? 0));
const exactMonth = computed(() => Number(payload.value?.kpis.exactCostMonth ?? payload.value?.kpis.historicalCost ?? 0));
const sessionCount = computed(() => Number(payload.value?.kpis.runCount ?? payload.value?.latestRunsPagination.total ?? 0));
const taskCount = computed(() => Number(payload.value?.kpis.activeTasks ?? payload.value?.taskPagination.total ?? payload.value?.taskCards.length ?? 0));
const taskProgressText = computed(() => {
  const latest = payload.value?.latestRuns?.[0];
  return latest ? humanizeStatus(latest.status) : "暂无任务";
});
const managedEnvironmentStatus = computed(() => {
  if (platformProvisionedResources.value?.summary?.activeBindings) return "可用";
  if (recentBindings.value.length > 0) return humanizeStatus(recentBindings.value[0]?.status);
  return "未开通";
});
const fileSpaceStatus = computed(() => {
  const storageCount = Number(platformProvisionedResources.value?.summary?.storageBucketCount ?? 0);
  if (storageCount > 0) return `${storageCount} 个文件空间`;
  return recentBindings.value.length > 0 ? "随托管运行环境绑定" : "未开通";
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
