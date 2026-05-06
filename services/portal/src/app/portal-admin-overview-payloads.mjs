import os from "node:os";

export function buildAdminSystemMetrics({
  allRuns,
  billingStatus,
  db,
  isRunTerminal,
  redisConfigured,
  storageMode,
}) {
  return {
    hostname: os.hostname(),
    cpuCores: os.cpus().length,
    totalMemoryGb: Number((os.totalmem() / 1024 / 1024 / 1024).toFixed(1)),
    freeMemoryGb: Number((os.freemem() / 1024 / 1024 / 1024).toFixed(1)),
    uptimeHours: Number((os.uptime() / 3600).toFixed(1)),
    concurrentRuns: allRuns.filter((run) => !isRunTerminal(run)).length,
    activeRuntimeAgents: (db.userComputeInstances || []).filter((item) => String(item.runtimeAgentId || item.runtimeAgentVersion || "").trim()).length,
    activeWorkspaceSessions: db.workspaceSessions.filter((item) => item.status === "active" && (!item.expiresAt || Date.parse(item.expiresAt) > Date.now())).length,
    dbMode: storageMode() === "postgres_redis" ? "Postgres / Redis" : "portal-db.json",
    redisStatus: redisConfigured ? "已配置" : "未接入",
    tencentBillingLinked: Boolean(billingStatus?.tencentBillingEnabled && billingStatus?.tencentCloudConfigured),
  };
}

export function buildAdminSummaries({
  opsSurfaceEnabled,
  performanceSummary,
  securitySummary,
  totals,
  urls,
}) {
  return {
    billing: {
      available: opsSurfaceEnabled,
      mode: "live",
      cpuCost: Number(totals.cpuCost || 0),
      gpuCost: Number(totals.gpuCost || 0),
      storageCost: Number(totals.pvCost || 0),
      totalCost: Number(totals.totalCost || 0),
      note: "数据来自账单聚合与对账状态，默认使用平台代开资源计量和云账单核对。",
    },
    sessionLedger: {
      available: true,
      mode: "status_only",
      source: "session_raw_ledger",
      note: "v21 以 SessionRawLedger 和 Portal 审计投影作为轨迹来源。",
    },
    oplRuntime: {
      available: true,
      mode: "status_only",
      adapterUrl: urls.portalOplAdapterUrl,
      oplWebUrl: urls.oplWebUrl || "",
      note: urls.oplWebUrl
        ? "Portal 生成 launch context，并把用户带到真实 OPL Web；adapter 只负责内部合同转换"
        : "未配置 OPL_WEB_URL，Portal 不会回退到旧工作台路径",
    },
    upstream: {
      gatewayUrl: urls.oplWebUrl || "",
      billingServiceUrl: urls.billingServiceUrl || "",
      traceAvailable: true,
      storageStatus: "platform_provisioned_storage",
      registryStatus: "retired_in_v21",
      note: "仅保留 upstream OPL、Runtime Agent、账单与审计状态，不再暴露旧运维栈。",
    },
    security: securitySummary,
    performance: performanceSummary,
  };
}

export function buildAdminOverviewPayloadView({
  activeUserStatus,
  alerts,
  allRuns,
  auditRows,
  cloudResourceRows,
  groupBillingByDay,
  groups,
  items,
  ledgerSummary,
  opsProfileEnabled,
  opsSurfaceEnabled,
  pending,
  pendingRuns,
  performanceSummary,
  productProfile,
  recentUsage,
  runtimeMode,
  serviceStatuses,
  summaries,
  runtimeAgents,
  upstreamStatuses,
  systemMetrics,
  tasks,
  todayRange,
  topUsers,
  totals,
  usageRows,
  users,
  warningEvents,
  withinDateRange,
  billingStatus,
}) {
  return {
    kpis: {
      totalUsers: users.length,
      activeUsers: users.filter((item) => activeUserStatus(item.status) === "active").length,
      disabledUsers: users.filter((item) => activeUserStatus(item.status) !== "active").length,
      activeTasks: tasks.filter((item) => item.status === "active").length,
      archivedTasks: tasks.filter((item) => item.status === "archived").length,
      totalCost: Number(totals.totalCost || 0),
      workspaceTotal: tasks.length,
      todayRuns: allRuns.filter((run) => withinDateRange(run.createdAt || "", todayRange)).length,
      todayNewUsers: users.filter((item) => withinDateRange(item.createdAt || "", todayRange)).length,
      todayNewWorkspaces: tasks.filter((item) => withinDateRange(item.createdAt || "", todayRange)).length,
      totalRuns: allRuns.length,
      averageResponseMs: Number(performanceSummary.masFirstReplyApproxMs || 0),
      todayTotalCost: Number(items
        .filter((item) => withinDateRange(item?.end || item?.start || item?.createdAt, todayRange))
        .reduce((sum, item) => sum + Number(item?.totalCost || 0), 0)
        .toFixed(5)),
      historicalTotalCost: Number(totals.totalCost || 0),
    },
    pending: {
      count: Number(pending?.pendingCount || 0),
      oldestPendingHours: Number(pending?.oldestPendingHours || 0),
      riskByUser: Array.isArray(pending?.riskByUser) ? pending.riskByUser.slice(0, 8) : [],
      riskByWorkspace: Array.isArray(pending?.riskByWorkspace) ? pending.riskByWorkspace.slice(0, 8) : [],
    },
    trend: groupBillingByDay(items, 7),
    totals,
    topUsers,
    recentUsage,
    groups,
    usageRows,
    ledgerSummary,
    pendingRuns,
    billingSync: {
      autoReconcileEnabled: Boolean(billingStatus?.autoReconcileEnabled),
      autoReconcileWindow: billingStatus?.autoReconcileWindow || "168h",
      lastRunAt: billingStatus?.reconcileState?.lastRunAt || "",
      lastScope: billingStatus?.reconcileState?.lastScope || "all",
      lastReconciledCount: Number(billingStatus?.reconcileState?.lastReconciledCount || 0),
      lastExactCount: Number(billingStatus?.reconcileState?.lastExactCount || 0),
      lastEstimatedCount: Number(billingStatus?.reconcileState?.lastEstimatedCount || 0),
      lastAdjustmentCount: Number(billingStatus?.reconcileState?.lastAdjustmentCount || 0),
      lastError: billingStatus?.reconcileState?.lastError || "",
      tencentBillingLinked: Boolean(billingStatus?.tencentBillingEnabled && billingStatus?.tencentCloudConfigured),
      exactSources: billingStatus?.exactSources || ["tencent_cloud_bill"],
      pendingSources: billingStatus?.pendingSources || ["platform_provisioned_local_metering"],
    },
    warningEvents,
    alerts,
    auditRows,
    systemMetrics,
    summaries,
    cloudResourceRows,
    runtimeAgents,
    upstreamStatuses,
    serviceStatuses: serviceStatuses.map((item) => ({ name: item.name, status: item.probe.status, ok: item.probe.ok, responseMs: item.probe.responseMs || null })),
    productProfile: {
      runtimeMode,
      opsProfileEnabled,
      opsSurfaceEnabled,
      ...productProfile,
    },
  };
}

export function buildAdminSystemApiPayload(payload) {
  return {
    serviceStatuses: payload.serviceStatuses || [],
    summaries: payload.summaries || {},
    systemMetrics: payload.systemMetrics || {},
    productProfile: payload.productProfile || {},
  };
}

export function buildAdminOpsApiPayload(payload) {
  return {
    cloudResourceRows: payload.cloudResourceRows || [],
    runtimeAgents: payload.runtimeAgents || [],
    upstreamStatuses: payload.upstreamStatuses || [],
    serviceStatuses: payload.serviceStatuses || [],
    auditRows: payload.auditRows || [],
    billingSync: payload.billingSync || {},
    systemMetrics: payload.systemMetrics || {},
    pending: payload.pending || {},
    warningEvents: payload.warningEvents || [],
    alerts: payload.alerts || [],
    summaries: payload.summaries || {},
    productProfile: payload.productProfile || {},
  };
}
