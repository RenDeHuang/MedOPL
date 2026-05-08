import os from "node:os";
import { getCanonicalResourcePlan } from "../domain/lab-packages.mjs";
import { buildUserBillingSummary, normalizeLedgerEntries } from "../domain/wallet-ledger.mjs";
import {
  buildAdminAlerts,
  buildAdminAuditRows,
  buildAdminGroups,
  buildAdminLedgerSummary,
  buildAdminRecentUsage,
  buildAdminTopUsers,
  buildAdminUsageRows,
  buildAdminUsersRows,
} from "./portal-admin-api-payload-helpers.mjs";
import { createPortalAdminPortraitPayloads } from "./portal-admin-portrait-payloads.mjs";

function isRegistrationEnabled(db) {
  return db?.settings?.allowRegistration !== false;
}

function groupNameById(db, groupId = "") {
  if (!groupId) return "";
  const group = db.groups.find((item) => item.id === groupId);
  return group?.name || "";
}

function defaultUrls(urls = {}) {
  return {
    harborUrl: urls.harborUrl || "",
    langfuseUrl: urls.langfuseUrl || "",
    minioConsoleUrl: urls.minioConsoleUrl || "",
    opencostUiUrl: urls.opencostUiUrl || "",
    oplWebUrl: urls.oplWebUrl || "",
    portalOplAdapterUrl: urls.portalOplAdapterUrl || "",
    rancherUrl: urls.rancherUrl || "",
  };
}

function userTenantId(user = {}) {
  return String(user.tenantId || user.id || "").trim();
}

function userDisplayName(user = {}) {
  return String(user.name || user.email || user.id || "").trim();
}

function customerSegment(user = {}) {
  const explicit = String(user.customerSegment || user.customer_segment || user.segment || "").trim().toLowerCase();
  if (["real_customer", "internal", "test_fixture"].includes(explicit)) return explicit;
  const probe = `${user.id || ""} ${user.email || ""} ${user.name || ""} ${user.tenantId || ""}`.toLowerCase();
  if (isTestFixtureProbe(probe)) return "test_fixture";
  return isInternalProbe(probe) ? "internal" : "real_customer";
}

function adminDataSegment(user = {}) {
  return customerSegment(user);
}

function isTestFixtureProbe(probe = "") {
  return ["@example.test", "test-", "fixture", "smoke"].some((marker) => probe.includes(marker));
}

function isInternalProbe(probe = "") {
  return ["@medopl.cn", "@gaofeng", "internal"].some((marker) => probe.includes(marker));
}

function includeAdminSegment(user = {}, { includeTestFixtures = false, includeInternal = false } = {}) {
  const segment = adminDataSegment(user);
  if (segment === "test_fixture") return Boolean(includeTestFixtures);
  if (segment === "internal") return Boolean(includeInternal);
  return true;
}

function commercialCustomers(db, options = {}) {
  return (Array.isArray(db.users) ? db.users : [])
    .filter((item) => item.role !== "admin")
    .filter((item) => includeAdminSegment(item, options));
}

function commercialResourceOrders(db, options = {}) {
  const usersById = new Map((Array.isArray(db.users) ? db.users : []).map((user) => [String(user.id || ""), user]));
  return (Array.isArray(db.resourceOrders) ? db.resourceOrders : [])
    .filter((order) => {
      const user = usersById.get(String(order.userId || order.portalUserId || "")) || {};
      return includeAdminSegment(user, options);
    });
}

function userLedgerEntries(db, user = {}) {
  const tenantId = userTenantId(user);
  const userId = String(user.id || "").trim();
  return normalizeLedgerEntries(db.ledger || [])
    .filter((entry) => entry.userId === userId || entry.tenantId === tenantId || entry.billingAccountId === userId || entry.billingAccountId === tenantId)
    .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
}

function activeResourceOrdersForUser(db, user = {}) {
  const tenantId = userTenantId(user);
  const userId = String(user.id || "").trim();
  return (Array.isArray(db.resourceOrders) ? db.resourceOrders : [])
    .filter((item) => item.userId === userId || item.tenantId === tenantId)
    .filter((item) => !["released", "settled", "failed", "cancelled", "deleted"].includes(String(item.status || "").toLowerCase()));
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

function cloudResourceRows(db, formatDateTime) {
  return commercialResourceOrders(db)
    .map((order) => cloudResourceRow(order, formatDateTime))
    .sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")))
    .slice(0, 50);
}

function moneyAmount(value = 0) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? Number(parsed.toFixed(2)) : 0;
}

function gbFromBytes(bytes = 0) {
  const parsed = Number(bytes || 0);
  return Number.isFinite(parsed) ? Number((parsed / 1024 ** 3).toFixed(3)) : 0;
}

function planLabel(planId = "") {
  const id = String(planId || "").trim();
  if (id.includes("pro")) return "Pro 套餐";
  if (id.includes("starter")) return "基础套餐";
  return id || "未选择套餐";
}

function workspaceTitle(task = {}) {
  return String(task.title || task.slug || task.workspaceId || "").trim();
}

function workspaceIdFor(task = {}) {
  return String(task.slug || task.workspaceId || task.id || "").trim();
}

function bindingId(binding = {}) {
  return String(binding.resourceBindingId || binding.id || "").trim();
}

function bindingForWorkspace(db = {}, workspaceId = "") {
  return (Array.isArray(db.workspaceResourceBindings) ? db.workspaceResourceBindings : [])
    .find((item) => String(item.workspaceId || "").trim() === workspaceId) || {};
}

function subscriptionForWorkspace(db = {}, user = {}, workspaceId = "") {
  return (Array.isArray(db.labSubscriptions) ? db.labSubscriptions : [])
    .find((item) => String(item.workspaceId || "").trim() === workspaceId && String(item.userId || "").trim() === String(user.id || "").trim()) || {};
}

function accountWallet(db = {}, user = {}) {
  return (Array.isArray(db.wallets) ? db.wallets : [])
    .find((item) => String(item.userId || "").trim() === String(user.id || "").trim()) || {};
}

function accountWorkspaces(db = {}, user = {}) {
  return (Array.isArray(db.taskSpaces) ? db.taskSpaces : [])
    .filter((item) => String(item.userId || "").trim() === String(user.id || "").trim())
    .filter((item) => String(item.status || "").toLowerCase() !== "deleted");
}

function freezeAmountForUser(db = {}, user = {}) {
  return (Array.isArray(db.weeklyProtectionFreezes) ? db.weeklyProtectionFreezes : [])
    .filter((item) => String(item.userId || "").trim() === String(user.id || "").trim())
    .reduce((sum, item) => sum + Number(item.frozenAmount || item.weeklyAmount || 0), 0);
}

function accessStatus(user = {}) {
  const status = String(user.status || "active").toLowerCase();
  if (status === "active") return "开通";
  if (["disabled", "suspended", "blocked"].includes(status)) return "禁用";
  return status || "未知";
}

function resourceState(status = "") {
  const normalized = String(status || "").toLowerCase();
  if (["planned", "plan", "pending_plan"].includes(normalized)) return "计划中";
  if (["preparing", "provisioning", "creating", "pending"].includes(normalized)) return "准备中";
  if (["active", "running", "available"].includes(normalized)) return "可用";
  if (["releasing", "release_requested"].includes(normalized)) return "释放中";
  if (["released", "settled"].includes(normalized)) return "已释放";
  if (["failed", "error", "abnormal"].includes(normalized)) return "异常";
  return normalized ? "计划中" : "计划中";
}

function capacityFromPlan(planId = "", binding = {}, subscription = {}) {
  const plan = getCanonicalResourcePlan(planId);
  return {
    cpuCores: Number(binding.cpuCores || plan?.compute?.cpuCores || 0),
    memoryGb: Number(binding.memoryGb || plan?.compute?.memoryGb || 0),
    fileSpaceGb: Number(binding.fileSpaceGb || binding.storageCapacityGb || subscription.includedStorageGb || plan?.storage?.capacityGb || 0),
  };
}

function workspaceConcurrency(task = {}, planId = "") {
  const explicit = Number(task.maxConcurrentRuns || task.concurrency || 0);
  if (explicit > 0) return explicit;
  return String(planId || "").includes("pro") ? 8 : 2;
}

function workspaceQueueCapacity(task = {}, planId = "") {
  const explicit = Number(task.queueCapacity || task.queue || 0);
  if (explicit > 0) return explicit;
  return String(planId || "").includes("pro") ? 16 : 4;
}

function accountOperationRows(db = {}) {
  return commercialCustomers(db, { includeInternal: false, includeTestFixtures: true })
    .map((user) => {
      const wallet = accountWallet(db, user);
      const workspaces = accountWorkspaces(db, user);
      const frozenAmount = moneyAmount(freezeAmountForUser(db, user));
      return {
        accountId: String(user.id || ""),
        accountName: userDisplayName(user),
        email: String(user.email || ""),
        accountStatus: String(user.status || "active"),
        accessStatus: accessStatus(user),
        workspaceCount: workspaces.length,
        wallet: {
          balance: moneyAmount(wallet.balance),
          frozenAmount,
          availableBalance: moneyAmount(Number(wallet.balance || 0) - frozenAmount),
          rechargeStatus: Number(wallet.balance || 0) > 0 ? "已充值" : "待充值",
        },
      };
    });
}

function workspaceOperationRows(db = {}) {
  return (Array.isArray(db.taskSpaces) ? db.taskSpaces : [])
    .filter((task) => String(task.status || "").toLowerCase() !== "deleted")
    .map((task) => {
      const workspaceId = workspaceIdFor(task);
      const user = (Array.isArray(db.users) ? db.users : []).find((item) => String(item.id || "") === String(task.userId || ""));
      const binding = bindingForWorkspace(db, workspaceId);
      const subscription = subscriptionForWorkspace(db, user || {}, workspaceId);
      const planId = String(binding.planId || binding.serverPlanId || task.serverPlanId || task.packageId || subscription.packageId || "");
      const capacity = capacityFromPlan(planId, binding, subscription);
      return {
        workspaceId,
        workspaceName: workspaceTitle(task),
        accountId: String(user?.id || task.userId || ""),
        accountName: userDisplayName(user || {}),
        planLabel: planLabel(planId),
        cpuCores: capacity.cpuCores,
        memoryGb: capacity.memoryGb,
        fileSpaceGb: capacity.fileSpaceGb,
        concurrency: workspaceConcurrency(task, planId),
        queueCapacity: workspaceQueueCapacity(task, planId),
        status: resourceState(binding.status || task.managedEnvironmentStatus || task.status),
        auditStatus: String(binding.auditStatus || "not_started"),
      };
    });
}

function activeRunRows(payload = {}, db = {}) {
  const usersById = new Map((Array.isArray(db.users) ? db.users : []).map((user) => [String(user.id || ""), user]));
  const workspaceById = new Map((Array.isArray(db.taskSpaces) ? db.taskSpaces : []).map((task) => [workspaceIdFor(task), task]));
  return (Array.isArray(payload.usageRows) ? payload.usageRows : [])
    .filter((row) => !["completed", "failed", "cancelled", "settled"].includes(String(row.status || "").toLowerCase()))
    .map((row) => {
      const workspaceId = String(row.workspaceId || "");
      const binding = bindingForWorkspace(db, workspaceId);
      const user = usersById.get(String(row.userId || "")) || {};
      const task = workspaceById.get(workspaceId) || {};
      return {
        sessionId: String(row.workspaceSessionId || row.sessionId || ""),
        runId: String(row.runId || ""),
        task: String(task.title || workspaceId || row.runId || "任务"),
        status: String(row.status || "running"),
        accountId: String(row.userId || ""),
        accountName: userDisplayName(user),
        workspaceId,
        estimatedCost: moneyAmount(row.totalCost),
      };
    });
}

function fileRowsForWorkspace(db = {}, workspaceId = "") {
  return (Array.isArray(db.workspaceFiles) ? db.workspaceFiles : [])
    .filter((file) => String(file.workspaceId || "").trim() === workspaceId)
    .filter((file) => String(file.status || "active").toLowerCase() !== "deleted");
}

function fileSpaceOperationRows(db = {}) {
  return workspaceOperationRows(db).map((workspace) => {
    const files = fileRowsForWorkspace(db, workspace.workspaceId);
    const protectedFiles = files.filter((file) => Boolean(file.deletedAt || file.deleted_at || file.retentionCleanupAfterAt || file.retention_cleanup_after_at || String(file.status || "").includes("retention")));
    const usedGb = gbFromBytes(files.reduce((sum, file) => sum + Number(file.sizeBytes || file.size_bytes || 0), 0));
    const protectedGb = gbFromBytes(protectedFiles.reduce((sum, file) => sum + Number(file.sizeBytes || file.size_bytes || 0), 0));
    return {
      workspaceId: workspace.workspaceId,
      workspaceName: workspace.workspaceName,
      accountId: workspace.accountId,
      accountName: workspace.accountName,
      capacityGb: workspace.fileSpaceGb,
      usedGb,
      protectedGb,
      retentionDays: 7,
      deleteProtectionStatus: protectedGb > 0 ? "保护期内" : "无保护占用",
      outputFileCount: files.filter((file) => ["outputs", "output"].includes(String(file.kind || "").toLowerCase())).length,
    };
  });
}

function costAllocationTagRows(db = {}) {
  return (Array.isArray(db.resourceOrders) ? db.resourceOrders : []).map((order) => ({
    resourceOrderId: String(order.resourceOrderId || order.id || ""),
    runId: String(order.runId || ""),
    serverPlanId: String(order.serverPlanId || order.planId || ""),
    tenantId: String(order.tenantId || ""),
    workspaceId: String(order.workspaceId || ""),
    resourceBindingId: String(order.resourceBindingId || ""),
    environmentId: String(order.environmentId || ""),
    estimatedCost: moneyAmount(order.estimatedCost || order.totalCost || 0),
    status: String(order.status || ""),
  }));
}

function tPlus1Status(db = {}) {
  const statuses = (Array.isArray(db.weeklyProtectionFreezes) ? db.weeklyProtectionFreezes : [])
    .map((item) => String(item.tPlus1AuditStatus || item.t_plus_1_audit_status || "").toLowerCase())
    .filter(Boolean);
  if (!statuses.length) return "未开始";
  if (statuses.some((status) => ["pending", "audit_pending"].includes(status))) return "待对账";
  if (statuses.some((status) => ["failed", "exception"].includes(status))) return "异常";
  return "已对账";
}

function auditAndAnnouncementRows(payload = {}, db = {}) {
  const auditEvents = (Array.isArray(payload.auditRows) ? payload.auditRows : []).map((item) => ({
    type: String(item.type || ""),
    accountId: String(item.userId || ""),
    workspaceId: String(item.workspaceId || ""),
    occurredAt: String(item.occurredAt || ""),
  }));
  const exceptions = auditEvents.filter((item) => /fail|error|exception|warning|blocked|denied/i.test(item.type));
  return {
    auditEvents,
    exceptions,
    releaseFailures: auditEvents.filter((item) => /release.*fail|释放失败/i.test(item.type)),
    billingExceptions: auditEvents.filter((item) => /billing.*exception|账单异常|billing_warning/i.test(item.type)),
    announcements: (Array.isArray(db.announcements) ? db.announcements : [])
      .filter((item) => String(item.status || "published").toLowerCase() !== "deleted")
      .map((item) => ({
        id: String(item.id || ""),
        title: String(item.title || ""),
        status: String(item.status || "published"),
        createdAt: String(item.createdAt || ""),
      })),
  };
}

function adminOpsSummary({ accounts = [], workspaces = [], runs = [], fileSpaces = [], costTags = [], audit = {} } = {}) {
  return {
    accountCount: accounts.length,
    workspaceCount: workspaces.length,
    currentRunCount: runs.length,
    usedFileSpaceGb: moneyAmount(fileSpaces.reduce((sum, item) => sum + Number(item.usedGb || 0), 0)),
    estimatedCost: moneyAmount(costTags.reduce((sum, item) => sum + Number(item.estimatedCost || 0), 0)),
    exceptionCount: (audit.exceptions || []).length,
  };
}

function customerBillingRiskStatus(risk = {}) {
  if (risk.status === "healthy") return "healthy";
  if (risk.severity === "warning") return "warning";
  if (risk.status === "suspended") return "suspended";
  return "blocked";
}

function currentPackageName(db, user = {}) {
  const tenantId = userTenantId(user);
  const userId = String(user.id || "").trim();
  const subscription = (Array.isArray(db.labSubscriptions) ? db.labSubscriptions : [])
    .filter((item) => item.userId === userId || item.tenantId === tenantId)
    .filter((item) => item.status !== "cancelled")
    .sort((a, b) => String(b.updatedAt || b.createdAt || "").localeCompare(String(a.updatedAt || a.createdAt || "")))[0];
  if (!subscription) return "";
  return subscription.packageId === "starter" ? "入门套餐" : subscription.packageId === "pro" ? "进阶套餐" : subscription.packageId;
}

function customerAccountingRow(db, user, { now }) {
  const summary = buildUserBillingSummary(db, { user, now, nextPaidActionCents: 0 });
  const entries = userLedgerEntries(db, user);
  const lastRecharge = entries.find((entry) => entry.type === "topup");
  const lastSpend = entries.find((entry) => ["subscription_daily_charge", "pending_usage", "exact_resource_charge", "makeup_charge"].includes(entry.type));
  return {
    tenantId: userTenantId(user),
    userId: user.id,
    displayName: userDisplayName(user),
    email: user.email || "",
    packageName: currentPackageName(db, user),
    balanceCents: summary.balanceCents,
    availableBalanceCents: summary.availableBalanceCents,
    frozenAmountCents: summary.frozenWeeklyAmountCents,
    todaySpendCents: summary.todaySpendCents,
    monthSpendCents: summary.monthSpendCents,
    totalSpendCents: summary.totalSpendCents,
    rechargeTotalCents: summary.rechargeTotalCents,
    runningResourceCount: activeResourceOrdersForUser(db, user).length,
    billingRiskStatus: customerBillingRiskStatus(summary.risk),
    lastRechargeAt: lastRecharge?.createdAt || "",
    lastSpendAt: lastSpend?.createdAt || "",
  };
}

function sumCustomerCents(customers = [], key) {
  return customers.reduce((sum, item) => sum + Number(item[key] || 0), 0);
}

function customerAccountingSummary(db, customers = []) {
  return {
    customerCount: customers.length,
    activeCustomerCount: customers.filter((item) => item.runningResourceCount > 0).length,
    todaySpendCents: sumCustomerCents(customers, "todaySpendCents"),
    monthSpendCents: sumCustomerCents(customers, "monthSpendCents"),
    pendingExactCents: customers.reduce((sum, item) => sum + pendingExactForCustomer(db, item.userId, item.tenantId), 0),
    unattributedBillRowCount: Array.isArray(db.unattributedBills) ? db.unattributedBills.length : 0,
  };
}

function userScopedRows(db, collectionKey, userId, tenantId) {
  const rows = Array.isArray(db[collectionKey]) ? db[collectionKey] : [];
  return rows.filter((item) => item.userId === userId || item.tenantId === tenantId);
}

export function buildAdminCustomerAccountingPayload(db, { now = new Date().toISOString() } = {}) {
  const users = commercialCustomers(db);
  const customers = users.map((user) => customerAccountingRow(db, user, { now }));
  return {
    customers,
    summary: customerAccountingSummary(db, customers),
    segmentPolicy: {
      defaultSegment: "real_customer",
      excludedByDefault: ["internal", "test_fixture"],
    },
  };
}

function pendingExactForCustomer(db, userId = "", tenantId = "") {
  return normalizeLedgerEntries(db.ledger || [])
    .filter((entry) => entry.type === "pending_usage")
    .filter((entry) => entry.userId === userId || entry.tenantId === tenantId)
    .reduce((sum, entry) => sum + Math.round(Number(entry.amount || 0) * 100), 0);
}

export function buildAdminCustomerAccountingDetailPayload(db, tenantIdOrUserId = "", { now = new Date().toISOString() } = {}) {
  const targetId = String(tenantIdOrUserId || "").trim();
  const user = (Array.isArray(db.users) ? db.users : []).find((item) => item.id === targetId || userTenantId(item) === targetId);
  if (!user) return null;
  const summary = buildUserBillingSummary(db, { user, now, nextPaidActionCents: 0 });
  const entries = userLedgerEntries(db, user);
  const tenantId = userTenantId(user);
  const userId = String(user.id || "").trim();
  return {
    tenantId,
    userId,
    displayName: userDisplayName(user),
    wallet: {
      balanceCents: summary.balanceCents,
      availableBalanceCents: summary.availableBalanceCents,
      frozenAmountCents: summary.frozenWeeklyAmountCents,
    },
    recharges: entries.filter((entry) => entry.type === "topup"),
    ledger: entries,
    activeResourceOrders: activeResourceOrdersForUser(db, user),
    historicalRuns: userScopedRows(db, "runs", userId, tenantId),
    workspaceFiles: userScopedRows(db, "workspaceFiles", userId, tenantId),
    sessionTraces: userScopedRows(db, "workspaceSessions", userId, tenantId),
  };
}

export function createPortalAdminApiPayloads(deps) {
  const {
    activeUserStatus,
    buildAdminSecuritySummary,
    collectRunsForTask,
    collectRunsForUser,
    fetchBillingStatus,
    fetchBillingSummary,
    fetchHarborSummary,
    fetchLangfuseSummary,
    fetchMinioSummary,
    fetchPendingSummary,
    fetchTraceRows,
    fetchWorkspaceMinioState,
    fetchWorkspaceStorageSnapshot,
    formatDateTime,
    groupBillingByDay,
    humanizeStatus,
    isRunTerminal,
    latestActiveWorkspaceSession,
    listTaskSpacesForUser,
    money,
    normalizePageSize,
    paginateRows,
    probe,
    rangeBounds,
    readPortalEvents,
    readWorkspaceSession,
    redisConfigured = false,
    runtimePerformanceSummary,
    sanitizeTaskTitle,
    storageMode,
    productProfile = {},
    urls: configuredUrls = {},
    withinDateRange,
    workspaceChatSessionsForUser,
  } = deps;
  const urls = defaultUrls(configuredUrls);
  const runtimeMode = String(productProfile.runtimeMode || "user_owned").trim().toLowerCase() || "user_owned";
  const opsProfileEnabled = Boolean(productProfile.opsProfileEnabled);
  const opsSurfaceEnabled = opsProfileEnabled || runtimeMode === "managed_runtime";

  async function buildAdminOverviewPayload(db) {
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
    const serviceStatuses = await Promise.all([
      { name: "Portal OPL Adapter", url: new URL("/healthz", `${urls.portalOplAdapterUrl}/`).toString() },
      { name: "Langfuse", url: urls.langfuseUrl },
      ...(opsSurfaceEnabled ? [
        { name: "Rancher", url: urls.rancherUrl },
        { name: "OpenCost", url: urls.opencostUiUrl },
        { name: "Harbor", url: urls.harborUrl },
        { name: "MinIO", url: urls.minioConsoleUrl },
      ] : []),
    ].filter((item) => item.url).map(async (item) => ({ ...item, probe: await probe(item.url) })));
    const disabledOpsSummary = { available: false, mode: "disabled", note: "默认 user-owned 模式下未启用运维入口" };
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

    const warningEvents = recentEvents
      .filter((event) => /fail|error|denied|blocked|pending|reconcile/i.test(String(event.type || "")))
      .slice(0, 12);
    const lowBalanceUsers = users
      .map((entry) => {
        const wallet = db.wallets.find((wallet) => wallet.userId === entry.id) || { balance: 0 };
        return { userId: entry.id, name: entry.name, email: entry.email, balance: Number(wallet.balance || 0) };
      })
      .filter((entry) => entry.balance <= 0)
      .slice(0, 12);
    const failedRuns = allRuns
      .filter((run) => String(run.status || "").toLowerCase() === "failed")
      .slice(0, 12)
      .map((run) => ({
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
          note: !opsSurfaceEnabled ? "默认 user-owned 模式下未启用 Rancher 入口" : (urls.rancherUrl ? "当前仅展示入口与可达状态" : "未配置 Rancher 入口"),
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
    };
  }

  function buildAdminUsersApiPayload(db, payload, options = {}) {
    const workspaceFilter = String(options.workspace || "").trim().toLowerCase();
    const idFilter = String(options.userId || "").trim().toLowerCase();
    const usernameFilter = String(options.username || "").trim().toLowerCase();
    const emailFilter = String(options.email || "").trim().toLowerCase();
    const keywordFilter = String(options.q || "").trim().toLowerCase();
    const users = buildAdminUsersRows({
      users: db.users,
      wallets: db.wallets,
      taskSpaces: db.taskSpaces,
      workspaceSessions: db.workspaceSessions,
      sessions: db.sessions,
      activeUserStatus,
      formatDateTime,
      groupNameById: (groupId) => groupNameById(db, groupId),
    })
      .filter((item) => {
        const haystack = `${item.id} ${item.name} ${item.email} ${(item.workspaceSlugs || []).join(" ")}`.toLowerCase();
        if (workspaceFilter && !(item.workspaceSlugs || []).some((slug) => String(slug || "").toLowerCase().includes(workspaceFilter))) return false;
        if (idFilter && !String(item.id || "").toLowerCase().includes(idFilter)) return false;
        if (usernameFilter && !String(item.name || "").toLowerCase().includes(usernameFilter)) return false;
        if (emailFilter && !String(item.email || "").toLowerCase().includes(emailFilter)) return false;
        if (keywordFilter && !haystack.includes(keywordFilter)) return false;
        return true;
      })
      .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
    const pagination = paginateRows(users, options.page, normalizePageSize(options.pageSize || 5));
    const financeRows = db.ledger
      .filter((item) => ["topup", "refund", "makeup_charge"].includes(item.type))
      .slice()
      .reverse()
      .slice(0, 50)
      .map((item) => {
        const targetUser = db.users.find((user) => user.id === item.userId) || {};
        return {
          id: item.id,
          userId: item.userId,
          userName: targetUser.name || item.userId,
          type: item.type,
          amount: Number(item.amount || 0),
          createdAt: item.createdAt,
          reason: item.reason || "",
        };
      });
    return {
      items: pagination.rows,
      pagination: {
        page: pagination.page,
        pageSize: pagination.pageSize,
        total: pagination.total,
        totalPages: pagination.totalPages,
      },
      allowRegistration: isRegistrationEnabled(db),
      financeRows,
      groups: db.groups.map((group) => ({ id: group.id, name: group.name })),
      kpis: payload.kpis,
    };
  }

  function buildAdminGroupsApiPayload(db, payload) {
    return {
      groups: payload.groups || [],
      users: db.users
        .filter((item) => item.role !== "admin")
        .map((item) => ({ id: item.id, name: item.name, email: item.email, groupId: item.groupId || "" })),
    };
  }

  function buildAdminUsageApiPayload(payload, options = {}) {
    const pagination = paginateRows(payload.usageRows || [], options.page, normalizePageSize(options.pageSize || 10));
    return {
      items: pagination.rows,
      pagination: {
        page: pagination.page,
        pageSize: pagination.pageSize,
        total: pagination.total,
        totalPages: pagination.totalPages,
      },
      productProfile: payload.productProfile || {},
    };
  }

  function buildAdminBillingOpsApiPayload(db, payload) {
    return {
      billingSync: payload.billingSync,
      pending: payload.pending,
      pendingRuns: payload.pendingRuns || [],
      warningEvents: payload.warningEvents || [],
      summaries: payload.summaries,
      productProfile: payload.productProfile || {},
      users: db.users.filter((item) => item.role !== "admin").map((item) => ({ id: item.id, name: item.name, email: item.email })),
      workspaces: db.taskSpaces.filter((item) => item.status !== "deleted").map((item) => ({ slug: item.slug, title: sanitizeTaskTitle(item.slug, item.title) })),
      adjustments: db.ledger
        .filter((item) => item.type === "refund" || item.type === "makeup_charge")
        .slice(-20)
        .reverse()
        .map((item) => {
          const targetUser = db.users.find((entry) => entry.id === item.userId) || {};
          return {
            type: item.type,
            userId: item.userId,
            userName: targetUser.name || item.userId,
            amount: Number(item.amount || 0),
            runId: item.runId || "",
            workspaceId: item.workspaceId || "",
            reason: item.reason || "",
            createdAt: item.createdAt,
          };
        }),
    };
  }

  function buildAdminSystemApiPayload(payload) {
    return {
      serviceStatuses: payload.serviceStatuses || [],
      summaries: payload.summaries || {},
      systemMetrics: payload.systemMetrics || {},
      productProfile: payload.productProfile || {},
    };
  }

  function buildAdminOpsApiPayload(dbOrPayload, maybePayload = null) {
    if (!maybePayload) {
      const payload = dbOrPayload || {};
      return {
        cloudResourceRows: payload.cloudResourceRows || [],
        systemMetrics: payload.systemMetrics || {},
        pending: payload.pending || {},
        warningEvents: payload.warningEvents || [],
        alerts: payload.alerts || [],
        summaries: payload.summaries || {},
        productProfile: payload.productProfile || {},
      };
    }
    const db = dbOrPayload || {};
    const payload = maybePayload || {};
    const accounts = accountOperationRows(db);
    const workspaces = workspaceOperationRows(db);
    const currentRuns = activeRunRows(payload, db);
    const fileSpaces = fileSpaceOperationRows(db);
    const costTags = costAllocationTagRows(db);
    const audit = auditAndAnnouncementRows(payload, db);
    return {
      roleSurface: "admin_ops",
      boundaries: {
        readonlyMvp: true,
        adminRoleOnly: true,
        userNavigationShowsAdminEntry: false,
        createsRealResources: false,
        realBillingMutation: false,
        callsRealCloud: false,
        futureAuthorizedImplementationRequired: true,
      },
      summary: adminOpsSummary({ accounts, workspaces, runs: currentRuns, fileSpaces, costTags, audit }),
      accountOperations: {
        accounts,
      },
      workspaceOperations: {
        resourceStates: ["计划中", "准备中", "可用", "释放中", "已释放", "异常"],
        workspaces,
      },
      currentRuns: {
        items: currentRuns,
      },
      fileSpaceOperations: {
        items: fileSpaces,
      },
      costReconciliation: {
        estimatedCost: {
          amount: moneyAmount(costTags.reduce((sum, item) => sum + Number(item.estimatedCost || 0), 0)),
          currency: "CNY",
          billingTruth: false,
          chargeApplied: false,
        },
        frozenAmount: moneyAmount((Array.isArray(db.weeklyProtectionFreezes) ? db.weeklyProtectionFreezes : []).reduce((sum, item) => sum + Number(item.frozenAmount || item.weeklyAmount || 0), 0)),
        tPlus1Status: tPlus1Status(db),
        costAllocationTags: costTags,
      },
      auditAndAnnouncements: audit,
      productProfile: payload.productProfile || {},
    };
  }

  function buildAdminSandboxesApiPayload(payload) {
    return {
      items: payload.sandboxes || [],
      productProfile: payload.productProfile || {},
    };
  }

  function buildAdminAuditApiPayload(payload, options = {}) {
    const pagination = paginateRows(payload.auditRows || [], options.page, normalizePageSize(options.pageSize || 10));
    return {
      items: pagination.rows,
      pagination: {
        page: pagination.page,
        pageSize: pagination.pageSize,
        total: pagination.total,
        totalPages: pagination.totalPages,
      },
    };
  }

  const {
    buildAdminRunPortraitApiPayload,
    buildAdminUserPortraitApiPayload,
    buildAdminWorkspacePortraitApiPayload,
  } = createPortalAdminPortraitPayloads({
    collectRunsForTask,
    collectRunsForUser,
    fetchBillingSummary,
    fetchTraceRows,
    fetchWorkspaceMinioState,
    fetchWorkspaceStorageSnapshot,
    formatDateTime,
    humanizeStatus,
    isRunTerminal,
    latestActiveWorkspaceSession,
    listTaskSpacesForUser,
    money,
    readWorkspaceSession,
    sanitizeTaskTitle,
    workspaceChatSessionsForUser,
    productProfile: {
      runtimeMode,
      opsProfileEnabled,
      opsSurfaceEnabled,
    },
  });

  return {
    buildAdminAuditApiPayload,
    buildAdminBillingOpsApiPayload,
    buildAdminCustomerAccountingPayload,
    buildAdminCustomerAccountingDetailPayload,
    buildAdminGroupsApiPayload,
    buildAdminOpsApiPayload,
    buildAdminOverviewPayload,
    buildAdminRunPortraitApiPayload,
    buildAdminSandboxesApiPayload,
    buildAdminSystemApiPayload,
    buildAdminUsageApiPayload,
    buildAdminUserPortraitApiPayload,
    buildAdminUsersApiPayload,
    buildAdminWorkspacePortraitApiPayload,
  };
}
