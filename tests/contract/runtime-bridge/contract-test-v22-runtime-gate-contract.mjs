import assert from "node:assert/strict";

const { createPortalApiRoutes } = await import("../../../services/portal/src/routes/portal-api.routes.mjs");

const RAW_PROVIDER_KEY = "gflabtoken_raw_key_must_remain_backend_only";

function assertNoSecrets(value, label) {
  const serialized = JSON.stringify(value);
  assert.equal(serialized.includes(RAW_PROVIDER_KEY), false, `${label}_must_not_leak_raw_provider_key`);
  assert.equal(/launchToken|runtimeToken|bearerToken/i.test(serialized), false, `${label}_must_not_expose_runtime_tokens`);
}

function responseRecorder() {
  return { statusCode: 0, payload: null };
}

function sendJson(res, payload, status = 200) {
  res.statusCode = status;
  res.payload = payload;
}

async function readBody(req) {
  return Buffer.from(req.body || "");
}

const user = {
  id: "user-v22-state",
  tenantId: "tenant-v22-state",
  name: "V22 State User",
  email: "state@example.test",
  role: "user",
  status: "active",
  currentTaskSlug: "workspace-v22-state",
};

const db = {
  users: [user],
  wallets: [{ userId: user.id, balance: 120 }],
  ledger: [{ tenantId: user.tenantId, userId: user.id, type: "topup", amount: 120, createdAt: "2026-05-07T00:00:00.000Z" }],
  announcements: [],
  taskSpaces: [{
    slug: "workspace-v22-state",
    userId: user.id,
    serverPlanId: "starter_2c4g_10gb",
    status: "active",
  }],
  providerKeyBindings: [{
    tenantId: user.tenantId,
    userId: user.id,
    provider: "gflabtoken",
    providerKeyRef: "provider-key-ref-v22-state",
    boundStatus: "bound",
    rawApiKey: RAW_PROVIDER_KEY,
    launchToken: "launch-token-must-not-leak",
    runtimeToken: "runtime-token-must-not-leak",
  }],
  userComputeInstances: [],
  userStorageBuckets: [],
  workspaceResourceBindings: [],
  weeklyProtectionFreezes: [],
};

const route = createPortalApiRoutes({
  activeUserStatus: (status) => status || "active",
  adminScopeResult: () => ({ ok: false, status: 403, error: "forbidden" }),
  announcementRows: () => [],
  buildCommercialProfile: () => ({ accountStatus: "active", billingStatus: "funded", entitlementStatus: "active" }),
  buildSessionTraceDetailPayload: async () => null,
  buildSessionTracesApiPayload: async () => ({ items: [] }),
  buildUserBillingSummary: () => ({
    balanceCents: 12000,
    availableBalanceCents: 12000,
    frozenWeeklyAmountCents: 0,
  }),
  collectRunsForUser: async () => [],
  currentServerPlanSelection: () => ({ id: "starter_2c4g_10gb" }),
  currentTaskSpaceForUser: (targetDb, targetUser) => targetDb.taskSpaces.find((item) => item.userId === targetUser.id) || null,
  evaluateUserPolicy: async () => ({ ok: true }),
  fetchBillingSummary: async () => ({ totals: { totalCost: 0 }, items: [] }),
  fetchHarborSummary: async () => ({ available: false }),
  fetchRuntimeBridgeCosts: async () => [],
  fetchRuntimeBridgeRuns: async () => [],
  fetchRuntimeBridgeTraceRows: async () => ({ rows: [] }),
  fetchOpsRegistryImageRows: async () => ({ items: [] }),
  fetchTraceRows: async () => ({ rows: [] }),
  formatDateTime: (value) => String(value || ""),
  isRunTerminal: () => true,
  normalizePageSize: (value) => Number(value || 20),
  paginateRows: (rows) => ({ rows, page: 1, pageSize: rows.length, total: rows.length, totalPages: 1 }),
  parsePositiveInt: (value, fallback) => Number(value || fallback),
  readBody,
  readSessionsRequestOptions: () => ({}),
  readTracesRequestOptions: () => ({}),
  sendJson,
  visibleAnnouncementRows: () => [],
  workspaceChatSessionsForUser: () => [],
  writeDb: async () => {},
});

async function request({ method = "GET", path = "/", body = null } = {}) {
  const res = responseRecorder();
  const handled = await route({
    req: { method, body: body ? JSON.stringify(body) : "" },
    res,
    url: new URL(path, "http://portal.local"),
    db,
    user,
  });
  return { handled, res };
}

const stateResult = await request({ path: "/portal/api/canonical-state?workspaceId=workspace-v22-state" });
assert.equal(stateResult.handled, true, "canonical_state_route_must_be_handled");
assert.equal(stateResult.res.statusCode, 200, "canonical_state_must_return_200");
assert.equal(stateResult.res.payload.ok, true, "canonical_state_must_return_ok");
assert.equal(stateResult.res.payload.identity.userId, user.id, "canonical_state_identity_user_mismatch");
assert.equal(Object.hasOwn(stateResult.res.payload.tenant || {}, "tenantId"), false, "canonical_state_must_not_expose_tenant_id");
assert.equal(stateResult.res.payload.tenant.status, "active", "canonical_state_tenant_status_mismatch");
assert.equal(stateResult.res.payload.balance.balanceCents, 12000, "canonical_state_balance_mismatch");
assert.equal(stateResult.res.payload.providerBound, true, "canonical_state_provider_must_be_bound");
assert.equal(stateResult.res.payload.providerKeyRef, "provider-key-ref-v22-state", "canonical_state_provider_key_ref_mismatch");
assert.equal(stateResult.res.payload.runtimeEnabled, false, "canonical_state_runtime_must_be_disabled_without_resource_binding");
assert.equal(Object.hasOwn(stateResult.res.payload, "resourceBinding"), false, "canonical_state_must_not_expose_resource_binding_before_runtime_open");
assert.equal(Object.hasOwn(stateResult.res.payload, "freeze"), false, "canonical_state_must_not_expose_internal_freeze_before_runtime_open");
assert.equal(stateResult.res.payload.plan.id, "starter_2c4g_10gb", "canonical_state_plan_mismatch");
assertNoSecrets(stateResult.res.payload, "canonical_state");

const runResult = await request({
  method: "POST",
  path: "/portal/api/runs",
  body: {
    workspaceId: "workspace-v22-state",
    mode: "full_runtime",
    prompt: "this must not start without runtime",
  },
});
assert.equal(runResult.handled, true, "runtime_run_route_must_be_handled");
assert.equal(runResult.res.statusCode, 409, "runtime_run_without_binding_must_return_409");
assert.equal(runResult.res.payload.ok, false, "runtime_run_without_binding_must_return_not_ok");
assert.equal(runResult.res.payload.error, "runtime_not_enabled", "runtime_run_without_binding_error_mismatch");
assertNoSecrets(runResult.res.payload, "runtime_run_rejection");

console.log(JSON.stringify({
  ok: true,
  contract: "v22_runtime_gate",
}, null, 2));
