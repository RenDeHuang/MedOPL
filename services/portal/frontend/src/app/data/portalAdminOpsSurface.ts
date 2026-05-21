import { fetchAdminOps } from "../../api/portal/admin";

export const adminReadOnlyMessage = "该管理面当前只展示已接入的只读数据；真实云资源、真实扣费或高风险设置仍需单独授权接口。";

function numberValue(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function money(value: unknown) {
  return `¥ ${numberValue(value).toFixed(2)}`;
}

function dateText(value: unknown) {
  return typeof value === "string" && value ? value.replace("T", " ").slice(0, 16) : "未返回";
}

function stringValue(value: unknown, fallback = "未返回") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function keyPart(value: unknown, fallback = "none") {
  if (typeof value === "string" && value.trim()) return value.trim().replace(/[^a-zA-Z0-9._:-]+/g, "_");
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "boolean") return String(value);
  return fallback;
}

function arrayValue<T = any>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : [];
}

function objectValue(value: unknown): Record<string, any> {
  return value && typeof value === "object" ? value as Record<string, any> : {};
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
