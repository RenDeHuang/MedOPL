import assert from "node:assert/strict";

const { createPortalApiRoutes } = await import("../services/portal/src/routes/portal-api.routes.mjs");

function createResponseRecorder() {
  return { statusCode: null, payload: null };
}

function sendJson(res, payload, status = 200) {
  res.statusCode = status;
  res.payload = payload;
}

const db = {
  users: [
    { id: "user-1", name: "Alice", email: "alice@example.test", role: "user", currentTaskSlug: "analysis" },
    { id: "admin-1", name: "Admin", email: "admin@example.test", role: "admin" },
  ],
  wallets: [{ userId: "user-1", balance: 10 }],
  ledger: [{ userId: "user-1", type: "topup", amount: 10, createdAt: "2026-05-01T00:00:00.000Z" }],
  announcements: [{ id: "a1", title: "Hello" }],
};

const adapterRun = {
  runId: "adapter-run-1",
  portalUserId: "user-1",
  workspaceId: "analysis",
  workspaceSessionId: "ws-session-1",
  runtimeSessionId: "runtime-session-1",
  status: "succeeded",
  createdAt: "2026-05-01T00:00:00.000Z",
  finishedAt: "2026-05-01T00:01:00.000Z",
  latencyMs: 123,
  tokenCount: 456,
};

const route = createPortalApiRoutes({
  activeUserStatus: (status) => status || "active",
  adminScopeResult: (user) => user.role === "admin" ? { ok: true } : { ok: false, error: "forbidden", status: 403 },
  announcementRows: (targetDb) => targetDb.announcements,
  buildCommercialProfile: () => ({ accountStatus: "active", billingStatus: "funded", entitlementStatus: "active" }),
  buildSessionTraceDetailPayload: async (_targetDb, _user, sessionId) => sessionId === "trace-1" ? { sessionId } : null,
  buildSessionTracesApiPayload: async () => ({ items: [{ sessionId: "trace-1" }] }),
  buildUserBillingSummary: (targetDb, { user }) => ({
    balanceCents: Number((targetDb.wallets.find((item) => item.userId === user.id)?.balance || 0) * 100),
    risk: { status: "healthy" },
    exactSettlement: { status: "settled_or_no_pending" },
  }),
  collectRunsForUser: async () => [{ runId: "run-1", workspaceId: "analysis", status: "completed", createdAt: "2026-05-01T00:00:00.000Z" }],
  currentServerPlanSelection: () => ({ id: "cpu-2c4g" }),
  currentTaskSpaceForUser: () => ({ slug: "analysis" }),
  evaluateUserPolicy: async () => ({ ok: true }),
  fetchBillingSummary: async () => ({
    totals: { cpuCost: 1, gpuCost: 0, pvCost: 0, totalCost: 1 },
    items: [{
      name: "run-1",
      cpuCost: 1,
      totalCost: 1,
      properties: { "label:run_id": "run-1", pricing_source: "fixture" },
    }],
  }),
  fetchHarborImageRows: async () => ({ items: [{ imageTag: "fixture:latest" }] }),
  fetchHarborSummary: async () => ({ available: true }),
  fetchLangfuseSummary: async () => ({ available: true, source: "langfuse" }),
  fetchOplAdapterCosts: async ({ runId }) => runId === "adapter-run-1" ? [{
    cpuCost: 1,
    gpuCost: 2,
    storageCost: 3,
    totalCost: 6,
    pricingSource: "adapter",
    status: "pending",
  }] : [],
  fetchOplAdapterRuns: async () => [adapterRun],
  fetchOplAdapterTraceRows: async () => ({ type: "live", source: "adapter", rows: [{ runId: "trace-run", startedAt: "2026-05-01T00:02:00.000Z" }] }),
  fetchTraceRows: async () => ({ type: "live", source: "langfuse", rows: [{ runId: "trace-run", startedAt: "2026-05-01T00:01:00.000Z" }] }),
  formatDateTime: (value) => `fmt:${value}`,
  isRunTerminal: (run) => run.status === "completed",
  normalizePageSize: (value) => Number(value || 5),
  paginateRows: (rows, pageValue = 1, pageSizeValue = 5) => ({
    rows: rows.slice(0, Number(pageSizeValue || 5)),
    page: Number(pageValue || 1),
    pageSize: Number(pageSizeValue || 5),
    total: rows.length,
    totalPages: 1,
  }),
  parsePositiveInt: (value, fallback) => Number(value || fallback),
  readSessionsRequestOptions: (url) => ({ page: url.searchParams.get("page"), pageSize: url.searchParams.get("page_size") }),
  readTracesRequestOptions: (url) => ({
    userId: url.searchParams.get("userId"),
    workspaceId: url.searchParams.get("workspaceId"),
    runId: url.searchParams.get("runId"),
    sessionId: url.searchParams.get("sessionId"),
    status: url.searchParams.get("status"),
    page: url.searchParams.get("page"),
    pageSize: url.searchParams.get("page_size"),
    limit: url.searchParams.get("limit"),
  }),
  sendJson,
  visibleAnnouncementRows: (targetDb) => targetDb.announcements.slice(0, 1),
  workspaceChatSessionsForUser: () => [{ workspaceSessionId: "ws-session-1", lastUsedAt: "2026-05-01T00:00:00.000Z" }],
});

async function request(path, user = db.users[0]) {
  const res = createResponseRecorder();
  const handled = await route({
    req: { method: "GET" },
    res,
    url: new URL(path, "http://portal.local"),
    db,
    user,
  });
  return { handled, res };
}

let result = await request("/portal/api/announcements");
assert.equal(result.handled, true);
assert.equal(result.res.payload.items.length, 1);

result = await request("/portal/api/me");
assert.equal(result.res.payload.id, "user-1");
assert.equal(result.res.payload.selectedServerPlan.id, "cpu-2c4g");

result = await request("/portal/api/sessions?limit=5");
assert.equal(result.res.payload.sessions[0].runId, "adapter-run-1");

result = await request("/portal/api/runs");
assert(result.res.payload.runs.some((item) => item.runId === "run-1"));
assert(result.res.payload.runs.some((item) => item.runId === "adapter-run-1"));

result = await request("/portal/api/costs/run?runId=adapter-run-1");
assert.equal(result.res.payload.source, "portal_opl_adapter");
assert.equal(result.res.payload.cost.totalCost, 6);

result = await request("/portal/api/billing/me/summary");
assert.equal(result.handled, true);
assert.equal(result.res.payload.balanceCents, 1000);
assert.ok("risk" in result.res.payload);
assert.ok("exactSettlement" in result.res.payload);

result = await request("/portal/api/registry/summary", db.users[1]);
assert.equal(result.res.payload.available, true);

result = await request("/portal/api/registry/summary", db.users[0]);
assert.equal(result.res.statusCode, 403);

result = await request("/portal/api/session-traces/trace-1");
assert.equal(result.res.payload.sessionId, "trace-1");

result = await request("/portal/api/traces?runId=trace-run", db.users[1]);
assert.equal(result.res.payload.items[0].runId, "trace-run");

result = await request("/portal/api/traces", db.users[0]);
assert.equal(result.res.statusCode, 403);
assert.equal(result.res.payload.use, "/portal/api/session-traces");

result = await request("/portal/api/not-owned");
assert.equal(result.handled, false);

console.log(JSON.stringify({
  ok: true,
  checked: [
    "announcements",
    "me",
    "sessions",
    "runs",
    "costs",
    "registry",
    "traces",
    "unmatched",
  ],
}, null, 2));
