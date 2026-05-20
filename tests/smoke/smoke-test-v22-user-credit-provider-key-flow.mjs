import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const RAW_PROVIDER_KEY = "gflabtoken_raw_key_user_credit_provider_flow_backend_only";

const { createPortalApiRoutes } = await import("../../services/portal/src/routes/portal-api.routes.mjs");
const { createProviderSecretStore } = await import("../../services/portal/src/domain/provider-secret-store.mjs");

function assertNoSecretLeak(value, label) {
  const serialized = JSON.stringify(value);
  assert.equal(serialized.includes(RAW_PROVIDER_KEY), false, `${label}_must_not_leak_raw_provider_key`);
  assert.equal(/launchToken|runtimeToken|bearerToken|providerSecret|rawProviderKey|providerApiKey|apiKey/i.test(serialized), false, `${label}_must_not_expose_secret_fields`);
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

const tempRoot = await mkdtemp(path.join(os.tmpdir(), "v22-user-credit-provider-key-flow-"));
try {
  const providerSecretStore = createProviderSecretStore({ secretsRoot: tempRoot });
  const db = {
    users: [],
    tenants: [],
    wallets: [],
    ledger: [],
    taskSpaces: [],
    workspaceResourceBindings: [],
    providerKeyBindings: [],
    announcements: [],
  };

  const writes = [];
  const route = createPortalApiRoutes({
    activeUserStatus: (status) => status || "active",
    adminScopeResult: () => ({ ok: false, status: 403, error: "forbidden" }),
    announcementRows: () => [],
    buildCommercialProfile: () => ({ accountStatus: "active", billingStatus: "funded", entitlementStatus: "active" }),
    buildSessionTraceDetailPayload: async () => null,
    buildSessionTracesApiPayload: async () => ({ items: [] }),
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
    providerSecretStore,
    readBody,
    readSessionsRequestOptions: () => ({}),
    readTracesRequestOptions: () => ({}),
    sendJson,
    visibleAnnouncementRows: () => [],
    workspaceChatSessionsForUser: () => [],
    writeDb: async (targetDb) => {
      writes.push(JSON.parse(JSON.stringify(targetDb)));
    },
  });

  async function request({ method = "GET", urlPath = "/", body = null, user = null } = {}) {
    const res = responseRecorder();
    const handled = await route({
      req: { method, body: body ? JSON.stringify(body) : "" },
      res,
      url: new URL(urlPath, "http://portal.local"),
      db,
      user,
    });
    return { handled, res };
  }

  const prepared = await request({
    method: "POST",
    urlPath: "/portal/api/v22/users/prepare",
    body: {
      tenantId: "tenant-v22-credit",
      userId: "user-v22-credit",
      email: "credit@example.test",
      name: "Credit Provider User",
      workspaceId: "workspace-v22-credit",
    },
  });
  assert.equal(prepared.handled, true, "prepare_user_route_must_be_handled");
  assert.equal(prepared.res.statusCode, 201, "prepare_user_must_create");
  assert.equal(prepared.res.payload.ok, true, "prepare_user_must_return_ok");
  assert.equal(prepared.res.payload.user.id, "user-v22-credit", "prepared_user_id_mismatch");
  assert.equal(prepared.res.payload.tenant.tenantId, "tenant-v22-credit", "prepared_tenant_mismatch");
  assertNoSecretLeak(prepared.res.payload, "prepare_user_response");

  const user = db.users.find((item) => item.id === "user-v22-credit");
  assert.ok(user, "prepared_user_must_exist_in_db");
  assert.equal(user.tenantId, "tenant-v22-credit", "prepared_user_must_have_tenant");
  assert.ok(db.tenants.some((item) => item.id === "tenant-v22-credit"), "prepared_tenant_must_exist");
  assert.ok(db.taskSpaces.some((item) => item.userId === user.id && item.slug === "workspace-v22-credit"), "prepared_workspace_must_exist");
  assert.ok(db.wallets.some((item) => item.userId === user.id), "prepared_wallet_must_exist");

  const topup = await request({
    method: "POST",
    urlPath: "/portal/api/v22/users/credit",
    user,
    body: {
      userId: user.id,
      amount: 120,
      idempotencyKey: "v22-credit-topup-once",
    },
  });
  assert.equal(topup.handled, true, "credit_route_must_be_handled");
  assert.equal(topup.res.statusCode, 200, "credit_route_must_return_200");
  assert.equal(topup.res.payload.ok, true, "credit_route_must_return_ok");
  assert.equal(topup.res.payload.balance.balanceCents, 12000, "credit_balance_cents_mismatch");
  assert.ok(db.ledger.some((entry) => entry.type === "topup" && entry.userId === user.id), "credit_must_append_topup_ledger");
  assertNoSecretLeak(topup.res.payload, "credit_response");

  const missingState = await request({
    urlPath: "/portal/api/canonical-state?workspaceId=workspace-v22-credit",
    user,
  });
  assert.equal(missingState.handled, true, "canonical_state_before_provider_must_be_handled");
  assert.equal(missingState.res.statusCode, 200, "canonical_state_before_provider_status_mismatch");
  assert.equal(missingState.res.payload.providerBound, false, "provider_must_not_be_bound_before_binding");
  assert.equal(missingState.res.payload.providerKeyRef, "", "provider_ref_must_be_empty_before_binding");
  assert.equal(missingState.res.payload.readyForManagedEnvironment, false, "managed_environment_must_not_be_ready_without_provider_key");
  assert.equal(missingState.res.payload.readiness.reason, "provider_key_required", "readiness_reason_must_require_provider_key");
  assertNoSecretLeak(missingState.res.payload, "canonical_state_before_provider");

  const blocked = await request({
    method: "POST",
    urlPath: "/portal/api/v22/managed-environment/readiness",
    user,
    body: { workspaceId: "workspace-v22-credit" },
  });
  assert.equal(blocked.handled, true, "readiness_route_must_be_handled");
  assert.equal(blocked.res.statusCode, 409, "readiness_without_provider_must_return_409");
  assert.equal(blocked.res.payload.ok, false, "readiness_without_provider_must_return_not_ok");
  assert.equal(blocked.res.payload.error, "provider_key_required", "readiness_without_provider_error_mismatch");
  assert.equal(blocked.res.payload.readyForManagedEnvironment, false, "readiness_without_provider_must_not_be_ready");
  assertNoSecretLeak(blocked.res.payload, "readiness_without_provider");

  const bound = await request({
    method: "POST",
    urlPath: "/portal/api/v22/provider-key",
    user,
    body: {
      workspaceId: "workspace-v22-credit",
      provider: "gflabtoken",
      apiKey: RAW_PROVIDER_KEY,
    },
  });
  assert.equal(bound.handled, true, "provider_key_route_must_be_handled");
  assert.equal(bound.res.statusCode, 200, "provider_key_binding_must_return_200");
  assert.equal(bound.res.payload.ok, true, "provider_key_binding_must_return_ok");
  assert.equal(bound.res.payload.providerBound, true, "provider_key_binding_must_mark_bound");
  assert.equal(bound.res.payload.boundStatus, "bound", "provider_key_binding_status_mismatch");
  assert.ok(bound.res.payload.providerKeyRef, "provider_key_binding_must_return_ref");
  assert.deepEqual(Object.keys(bound.res.payload).sort(), ["boundStatus", "ok", "provider", "providerBound", "providerKeyRef"].sort(), "provider_key_response_keys_mismatch");
  assertNoSecretLeak(bound.res.payload, "provider_key_response");

  const secret = await providerSecretStore.readProviderSecret(bound.res.payload.providerKeyRef);
  assert.equal(secret.apiKey, RAW_PROVIDER_KEY, "backend_secret_store_must_keep_raw_key");
  assert.equal(JSON.stringify(secret).includes(RAW_PROVIDER_KEY), true, "backend_secret_boundary_must_contain_raw_key");

  const finalState = await request({
    urlPath: "/portal/api/canonical-state?workspaceId=workspace-v22-credit",
    user,
  });
  assert.equal(finalState.res.statusCode, 200, "canonical_state_after_provider_status_mismatch");
  assert.equal(finalState.res.payload.identity.userId, user.id, "canonical_state_identity_mismatch");
  assert.equal(Object.hasOwn(finalState.res.payload.tenant || {}, "tenantId"), false, "canonical_state_must_not_expose_tenant_id");
  assert.equal(finalState.res.payload.tenant.status, "active", "canonical_state_tenant_status_mismatch");
  assert.equal(finalState.res.payload.balance.balanceCents, 12000, "canonical_state_balance_mismatch");
  assert.equal(finalState.res.payload.providerBound, true, "canonical_state_provider_bound_mismatch");
  assert.equal(finalState.res.payload.providerKeyRef, bound.res.payload.providerKeyRef, "canonical_state_provider_ref_mismatch");
  assert.equal(finalState.res.payload.readyForManagedEnvironment, true, "canonical_state_must_be_ready_after_provider_key");
  assert.equal(finalState.res.payload.readiness.reason, "ready", "canonical_state_readiness_reason_mismatch");
  assertNoSecretLeak(finalState.res.payload, "canonical_state_after_provider");

  const allowed = await request({
    method: "POST",
    urlPath: "/portal/api/v22/managed-environment/readiness",
    user,
    body: { workspaceId: "workspace-v22-credit" },
  });
  assert.equal(allowed.res.statusCode, 200, "readiness_after_provider_must_return_200");
  assert.equal(allowed.res.payload.ok, true, "readiness_after_provider_must_return_ok");
  assert.equal(allowed.res.payload.readyForManagedEnvironment, true, "readiness_after_provider_must_be_ready");
  assert.equal(allowed.res.payload.providerKeyRef, bound.res.payload.providerKeyRef, "readiness_after_provider_ref_mismatch");
  assertNoSecretLeak(allowed.res.payload, "readiness_after_provider");

  assert.equal(writes.length >= 3, true, "mutating_routes_must_persist_db");

  const contract = await readFile("docs/specs/README.md", "utf8");
  for (const required of [
    "provider_key_required",
    "readyForManagedEnvironment",
    "providerKeyRef",
    "bound status",
    "portal.medopl.cn 登录不需要 gflabtoken API Key",
    "opl.medopl.cn 登录 / 进入 OPL 工作台需要 gflabtoken API Key",
    "API Key 输入框放在 OPL 登录页密码下面",
    "API Key 不是 Portal 普通登录字段",
    "raw API Key 只能进入后端密钥边界",
  ]) {
    assert(contract.includes(required), `contract_missing:${required}`);
  }

  console.log(JSON.stringify({
    ok: true,
    contract: "v22_user_credit_provider_key_flow",
    providerKeyRef: bound.res.payload.providerKeyRef,
  }, null, 2));
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}
