import {
  buildAdminAlerts,
  buildAdminAuditRows,
  buildAdminGroups,
  buildAdminLedgerSummary,
  buildAdminRecentUsage,
  buildAdminTopUsers,
  buildAdminUsageRows,
} from "./portal-admin-api-payload-helpers.mjs";
import {
  buildAdminOverviewPayloadView,
  buildAdminSummaries,
  buildAdminSystemMetrics,
} from "./portal-admin-overview-payloads.mjs";

function userTenantId(user = {}) {
  return String(user.tenantId || user.id || "").trim();
}

function customerSegment(user = {}) {
  const explicit = String(user.customerSegment || user.customer_segment || user.segment || "").trim().toLowerCase();
  if (["real_customer", "internal", "test_fixture"].includes(explicit)) return explicit;
  const probe = `${user.id || ""} ${user.email || ""} ${user.name || ""} ${user.tenantId || ""}`.toLowerCase();
  if (["@example.test", "test-", "fixture", "smoke"].some((marker) => probe.includes(marker))) return "test_fixture";
  return ["@medopl.cn", "@gaofeng", "internal"].some((marker) => probe.includes(marker)) ? "internal" : "real_customer";
}

function includeAdminSegment(user = {}, { includeTestFixtures = false, includeInternal = false } = {}) {
  const segment = customerSegment(user);
  if (segment === "test_fixture") return Boolean(includeTestFixtures);
  if (segment === "internal") return Boolean(includeInternal);
  return true;
}

function commercialCustomers(db, options = {}) {
  return (Array.isArray(db.users) ? db.users : [])
    .filter((item) => item.role !== "admin")
    .filter((item) => includeAdminSegment(item, options));
}

function cloudResourceRow(order = {}, formatDateTime = (value) => value || "") {
  const resourceIds = Array.isArray(order.cloudResourceIds) ? order.cloudResourceIds : [];
  const stoppedAt = String(order.billingStoppedAt || order.pendingStoppedAt || order.settledAt || "").trim();
  return {
    name: order.serverPlanId || order.id,
    status: String(order.status || "unknown").trim() || "unknown",
    resourceOrderId: order.id,
    runId: order.runId || "",
    workspaceId: order.workspaceId || "",
    cloudResourceCount: resourceIds.length,
    cleanupEvidence: stoppedAt ? `释放时间 ${formatDateTime(stoppedAt)}` : (resourceIds.length ? `${resourceIds.length} 个云资源编号` : "等待资源编号"),
    billingStopped: Boolean(stoppedAt) || ["released", "settled", "failed", "cancelled"].includes(String(order.status || "").toLowerCase()),
    updatedAt: order.updatedAt || order.createdAt || "",
  };
}

function commercialResourceOrders(db, options = {}) {
  const usersById = new Map((Array.isArray(db.users) ? db.users : []).map((user) => [String(user.id || ""), user]));
  return (Array.isArray(db.resourceOrders) ? db.resourceOrders : [])
    .filter((order) => {
      const user = usersById.get(String(order.userId || order.portalUserId || "")) || {};
      return includeAdminSegment(user, options);
    });
}

function cloudResourceRows(db, formatDateTime) {
  return commercialResourceOrders(db)
    .map((order) => cloudResourceRow(order, formatDateTime))
    .sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")))
    .slice(0, 50);
}

function defaultServiceUrls(urls) {
  return [
    { name: "Portal", url: urls.portalPublicUrl },
    { name: "Gateway", url: urls.oplWebUrl },
    { name: "Portal OPL Adapter", url: new URL("/healthz", `${urls.portalOplAdapterUrl}/`).toString() },
    { name: "Billing", url: urls.billingServiceUrl },
  ].filter((item) => item.url);
}

function runtimeAgentRows(db = {}) {
  return (Array.isArray(db.userComputeInstances) ? db.userComputeInstances : [])
    .filter((item) => String(item.runtimeAgentId || item.runtimeAgentVersion || "").trim())
    .map((item) => ({
      id: item.id,
      userId: item.ownerUserId || item.userId || "",
      workspaceId: item.workspaceId || "",
      instanceId: item.cvmInstanceId || item.instanceId || "",
      region: item.region || "",
      runtimeAgentId: item.runtimeAgentId || "",
      runtimeAgentVersion: item.runtimeAgentVersion || "",
      status: item.status || "",
      healthStatus: item.healthStatus || "",
      updatedAt: item.updatedAt || item.createdAt || "",
    }))
    .sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")))
    .slice(0, 50);
}

function upstreamStatusRows({ billingStatus, runtimeAgents = [] }) {
  return [
    {
      name: "Gateway",
      status: "status_only",
      detail: "OPL Web / Gateway 由系统探测项体现。",
    },
    {
      name: "Billing Upstream",
      status: billingStatus?.tencentBillingEnabled && billingStatus?.tencentCloudConfigured ? "connected" : "degraded",
      detail: billingStatus?.tencentBillingEnabled && billingStatus?.tencentCloudConfigured ? "腾讯云账单已接入。" : "腾讯云账单未完成接入。",
    },
    {
      name: "Session Ledger",
      status: "status_only",
      detail: "v21 默认从 SessionRawLedger 和 Portal 审计投影读取轨迹。",
    },
    {
      name: "User Storage",
      status: "platform_provisioned_storage",
      detail: "用户文件、输出和 session 原始记录写入用户绑定存储。",
    },
    {
      name: "Runtime Agent",
      status: runtimeAgents.length ? "connected" : "pending",
      detail: runtimeAgents.length ? `${runtimeAgents.length} 个平台代开的客户专属运行环境已注册 Runtime Agent。` : "等待平台代开客户专属运行环境并注册 Runtime Agent。",
    },
  ];
}

export function createPortalAdminOverviewPayloadBuilder({
  activeUserStatus,
  buildAdminSecuritySummary,
  collectRunsForUser,
  fetchBillingStatus,
  fetchBillingSummary,
  fetchPendingSummary,
  formatDateTime,
  groupBillingByDay,
  isRunTerminal,
  money,
  probe,
  rangeBounds,
  readPortalEvents,
  redisConfigured,
  runtimePerformanceSummary,
  storageMode,
  withinDateRange,
  urls,
  runtimeMode,
  opsProfileEnabled,
  opsSurfaceEnabled,
}) {
  return async function buildAdminOverviewPayload(db) {
    const users = commercialCustomers(db).filter((item) => activeUserStatus(item.status) !== "deleted");
    const billing = await fetchBillingSummary("", "", "168h");
    const items = billing?.items || [];
    const totals = billing?.totals || { cpuCost: 0, gpuCost: 0, pvCost: 0, totalCost: 0 };
    const pending = await fetchPendingSummary("", "", "168h");
    const billingStatus = await fetchBillingStatus();
    const tasks = db.taskSpaces.filter((item) => item.status !== "deleted");
    const groups = Array.isArray(db.groups) ? db.groups : [];
    const todayRange = rangeBounds("today");
    const recentEvents = await readPortalEvents({ limit: 240 });
    const allRuns = [];
    for (const item of users) {
      allRuns.push(...(await collectRunsForUser(item.id, { limit: 50 })).map((run) => ({ ...run, userId: item.id, userName: item.name, userEmail: item.email })));
    }
    const serviceStatuses = await Promise.all(defaultServiceUrls(urls).map(async (item) => ({ ...item, probe: await probe(item.url) })));
    const securitySummary = buildAdminSecuritySummary();
    const performanceSummary = await runtimePerformanceSummary();
    const topUsers = buildAdminTopUsers({ users, items, wallets: db.wallets });
    const recentUsage = buildAdminRecentUsage({ allRuns, isRunTerminal, formatDateTime });
    const usageRows = buildAdminUsageRows({ allRuns, items, isRunTerminal, formatDateTime });
    const runtimeAgents = runtimeAgentRows(db);
    const warningEvents = recentEvents.filter((event) => /fail|error|denied|blocked|pending|reconcile/i.test(String(event.type || ""))).slice(0, 12);
    const lowBalanceUsers = users
      .map((entry) => {
        const wallet = db.wallets.find((wallet) => wallet.userId === entry.id) || { balance: 0 };
        return { userId: entry.id, name: entry.name, email: entry.email, balance: Number(wallet.balance || 0) };
      })
      .filter((entry) => entry.balance <= 0)
      .slice(0, 12);
    const failedRuns = allRuns.filter((run) => String(run.status || "").toLowerCase() === "failed").slice(0, 12).map((run) => ({
      runId: run.runId,
      userId: run.userId,
      userName: run.userName,
      workspaceId: run.workspaceId || "-",
      createdAt: formatDateTime(run.createdAt || ""),
    }));
    const unavailableServices = serviceStatuses.filter((item) => !item.probe.ok);
    const alerts = buildAdminAlerts({
      securitySummary,
      performanceSummary,
      unavailableServices,
      traceMissingAlerts: [],
      failedRuns,
      pendingRuns: pending?.runs || [],
      lowBalanceUsers,
      formatDateTime,
      money,
    });
    const systemMetrics = buildAdminSystemMetrics({
      allRuns,
      billingStatus,
      db,
      isRunTerminal,
      redisConfigured,
      storageMode,
    });
    const summaries = buildAdminSummaries({
      opsSurfaceEnabled,
      performanceSummary,
      securitySummary,
      totals,
      urls,
    });
    return buildAdminOverviewPayloadView({
      activeUserStatus,
      alerts,
      allRuns,
      auditRows: buildAdminAuditRows(recentEvents, formatDateTime),
      billingStatus,
      cloudResourceRows: cloudResourceRows(db, formatDateTime),
      groupBillingByDay,
      groups: buildAdminGroups({ groups, users }),
      items,
      ledgerSummary: buildAdminLedgerSummary(db.ledger),
      opsProfileEnabled,
      opsSurfaceEnabled,
      pending,
      pendingRuns: Array.isArray(pending?.runs) ? pending.runs.slice(0, 12) : [],
      performanceSummary,
      recentUsage,
      runtimeMode,
      serviceStatuses,
      summaries,
      runtimeAgents,
      upstreamStatuses: upstreamStatusRows({ billingStatus, runtimeAgents }),
      systemMetrics,
      tasks,
      todayRange,
      topUsers,
      totals,
      usageRows,
      users,
      warningEvents,
      withinDateRange,
    });
  };
}
