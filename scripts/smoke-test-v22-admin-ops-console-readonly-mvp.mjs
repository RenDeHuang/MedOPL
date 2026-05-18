import assert from "node:assert/strict";
import { readdir, readFile, stat } from "node:fs/promises";
import { retiredFigmaZipResidue } from "./smoke-test-v22-portal-retired-frontend-surface-gate.mjs";

const { createPortalAdminApiPayloads } = await import("../services/portal/src/app/portal-admin-api-payloads.mjs");

const now = "2026-05-08T08:00:00.000Z";
const forbiddenSecretsAndStorage = [
  "SecretId",
  "SecretKey",
  "raw API Key",
  "rawApiKey",
  "kubeconfig",
  "objectKey",
  "storageKey",
  "cosPrefix",
  "storageBackend",
  "signedUrl",
  "cos-prefix-proof-must-not-leak",
  "cos_standard_workspace_quota",
  "secret-proof-must-not-leak",
];
const forbiddenCloudMutationCopy = [
  "真实云控制台式操作",
  "直接删除节点池",
  "直接释放云资源",
  "直接改真实资源",
  "删除节点池",
  "CVM",
  "COS",
  "K8s",
  "TKE",
  "服务器编号",
  "云资源清单",
];

function assertIncludesAll(source, phrases, label) {
  for (const phrase of phrases) {
    assert(source.includes(phrase), `${label}_missing:${phrase}`);
  }
}

function assertNotIncludesAny(source, phrases, label) {
  for (const phrase of phrases) {
    assert.equal(source.includes(phrase), false, `${label}_must_not_include:${phrase}`);
  }
}

function sortedKeys(value) {
  return Object.keys(value).sort();
}

function assertTopLevelKeys(value, expected, label) {
  assert.deepEqual(sortedKeys(value), expected.slice().sort(), `${label}_keys_mismatch`);
}

function sliceBetween(source, start, end, label) {
  const startIndex = source.indexOf(start);
  assert.notEqual(startIndex, -1, `${label}_start_marker_missing`);
  const endIndex = source.indexOf(end, startIndex + start.length);
  assert.notEqual(endIndex, -1, `${label}_end_marker_missing`);
  return source.slice(startIndex, endIndex);
}

async function exists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readAdminPageSources() {
  const root = "services/portal/frontend/src/app/pages/admin";
  const entries = await readdir(root, { withFileTypes: true });
  const sources = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".tsx")) continue;
    sources.push(await readFile(`${root}/${entry.name}`, "utf8"));
  }
  return sources.join("\n");
}

const db = {
  users: [
    { id: "admin-ops-1", email: "ops@example.test", name: "Ops", role: "admin", status: "active", createdAt: now },
    { id: "user-alpha", tenantId: "tenant-alpha", email: "alpha@example.test", name: "Alpha Lab", role: "user", status: "active", customerSegment: "real_customer", createdAt: now },
    { id: "user-beta", tenantId: "tenant-beta", email: "beta@example.test", name: "Beta Lab", role: "user", status: "disabled", customerSegment: "real_customer", createdAt: now },
  ],
  wallets: [
    { userId: "user-alpha", balance: 360, updatedAt: now },
    { userId: "user-beta", balance: 0, updatedAt: now },
  ],
  groups: [],
  taskSpaces: [
    {
      slug: "workspace-alpha",
      title: "Alpha 工作空间",
      userId: "user-alpha",
      status: "active",
      serverPlanId: "starter_2c4g_10gb",
      packageId: "starter_2c4g_10gb",
      maxConcurrentRuns: 2,
      queueCapacity: 4,
      createdAt: now,
      updatedAt: now,
    },
    {
      slug: "workspace-beta",
      title: "Beta 工作空间",
      userId: "user-beta",
      status: "preparing",
      serverPlanId: "pro_8c16g_100gb",
      packageId: "pro_8c16g_100gb",
      maxConcurrentRuns: 8,
      queueCapacity: 16,
      createdAt: now,
      updatedAt: now,
    },
  ],
  labSubscriptions: [
    {
      id: "sub-alpha",
      userId: "user-alpha",
      tenantId: "tenant-alpha",
      workspaceId: "workspace-alpha",
      packageId: "starter_2c4g_10gb",
      status: "active",
      computeTier: "starter",
      includedStorageGb: 10,
      weeklyFreezeAmount: 18,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "sub-beta",
      userId: "user-beta",
      tenantId: "tenant-beta",
      workspaceId: "workspace-beta",
      packageId: "pro_8c16g_100gb",
      status: "disabled",
      computeTier: "pro",
      includedStorageGb: 100,
      weeklyFreezeAmount: 88,
      createdAt: now,
      updatedAt: now,
    },
  ],
  workspaceResourceBindings: [
    {
      id: "binding-alpha",
      resourceBindingId: "rb-alpha",
      environmentId: "env-alpha",
      ownerUserId: "user-alpha",
      userId: "user-alpha",
      ownerTenantId: "tenant-alpha",
      tenantId: "tenant-alpha",
      workspaceId: "workspace-alpha",
      planId: "starter_2c4g_10gb",
      serverPlanId: "starter_2c4g_10gb",
      packageId: "starter_2c4g_10gb",
      billingAttributionId: "bill-rb-alpha",
      accountId: "user-alpha",
      runId: "run-alpha",
      estimatedCost: 9.6,
      cpuCores: 2,
      memoryGb: 4,
      fileSpaceGb: 10,
      storageBackend: "cos_standard_workspace_quota",
      status: "active",
      auditStatus: "passed",
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "binding-beta",
      resourceBindingId: "rb-beta",
      environmentId: "env-beta",
      ownerUserId: "user-beta",
      userId: "user-beta",
      ownerTenantId: "tenant-beta",
      tenantId: "tenant-beta",
      workspaceId: "workspace-beta",
      planId: "pro_8c16g_100gb",
      serverPlanId: "pro_8c16g_100gb",
      packageId: "pro_8c16g_100gb",
      billingAttributionId: "bill-rb-beta",
      accountId: "user-beta",
      estimatedCost: 1.2,
      cpuCores: 8,
      memoryGb: 16,
      fileSpaceGb: 100,
      status: "preparing",
      auditStatus: "pending",
      createdAt: now,
      updatedAt: now,
    },
  ],
  workspaceSessions: [{
    id: "session-alpha",
    userId: "user-alpha",
    tenantId: "tenant-alpha",
    workspaceId: "workspace-alpha",
    resourceBindingId: "rb-alpha",
    environmentId: "env-alpha",
    status: "active",
    createdAt: now,
    lastUsedAt: now,
  }],
  workspaceFiles: [
    {
      id: "file-output-alpha",
      userId: "user-alpha",
      tenantId: "tenant-alpha",
      workspaceId: "workspace-alpha",
      kind: "outputs",
      name: "result.csv",
      source: "runtime_bridge_artifact_reference",
      runId: "run-alpha",
      oplSessionId: "session-alpha",
      artifactRef: "artifact-alpha",
      sizeBytes: 1024 * 1024 * 256,
      status: "active",
      objectKey: "object-key-proof-must-not-leak",
      storageKey: "storage-key-proof-must-not-leak",
      cosPrefix: "cos-prefix-proof-must-not-leak",
      storageBackend: "cos_standard_workspace_quota",
      signedUrl: "https://signed-url-proof-must-not-leak",
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "file-deleted-alpha",
      userId: "user-alpha",
      tenantId: "tenant-alpha",
      workspaceId: "workspace-alpha",
      kind: "outputs",
      name: "deleted.csv",
      source: "runtime_bridge_artifact_reference",
      runId: "run-alpha",
      sizeBytes: 1024 * 1024 * 64,
      status: "retention_protected",
      deletedAt: now,
      retentionCleanupAfterAt: "2026-05-15T08:00:00.000Z",
      createdAt: now,
      updatedAt: now,
    },
  ],
  weeklyProtectionFreezes: [
    {
      id: "freeze-alpha",
      userId: "user-alpha",
      tenantId: "tenant-alpha",
      workspaceId: "workspace-alpha",
      resourceBindingId: "rb-alpha",
      frozenAmount: 18,
      status: "active",
      tPlus1AuditStatus: "pending",
      createdAt: now,
      updatedAt: now,
    },
  ],
  ledger: [
    { id: "ledger-topup-alpha", userId: "user-alpha", tenantId: "tenant-alpha", type: "topup", amount: 360, createdAt: now },
    { id: "ledger-frozen-alpha", userId: "user-alpha", tenantId: "tenant-alpha", type: "pending_usage", amount: 18, workspaceId: "workspace-alpha", runId: "run-alpha", createdAt: now },
  ],
  userSandboxes: [],
  announcements: [
    { id: "announcement-1", title: "维护窗口", status: "published", createdAt: now },
  ],
};

const runFixture = {
  runId: "run-alpha",
  userId: "user-alpha",
  workspaceId: "workspace-alpha",
  workspaceSessionId: "session-alpha",
  resourceBindingId: "rb-alpha",
  environmentId: "env-alpha",
  status: "running",
  createdAt: now,
  source: "fixture",
};

const payloads = createPortalAdminApiPayloads({
  activeUserStatus: (status) => String(status || "active").toLowerCase(),
  buildAdminSecuritySummary: () => ({ healthy: true, failedCount: 0, checks: [] }),
  collectRunsForTask: async () => [runFixture],
  collectRunsForUser: async (userId) => userId === "user-alpha" ? [runFixture] : [],
  fetchBillingStatus: async () => ({
    autoReconcileEnabled: true,
    reconcileState: { lastRunAt: now, lastScope: "all", lastReconciledCount: 2 },
    tencentBillingEnabled: false,
    tencentCloudConfigured: false,
  }),
  fetchBillingSummary: async () => ({
    totals: { cpuCost: 3.2, gpuCost: 0, pvCost: 1.2, totalCost: 9.6 },
    currency: "CNY",
    items: [{
      name: "run-alpha",
      totalCost: 9.6,
      cpuCost: 3.2,
      gpuCost: 0,
      pvCost: 1.2,
      createdAt: now,
      properties: {
        "label:customer_id": "user-alpha",
        "label:run_id": "run-alpha",
        "label:workspace_id": "workspace-alpha",
        "label:resource_binding_id": "rb-alpha",
      },
    }, {
      name: "workspace-alpha-base-cost",
      totalCost: 1.2,
      cpuCost: 1.2,
      gpuCost: 0,
      pvCost: 0,
      createdAt: now,
      properties: {
        "label:customer_id": "user-alpha",
        "label:workspace_id": "workspace-alpha",
        "label:resource_binding_id": "rb-alpha",
      },
    }],
  }),
  fetchHarborSummary: async () => ({ available: false, mode: "deferred" }),
  fetchLangfuseSummary: async () => ({ available: false, mode: "deferred" }),
  fetchMinioSummary: async () => ({ available: false, mode: "deferred" }),
  fetchPendingSummary: async () => ({ pendingCount: 0, runs: [] }),
  fetchTraceRows: async () => ({ rows: [] }),
  fetchWorkspaceMinioState: async () => ({ available: false }),
  fetchWorkspaceStorageSnapshot: async () => ({ files: [], outputs: [] }),
  formatDateTime: (value) => value ? `fmt:${value}` : "",
  groupBillingByDay: () => ({ labels: [now.slice(0, 10)], total: [9.6], cpu: [3.2], gpu: [0], storage: [1.2] }),
  humanizeStatus: (status) => String(status || ""),
  isRunTerminal: (run) => ["completed", "failed", "cancelled"].includes(String(run?.status || "").toLowerCase()),
  latestActiveWorkspaceSession: () => db.workspaceSessions[0],
  listTaskSpacesForUser: () => db.taskSpaces,
  money: (value) => Number(value || 0).toFixed(2),
  normalizePageSize: (value) => Number(value || 10),
  paginateRows: (rows, pageValue = 1, pageSizeValue = 10) => ({
    rows: rows.slice(0, Number(pageSizeValue || 10)),
    page: Number(pageValue || 1),
    pageSize: Number(pageSizeValue || 10),
    total: rows.length,
    totalPages: Math.max(1, Math.ceil(rows.length / Number(pageSizeValue || 10))),
  }),
  probe: async () => ({ ok: true, status: "disabled", responseMs: 0 }),
  rangeBounds: () => ({ start: new Date("2026-05-08T00:00:00.000Z"), end: new Date("2026-05-08T23:59:59.999Z") }),
  readPortalEvents: async () => [
    { type: "release_failed", userId: "user-alpha", workspaceId: "workspace-alpha", occurredAt: now, detail: { reason: "fixture" } },
    { type: "billing_exception", userId: "user-alpha", workspaceId: "workspace-alpha", occurredAt: now, detail: { reason: "fixture" } },
  ],
  readWorkspaceSession: () => db.workspaceSessions[0],
  runtimePerformanceSummary: async () => ({ masFirstReplyApproxMs: 0, warmupTimeoutCount: 0, latestSuccessfulMasRuns: [], totalSuccessfulMasRuns: 0 }),
  sanitizeTaskTitle: (_slug, title) => title,
  storageMode: () => "json",
  productProfile: {
    runtimeMode: "platform_provisioned",
    opsProfileEnabled: true,
  },
  urls: {
    portalRuntimeBridgeUrl: "http://runtime-bridge.local",
  },
  withinDateRange: () => true,
  workspaceChatSessionsForUser: () => db.workspaceSessions,
});

const overview = await payloads.buildAdminOverviewPayload(db);
const adminOpsPayload = payloads.buildAdminOpsApiPayload(db, overview);

assertTopLevelKeys(adminOpsPayload, [
  "accountOperations",
  "auditAndAnnouncements",
  "boundaries",
  "costReconciliation",
  "currentRuns",
  "fileSpaceOperations",
  "productProfile",
  "roleSurface",
  "summary",
  "workspaceOperations",
], "admin_ops_payload");

assert.equal(adminOpsPayload.roleSurface, "admin_ops", "admin_ops_payload_role_surface");
assert.equal(adminOpsPayload.boundaries.readonlyMvp, true, "admin_ops_payload_must_keep_ops_projection_readonly_mvp");
assert.equal(adminOpsPayload.boundaries.createsRealResources, false, "admin_ops_must_not_create_real_resources");
assert.equal(adminOpsPayload.boundaries.realBillingMutation, false, "admin_ops_must_not_mutate_real_billing");
assert.equal(adminOpsPayload.boundaries.callsRealCloud, false, "admin_ops_must_not_call_real_cloud");
assert.equal(adminOpsPayload.boundaries.adminRoleOnly, true, "admin_ops_must_be_admin_role_only");
assert.equal(adminOpsPayload.boundaries.userNavigationShowsAdminEntry, false, "user_navigation_must_not_show_admin_entry");

assert.equal(adminOpsPayload.accountOperations.accounts.length, 2, "admin_ops_must_list_accounts");
assert.equal(adminOpsPayload.accountOperations.accounts[0].accountName, "Alpha Lab", "admin_ops_must_include_account_name");
assert.equal(adminOpsPayload.accountOperations.accounts[0].workspaceCount, 1, "admin_ops_must_include_workspace_count");
assert.equal(adminOpsPayload.accountOperations.accounts[0].wallet.balance, 360, "admin_ops_must_include_balance");
assert.equal(adminOpsPayload.accountOperations.accounts[0].wallet.frozenAmount, 18, "admin_ops_must_include_frozen_amount");
assert.equal(adminOpsPayload.accountOperations.accounts[1].accessStatus, "禁用", "admin_ops_must_include_disabled_status");

assert.equal(adminOpsPayload.workspaceOperations.workspaces.length, 2, "admin_ops_must_list_workspaces");
assert.deepEqual(
  adminOpsPayload.workspaceOperations.resourceStates,
  ["计划中", "准备中", "可用", "释放中", "已释放", "异常"],
  "admin_ops_resource_states_mismatch",
);
assert.equal(adminOpsPayload.workspaceOperations.workspaces[0].accountName, "Alpha Lab", "workspace_must_include_owner_account");
assert.equal(adminOpsPayload.workspaceOperations.workspaces[0].planLabel, "基础套餐", "workspace_must_include_plan_label");
assert.equal(adminOpsPayload.workspaceOperations.workspaces[0].cpuCores, 2, "workspace_must_include_cpu");
assert.equal(adminOpsPayload.workspaceOperations.workspaces[0].memoryGb, 4, "workspace_must_include_memory");
assert.equal(adminOpsPayload.workspaceOperations.workspaces[0].fileSpaceGb, 10, "workspace_must_include_file_space");
assert.equal(adminOpsPayload.workspaceOperations.workspaces[0].concurrency, 2, "workspace_must_include_concurrency");
assert.equal(adminOpsPayload.workspaceOperations.workspaces[0].queueCapacity, 4, "workspace_must_include_queue");
assertNotIncludesAny(JSON.stringify(adminOpsPayload.workspaceOperations), [
  "tenantId",
  "resourceBindingId",
  "environmentId",
  "retiredResourceOrderIdentifier",
  "serverPlanId",
], "workspace_operations_must_not_expose_attribution_tags");

assert.equal(adminOpsPayload.currentRuns.items.length >= 1, true, "admin_ops_must_include_current_runs");
assert.equal(adminOpsPayload.currentRuns.items[0].accountId, "user-alpha", "current_run_must_include_account");
assert.equal(adminOpsPayload.currentRuns.items[0].workspaceId, "workspace-alpha", "current_run_must_include_workspace_id");
assertTopLevelKeys(adminOpsPayload.currentRuns.items[0], [
  "accountId",
  "accountName",
  "estimatedCost",
  "runId",
  "sessionId",
  "status",
  "task",
  "workspaceId",
], "current_run_item_public_surface");
assertNotIncludesAny(JSON.stringify(adminOpsPayload.currentRuns), [
  "tenantId",
  "resourceBindingId",
  "environmentId",
  "retiredResourceOrderIdentifier",
  "serverPlanId",
], "current_runs_must_not_expose_attribution_tags");

assert.equal(adminOpsPayload.fileSpaceOperations.items[0].usedGb > 0, true, "file_space_must_include_usage");
assert.equal(adminOpsPayload.fileSpaceOperations.items[0].retentionDays, 7, "file_space_must_include_retention_days");
assert.equal(adminOpsPayload.fileSpaceOperations.items[0].protectedGb > 0, true, "file_space_must_include_protection_usage");
assert.equal(adminOpsPayload.fileSpaceOperations.items[0].deleteProtectionStatus, "保护期内", "file_space_must_include_delete_protection_status");

assert.equal(adminOpsPayload.costReconciliation.estimatedCost.amount, 10.8, "cost_reconciliation_must_include_estimated_cost");
assert.equal(adminOpsPayload.costReconciliation.frozenAmount, 18, "cost_reconciliation_must_include_frozen_amount");
assert.equal(adminOpsPayload.costReconciliation.tPlus1Status, "待对账", "cost_reconciliation_must_include_t_plus_1_status");
assert.equal(adminOpsPayload.costReconciliation.costAllocationTags.some((item) => item.runId === ""), true, "cost_items_with_empty_run_id_must_be_represented");
assertIncludesAll(JSON.stringify(adminOpsPayload.costReconciliation.costAllocationTags), [
  "resourceBindingId",
  "billingAttributionId",
  "accountId",
  "runId",
  "serverPlanId",
  "workspaceId",
  "environmentId",
], "cost_allocation_tags");
assertNotIncludesAny(JSON.stringify(adminOpsPayload.costReconciliation.costAllocationTags), [
  "retiredResourceOrderIdentifier",
], "cost_allocation_tags_must_not_expose_retired_resource_order_id");

assert.equal(adminOpsPayload.auditAndAnnouncements.auditEvents.length >= 1, true, "admin_ops_must_include_audit_events");
assert.equal(adminOpsPayload.auditAndAnnouncements.exceptions.length >= 1, true, "admin_ops_must_include_exceptions");
assert.equal(adminOpsPayload.auditAndAnnouncements.releaseFailures.length >= 1, true, "admin_ops_must_include_release_failures");
assert.equal(adminOpsPayload.auditAndAnnouncements.billingExceptions.length >= 1, true, "admin_ops_must_include_billing_exceptions");
assert.equal(adminOpsPayload.auditAndAnnouncements.announcements.length, 1, "admin_ops_must_include_announcements");

const payloadJson = JSON.stringify(adminOpsPayload);
assertNotIncludesAny(payloadJson, forbiddenSecretsAndStorage, "admin_ops_payload_secret_storage_leak");
assertNotIncludesAny(payloadJson, forbiddenCloudMutationCopy, "admin_ops_payload_cloud_mutation_copy");

const routerSource = await readFile("services/portal/frontend/src/app/routes.tsx", "utf8");
const layoutSource = await readFile("services/portal/frontend/src/app/components/Layout.tsx", "utf8");
const adminPageSources = await readAdminPageSources();
assert.equal(await exists(`services/portal/frontend/src/app/${retiredFigmaZipResidue[0]}`), false, "old_admin_console_residue_must_be_removed");
assertIncludesAll(routerSource, [
  'path: "admin/ops"',
  "AdminOps",
], "admin_ops_active_route");
assertIncludesAll(layoutSource, [
  'path: "/admin/ops"',
  'userRole === "admin"',
  "RoleContext 不是安全边界",
], "admin_ops_nav_role_gate");
assertNotIncludesAny(routerSource, [
  "AdminConsole",
  "requiresAdmin",
  "requiresOpsSurface",
], "old_admin_console_must_not_be_active_route");
assertNotIncludesAny(adminPageSources, forbiddenSecretsAndStorage, "admin_pages_secret_storage_copy");
assertNotIncludesAny(adminPageSources, [
  "真实云控制台式操作",
  "直接删除节点池",
  "直接释放云资源",
  "直接改真实资源",
  "删除节点池",
  "CVM",
  "COS",
  "K8s",
  "TKE",
  "服务器编号",
  "云资源清单",
  "请访问对应的云控制台或运维系统",
], "admin_pages_cloud_mutation_copy");

const userSurfaceSources = [
  await readFile("services/portal/frontend/src/app/pages/RuntimeEnvironment.tsx", "utf8"),
  await readFile("services/portal/frontend/src/app/pages/Workspace.tsx", "utf8"),
  await readFile("services/portal/frontend/src/app/pages/Overview.tsx", "utf8"),
  await readFile("services/portal/frontend/src/app/pages/TasksResults.tsx", "utf8"),
  layoutSource,
  routerSource,
].join("\n");
assertNotIncludesAny(userSurfaceSources, [
  "全局账号",
  "全局费用",
  "全局审计",
  "资源异常处置",
  ...forbiddenCloudMutationCopy,
], "user_surface_must_not_expose_admin_ops");

const suite = await readFile("scripts/smoke-test-v22-mvp-contract-suite.mjs", "utf8");
assertIncludesAll(suite, [
  "smoke-test-v22-admin-ops-console-readonly-mvp",
], "mvp_suite_must_include_admin_ops_readonly_smoke");

console.log(JSON.stringify({
  ok: true,
  contract: "v22_admin_ops_console_readonly_mvp",
  covered: [
    "admin_ops_payload_readonly_capabilities",
    "admin_ops_entry_admin_only",
    "user_surface_no_admin_global_data",
    "account_workspace_primary_language",
    "no_secret_storage_or_raw_key_leak",
    "no_real_cloud_resource_mutation",
  ],
}, null, 2));
