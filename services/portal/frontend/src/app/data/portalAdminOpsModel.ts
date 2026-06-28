import {
  deleteAdminAnnouncement,
  fetchAdminAlerts,
  fetchAdminAudit,
  fetchAdminBillingOps,
  fetchAdminOps,
  fetchAdminOverview,
  fetchAdminSystem,
  markAdminBillingOp,
  normalizePortalAdminActionError,
  saveAdminAnnouncement,
  toggleAdminAnnouncement,
  updateAdminSiteSettings,
} from "../../api/portal/admin";
import { fetchAnnouncements } from "../../api/portal/sessions";
import {
  arrayValue,
  dateText,
  keyPart,
  money,
  numberValue,
  objectValue,
  stringValue,
} from "./portalFormatters";
import { usePortalQuery } from "./portalQuery";

export const adminReadOnlyMessage = "该管理面服务 MedOPL 商业资源控制面；真实云资源、真实扣费或高风险设置仍需单独授权接口。";

export {
  deleteAdminAnnouncement,
  markAdminBillingOp,
  normalizePortalAdminActionError,
  saveAdminAnnouncement,
  toggleAdminAnnouncement,
  updateAdminSiteSettings,
};

function adminAlertSeverity(severity: unknown): "error" | "warning" | "info" {
  const value = String(severity || "").toLowerCase();
  if (["danger", "error", "critical", "failed"].includes(value)) return "error";
  if (["warning", "warn", "pending"].includes(value)) return "warning";
  return "info";
}

function adminBillingType(row: Record<string, any>): "pending" | "anomaly" | "refund" {
  if (row.type === "refund") return "refund";
  if (row.severity) return "anomaly";
  return "pending";
}

function adminBillingStatus(status: unknown): "pending" | "approved" | "rejected" {
  const value = String(status || "").toLowerCase();
  if (value === "approved") return "approved";
  if (value === "rejected") return "rejected";
  return "pending";
}

function adminAuditStatus(type: unknown): "success" | "failed" | "warning" {
  const value = String(type || "");
  if (/fail|error|denied|blocked/i.test(value)) return "failed";
  if (/warning|pending/i.test(value)) return "warning";
  return "success";
}

function billingRowKey(source: string, row: Record<string, any>, index: number) {
  const type = adminBillingType(row);
  const event = keyPart(row.status || row.type || row.reason || row.title || row.detail, type);
  const primary = keyPart(row.runId || row.userId || row.workspaceId || row.createdAt || row.occurredAt || row.completedAt, "no-primary");
  return `billing:${source}:${type}:${event}:${primary}:${index}`;
}

function auditRowKey(row: Record<string, any>, index: number) {
  const type = stringValue(row.type, "audit");
  const detail = keyPart(row.detail || row.operation || row.action || row.type, type);
  const primary = keyPart(row.id || row.userId || row.operatorId || row.workspaceId || row.occurredAt, "no-primary");
  return `audit:items:${type}:${detail}:${primary}:${index}`;
}

function alertRowKey(row: Record<string, any>) {
  const type = stringValue(row.category || row.severity, "alert");
  const detail = keyPart(row.title || row.detail || row.message || row.category, type);
  const primary = keyPart(row.id || row.runId || row.userId || row.workspaceId || row.occurredAt || row.createdAt, "no-primary");
  const action = keyPart(row.action, "no-action");
  return `alert:items:${type}:${detail}:${primary}:${action}`;
}

function adminServiceRowKey(source: string, row: Record<string, any>, index: number) {
  const identity = keyPart(row.id || row.key || row.name || row.title || row.category || row.url, "service");
  const status = keyPart(row.status || row.mode || row.ok, "unknown");
  return `admin-service:${source}:${identity}:${status}:${index}`;
}

function adminOpsRowKey(source: string, row: Record<string, any>, index: number) {
  const identity = keyPart(row.id || row.accountId || row.workspaceId || row.resourceBindingId || row.runId || row.title || row.type, "ops");
  const status = keyPart(row.status || row.accessStatus || row.auditStatus || row.deleteProtectionStatus || row.type, "unknown");
  return `admin-ops:${source}:${identity}:${status}:${index}`;
}

export async function loadAdminDashboardModel() {
  const overview = await fetchAdminOverview();
  const payload = objectValue(overview);
  const kpis = objectValue(payload.kpis);
  const pending = objectValue(payload.pending);
  const alerts = arrayValue(payload.alerts).slice(0, 5).map((item) => {
    const row = objectValue(item);
    return {
      rowKey: alertRowKey(row),
      id: stringValue(row.runId || row.userId || row.title || row.detail),
      type: stringValue(row.category || row.severity),
      user: stringValue(row.userName || row.userId, ""),
      workspace: stringValue(row.workspaceId, ""),
      message: stringValue(row.title || row.detail),
      severity: adminAlertSeverity(row.severity),
    };
  });
  return {
    stats: {
      activeUsers: numberValue(kpis.activeUsers),
      totalWorkspaces: numberValue(kpis.workspaceTotal),
      runningTasks: numberValue(kpis.todayRuns || kpis.totalRuns),
      todayRevenue: numberValue(kpis.todayTotalCost),
      frozenAmount: numberValue(payload.ledgerSummary?.frozenAmount || payload.pending?.oldestPendingHours),
      pendingItems: numberValue(pending.count || alerts.length),
    },
    pendingItems: alerts,
  };
}

export function useAdminDashboardModel() {
  return usePortalQuery(loadAdminDashboardModel, []);
}

export async function loadAdminAlertsModel() {
  const [alertsPayload, announcementsPayload] = await Promise.all([fetchAdminAlerts(), fetchAnnouncements({ mode: "all" })]);
  const pendingItems = arrayValue(objectValue(alertsPayload).alerts).map((item) => {
    const row = objectValue(item);
    return {
      rowKey: alertRowKey(row),
      id: stringValue(row.runId || row.userId || row.title || row.detail),
      type: stringValue(row.category || row.severity),
      severity: adminAlertSeverity(row.severity),
      user: stringValue(row.userName || row.userId, ""),
      workspace: stringValue(row.workspaceId, ""),
      message: stringValue(row.title || row.detail),
      createdAt: dateText(row.occurredAt),
    };
  });
  return {
    announcements: announcementsPayload.items.map((item) => ({
      id: item.id,
      title: item.title,
      content: item.content,
      isPinned: Boolean(item.pinned),
      isActive: item.status !== "inactive",
      createdAt: dateText(item.createdAt),
      publishedAt: dateText(item.updatedAt || item.createdAt),
    })),
    pendingItems,
  };
}

export function useAdminAlertsModel(refreshVersion: number) {
  return usePortalQuery(loadAdminAlertsModel, [refreshVersion]);
}

export async function loadAdminBillingOpsModel() {
  const billing = objectValue(await fetchAdminBillingOps());
  const pending = objectValue(billing.pending);
  const sync = objectValue(billing.billingSync);
  const warningEvents = arrayValue(billing.warningEvents);
  const pendingRuns = arrayValue(billing.pendingRuns);
  const adjustments = arrayValue(billing.adjustments);
  const billingItems = [
    { source: "pendingRuns", items: pendingRuns },
    { source: "warningEvents", items: warningEvents },
    { source: "adjustments", items: adjustments },
  ].flatMap(({ source, items }) => items.map((item, index) => {
    const row = objectValue(item);
    return {
      rowKey: billingRowKey(source, row, index),
      id: stringValue(row.id),
      source,
      userId: stringValue(row.userId, ""),
      type: adminBillingType(row),
      user: stringValue(row.userName || row.userId, "-"),
      workspace: stringValue(row.workspaceId, "-"),
      amount: numberValue(row.amount || row.totalCost || row.estimatedCost),
      status: adminBillingStatus(row.status),
      reason: stringValue(row.reason || row.title || row.detail || row.type),
      anomaly: Boolean(row.anomaly || row.severity),
      note: stringValue(row.note, ""),
      createdAt: dateText(row.createdAt || row.occurredAt || row.completedAt),
    };
  }));
  return {
    stats: {
      pendingCount: numberValue(pending.count || pendingRuns.length),
      t1ReconcileStatus: sync.lastError ? "failed" : sync.lastRunAt ? "completed" : "pending",
      frozenAnomalies: warningEvents.length,
      todayRefunds: adjustments.filter((item) => objectValue(item).type === "refund").length,
    },
    billingItems,
  };
}

export function useAdminBillingOpsModel(refreshVersion: number) {
  return usePortalQuery(loadAdminBillingOpsModel, [refreshVersion]);
}

export async function loadAdminAuditModel() {
  const audit = objectValue(await fetchAdminAudit());
  return {
    auditEvents: arrayValue(audit.items).map((item, index) => {
      const row = objectValue(item);
      const rawType = stringValue(row.type, "audit");
      return {
        rowKey: auditRowKey(row, index),
        id: stringValue(row.id || row.occurredAt, String(index)),
        type: rawType,
        operation: stringValue(row.action || rawType),
        user: stringValue(row.actor?.email || row.actor?.name || row.operatorId || row.userId, "-"),
        workspace: stringValue(row.workspaceId, ""),
        status: adminAuditStatus(rawType),
        details: stringValue(row.reason || row.detail || row.type),
        actor: stringValue(row.actor?.email || row.actor?.name || row.operatorId, "-"),
        target: stringValue(row.target?.id || row.target?.userId || row.target?.announcementId || row.target?.kind, "-"),
        reason: stringValue(row.reason || row.detail || row.type),
        idempotencyKey: stringValue(row.idempotencyKey, "-"),
        before: JSON.stringify(row.before ?? null),
        after: JSON.stringify(row.after ?? null),
        timestamp: dateText(row.createdAt || row.occurredAt),
      };
    }),
  };
}

export function useAdminAuditModel() {
  return usePortalQuery(loadAdminAuditModel, []);
}

export async function loadAdminSystemModel() {
  const system = objectValue(await fetchAdminSystem());
  const publicSettings = objectValue(system.publicSettings);
  const services = arrayValue(system.serviceStatuses);
  const metrics = objectValue(system.systemMetrics);
  const security = objectValue(system.summaries?.security);
  const failedServices = services.filter((item) => objectValue(item).ok === false).length;
  const degradedServices = services.filter((item) => ["degraded", "pending"].includes(String(objectValue(item).status || "").toLowerCase())).length;
  return {
    siteName: stringValue(publicSettings.siteName, "MedOPL Portal"),
    siteLogo: stringValue(publicSettings.siteLogo, ""),
    homeTitle: stringValue(publicSettings.siteSubtitle || publicSettings.homeContent, "OPL 资源控制面"),
    siteSubtitle: stringValue(publicSettings.siteSubtitle || publicSettings.homeContent, "OPL 资源控制面"),
    homeContent: stringValue(publicSettings.homeContent || publicSettings.siteSubtitle, "OPL 资源控制面"),
    registrationEnabled: Boolean(system.allowRegistration),
    adminReadOnlyMessage,
    serviceStatus: {
      totalServices: services.length,
      failedServices,
      degradedServices,
      keyRoutes: services.slice(0, 6).map((item, index) => {
        const row = objectValue(item);
        return {
          rowKey: adminServiceRowKey("system", row, index),
          name: stringValue(row.name),
          status: row.ok === false ? "failed" : String(row.status || "operational"),
        };
      }),
      securityChecks: {
        total: arrayValue(security.checks).length,
        passed: arrayValue(security.checks).filter((item) => objectValue(item).healthy !== false).length,
        failed: arrayValue(security.checks).filter((item) => objectValue(item).healthy === false).length,
      },
      performance: {
        avgResponseTime: numberValue(metrics.averageResponseMs || metrics.masFirstReplyApproxMs),
        errorRate: numberValue(metrics.errorRate),
      },
    },
  };
}

export function useAdminSystemModel(refreshVersion: number) {
  return usePortalQuery(loadAdminSystemModel, [refreshVersion]);
}

function adminOpsOperationRows(ops: Record<string, any>) {
  const accountRows = arrayValue(ops.accountOperations?.accounts).map((item, index) => {
    const row = objectValue(item);
    return {
      rowKey: adminOpsRowKey("account", row, index),
      type: "account",
      label: stringValue(row.accountName || row.email || row.accountId),
      owner: stringValue(row.accountId, ""),
      workspace: `${numberValue(row.workspaceCount)} 个工作空间`,
      status: stringValue(row.accessStatus || row.accountStatus),
      auditState: stringValue(row.wallet?.rechargeStatus, "账户状态可见"),
    };
  });
  const workspaceRows = arrayValue(ops.workspaceOperations?.workspaces).map((item, index) => {
    const row = objectValue(item);
    return {
      rowKey: adminOpsRowKey("workspace", row, index),
      type: "workspace",
      label: stringValue(row.workspaceName || row.workspaceId),
      owner: stringValue(row.accountName || row.accountId, ""),
      workspace: stringValue(row.workspaceId, ""),
      status: stringValue(row.status),
      auditState: stringValue(row.auditStatus, "审计状态可见"),
    };
  });
  const runRows = arrayValue(ops.currentRuns?.items).map((item, index) => {
    const row = objectValue(item);
    return {
      rowKey: adminOpsRowKey("run", row, index),
      type: "run",
      label: stringValue(row.task || row.runId),
      owner: stringValue(row.accountName || row.accountId, ""),
      workspace: stringValue(row.workspaceId, ""),
      status: stringValue(row.status),
      auditState: `费用估算 ${money(row.estimatedCost)}`,
    };
  });
  const fileSpaceRows = arrayValue(ops.fileSpaceOperations?.items).map((item, index) => {
    const row = objectValue(item);
    return {
      rowKey: adminOpsRowKey("file-space", row, index),
      type: "file-space",
      label: stringValue(row.workspaceName || row.workspaceId),
      owner: stringValue(row.accountName || row.accountId, ""),
      workspace: stringValue(row.workspaceId, ""),
      status: stringValue(row.deleteProtectionStatus),
      auditState: `${numberValue(row.usedGb)} / ${numberValue(row.capacityGb)} GB`,
    };
  });
  return [...accountRows, ...workspaceRows, ...runRows, ...fileSpaceRows];
}

function adminOpsExceptionRows(ops: Record<string, any>) {
  return arrayValue(ops.auditAndAnnouncements?.exceptions).map((item, index) => {
    const row = objectValue(item);
    return {
      rowKey: adminOpsRowKey("exception", row, index),
      type: stringValue(row.type, "ops_exception"),
      accountId: stringValue(row.accountId, ""),
      workspaceId: stringValue(row.workspaceId, ""),
      occurredAt: dateText(row.occurredAt),
    };
  });
}

function adminOpsCostTagRows(ops: Record<string, any>) {
  return arrayValue(ops.costReconciliation?.costAllocationTags).map((item, index) => {
    const row = objectValue(item);
    return {
      rowKey: adminOpsRowKey("cost-tag", row, index),
      resourceBindingId: stringValue(row.resourceBindingId, ""),
      billingAttributionId: stringValue(row.billingAttributionId, ""),
      accountId: stringValue(row.accountId, ""),
      workspaceId: stringValue(row.workspaceId, ""),
      environmentId: stringValue(row.environmentId, ""),
      status: stringValue(row.status, ""),
      estimatedCost: money(row.estimatedCost),
    };
  });
}

export async function loadAdminOpsModel() {
  const ops = objectValue(await fetchAdminOps());
  if (ops.error === "ops_surface_disabled" || ops.opsSurfaceEnabled === false) {
    return {
      opsSurfaceEnabled: false,
      disabledTitle: "平台托管运维入口未启用",
      disabledMessage: stringValue(ops.message, "未启用平台托管运维入口。"),
      platformMetrics: {
        totalRequests: 0,
        avgResponseTime: 0,
        activeConnections: 0,
        errorRate: 0,
      },
      services: [],
      adminReadOnlyMessage,
    };
  }
  const systemMetrics = objectValue(ops.systemMetrics);
  const services = arrayValue(ops.serviceStatuses || ops.upstreamStatuses || ops.alerts);
  const summaries = objectValue(ops.summaries);
  const boundaries = objectValue(ops.boundaries);
  const futureAuthorizedActions = [
    {
      rowKey: "future-authorized:real-cloud-resource-operation",
      name: "真实云资源操作未授权",
      status: boundaries.callsRealCloud === false ? "disabled" : "requires-authorization",
      reason: "当前只展示本地 Portal 运维投影，不执行真实云资源操作。",
    },
    {
      rowKey: "future-authorized:real-billing-mutation",
      name: "真实扣费未授权",
      status: boundaries.realBillingMutation === false ? "disabled" : "requires-authorization",
      reason: "本地账单运营状态和备注可写入审计，真实扣费需要单独授权接口。",
    },
    {
      rowKey: "future-authorized:real-resource-release",
      name: "真实资源释放未授权",
      status: boundaries.createsRealResources === false ? "disabled" : "requires-authorization",
      reason: "释放、创建或绑定真实资源不属于当前 admin ops surface。",
    },
  ];
  return {
    opsSurfaceEnabled: true,
    platformMetrics: {
      totalRequests: numberValue(systemMetrics.totalRequests || systemMetrics.totalRuns || ops.summary?.runCount),
      avgResponseTime: numberValue(systemMetrics.averageResponseMs || systemMetrics.masFirstReplyApproxMs),
      activeConnections: numberValue(systemMetrics.activeWorkspaceSessions || systemMetrics.concurrentRuns),
      errorRate: numberValue(systemMetrics.errorRate),
    },
    services: services.map((item, index) => {
      const row = objectValue(item);
      return {
        rowKey: adminServiceRowKey("ops", row, index),
        name: stringValue(row.name || row.title || row.category),
        status: row.ok === false ? "down" : String(row.status || row.mode || "operational"),
        uptime: row.responseMs ? `${row.responseMs}ms` : stringValue(row.mode || summaries.billing?.mode, "状态可见"),
        lastCheck: dateText(row.occurredAt || row.updatedAt),
      };
    }),
    localOperationRows: adminOpsOperationRows(ops),
    opsExceptionRows: adminOpsExceptionRows(ops),
    costAllocationRows: adminOpsCostTagRows(ops),
    futureAuthorizedActions,
    opsSummary: {
      accountCount: numberValue(ops.summary?.accountCount),
      workspaceCount: numberValue(ops.summary?.workspaceCount),
      currentRunCount: numberValue(ops.summary?.currentRunCount),
      exceptionCount: numberValue(ops.summary?.exceptionCount),
      estimatedCost: money(ops.summary?.estimatedCost),
      frozenAmount: money(ops.costReconciliation?.frozenAmount),
      tPlus1Status: stringValue(ops.costReconciliation?.tPlus1Status, "未开始"),
    },
    adminReadOnlyMessage,
  };
}

export function useAdminOpsModel() {
  return usePortalQuery(loadAdminOpsModel, []);
}
