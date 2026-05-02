import assert from "node:assert/strict";

const { createPortalPagePayloads } = await import("../services/portal/src/app/portal-page-payloads.mjs");

const taskFiles = {
  "/workspace/user-1/analysis/inputs": [{ name: "input.csv", fullPath: "/workspace/user-1/analysis/inputs/input.csv" }],
  "/workspace/user-1/analysis/outputs": [{ name: "result.json", fullPath: "/workspace/user-1/analysis/outputs/result.json" }],
  "/workspace/user-1/default/inputs": [],
  "/workspace/user-1/default/outputs": [],
};

const db = {
  users: [{ id: "user-1", email: "alice@example.test", name: "Alice", role: "user", currentTaskSlug: "analysis" }],
  wallets: [{ userId: "user-1", balance: 25 }],
  ledger: [
    { userId: "user-1", type: "resource_charge", amount: 2, createdAt: "2026-05-01T02:00:00.000Z" },
    { userId: "user-1", type: "refund", amount: 0.5, createdAt: "2026-05-01T03:00:00.000Z" },
  ],
  workspaceSessions: [{ id: "workspace-session-1", userId: "user-1", workspaceId: "analysis", status: "active", createdAt: "2026-05-01T01:00:00.000Z" }],
  resourceOrderEvents: [],
  resourceOrders: [{ id: "order-1", userId: "user-1", tenantId: "user-1", workspaceId: "analysis", status: "running" }],
};

const tasks = [
  {
    slug: "analysis",
    title: "Analysis",
    status: "active",
    userId: "user-1",
    path: "/workspace/user-1/analysis",
    serverPlanId: "cpu-2c4g",
    createdAt: "2026-05-01T00:00:00.000Z",
    updatedAt: "2026-05-01T04:00:00.000Z",
  },
  {
    slug: "default",
    title: "Default",
    status: "active",
    userId: "user-1",
    path: "/workspace/user-1/default",
    createdAt: "2026-05-01T00:10:00.000Z",
    updatedAt: "2026-05-01T00:10:00.000Z",
  },
];

const runs = [
  { runId: "run-1", workspaceId: "analysis", status: "completed", createdAt: "2026-05-01T01:00:00.000Z" },
  { runId: "run-2", workspaceId: "default", status: "running", createdAt: "2026-05-01T02:00:00.000Z" },
];

const billingSummary = {
  source: "tencent_cloud_bill",
  cloudSource: "tencent_cloud",
  totals: { cpuCost: 1, gpuCost: 0, pvCost: 0.5, totalCost: 1.5 },
  items: [{
    name: "run-1",
    cpuCost: 1,
    gpuCost: 0,
    pvCost: 0.5,
    totalCost: 1.5,
    start: "2026-05-01T01:00:00.000Z",
    end: "2026-05-01T02:00:00.000Z",
    properties: {
      "label:run_id": "run-1",
      "label:workspace_id": "analysis",
      pricing_source: "fixture",
    },
  }],
};

const pagePayloads = createPortalPagePayloads({
  buildCommercialProfile: (_targetDb, _user, context = {}) => ({
    accountStatus: "active",
    billingStatus: "funded",
    entitlementStatus: "active",
    activeFreeze: 3,
    availableBalance: Number(context.wallet?.balance || 0) - 3,
    trialRemaining: 0,
  }),
  buildOverviewOnboarding: () => ({ done: true }),
  buildServerPlansFallback: () => ({ items: [] }),
  buildServerPlansSummary: () => ({ total: 1, salable: 1 }),
  collectRunsForUser: async () => runs,
  currentServerPlanSelection: (task) => ({ id: task?.serverPlanId || "" }),
  currentTaskSpaceForUser: () => tasks[0],
  defaultTaskTitle: (slug) => `Task ${slug}`,
  ensureTaskSpace: async () => tasks[0],
  ensureWallet: (targetDb, userId) => targetDb.wallets.find((item) => item.userId === userId),
  evaluateUserPolicy: async () => ({ blocked: false }),
  fetchBillingSummary: async () => billingSummary,
  fetchPendingSummary: async () => ({ totals: { totalCost: 0.25 } }),
  fetchServerPlans: async () => ({ items: [{ id: "cpu-2c4g", salable: true }] }),
  findTaskSpace: (targetDb, userId, slug) => tasks.find((item) => item.userId === userId && item.slug === slug) || null,
  formatDateOnly: (date) => new Date(date).toISOString().slice(0, 10),
  formatDateTime: (value) => `fmt:${value}`,
  isRunTerminal: (run) => run.status === "completed",
  latestActiveWorkspaceSession: () => db.workspaceSessions[0],
  listFilesRecursive: async (dir) => taskFiles[dir] || [],
  listTaskSpacesForUser: () => tasks,
  mkdir: async () => {},
  path: {
    join: (...parts) => parts.join("/").replaceAll(/\/+/g, "/"),
  },
  readPortalEvents: async () => [{ type: "workspace_created", userId: "user-1", workspaceId: "analysis", occurredAt: "2026-05-01T00:00:00.000Z" }],
  resourceOrderPublicView: (order) => ({ id: order.id, status: order.status }),
  resourceOrdersForUser: () => db.resourceOrders,
  sanitizeTaskTitle: (_slug, title) => title || "Untitled",
  stat: async (file) => ({ size: file.endsWith("input.csv") ? 20 : 10 }),
  workspaceStorageEntitlement: () => ({ enabled: true, storageSizeGb: 10 }),
});

const overview = await pagePayloads.buildOverviewPayload(db, db.users[0], {});
assert.equal(overview.kpis.balance, 25, "overview_must_include_wallet_balance");
assert.equal(overview.kpis.pendingCost, 0.25, "overview_must_include_pending_cost");
assert.equal(overview.kpis.exactCost, 1.5, "overview_must_include_exact_cost");
assert.equal(overview.kpis.historicalCost, 1.5, "overview_must_net_historical_spend");
assert.equal(overview.latestResourceOrders[0].id, "order-1", "overview_must_include_resource_orders");

const billing = await pagePayloads.buildBillingPayload(db, db.users[0], { pageSize: 5 });
assert.equal(billing.summary.selectedCost, 1.5, "billing_must_total_selected_exact_items");
assert.equal(billing.summary.pendingCost, 0.25, "billing_must_include_pending_total");
assert.equal(billing.taskCosts[0].slug, "analysis", "billing_must_group_cost_by_workspace");
assert.equal(billing.runCosts[0].pricingSource, "fixture", "billing_must_preserve_run_pricing_source");

const workspace = await pagePayloads.buildWorkspacePayload(db, db.users[0], "analysis", {});
assert.equal(workspace.workspace.slug, "analysis", "workspace_must_identify_current_workspace");
assert.equal(workspace.counts.inputs, 1, "workspace_must_count_input_files");
assert.equal(workspace.distribution.inputBytes, 20, "workspace_must_sum_input_bytes");
assert.equal(workspace.activeSession.id, "workspace-session-1", "workspace_must_include_active_session");

console.log(JSON.stringify({
  ok: true,
  contract: "portal_page_payloads",
}, null, 2));
