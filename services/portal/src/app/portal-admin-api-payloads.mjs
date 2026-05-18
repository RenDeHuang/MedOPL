import { getCanonicalResourcePlan } from "../domain/lab-packages.mjs";
import { ensurePublicSiteSettings } from "../domain/portal-public-settings.mjs";
import { buildUserBillingSummary, normalizeLedgerEntries } from "../domain/wallet-ledger.mjs";
import {
  buildAdminUsersRows,
  commercialCustomers,
  customerSegment,
  userTenantId,
} from "./portal-admin-api-payload-helpers.mjs";
import { createPortalAdminOverviewPayloadBuilder } from "./portal-admin-overview-runtime-payloads.mjs";
import { createPortalAdminPortraitPayloads } from "./portal-admin-portrait-payloads.mjs";

function isRegistrationEnabled(db) {
  return db?.settings?.allowRegistration !== false;
}

function groupNameById(db, groupId = "") {
  if (!groupId) return "";
  const group = db.groups.find((item) => item.id === groupId);
  return group?.name || "";
}

function text(value = "") {
  return String(value ?? "").trim();
}

function defaultUrls(urls = {}) {
  return {
    harborUrl: urls.harborUrl || "",
    langfuseUrl: urls.langfuseUrl || "",
    minioConsoleUrl: urls.minioConsoleUrl || "",
    oplWebUrl: urls.oplWebUrl || "",
    portalRuntimeBridgeUrl: urls.portalRuntimeBridgeUrl || "",
    rancherUrl: urls.rancherUrl || "",
  };
}

function userDisplayName(user = {}) {
  return String(user.name || user.email || user.id || "").trim();
}

function userLedgerEntries(db, user = {}) {
  const tenantId = userTenantId(user);
  const userId = String(user.id || "").trim();
  return normalizeLedgerEntries(db.ledger || [])
    .filter((entry) => entry.userId === userId || entry.tenantId === tenantId || entry.billingAccountId === userId || entry.billingAccountId === tenantId)
    .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
}

function activeResourceBindingsForUser(db, user = {}) {
  const tenantId = userTenantId(user);
  const userId = String(user.id || "").trim();
  return (Array.isArray(db.workspaceResourceBindings) ? db.workspaceResourceBindings : [])
    .filter((item) => item.userId === userId || item.ownerUserId === userId || item.accountId === userId || item.tenantId === tenantId || item.ownerTenantId === tenantId)
    .filter((item) => !["released", "settled", "failed", "cancelled", "deleted"].includes(String(item.status || "").toLowerCase()));
}

function moneyAmount(value = 0) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? Number(parsed.toFixed(2)) : 0;
}

function billingOpIdFor(source = "", row = {}) {
  const parts = [
    source,
    row.id || row.itemId || row.ledgerId,
    row.runId || row.sourceId || row.eventId || row.auditEventId,
    row.userId || row.customerId || row.tenantId,
    row.workspaceId,
    row.createdAt || row.occurredAt || row.completedAt,
    row.type || row.category || row.severity || row.reason || row.title || row.detail,
  ].map((part) => text(part).replace(/\s+/g, "-"));
  return `billing-op:${parts.map((part) => part || "none").join(":")}`;
}

function billingOperationFor(source = "", row = {}, operationsById = new Map()) {
  const id = billingOpIdFor(source, row);
  return {
    id,
    operation: operationsById.get(id) || {},
  };
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
  return (Array.isArray(db.workspaceResourceBindings) ? db.workspaceResourceBindings : []).map((binding) => {
    const resourceBindingId = String(binding.resourceBindingId || binding.id || "");
    return {
      resourceBindingId,
      billingAttributionId: String(binding.billingAttributionId || binding.cloudOperationId || binding.costAllocationTag || resourceBindingId),
      accountId: String(binding.accountId || binding.userId || binding.ownerUserId || binding.tenantId || binding.ownerTenantId || ""),
      runId: String(binding.runId || ""),
      serverPlanId: String(binding.serverPlanId || binding.planId || binding.packageId || ""),
      tenantId: String(binding.tenantId || binding.ownerTenantId || ""),
      workspaceId: String(binding.workspaceId || ""),
      environmentId: String(binding.environmentId || binding.managedEnvironmentId || ""),
      estimatedCost: moneyAmount(binding.estimatedCost || binding.totalCost || binding.freezeAmount || 0),
      status: String(binding.status || ""),
    };
  });
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
    activeResourceBindingCount: activeResourceBindingsForUser(db, user).length,
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
    activeCustomerCount: customers.filter((item) => item.activeResourceBindingCount > 0).length,
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
    activeResourceBindings: activeResourceBindingsForUser(db, user),
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
  const runtimeMode = String(productProfile.runtimeMode || "platform_provisioned").trim().toLowerCase() || "platform_provisioned";
  const opsProfileEnabled = Boolean(productProfile.opsProfileEnabled);
  const opsSurfaceEnabled = opsProfileEnabled;

  const buildAdminOverviewPayload = createPortalAdminOverviewPayloadBuilder({
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
  });

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
    const billingOpsById = new Map((Array.isArray(db.settings?.billingOps) ? db.settings.billingOps : [])
      .map((item) => [String(item.id || item.itemId || "").trim(), item])
      .filter(([id]) => id));
    const pendingRuns = (payload.pendingRuns || []).map((item) => {
      const targetUser = db.users.find((entry) => entry.id === (item.userId || item.customerId)) || {};
      const { id, operation } = billingOperationFor("pendingRuns", item, billingOpsById);
      return {
        ...item,
        id,
        userId: item.userId || item.customerId || "",
        userName: item.userName || targetUser.name || item.customerId || item.userId || "",
        amount: Number(item.amount || item.totalCost || 0),
        reason: item.reason || "platform_metering_projection",
        status: operation.status || "pending",
        anomaly: Boolean(operation.anomaly),
        note: operation.note || "",
        handledAt: operation.updatedAt || "",
        handledBy: operation.operatorId || "",
      };
    });
    const warningEvents = (payload.warningEvents || []).map((item) => {
      const targetUser = db.users.find((entry) => entry.id === item.userId) || {};
      const { id, operation } = billingOperationFor("warningEvents", item, billingOpsById);
      const hasOperation = Boolean(text(operation.id || operation.itemId));
      return {
        ...item,
        id,
        userName: item.userName || targetUser.name || item.userId || "",
        amount: Number(item.amount || item.totalCost || item.estimatedCost || 0),
        status: operation.status || "pending",
        anomaly: hasOperation ? Boolean(operation.anomaly) : Boolean(item.anomaly || item.severity),
        note: operation.note || "",
        handledAt: operation.updatedAt || "",
        handledBy: operation.operatorId || "",
      };
    });
    return {
      billingSync: payload.billingSync,
      pending: payload.pending,
      pendingRuns,
      warningEvents,
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
          const { id, operation } = billingOperationFor("adjustments", item, billingOpsById);
          return {
            id,
            ledgerId: item.id,
            type: item.type,
            userId: item.userId,
            userName: targetUser.name || item.userId,
            amount: Number(item.amount || 0),
            runId: item.runId || "",
            workspaceId: item.workspaceId || "",
            reason: item.reason || "",
            status: operation.status || "pending",
            anomaly: Boolean(operation.anomaly),
            note: operation.note || "",
            handledAt: operation.updatedAt || "",
            handledBy: operation.operatorId || "",
            createdAt: item.createdAt,
          };
        }),
    };
  }

  function buildAdminSystemApiPayload(db, payload) {
    return {
      serviceStatuses: payload.serviceStatuses || [],
      summaries: payload.summaries || {},
      systemMetrics: payload.systemMetrics || {},
      productProfile: payload.productProfile || {},
      allowRegistration: isRegistrationEnabled(db),
      publicSettings: ensurePublicSiteSettings(db),
    };
  }

  function buildAdminOpsApiPayload(dbOrPayload, maybePayload = null) {
    if (!maybePayload) {
      const payload = dbOrPayload || {};
      return {
        managedResourceBindingRows: payload.managedResourceBindingRows || [],
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
