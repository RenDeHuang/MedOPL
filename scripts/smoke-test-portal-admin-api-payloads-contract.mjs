import assert from "node:assert/strict";

const { createPortalAdminApiPayloads } = await import("../services/portal/src/app/portal-admin-api-payloads.mjs");

const now = "2026-05-01T00:00:00.000Z";

const db = {
  users: [
    {
      id: "admin-1",
      email: "admin@example.test",
      name: "Admin",
      role: "admin",
      status: "active",
      createdAt: now,
    },
    {
      id: "user-1",
      email: "alice@example.test",
      name: "Alice",
      role: "user",
      status: "active",
      groupId: "group-1",
      createdAt: now,
    },
  ],
  wallets: [{ userId: "user-1", balance: 42, updatedAt: now }],
  groups: [{ id: "group-1", name: "Research", status: "active" }],
  taskSpaces: [{
    slug: "analysis",
    title: "Analysis",
    userId: "user-1",
    status: "active",
    createdAt: now,
    updatedAt: now,
  }],
  workspaceSessions: [{
    id: "workspace-session-1",
    userId: "user-1",
    workspaceId: "analysis",
    status: "active",
    lastUsedAt: now,
    createdAt: now,
  }],
  sessions: [{ id: "portal-session-1", userId: "user-1", authSource: "local", createdAt: now }],
  ledger: [{
    id: "ledger-1",
    userId: "user-1",
    type: "refund",
    amount: 3,
    createdAt: now,
    reason: "contract",
  }],
  userSandboxes: [{ userId: "user-1", imageTag: "portal/test:latest", status: "running", updatedAt: now }],
};

const runFixture = {
  runId: "run-1",
  userId: "user-1",
  workspaceId: "analysis",
  workspaceSessionId: "workspace-session-1",
  status: "completed",
  createdAt: now,
  source: "fixture",
};

const calls = [];
const payloads = createPortalAdminApiPayloads({
  activeUserStatus: (status) => String(status || "active").toLowerCase(),
  buildAdminSecuritySummary: () => ({ healthy: true, failedCount: 0, checks: [] }),
  collectRunsForTask: async (userId) => userId === "user-1" ? [runFixture] : [],
  collectRunsForUser: async (userId) => userId === "user-1" ? [runFixture] : [],
  fetchBillingStatus: async () => ({
    autoReconcileEnabled: true,
    reconcileState: { lastRunAt: now, lastScope: "all" },
    tencentBillingEnabled: true,
    tencentCloudConfigured: true,
  }),
  fetchBillingSummary: async (userId, workspaceId) => {
    calls.push(["billing", userId, workspaceId]);
    return {
      totals: { cpuCost: 1, gpuCost: 2, pvCost: 3, totalCost: 6 },
      items: [{
        name: "run-1",
        totalCost: 6,
        cpuCost: 1,
        gpuCost: 2,
        pvCost: 3,
        start: now,
        end: now,
        properties: {
          "label:customer_id": "user-1",
          "label:run_id": "run-1",
          pricing_source: "fixture",
        },
      }],
    };
  },
  fetchHarborSummary: async () => ({ available: true, source: "fixture" }),
  fetchLangfuseSummary: async () => ({ available: true, source: "fixture" }),
  fetchMinioSummary: async () => ({ available: true, source: "fixture" }),
  fetchPendingSummary: async () => ({ pendingCount: 0, runs: [] }),
  fetchTraceRows: async () => ({ source: "fixture", type: "live", rows: [{ runId: "run-1", startedAt: now }] }),
  fetchWorkspaceMinioState: async () => ({ available: true, source: "fixture" }),
  fetchWorkspaceStorageSnapshot: async () => ({
    source: "fixture",
    type: "live",
    inputsCount: 1,
    outputsCount: 1,
    inputBytes: 11,
    outputBytes: 22,
    files: [{ name: "input.txt" }],
    outputs: [{ name: "run-1-output.txt" }],
  }),
  formatDateTime: (value) => `fmt:${value}`,
  groupBillingByDay: () => ({ labels: [now.slice(0, 10)], total: [6], cpu: [1], gpu: [2], storage: [3] }),
  humanizeStatus: (status) => `human:${status}`,
  isRunTerminal: (run) => String(run?.status || "") === "completed",
  latestActiveWorkspaceSession: () => db.workspaceSessions[0],
  listTaskSpacesForUser: () => db.taskSpaces,
  money: (value) => Number(value || 0).toFixed(2),
  normalizePageSize: (value) => Number(value || 5),
  paginateRows: (rows, pageValue = 1, pageSizeValue = 5) => ({
    rows: rows.slice(0, Number(pageSizeValue || 5)),
    page: Number(pageValue || 1),
    pageSize: Number(pageSizeValue || 5),
    total: rows.length,
    totalPages: Math.max(1, Math.ceil(rows.length / Number(pageSizeValue || 5))),
  }),
  probe: async (url) => ({ ok: true, status: "200", responseMs: url.length }),
  rangeBounds: () => ({ start: new Date("2026-05-01T00:00:00.000Z"), end: new Date("2026-05-01T23:59:59.999Z") }),
  readPortalEvents: async () => [{ type: "billing_warning", userId: "user-1", occurredAt: now }],
  readWorkspaceSession: () => db.workspaceSessions[0],
  runtimePerformanceSummary: async () => ({
    masFirstReplyApproxMs: 1000,
    warmupTimeoutCount: 0,
    latestSuccessfulMasRuns: [],
    totalSuccessfulMasRuns: 1,
  }),
  sanitizeTaskTitle: (_slug, title) => title,
  storageMode: () => "json",
  urls: {
    harborUrl: "http://harbor.local",
    langfuseUrl: "http://langfuse.local",
    minioConsoleUrl: "http://minio.local",
    opencostUiUrl: "http://opencost.local",
    portalOplAdapterUrl: "http://adapter.local",
    rancherUrl: "http://rancher.local",
  },
  withinDateRange: () => true,
  workspaceChatSessionsForUser: () => [{
    sessionId: "workspace-session-1",
    workspaceSessionId: "workspace-session-1",
    lastUsedAt: now,
    status: "active",
  }],
});

const overview = await payloads.buildAdminOverviewPayload(db);
assert.equal(overview.kpis.totalUsers, 1, "admin_overview_must_exclude_admin_users");
assert.equal(overview.groups[0].memberCount, 1, "admin_overview_must_count_group_members");
assert.equal(overview.alerts.length, 0, "healthy_fixture_must_not_create_alerts");
assert.equal(overview.summaries.harbor.imageTagCount, 1, "overview_must_include_harbor_image_tag_count");

const users = payloads.buildAdminUsersApiPayload(db, overview, { q: "alice", workspace: "analysis" });
assert.equal(users.items.length, 1, "admin_users_filter_must_match_user_and_workspace");
assert.equal(users.items[0].balance, 42, "admin_users_must_include_wallet_balance");
assert.equal(users.financeRows[0].type, "refund", "admin_users_must_include_finance_rows");

const ops = payloads.buildAdminOpsApiPayload(overview);
assert.equal(ops.summaries.security.healthy, true, "ops_payload_must_include_security_summary");
assert.equal(ops.systemMetrics.dbMode, "portal-db.json", "ops_payload_must_include_storage_mode");

const userPortrait = await payloads.buildAdminUserPortraitApiPayload(db, "user-1");
assert.equal(userPortrait.user.email, "alice@example.test", "user_portrait_must_identify_user");
assert.equal(userPortrait.recentRuns[0].runId, "run-1", "user_portrait_must_include_recent_runs");
assert.equal(userPortrait.trace.count, 1, "user_portrait_must_include_trace_count");

const workspacePortrait = await payloads.buildAdminWorkspacePortraitApiPayload(db, "user-1", "analysis");
assert.equal(workspacePortrait.workspace.slug, "analysis", "workspace_portrait_must_identify_workspace");
assert.equal(workspacePortrait.storage.outputs[0].name, "run-1-output.txt", "workspace_portrait_must_include_storage_outputs");

const runPortrait = await payloads.buildAdminRunPortraitApiPayload(db, "run-1");
assert.equal(runPortrait.run.runId, "run-1", "run_portrait_must_identify_run");
assert.equal(runPortrait.outputs[0].name, "run-1-output.txt", "run_portrait_must_link_related_outputs");
assert.ok(calls.some(([kind, userId]) => kind === "billing" && userId === "user-1"), "portraits_must_query_user_billing");

assert.equal(await payloads.buildAdminUserPortraitApiPayload(db, "missing"), null, "missing_user_portrait_must_return_null");
assert.equal(await payloads.buildAdminWorkspacePortraitApiPayload(db, "user-1", "missing"), null, "missing_workspace_portrait_must_return_null");
assert.equal(await payloads.buildAdminRunPortraitApiPayload(db, "missing"), null, "missing_run_portrait_must_return_null");

console.log(JSON.stringify({
  ok: true,
  checked: [
    "admin_overview",
    "admin_users",
    "admin_ops",
    "admin_user_portrait",
    "admin_workspace_portrait",
    "admin_run_portrait",
  ],
}, null, 2));
