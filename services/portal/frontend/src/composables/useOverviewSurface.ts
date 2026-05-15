import { computed, ref, watch } from "vue";
import type { RouteLocationNormalizedLoaded } from "vue-router";
import type { OverviewPayload } from "@/api/portal/overview";
import { fetchOverview } from "@/api/portal/overview";
import type { PlatformProvisionedResourcesPayload, WorkspaceResourceBinding } from "@/api/portal/resources";
import { fetchMyResources } from "@/api/portal/resources";

function errorMessage(error: unknown, fallback: string) {
  const value = (error as { businessMessage?: unknown; message?: unknown })?.businessMessage
    || (error as { message?: unknown })?.message;
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

export function useOverviewSurface(route: RouteLocationNormalizedLoaded) {
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

  const workbenchHref = "/opl-launch";
  const recentBindings = computed<WorkspaceResourceBinding[]>(() => (platformProvisionedResources.value?.bindings || []).slice(0, 4));
  const frozenAmount = computed(() => Number(payload.value?.kpis.frozenAmount ?? recentBindings.value.reduce((sum, item) => sum + Number(item.protection?.frozenAmount || 0), 0)));
  const availableBalance = computed(() => Number(payload.value?.kpis.availableBalance ?? (payload.value?.kpis.balance || 0) - frozenAmount.value));
  const pendingMonth = computed(() => Number(payload.value?.kpis.pendingCostMonth ?? 0));
  const exactMonth = computed(() => Number(payload.value?.kpis.exactCostMonth ?? payload.value?.kpis.historicalCost ?? 0));
  const todaySpend = computed(() => Number(payload.value?.kpis.exactCostToday ?? payload.value?.kpis.pendingCostToday ?? payload.value?.kpis.todayCost ?? 0));
  const totalSpend = computed(() => exactMonth.value + pendingMonth.value);
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
  const computeSummary = computed(() => {
    const plan = payload.value?.selectedServerPlan;
    if (plan?.cpu || plan?.memoryGb) return `${Number(plan.cpu || 0)} 核 / ${Number(plan.memoryGb || 0)}GB`;
    const instance = recentBindings.value[0]?.computeInstance || recentBindings.value[0]?.computeInstances[0];
    if (instance?.serverPlanId) return planLabel(instance.serverPlanId) || instance.serverPlanId;
    return recentBindings.value.length > 0 ? "随当前套餐分配" : "待选择套餐";
  });
  const storageSummary = computed(() => {
    const storage = recentBindings.value[0]?.storageBucket || recentBindings.value[0]?.storageBuckets[0];
    const capacity = Number(storage?.storageCapacityGb || 0);
    if (capacity > 0) return `${capacity} GB 文件空间`;
    const selectedStorage = payload.value?.selectedServerPlan?.storageRequest || payload.value?.selectedServerPlan?.storageLimit;
    return selectedStorage || fileSpaceStatus.value;
  });
  const releaseStatus = computed(() => {
    const protection = recentBindings.value[0]?.protection;
    if (!protection) return recentBindings.value.length > 0 ? "未释放" : "未开通";
    const stopBilling = auditStatusText(protection.reconcile120MinStatus);
    const audit = auditStatusText(protection.tPlus1AuditStatus);
    return `停止计费 ${stopBilling} / T+1 ${audit}`;
  });
  const selectedPlanDisplayName = computed(() => payload.value?.selectedServerPlan?.name || "未选择套餐");
  const serviceSummary = computed(() => `${selectedPlanDisplayName.value} 托管科研工作台服务`);
  const nextAction = computed(() => {
    const currentPayload = payload.value;
    if (!currentPayload) {
      return {
        label: "加载工作台状态",
        href: "/overview",
        detail: "正在读取套餐、余额、环境和工作空间状态。",
      };
    }
    if (!currentPayload.serverPlansSummary.quotedCount || !currentPayload.selectedServerPlan) {
      return {
        label: "选择托管套餐",
        href: "/packages",
        detail: "先确认套餐、算力和文件空间，再进入 OPL 工作台。",
      };
    }
    if (!currentPayload.commercial.canStartChargeableRun) {
      return {
        label: "处理余额或权限",
        href: "/billing",
        detail: "余额、冻结金额或权益状态未满足新任务运行条件。",
      };
    }
    if (!currentPayload.commercial.canEnterWorkbench) {
      return {
        label: "查看受限原因",
        href: "/resources",
        detail: "检查托管运行环境、文件空间和释放审计状态。",
      };
    }
    return {
      label: "进入 OPL 工作台",
      href: workbenchHref,
      detail: "环境、套餐、余额和文件空间均可用，可以进入 OPL 运行任务。",
    };
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
    } catch (err) {
      if (current !== requestId) return;
      error.value = errorMessage(err, "总览加载失败");
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

  return {
    auditStatusText,
    availableBalance,
    commercialText,
    computeSummary,
    displayFileSpace,
    displayPlan,
    error,
    exactMonth,
    fileSpaceStatus,
    frozenAmount,
    humanizeStatus,
    managedEnvironmentStatus,
    money,
    nextPage,
    overviewLoading,
    overviewQuery,
    payload,
    pendingMonth,
    previousPage,
    recentBindings,
    resourcePanelLoading,
    sessionCount,
    nextAction,
    releaseStatus,
    selectedPlanDisplayName,
    serviceSummary,
    statusBadge,
    storageSummary,
    taskCount,
    taskProgressText,
    todaySpend,
    totalSpend,
    workbenchHref,
  };
}
