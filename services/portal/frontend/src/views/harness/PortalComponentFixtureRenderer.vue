<template>
  <component :is="entry.component" v-bind="entry.props" v-on="entry.listeners" />
</template>

<script setup lang="ts">
import { computed, type Component } from "vue";
import type { ChartData } from "chart.js";
import type { RouteLocationRaw } from "vue-router";
import AdminAuditTablePanel from "@/components/admin/AdminAuditTablePanel.vue";
import AdminBillingOpsSummaryPanel from "@/components/admin/AdminBillingOpsSummaryPanel.vue";
import AdminDashboardSummaryPanel from "@/components/admin/AdminDashboardSummaryPanel.vue";
import AdminServiceStatusPanel from "@/components/admin/AdminServiceStatusPanel.vue";
import AdminSiteSettingsPanel from "@/components/admin/AdminSiteSettingsPanel.vue";
import AdminUsageTablePanel from "@/components/admin/AdminUsageTablePanel.vue";
import AdminUsersTablePanel from "@/components/admin/AdminUsersTablePanel.vue";
import BillingCostBreakdownPanel from "@/components/billing/BillingCostBreakdownPanel.vue";
import BillingHero from "@/components/billing/BillingHero.vue";
import BillingLedgerPanel from "@/components/billing/BillingLedgerPanel.vue";
import BillingRunCostPanel from "@/components/billing/BillingRunCostPanel.vue";
import BillingTrendAndFilterPanel from "@/components/billing/BillingTrendAndFilterPanel.vue";
import BillingWorkspaceCostPanel from "@/components/billing/BillingWorkspaceCostPanel.vue";
import OverviewFinancialMetricsPanel from "@/components/overview/OverviewFinancialMetricsPanel.vue";
import OverviewHero from "@/components/overview/OverviewHero.vue";
import OverviewManagedEnvironmentPanel from "@/components/overview/OverviewManagedEnvironmentPanel.vue";
import OverviewPlansPanel from "@/components/overview/OverviewPlansPanel.vue";
import OverviewRecentRunsPanel from "@/components/overview/OverviewRecentRunsPanel.vue";
import OverviewWorkspacePanel from "@/components/overview/OverviewWorkspacePanel.vue";
import ResourcesAdjustmentPanel from "@/components/resources/ResourcesAdjustmentPanel.vue";
import ResourcesCurrentPanel from "@/components/resources/ResourcesCurrentPanel.vue";
import ResourcesHero from "@/components/resources/ResourcesHero.vue";
import ResourcesPlanSelectionPanel from "@/components/resources/ResourcesPlanSelectionPanel.vue";
import ResourcesReleaseAuditPanel from "@/components/resources/ResourcesReleaseAuditPanel.vue";
import TraceFilterPanel from "@/components/trace/TraceFilterPanel.vue";
import TraceHero from "@/components/trace/TraceHero.vue";
import TraceSessionTablePanel from "@/components/trace/TraceSessionTablePanel.vue";
import WorkspaceFilesPanel from "@/components/workspace/WorkspaceFilesPanel.vue";
import WorkspaceFileSpacePanel from "@/components/workspace/WorkspaceFileSpacePanel.vue";
import WorkspaceHero from "@/components/workspace/WorkspaceHero.vue";
import WorkspaceListPanel from "@/components/workspace/WorkspaceListPanel.vue";
import WorkspaceManagedPlanPanel from "@/components/workspace/WorkspaceManagedPlanPanel.vue";
import type { AdminUsersPayload } from "@/api/portal/admin";
import type { BillingPayload } from "@/api/portal/billing";
import type { PortalPagination, PortalQueryValue } from "@/api/portal/common";
import type { OverviewPayload } from "@/api/portal/overview";
import type { SessionTracesPayload } from "@/api/portal/traces";
import type {
  CustomerComputeResource,
  CustomerStorageResource,
  WeeklyProtectionFreeze,
  WorkspaceResourceBinding,
} from "@/api/portal/resources";
import type {
  ManagedResourceBindingPlanPayload,
  StorageEntitlementPayload,
  WorkspacePayload,
} from "@/api/portal/workspace";
import type { PortalWorkbenchFixtureState } from "@/harness/portal-component-workbench";

type SurfaceContext = {
  degraded: boolean;
  empty: boolean;
  error: boolean;
  loading: boolean;
  payload: Record<string, any>;
  restricted: boolean;
  saving: boolean;
  selected: PortalWorkbenchFixtureState;
};

type SurfaceEntry = {
  componentId: string;
  component: Component;
  listeners?: Record<string, (...args: any[]) => void>;
  props: (context: SurfaceContext) => Record<string, any>;
};

const props = defineProps<{
  selected: PortalWorkbenchFixtureState;
}>();

const componentRegistry: SurfaceEntry[] = [
  {
    componentId: "overview.hero",
    component: OverviewHero,
    props: (context) => ({
      accountStatus: context.restricted ? "需处理" : "正常",
      billingStatus: context.restricted ? "需充值" : "钱包可用",
      canEnterWorkbench: !context.restricted,
      canStartChargeableRun: !context.restricted,
      entitlementStatus: "可用",
      selectedPlanName: context.restricted ? "未选择" : "基础套餐",
      serverPlansReady: !context.loading,
      workbenchHref: "/portal/opl",
    }),
  },
  {
    componentId: "overview.financial_metrics",
    component: OverviewFinancialMetricsPanel,
    props: (context) => ({
      availableBalance: yuan(context.empty ? 0 : 480),
      balance: yuan(context.empty ? 0 : 520),
      frozenAmount: yuan(context.empty ? 0 : 40),
      sessionCount: context.empty ? 0 : 8,
      taskCount: context.empty ? 0 : 5,
      taskProgressText: context.empty ? "暂无任务" : "3 个已完成",
      todaySpend: yuan(context.empty ? 0 : 18.6),
      totalSpend: yuan(context.empty ? 0 : 326.8),
    }),
  },
  {
    componentId: "overview.managed_environment",
    component: OverviewManagedEnvironmentPanel,
    props: (context) => ({
      auditStatusText,
      bindings: context.empty ? [] : resourceBindings(context),
      displayFileSpace,
      displayPlan,
      fileSpaceStatus: context.empty ? "待开通" : "10GB 文件空间可用",
      humanizeStatus: statusText,
      loading: context.loading,
      managedEnvironmentStatus: context.empty ? "待开通" : "可用",
      money: yuan,
      statusBadge,
    }),
  },
  {
    componentId: "overview.recent_runs",
    component: OverviewRecentRunsPanel,
    props: (context) => ({
      humanizeStatus: statusText,
      items: context.empty ? [] : latestRuns(),
      nextTo: routeQuery(context, { runs_page: 1 }),
      page: 1,
      previousTo: routeQuery(context, { runs_page: 1 }),
      statusBadge,
      total: context.empty ? 0 : latestRuns().length,
      totalPages: 1,
    }),
  },
  {
    componentId: "overview.plans",
    component: OverviewPlansPanel,
    props: (context) => ({
      lowestHourlyPrice: yuan(context.empty ? 0 : 3.2),
      purchasableCount: context.empty ? 0 : 2,
      quotedCount: context.empty ? 0 : 2,
      selectedPlanName: context.empty ? "未选择" : "基础套餐",
    }),
  },
  {
    componentId: "overview.workspace",
    component: OverviewWorkspacePanel,
    props: (context) => ({
      humanizeStatus: statusText,
      items: context.empty ? [] : taskCards(),
      statusBadge,
    }),
  },
  {
    componentId: "billing.hero",
    component: BillingHero,
    props: (context) => ({
      billingExportHref: "/portal/billing/export.csv",
      microMoney: yuan,
      money: yuan,
      payload: billingPayload(context),
      taskExportHref: "/portal/billing/tasks-export.csv",
    }),
  },
  {
    componentId: "billing.cost_breakdown",
    component: BillingCostBreakdownPanel,
    props: (context) => ({
      componentCostHint: context.degraded ? "等待账单核对回补" : "账单核对已接入",
      microMoney: yuan,
      payload: billingPayload(context),
      sourceBackfilledValue: (value: number | undefined) => context.degraded ? "待回补" : yuan(value),
      sourceBackfillHint: context.degraded ? "等待账单核对回补" : "账单核对已接入",
    }),
  },
  {
    componentId: "billing.trend_filter",
    component: BillingTrendAndFilterPanel,
    listeners: noopListeners(["update:filterFrom", "update:filterTo", "apply", "reset"]),
    props: (context) => ({
      currentFrom: "2026-05-01",
      currentTo: "2026-05-13",
      filterFrom: "2026-05-01",
      filterTo: "2026-05-13",
      loading: context.loading,
      trendChartData: context.empty || context.loading ? null : trendChartData(),
    }),
  },
  {
    componentId: "billing.workspace_costs",
    component: BillingWorkspaceCostPanel,
    props: (context) => ({
      billingQuery: (updates: Record<string, PortalQueryValue>) => routeQuery(context, updates),
      items: billingPayload(context).taskCosts,
      loading: context.loading,
      microMoney: yuan,
      nextPage,
      pagination: billingPayload(context).taskPagination,
      previousPage,
    }),
  },
  {
    componentId: "billing.run_costs",
    component: BillingRunCostPanel,
    props: (context) => ({
      billingQuery: (updates: Record<string, PortalQueryValue>) => routeQuery(context, updates),
      humanizeStatus: statusText,
      items: billingPayload(context).runCosts,
      loading: context.loading,
      microMoney: yuan,
      nextPage,
      pagination: billingPayload(context).runPagination,
      previousPage,
      statusBadge,
    }),
  },
  {
    componentId: "billing.ledger",
    component: BillingLedgerPanel,
    props: (context) => ({
      billingQuery: (updates: Record<string, PortalQueryValue>) => routeQuery(context, updates),
      humanizeLedgerType: ledgerType,
      items: billingPayload(context).ledger,
      loading: context.loading,
      money: yuan,
      nextPage,
      pagination: billingPayload(context).ledgerPagination,
      previousPage,
    }),
  },
  {
    componentId: "resources.hero",
    component: ResourcesHero,
    listeners: noopListeners(["reload"]),
    props: (context) => ({
      balanceFreezeStatus: context.degraded ? "待核对" : "冻结金额充足",
      currentConcurrencyText: "1 个任务",
      currentComputeSpec: "2 核 4GB",
      currentFileSpaceText: context.empty ? "待开通" : "10GB 文件空间",
      currentPlanName: context.empty ? "未选择" : "基础套餐",
      estimatedCostText: yuan(context.degraded ? 0 : 18.6),
      resourcesLoading: context.loading,
    }),
  },
  {
    componentId: "resources.plan_selection",
    component: ResourcesPlanSelectionPanel,
    listeners: noopListeners(["setAdjustmentPlan"]),
    props: (context) => ({
      currentPlanId: context.empty ? "" : "starter_2c4g_10gb",
      planCards: context.empty ? [] : planCards(),
    }),
  },
  {
    componentId: "resources.adjustment",
    component: ResourcesAdjustmentPanel,
    listeners: noopListeners(["setAdjustmentPlan"]),
    props: () => ({}),
  },
  {
    componentId: "resources.current",
    component: ResourcesCurrentPanel,
    props: (context) => ({
      computeSpecText,
      concurrencyText,
      currentStatus: context.empty ? "pending" : "active",
      items: context.empty ? [] : resourceBindings(context),
      planLabel,
      protectionEstimateText,
      statusBadge,
      statusText,
      storageCapacityText,
      workspaceDisplayName,
    }),
  },
  {
    componentId: "resources.release_audit",
    component: ResourcesReleaseAuditPanel,
    props: (context) => ({
      auditStatusText,
      currentProtection: context.empty ? null : protectionFreeze(context),
      releasePolicyText: context.empty ? "待释放" : "按需释放后停止计费",
      stopBillingText: context.empty ? "待释放" : "待释放",
    }),
  },
  {
    componentId: "workspace.hero",
    component: WorkspaceHero,
    props: (context) => ({
      downloadAllHref: (kind: "inputs" | "outputs") => `/portal/workspace/download-all?kind=${encodeURIComponent(kind)}`,
      estimatedCostText: workspaceMoney(workspaceEstimatedCost(context)),
      humanizeStatus: statusText,
      isActiveWorkspace: !context.restricted,
      isArchivedWorkspace: context.restricted,
      payload: workspacePayload(context),
      statusBadge,
      workspaceMasHref: (task?: string) => `/portal/opl${task ? `?task=${encodeURIComponent(task)}` : ""}`,
    }),
  },
  {
    componentId: "workspace.file_space",
    component: WorkspaceFileSpacePanel,
    props: (context) => ({
      currentFolderName: "全部文件",
      fileKindText: (value?: string) => value === "output" ? "输出文件" : "输入文件",
      fileProtectionText: (file: { status?: string; retentionUntil?: string }) => file.status === "retention_protected" ? `保护期至 ${file.retentionUntil || "2026-05-20"}` : statusText(file.status || "active"),
      fileSourceText: (file: { source?: string; artifactRef?: string }) => file.source === "runtime_output" || file.artifactRef ? "运行轨迹" : "上传文件",
      fileSpaceRetentionDays: 7,
      fileSpaceUsageText: context.empty ? "文件空间未开通" : "已用 2GB，总量 10GB",
      humanizeStatus: statusText,
      payload: workspacePayload(context),
      selectedFileCount: context.empty ? 0 : 1,
      storageEntitlement: storageEntitlement(context),
    }),
  },
  {
    componentId: "workspace.managed_plan",
    component: WorkspaceManagedPlanPanel,
    props: (context) => ({
      auditStatusText,
      humanizeStatus: statusText,
      managedPlan: context.empty ? null : managedPlan(context),
      money: workspaceMoney,
      releasePolicyText: (value?: string) => value === "not_released" ? "未释放" : "释放处理中",
      snapshotText: (realResourceCreated?: boolean) => realResourceCreated ? "已创建" : "计划快照",
      statusBadge,
    }),
  },
  {
    componentId: "workspace.list",
    component: WorkspaceListPanel,
    props: (context) => ({
      humanizeStatus: statusText,
      nextPage,
      payload: workspacePayload(context),
      previousPage,
      statusBadge,
      workspaceQuery: (updates: Record<string, PortalQueryValue>) => routeQuery(context, updates),
    }),
  },
  {
    componentId: "workspace.files",
    component: WorkspaceFilesPanel,
    props: (context) => ({
      costEstimateText: (item: { costEstimate?: { amount?: number; currency?: string } }) => workspaceMoney(item.costEstimate?.amount, item.costEstimate?.currency),
      downloadFileHref: (kind: "inputs" | "outputs", fileName: string) => `/portal/workspace/download-file?kind=${encodeURIComponent(kind)}&file=${encodeURIComponent(fileName)}`,
      hasLinkedTask: (item: { runId?: string }) => Boolean(item.runId),
      linkedTaskText: (item: { runId?: string }) => item.runId ? "已关联" : "已记录",
      payload: workspacePayload(context),
      rechargeStatusText: (value?: string) => value === "display_only" ? "仅展示" : "待估算",
      uploadAction: "/portal/workspace/upload",
    }),
  },
  {
    componentId: "trace.hero",
    component: TraceHero,
    props: (context) => ({
      businessFactSource: "运行记录",
      customerDefaultLangfuseUi: false,
      estimatedCostText: workspaceMoney(context.empty ? 0 : 10.3),
      outputCount: context.empty ? 0 : 1,
      runCount: context.empty ? 0 : 1,
      sessionCount: context.empty ? 0 : traceItems(context).length,
    }),
  },
  {
    componentId: "trace.filter",
    component: TraceFilterPanel,
    listeners: noopListeners(["apply", "reset", "updateFilter"]),
    props: () => ({
      filters: {
        sessionId: "",
        status: "",
        workspaceId: "",
      },
    }),
  },
  {
    componentId: "trace.session_table",
    component: TraceSessionTablePanel,
    props: (context) => ({
      costEstimateText: traceCost,
      displayIndex: (index: number) => String(Number(index || 0) + 1),
      humanizeStatus: statusText,
      items: traceItems(context),
      linkedOutputFiles: (item: SessionTracesPayload["items"][number]) => item.linkedOutputFiles || item.files?.linkedOutputFiles || [],
      nextPage,
      pagination: pagination(traceItems(context).length),
      previousPage,
      rechargeStatusText: (value?: string) => value === "display_only" ? "仅展示" : "待估算",
      statusBadge,
      traceCount: traceItems(context).length,
      traceQuery: (updates: Record<string, PortalQueryValue>) => routeQuery(context, updates),
    }),
  },
  {
    componentId: "admin.system.site_settings",
    component: AdminSiteSettingsPanel,
    listeners: noopListeners(["submit"]),
    props: (context) => ({
      error: context.error ? "站点设置保存失败，请检查输入。" : "",
      message: context.saving ? "正在保存站点设置。" : "",
      model: siteSettingsModel(context),
      saving: context.saving,
    }),
  },
  {
    componentId: "admin.system.service_status",
    component: AdminServiceStatusPanel,
    props: (context) => ({
      failedServices: context.empty ? 0 : 1,
      masReplyLabel: context.empty ? "-" : "860 ms",
      opsSurfaceEnabled: true,
      responseLabel: (value: number | null | undefined) => value == null ? "-" : `${Number(value)} ms`,
      securityChecks: context.empty ? [] : [
        { key: "默认密码", healthy: true, detail: "已关闭默认密码。" },
        { key: "注册开关", healthy: true, detail: "注册入口由管理台控制。" },
      ],
      securityGapCount: context.empty ? 0 : 0,
      serviceCards: context.empty ? [] : [
        { name: "Portal", ok: true, status: "ready", source: "内部诊断", kind: "主链路探测", responseMs: 42 },
        { name: "OPL", ok: true, status: "ready", source: "内部诊断", kind: "主链路探测", responseMs: 86 },
      ],
      serviceCount: context.empty ? 0 : 2,
      systemMetrics: context.empty ? {} : { hostname: "portal-local", uptimeHours: 12, freeMemoryGb: 6.5, dbMode: "sqlite" },
    }),
  },
  {
    componentId: "admin.dashboard.summary",
    component: AdminDashboardSummaryPanel,
    props: (context) => ({
      alerts: context.empty ? [] : [
        { category: "billing", title: "待核对账单", detail: "1 个任务等待账单核对。", severity: "warning" },
      ],
      kpis: context.empty ? {} : {
        averageResponseMs: 860,
        historicalTotalCost: 326.8,
        todayNewUsers: 2,
        todayNewWorkspaces: 3,
        todayRuns: 6,
        todayTotalCost: 18.6,
        totalRuns: 28,
        totalUsers: 12,
        workspaceTotal: 16,
      },
      money: yuan,
      opsSurfaceEnabled: true,
      responseLabel: context.empty ? "未记录" : "860 ms",
      usageRows: context.empty ? [] : adminUsageRows(),
    }),
  },
  {
    componentId: "admin.users.table",
    component: AdminUsersTablePanel,
    listeners: noopListeners(["applyFilters", "copyInternalId", "openCreate", "openEdit", "openMore", "openSettings", "resetFilters", "toggleUser", "updateFilter"]),
    props: (context) => ({
      copiedUserId: "",
      filters: {
        email: "",
        userId: "",
        username: "",
        workspace: "",
      },
      nextPage,
      payload: adminUsersPayload(context),
      previousPage,
      refreshing: context.loading,
      submittingAction: "",
      usersQuery: (updates: Record<string, PortalQueryValue>) => routeQuery(context, updates),
    }),
  },
  {
    componentId: "admin.billing_ops.summary",
    component: AdminBillingOpsSummaryPanel,
    props: (context) => ({
      adjustmentLabel: ledgerType,
      money: (value: number | undefined, digits = 5) => `¥${Number(value || 0).toFixed(digits)}`,
      opsSurfaceEnabled: true,
      payload: adminBillingOpsPayload(context),
      sourceLabel: (value?: string) => value && value !== "metering pending" ? value : "计量待回补",
    }),
  },
  {
    componentId: "admin.usage.table",
    component: AdminUsageTablePanel,
    props: (context) => {
      const rows = context.empty ? [] : adminUsageRows();
      const failedCount = rows.filter((item) => String(item.status || "").toLowerCase() === "failed").length;
      const successCount = rows.filter((item) => String(item.status || "").toLowerCase() === "completed").length;
      const averageCost = rows.length ? rows.reduce((sum, item) => sum + Number(item.totalCost || 0), 0) / rows.length : 0;
      return {
        averageCost,
        failedCount,
        money: yuan,
        opsSurfaceEnabled: true,
        payload: {
          items: rows,
          pagination: pagination(rows.length),
        },
        statusLabel: statusText,
        statusTone,
        successCount,
      };
    },
  },
  {
    componentId: "admin.audit.table",
    component: AdminAuditTablePanel,
    listeners: noopListeners(["nextPage", "previousPage", "update:keyword", "update:pageSize"]),
    props: (context) => {
      const items = context.empty ? [] : adminAuditRows();
      return {
        auditTypeLabel,
        currentPage: 1,
        items,
        keyword: "",
        pageSize: 10,
        payload: {
          items,
          pagination: pagination(items.length, 10),
        },
        runCount: items.filter((item) => String(item.type || "").includes("run")).length,
        settingsCount: items.filter((item) => String(item.type || "").includes("settings")).length,
        shortDetail: (value?: string) => String(value || "-").slice(0, 84),
        sourceLabel: auditSourceLabel,
        totalPages: 1,
        workspaceCount: items.filter((item) => String(item.type || "").includes("workspace")).length,
      };
    },
  },
];

const registryById = new Map(componentRegistry.map((item) => [item.componentId, item]));

const entry = computed(() => {
  const context = buildContext();
  const renderer = registryById.get(props.selected.componentId);
  if (!renderer) {
    throw new Error(`Portal component fixture renderer missing: ${props.selected.componentId}`);
  }
  return {
    component: renderer.component,
    listeners: renderer.listeners || {},
    props: renderer.props(context),
  };
});

function buildContext(): SurfaceContext {
  const state = props.selected.state;
  const payload = props.selected.payload && typeof props.selected.payload === "object"
    ? props.selected.payload as Record<string, any>
    : {};
  return {
    degraded: state === "degraded",
    empty: state === "empty",
    error: state === "error",
    loading: state === "loading",
    payload,
    restricted: state === "restricted",
    saving: state === "saving",
    selected: props.selected,
  };
}

function noopListeners(names: string[]) {
  return Object.fromEntries(names.map((name) => [name, () => undefined]));
}

function pagination(total: number, pageSize = 5): PortalPagination {
  return {
    page: 1,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

function previousPage(page: number) {
  return Math.max(1, Number(page || 1) - 1);
}

function nextPage(page: number, totalPages: number) {
  return Math.min(Number(totalPages || 1), Number(page || 1) + 1);
}

function routeQuery(context: SurfaceContext, updates: Record<string, PortalQueryValue>): RouteLocationRaw {
  return {
    path: context.selected.statePath,
    query: Object.fromEntries(Object.entries(updates).filter(([, value]) => value !== undefined && value !== null && value !== "")) as Record<string, string | number>,
  };
}

function yuan(value?: number) {
  return `¥${Number(value || 0).toFixed(2)}`;
}

function workspaceMoney(value?: number, currency = "CNY") {
  return `${Number(value || 0).toFixed(2)} ${currency}`;
}

function statusText(status?: string) {
  const normalized = String(status || "").toLowerCase();
  if (["active", "running"].includes(normalized)) return "运行中";
  if (["completed", "success", "finished", "settled", "done", "matched"].includes(normalized)) return "已完成";
  if (["failed", "error"].includes(normalized)) return "失败";
  if (["archived", "released"].includes(normalized)) return normalized === "released" ? "已释放" : "已归档";
  if (["disabled", "inactive"].includes(normalized)) return "已停用";
  if (["pending", "not_started"].includes(normalized)) return "待处理";
  return status || "未知";
}

function statusBadge(status?: string) {
  const normalized = String(status || "").toLowerCase();
  if (["active", "completed", "success", "finished", "settled", "done", "matched", "released"].includes(normalized)) return "badge-success";
  if (["failed", "error", "disabled", "deleted"].includes(normalized)) return "badge-danger";
  if (["running"].includes(normalized)) return "badge-primary";
  return "badge-warning";
}

function statusTone(status?: string): "success" | "warning" | "danger" | "primary" {
  const normalized = String(status || "").toLowerCase();
  if (["completed", "success", "finished"].includes(normalized)) return "success";
  if (["failed", "error"].includes(normalized)) return "danger";
  if (["running", "active"].includes(normalized)) return "primary";
  return "warning";
}

function ledgerType(type = "") {
  if (type === "topup") return "充值";
  if (type === "resource_charge") return "托管运行环境消费";
  if (type === "refund") return "退款";
  if (type === "makeup_charge") return "补扣";
  return type || "-";
}

function auditStatusText(status?: string) {
  if (status === "audit_pending" || status === "pending") return "待审计";
  if (status === "audit_ready" || status === "matched") return "可审计";
  if (status === "audited" || status === "done") return "已审计";
  return "未开始";
}

function displayPlan(item: WorkspaceResourceBinding) {
  return planLabel(item.computeInstance?.serverPlanId);
}

function displayFileSpace(item: WorkspaceResourceBinding) {
  return storageCapacityText(item.storageBucket);
}

function planLabel(planId?: string) {
  return String(planId || "") === "pro_8c16g_100gb" ? "Pro 套餐" : "基础套餐";
}

function computeSpecText(row?: Partial<CustomerComputeResource> | null) {
  if (row?.serverPlanId === "pro_8c16g_100gb") return "8 核 16GB";
  return "2 核 4GB";
}

function storageCapacityText(row?: Partial<CustomerStorageResource> | null) {
  const value = Number(row?.storageCapacityGb || 10);
  return `${value}GB 文件空间`;
}

function concurrencyText(planId?: string) {
  return planId === "pro_8c16g_100gb" ? "2 个任务" : "1 个任务";
}

function protectionEstimateText(protection?: WeeklyProtectionFreeze | null) {
  return yuan(protection?.weeklyAmount || protection?.frozenAmount || 0);
}

function workspaceDisplayName(value?: string) {
  return value ? "工作空间 1" : "工作空间";
}

function planCards() {
  return [
    {
      id: "starter_2c4g_10gb",
      name: "基础套餐",
      description: "适合轻量会话和小型任务。",
      computeSpec: "2 核 4GB",
      fileSpace: "10GB 文件空间",
      concurrency: "1 个任务",
      estimatedCost: "每小时 ¥3.20",
    },
    {
      id: "pro_8c16g_100gb",
      name: "Pro 套餐",
      description: "适合较大任务和更多输出文件。",
      computeSpec: "8 核 16GB",
      fileSpace: "100GB 文件空间",
      concurrency: "2 个任务",
      estimatedCost: "每小时 ¥9.60",
    },
  ];
}

function taskCards(): OverviewPayload["taskCards"] {
  return [
    { slug: "workspace-1", title: "科研工作空间", status: "active", runCount: 3, updatedAt: "2026-05-13 10:30" },
    { slug: "workspace-2", title: "验证工作空间", status: "archived", runCount: 1, updatedAt: "2026-05-12 18:20" },
  ];
}

function latestRuns(): OverviewPayload["latestRuns"] {
  return [
    { runId: "run-1", workspaceId: "workspace-1", workspaceTitle: "科研工作空间", status: "completed", createdAt: "2026-05-13 10:00", displayTime: "2026-05-13 10:00" },
    { runId: "run-2", workspaceId: "workspace-1", workspaceTitle: "科研工作空间", status: "running", createdAt: "2026-05-13 11:00", displayTime: "2026-05-13 11:00" },
  ];
}

function billingPayload(context: SurfaceContext): BillingPayload {
  const empty = context.empty || context.loading;
  const taskCosts = empty ? [] : [
    { slug: "workspace-1", title: "科研工作空间", totalCost: 18.6, cpuCost: 12.2, gpuCost: 0, storageCost: 6.4, runCount: 3 },
    { slug: "workspace-2", title: "验证工作空间", totalCost: 8.2, cpuCost: 7.2, gpuCost: 0, storageCost: 1, runCount: 1 },
  ];
  const runCosts = empty ? [] : [
    { runId: "run-1", workspaceId: "workspace-1", cpuCost: 8.2, gpuCost: 0, storageCost: 2.1, totalCost: 10.3, startedAt: "2026-05-13 10:00", endedAt: "2026-05-13 10:20", pricingSource: "账单估算", runStatus: "completed" },
    { runId: "run-2", workspaceId: "workspace-1", cpuCost: 3.2, gpuCost: 0, storageCost: 0.8, totalCost: 4, startedAt: "2026-05-13 11:00", endedAt: "", pricingSource: "账单估算", runStatus: "running" },
  ];
  const ledger = empty ? [] : [
    { id: "ledger-1", type: "topup", amount: 500, reason: "管理员手动充值", createdAt: "2026-05-13 09:00" },
    { id: "ledger-2", type: "resource_charge", amount: -18.6, reason: "任务执行扣费", createdAt: "2026-05-13 10:30" },
    { id: "ledger-3", type: "refund", amount: 12, reason: "人工退款", createdAt: "2026-05-13 11:20" },
  ];
  return {
    wallet: {
      activeFreeze: empty ? 0 : 40,
      availableBalance: empty ? 0 : 480,
      balance: empty ? 0 : 520,
      frozen: empty ? 0 : 40,
      trialRemaining: 0,
    },
    totals: { cpuCost: empty ? 0 : 19.4, gpuCost: 0, pvCost: empty ? 0 : 7.4, totalCost: empty ? 0 : 26.8 },
    breakdown: { cloudSource: context.degraded ? "pending" : "tencent_cloud", cpuCost: empty ? 0 : 19.4, gpuCost: 0, otherCloudCost: 0, storageCost: empty ? 0 : 7.4, trafficCost: 0, vpnCost: 0 },
    summary: { exactCost: empty ? 0 : 26.8, pendingCost: context.degraded ? 8.2 : 0, runCount: runCosts.length, selectedCost: empty ? 0 : 26.8, workspaceCount: taskCosts.length },
    supportBoundary: {
      actionRequired: context.restricted ? ["请联系管理员充值"] : [],
      amounts: { activeFreeze: empty ? 0 : 40, availableBalance: empty ? 0 : 480, minRequiredBalance: 20, walletBalance: empty ? 0 : 520 },
      billingCopy: context.restricted ? "余额不足时不能启动新任务。" : "余额可支持新任务。",
      canDownloadExistingOutput: true,
      canStartPaidRun: !context.restricted,
      failedRunBillingStatus: "not_charged",
      fileRetentionStatus: "active",
      fundingStatus: context.restricted ? "insufficient" : "ready",
      graceStatus: "active",
      supportStatus: "active",
      userCopy: context.restricted ? "请联系管理员充值。" : "可以继续使用工作台。",
    },
    taskCosts,
    taskPagination: pagination(taskCosts.length),
    runCosts,
    runPagination: pagination(runCosts.length),
    ledger,
    ledgerPagination: pagination(ledger.length),
    filter: { from: "2026-05-01", range: "month", to: "2026-05-13" },
    trend: empty ? { cpu: [], gpu: [], labels: [], storage: [], total: [] } : { cpu: [4, 5, 6], gpu: [0, 0, 0], labels: ["05-11", "05-12", "05-13"], storage: [1, 2, 3], total: [5, 7, 9] },
    todayCost: empty ? 0 : 18.6,
  };
}

function trendChartData(): ChartData<"bar"> {
  return {
    labels: ["05-11", "05-12", "05-13"],
    datasets: [
      { label: "总成本", data: [5, 7, 9], backgroundColor: "#0f766e" },
      { label: "CPU", data: [4, 5, 6], backgroundColor: "#0ea5e9" },
      { label: "文件空间", data: [1, 2, 3], backgroundColor: "#10b981" },
    ],
  };
}

function protectionFreeze(context: SurfaceContext): WeeklyProtectionFreeze {
  return {
    computeInstanceId: "compute-1",
    consumedAmount: context.degraded ? 40 : 18.6,
    createdAt: "2026-05-13",
    frozenAmount: 80,
    id: "freeze-1",
    reconcile120MinStatus: context.degraded ? "pending" : "matched",
    releasedAmount: 0,
    remainingAmount: context.degraded ? 0 : 61.4,
    resourceBindingId: "binding-1",
    status: context.degraded ? "pending" : "active",
    storageBucketId: "storage-1",
    tPlus1AuditStatus: context.degraded ? "audit_pending" : "audit_ready",
    updatedAt: "2026-05-13",
    usageMode: "workspace",
    weeklyAmount: 80,
    windowEndAt: "2026-05-20",
    windowStartAt: "2026-05-13",
    workspaceId: "workspace-1",
  };
}

function resourceBindings(context: SurfaceContext): WorkspaceResourceBinding[] {
  return [
    {
      bindingAccess: {
        fullRuntime: { allowed: true, bindingRequired: true, reason: "ready" },
        oplLite: { allowed: true, bindingRequired: false, reason: "ready" },
        workspaceFiles: { allowed: true, bindingRequired: true, reason: "ready" },
        workspaceOutputs: { allowed: true, bindingRequired: true, reason: "ready" },
        workspaceTasks: { allowed: true, bindingRequired: true, reason: "ready" },
      },
      computeInstance: {
        createdAt: "2026-05-13",
        id: "compute-1",
        instanceId: "compute-1",
        instanceType: "S2.MEDIUM4",
        region: "ap-guangzhou",
        serverPlanId: "starter_2c4g_10gb",
        status: context.degraded ? "pending" : "active",
      },
      computeInstanceId: "compute-1",
      computeInstances: [],
      createdAt: "2026-05-13",
      id: "binding-1",
      protection: protectionFreeze(context),
      resourceBindingId: "binding-1",
      rootPrefix: "workspace-1",
      status: context.degraded ? "pending" : "active",
      storageBucket: {
        bucketId: "storage-1",
        bucketName: "workspace-files",
        id: "storage-1",
        region: "ap-guangzhou",
        status: "active",
        storageCapacityGb: 10,
      },
      storageBucketId: "storage-1",
      storageBuckets: [],
      updatedAt: "2026-05-13",
      workspaceId: "workspace-1",
    },
  ];
}

function storageEntitlement(context: SurfaceContext): StorageEntitlementPayload {
  return {
    enabled: !context.empty && !context.restricted,
    freeQuotaGb: 0,
    message: context.restricted ? "文件空间受限" : "文件空间可用",
    minimumPurchaseGb: 10,
    resourceOrderId: "",
    retentionPolicy: "seven_day_protection",
    status: context.restricted ? "disabled" : "active",
    storagePlanId: "starter-storage",
    storageSizeGb: context.empty || context.restricted ? 0 : 10,
  };
}

function managedPlan(context: SurfaceContext): ManagedResourceBindingPlanPayload {
  return {
    auditStatus: { auditReadyAt: "2026-05-14", policy: "次日审计", status: context.degraded ? "audit_pending" : "audit_ready" },
    estimatedCost: { amount: 18.6, billingTruth: false, chargeApplied: false, currency: "CNY", source: "fixture", status: "estimated" },
    managedEnvironment: "workspace-runtime",
    planSpec: "2 核 4GB，10GB 文件空间",
    regionLabel: "广州",
    releasePolicy: { billingStopConfirmBy: "2026-05-13 18:00", protection: "seven_day_protection", releasedAt: "", status: "not_released", stopBillingConfirmWithinMinutes: 30 },
    resourceBindingId: "binding-1",
    snapshot: { label: "计划快照", providerAdapterStage: "fixture", realResourceCreated: false, source: "harness" },
    status: context.degraded ? "pending" : "active",
  };
}

function workspacePayload(context: SurfaceContext): WorkspacePayload {
  const empty = context.empty || context.loading;
  const restricted = context.restricted;
  const files = empty ? [] : [
    { fileRef: "file-input-1", name: "input-study.csv", folderRef: "folder-root", kind: "input", source: "upload", runId: "", sessionId: "", artifactRef: "", sizeBytes: 2048, status: "active", deletedAt: "", retentionUntil: "" },
    { fileRef: "file-output-1", name: "result-summary.csv", folderRef: "folder-root", kind: "output", source: "runtime_output", runId: "run-1", sessionId: "session-1", artifactRef: "artifact-1", sizeBytes: 2048, status: "active", deletedAt: "", retentionUntil: "" },
  ];
  const outputs = empty ? [] : [
    {
      artifactRef: "artifact-1",
      balanceLink: { availableBalanceCents: 48000, balanceCents: 52000, chargeApplied: false, currency: "CNY", estimatedAmount: 10.3, estimateOnly: true, linkedToBalance: true, rechargeStatus: "display_only" },
      contentType: "text/csv",
      costEstimate: { amount: 10.3, billingTruth: false, components: { compute: 8.2, storage: 2.1, total: 10.3 }, currency: "CNY", pendingReconciliation: true, pricingSource: "estimate", source: "fixture", status: "estimated" },
      createdAt: "2026-05-13",
      fileRef: "file-output-1",
      fullPath: "/outputs/result-summary.csv",
      kind: "output",
      name: "result-summary.csv",
      resourceUsage: { costItemCount: 1, inputFileCount: 2, latencyMs: 800, outputBytes: 2048, outputFileCount: 1, runId: "run-1", sessionId: "session-1", source: "fixture", status: "completed", workspaceId: "workspace-1" },
      runId: "run-1",
      sessionId: "session-1",
      sizeBytes: 2048,
      source: "runtime_output",
      status: "active",
      updatedAt: "2026-05-13",
      workspaceId: "workspace-1",
    },
  ];
  return {
    activeSession: null,
    costs: { cpuCost: empty ? 0 : 8.2, gpuCost: 0, pvCost: empty ? 0 : 2.1, totalCost: empty ? 0 : 10.3 },
    counts: { completedRuns: empty ? 0 : 2, inputs: empty ? 0 : 2, outputs: empty ? 0 : 1, runs: empty ? 0 : 3 },
    distribution: { inputBytes: empty ? 0 : 2048, outputBytes: empty ? 0 : 4096 },
    eventTimeline: [],
    files: empty ? [] : [{ fullPath: "/inputs/input-study.csv", name: "input-study.csv" }, { fullPath: "/inputs/protocol.md", name: "protocol.md" }],
    filesPagination: pagination(empty ? 0 : 2),
    fileSpace: empty ? null : {
      actions: { batchDelete: true, batchDownload: true, clearFileSpaceRequiresConfirmation: true, createFolder: true, deleteFileOrFolder: true, moveFileOrFolder: true, permanentDeleteRequiresConfirmation: true, renameFolder: true, selectFiles: true, uploadToCurrentFolder: true },
      capacityGb: restricted ? 0 : 10,
      currentFolderRef: "folder-root",
      deletePolicy: { clearFileSpaceRequiresConfirmation: true, ordinaryDeleteRequiresConfirmation: false, permanentDeleteRequiresConfirmation: true, retentionDays: 7 },
      files,
      folders: [{ folderRef: "folder-root", name: "全部文件", parentFolderRef: "", path: "/", status: "active" }],
      retentionDays: 7,
      selectedFileRefs: files.slice(0, 1).map((item) => item.fileRef),
      usedGb: restricted ? 0 : 2,
    },
    managedResourceBindingPlan: empty ? null : managedPlan(context),
    outputs,
    outputsPagination: pagination(outputs.length),
    recentRuns: empty ? [] : [{ runId: "run-1", status: "completed", createdAt: "2026-05-13", costEstimate: outputs[0].costEstimate, balanceLink: outputs[0].balanceLink, resourceUsage: outputs[0].resourceUsage }],
    runStatus: { completed: empty ? 0 : 2, running: empty ? 0 : 1 },
    runsPagination: pagination(empty ? 0 : 3),
    storageEntitlement: storageEntitlement(context),
    tasks: taskCards().map((item) => ({ ...item, inputs: 2, outputs: 1, runs: item.runCount, totalCost: 10.3 })),
    tasksPageRows: empty ? [] : taskCards().map((item) => ({ ...item, inputs: 2, outputs: 1, runs: item.runCount, totalCost: 10.3 })),
    tasksPagination: pagination(empty ? 0 : 2),
    taskTreemap: [],
    workspace: { archivedAt: restricted ? "2026-05-13" : null, createdAt: "2026-05-10", deletedAt: null, slug: "workspace-1", status: restricted ? "archived" : "active", storageEntitlement: storageEntitlement(context), title: "科研工作空间" },
  };
}

function workspaceEstimatedCost(context: SurfaceContext) {
  return workspacePayload(context).outputs.reduce((sum, item) => sum + Number(item.costEstimate?.amount || 0), 0);
}

function traceItems(context: SurfaceContext): SessionTracesPayload["items"] {
  if (context.empty || context.loading) return [];
  return [
    {
      balanceLink: { availableBalanceCents: 48000, balanceCents: 52000, chargeApplied: false, currency: "CNY", estimatedAmount: 10.3, estimateOnly: true, linkedToBalance: true, rechargeStatus: "display_only" },
      businessStatus: "completed",
      costEstimate: { amount: 10.3, billingTruth: false, components: { compute: 8.2, storage: 2.1, total: 10.3 }, currency: "CNY", pendingReconciliation: true, pricingSource: "estimate", source: "fixture", status: "estimated" },
      files: {
        inputsCount: 2,
        linkedOutputCount: 1,
        linkedOutputFiles: [{ artifactRef: "artifact-1", contentType: "text/csv", fileRef: "file-output-1", kind: "output", name: "result-summary.csv", runId: "run-1", sessionId: "session-1", sizeBytes: 2048, source: "runtime_output", status: "active", workspaceId: "workspace-1" }],
        outputsCount: 1,
      },
      inputPreview: "输入文件 2 个",
      latencyMs: 840,
      linkedOutputFiles: [{ artifactRef: "artifact-1", contentType: "text/csv", fileRef: "file-output-1", kind: "output", name: "result-summary.csv", runId: "run-1", sessionId: "session-1", sizeBytes: 2048, source: "runtime_output", status: "active", workspaceId: "workspace-1" }],
      model: "gflab-default",
      resourceUsage: { costItemCount: 1, inputFileCount: 2, latencyMs: 840, outputBytes: 2048, outputFileCount: 1, runId: "run-1", sessionId: "session-1", source: "fixture", status: "completed", tokenCount: 1200, workspaceId: "workspace-1" },
      runId: "run-1",
      sessionId: "session-1",
      startedAt: "2026-05-13 10:00",
      status: "completed",
      title: "结直肠癌数据初筛",
      tokenCount: 1200,
      traceId: "trace-1",
      traceName: "分析任务",
      url: "",
      userAgent: "fixture",
      userId: "user-1",
      workspaceId: "workspace-1",
      workspaceSessionId: "workspace-session-1",
      runtimeSessionId: "runtime-session-1",
    },
  ];
}

function traceCost(item: SessionTracesPayload["items"][number]) {
  return workspaceMoney(item.costEstimate?.amount, item.costEstimate?.currency || "CNY");
}

function siteSettingsModel(context: SurfaceContext) {
  return {
    allowRegistration: !context.error,
    homeContent: "OPL 是面向个人科研工作流的开放实验室。MedOPL 提供托管账号、计算资源、文件空间、任务执行和账单管理，让用户直接进入科研工作台。",
    siteLogo: "",
    siteName: "MedOPL",
    siteSubtitle: "托管 OPL 科研工作台",
  };
}

function adminUsersPayload(context: SurfaceContext): AdminUsersPayload {
  const items = context.empty || context.loading ? [] : [
    { balance: 520, createdAt: "2026-05-10", email: "lin@example.test", id: "user-1", lastActiveAt: "2026-05-13 09:40", lastUsedAt: "2026-05-13 09:50", name: "林研究员", role: "user", status: "active" },
    { balance: 86, createdAt: "2026-05-08", email: "chen@example.test", id: "user-2", lastActiveAt: "2026-05-12 17:20", lastUsedAt: "2026-05-12 17:30", name: "陈研究员", role: "user", status: "disabled" },
    { balance: 1240, createdAt: "2026-05-06", email: "wang@example.test", id: "user-3", lastActiveAt: "2026-05-13 08:00", lastUsedAt: "2026-05-13 08:10", name: "王研究员", role: "user", status: "active" },
  ];
  return {
    allowRegistration: true,
    financeRows: context.empty ? [] : [
      { amount: 500, createdAt: "2026-05-13 09:00", id: "finance-1", reason: "管理员手动充值", type: "topup", userId: "user-1", userName: "林研究员" },
      { amount: 80, createdAt: "2026-05-13 10:30", id: "finance-2", reason: "人工退款", type: "refund", userId: "user-2", userName: "陈研究员" },
    ],
    groups: [{ id: "group-basic", name: "基础资源组" }],
    items,
    pagination: pagination(items.length),
  };
}

function adminUsageRows() {
  return [
    { createdAt: "2026-05-13 10:00", cpuCost: 8.2, gpuCost: 0, runId: "run-1", status: "completed", storageCost: 2.1, totalCost: 10.3, userId: "user-1", userName: "林研究员", workspaceId: "workspace-1" },
    { createdAt: "2026-05-13 11:00", cpuCost: 3.2, gpuCost: 0, runId: "run-2", status: "running", storageCost: 0.8, totalCost: 4, userId: "user-2", userName: "陈研究员", workspaceId: "workspace-2" },
  ];
}

function adminBillingOpsPayload(context: SurfaceContext) {
  const empty = context.empty || context.loading;
  return {
    adjustments: empty ? [] : [
      { amount: 80, createdAt: "2026-05-13 10:30", type: "refund", userId: "user-2", userName: "陈研究员", workspaceId: "workspace-2" },
    ],
    billingSync: { autoReconcileEnabled: true, lastAdjustmentCount: empty ? 0 : 1, lastError: "", lastRunAt: empty ? "" : "2026-05-13 11:00", tencentBillingLinked: !context.degraded },
    pending: { count: empty ? 0 : 1 },
    pendingRuns: empty ? [] : [{ customerId: "user-1", pendingHours: 2.5, pricingSource: "metering pending", runId: "run-2", userId: "user-1", workspaceId: "workspace-1" }],
    productProfile: { opsSurfaceEnabled: true },
    summaries: { billing: { cpuCost: 19.4, gpuCost: 0, storageCost: 7.4, totalCost: 26.8 } },
  };
}

function adminAuditRows() {
  return [
    { detail: "管理员更新站点设置。", occurredAt: "2026-05-13 09:00", operatorId: "admin-1", type: "settings_updated", userId: "user-1", workspaceId: "" },
    { detail: "工作空间已归档。", occurredAt: "2026-05-13 10:00", operatorId: "user-1", type: "workspace_archived", userId: "user-1", workspaceId: "workspace-1" },
    { detail: "任务执行完成。", occurredAt: "2026-05-13 10:30", operatorId: "runtime", type: "run_completed", userId: "user-1", workspaceId: "workspace-1" },
  ];
}

function auditTypeLabel(value = "") {
  if (value.includes("settings")) return "配置变更";
  if (value.includes("workspace")) return "工作空间事件";
  if (value.includes("run")) return "运行事件";
  return value || "事件";
}

function auditSourceLabel(value = "") {
  if (value.includes("settings")) return "Portal 配置";
  if (value.includes("workspace")) return "工作空间";
  if (value.includes("run")) return "运行时";
  return "Portal";
}
</script>
