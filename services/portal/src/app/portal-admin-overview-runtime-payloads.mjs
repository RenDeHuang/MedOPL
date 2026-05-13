import os from "node:os";
import {
  buildAdminAlerts,
  buildAdminAuditRows,
  buildAdminGroups,
  buildAdminLedgerSummary,
  buildAdminRecentUsage,
  buildAdminTopUsers,
  buildAdminUsageRows,
  cloudResourceRows,
  commercialCustomers,
} from "./portal-admin-api-payload-helpers.mjs";

function overviewServiceTargets(urls, opsSurfaceEnabled) {
  return [
    { name: "Portal OPL Adapter", url: new URL("/healthz", `${urls.portalOplAdapterUrl}/`).toString() },
    { name: "Langfuse", url: urls.langfuseUrl },
    ...(opsSurfaceEnabled ? [
      { name: "Rancher", url: urls.rancherUrl },
      { name: "OpenCost", url: urls.opencostUiUrl },
      { name: "Harbor", url: urls.harborUrl },
      { name: "MinIO", url: urls.minioConsoleUrl },
    ] : []),
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
  fetchHarborSummary,
  fetchLangfuseSummary,
  fetchMinioSummary,
  fetchPendingSummary,
  fetchTraceRows,
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
    const serviceStatuses = await Promise.all(overviewServiceTargets(urls, opsSurfaceEnabled).map(async (item) => ({ ...item, probe: await probe(item.url) })));
    const disabledOpsSummary = { available: false, mode: "disabled", note: "未启用平台托管运维入口" };
    const [minioSummary, harborSummary, langfuseSummary] = await Promise.all([
      opsSurfaceEnabled ? fetchMinioSummary() : Promise.resolve(disabledOpsSummary),
      opsSurfaceEnabled ? fetchHarborSummary() : Promise.resolve(disabledOpsSummary),
      fetchLangfuseSummary(),
    ]);
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
    const traceMissingRuns = allRuns
      .filter((run) => isRunTerminal(run))
      .slice(0, 40)
      .filter(() => langfuseSummary?.available);
    const traceRows = langfuseSummary?.available ? (await fetchTraceRows({ limit: 200 })).rows || [] : [];
    const tracedRunIds = new Set(traceRows.map((item) => item.runId).filter(Boolean));
    const traceMissingAlerts = traceMissingRuns
      .filter((run) => run.runId && !tracedRunIds.has(run.runId))
      .slice(0, 12)
      .map((run) => ({
        severity: "warning",
        category: "trace",
        userId: run.userId,
        runId: run.runId,
        workspaceId: run.workspaceId || "-",
        title: "Run 缺少 Trace",
        detail: `${run.runId} 已完成但未找到 Langfuse trace`,
        occurredAt: formatDateTime(run.createdAt || ""),
        action: `/portal/admin/run?runId=${run.runId}`,
      }));
    const alerts = buildAdminAlerts({
      securitySummary,
      performanceSummary,
      unavailableServices,
      traceMissingAlerts,
      failedRuns,
      pendingRuns: pending?.runs || [],
      lowBalanceUsers,
      formatDateTime,
      money,
    });

    const systemMetrics = {
      hostname: os.hostname(),
      cpuCores: os.cpus().length,
      totalMemoryGb: Number((os.totalmem() / 1024 / 1024 / 1024).toFixed(1)),
      freeMemoryGb: Number((os.freemem() / 1024 / 1024 / 1024).toFixed(1)),
      uptimeHours: Number((os.uptime() / 3600).toFixed(1)),
      concurrentRuns: allRuns.filter((run) => !isRunTerminal(run)).length,
      activeSandboxes: db.userSandboxes.filter((item) => !["terminated", "error"].includes(String(item.status || "").toLowerCase())).length,
      activeWorkspaceSessions: db.workspaceSessions.filter((item) => item.status === "active" && (!item.expiresAt || Date.parse(item.expiresAt) > Date.now())).length,
      dbMode: storageMode() === "postgres_redis" ? "Postgres / Redis" : "portal-db.json",
      redisStatus: redisConfigured ? "已配置" : "未接入",
      opencostLinked: Boolean(billingStatus?.opencostBaseUrl),
      tencentBillingLinked: Boolean(billingStatus?.tencentBillingEnabled && billingStatus?.tencentCloudConfigured),
    };

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
      groups: buildAdminGroups({ groups, users }),
      usageRows,
      ledgerSummary: buildAdminLedgerSummary(db.ledger),
      pendingRuns: Array.isArray(pending?.runs) ? pending.runs.slice(0, 12) : [],
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
        opencostLinked: Boolean(billingStatus?.opencostBaseUrl),
        tencentBillingLinked: Boolean(billingStatus?.tencentBillingEnabled && billingStatus?.tencentCloudConfigured),
        exactSources: billingStatus?.exactSources || ["tencent_cloud_bill"],
        pendingSources: billingStatus?.pendingSources || ["opencost_pending", "metering_pending"],
      },
      warningEvents,
      alerts,
      auditRows: buildAdminAuditRows(recentEvents, formatDateTime),
      systemMetrics,
      summaries: {
        billing: {
          available: opsSurfaceEnabled,
          mode: opsSurfaceEnabled ? "live" : "disabled",
          cpuCost: Number(totals.cpuCost || 0),
          gpuCost: Number(totals.gpuCost || 0),
          storageCost: Number(totals.pvCost || 0),
          totalCost: Number(totals.totalCost || 0),
          note: opsSurfaceEnabled ? "数据来自账单聚合" : "未启用运维成本入口",
        },
        minio: minioSummary,
        harbor: {
          ...harborSummary,
          imageTagCount: new Set(db.userSandboxes.map((item) => item.imageTag).filter(Boolean)).size,
        },
        langfuse: langfuseSummary,
        oplRuntime: {
          available: true,
          mode: "status_only",
          adapterUrl: urls.portalOplAdapterUrl,
          oplWebUrl: urls.oplWebUrl || "",
          note: urls.oplWebUrl
            ? "Portal 生成 launch context，并把用户带到真实 OPL Web；adapter 只负责内部合同转换"
            : "未配置 OPL_WEB_URL，Portal 不会回退到旧工作台路径",
        },
        rancher: {
          available: opsSurfaceEnabled && Boolean(urls.rancherUrl),
          mode: opsSurfaceEnabled ? "status_only" : "disabled",
          note: !opsSurfaceEnabled ? "未启用平台托管运维入口" : (urls.rancherUrl ? "当前仅展示入口与可达状态" : "未配置 Rancher 入口"),
        },
        security: securitySummary,
        performance: performanceSummary,
      },
      sandboxes: db.userSandboxes
        .map((item) => {
          const targetUser = db.users.find((user) => user.id === item.userId) || {};
          return {
            ...item,
            userName: targetUser.name || targetUser.email || item.userId,
            updatedAtLabel: formatDateTime(item.updatedAt || item.lastActiveAt || item.createdAt || ""),
          };
        })
        .sort((a, b) => String(b.updatedAt || b.lastActiveAt || b.createdAt || "").localeCompare(String(a.updatedAt || a.lastActiveAt || a.createdAt || ""))),
      cloudResourceRows: cloudResourceRows(db, formatDateTime),
      serviceStatuses: serviceStatuses.map((item) => ({ name: item.name, status: item.probe.status, ok: item.probe.ok, responseMs: item.probe.responseMs || null })),
      productProfile: {
        runtimeMode,
        opsProfileEnabled,
        opsSurfaceEnabled,
      },
      runtimeAgents,
      upstreamStatuses: upstreamStatusRows({ billingStatus, runtimeAgents }),
    };
  };
}
