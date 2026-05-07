import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const RAW_PROVIDER_KEY = "gflabtoken_raw_key_managed_environment_backend_only";

const { createPortalApiRoutes } = await import("../services/portal/src/routes/portal-api.routes.mjs");
const { createProviderSecretStore } = await import("../services/portal/src/domain/provider-secret-store.mjs");

function assertNoSecretLeak(value, label) {
  const serialized = JSON.stringify(value);
  assert.equal(serialized.includes(RAW_PROVIDER_KEY), false, `${label}_must_not_leak_raw_provider_key`);
  assert.equal(/launchToken|runtimeToken|bearerToken|providerSecret|rawProviderKey|providerApiKey|apiKey/i.test(serialized), false, `${label}_must_not_expose_secret_fields`);
}

function assertNoCloudConsoleLanguage(value, label) {
  const serialized = JSON.stringify(value);
  assert.equal(/K8s|TKE|云资源控制台/.test(serialized), false, `${label}_must_not_use_cloud_console_language`);
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

const tempRoot = await mkdtemp(path.join(os.tmpdir(), "v22-managed-environment-open-flow-"));
try {
  const providerSecretStore = createProviderSecretStore({ secretsRoot: tempRoot });
  const db = {
    users: [],
    tenants: [],
    wallets: [],
    ledger: [],
    taskSpaces: [],
    providerKeyBindings: [],
    userComputeInstances: [],
    userStorageBuckets: [],
    workspaceResourceBindings: [],
    weeklyProtectionFreezes: [],
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
    currentServerPlanSelection: (taskSpace) => ({ id: taskSpace?.serverPlanId || "starter_2c4g_10gb" }),
    currentTaskSpaceForUser: (targetDb, targetUser) => targetDb.taskSpaces.find((item) => item.userId === targetUser.id) || null,
    evaluateUserPolicy: async () => ({ ok: true }),
    fetchBillingSummary: async () => ({ totals: { totalCost: 0 }, items: [] }),
    fetchHarborSummary: async () => ({ available: false }),
    fetchOplAdapterCosts: async () => [],
    fetchOplAdapterRuns: async () => [],
    fetchOplAdapterTraceRows: async () => ({ rows: [] }),
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

  await request({
    method: "POST",
    urlPath: "/portal/api/v22/users/prepare",
    body: {
      tenantId: "tenant-v22-open",
      userId: "user-v22-open",
      email: "open@example.test",
      name: "Managed Environment User",
      workspaceId: "workspace-v22-open",
    },
  });
  const user = db.users.find((item) => item.id === "user-v22-open");
  assert.ok(user, "prepared_user_must_exist");

  await request({
    method: "POST",
    urlPath: "/portal/api/v22/users/credit",
    user,
    body: {
      userId: user.id,
      amount: 500,
      idempotencyKey: "v22-managed-open-topup",
    },
  });

  const blocked = await request({
    method: "POST",
    urlPath: "/portal/api/v22/managed-environment/open",
    user,
    body: {
      workspaceId: "workspace-v22-open",
      planId: "starter_2c4g_10gb",
      fileSpaceGb: 10,
    },
  });
  assert.equal(blocked.handled, true, "managed_environment_open_route_must_be_handled");
  assert.equal(blocked.res.statusCode, 409, "open_without_provider_must_return_409");
  assert.equal(blocked.res.payload.ok, false, "open_without_provider_must_return_not_ok");
  assert.equal(blocked.res.payload.error, "provider_key_required", "open_without_provider_error_mismatch");
  assert.equal(blocked.res.payload.readyForManagedEnvironment, false, "open_without_provider_must_not_be_ready");
  assertNoSecretLeak(blocked.res.payload, "open_without_provider");

  const bound = await request({
    method: "POST",
    urlPath: "/portal/api/v22/provider-key",
    user,
    body: {
      workspaceId: "workspace-v22-open",
      provider: "gflabtoken",
      apiKey: RAW_PROVIDER_KEY,
    },
  });
  assert.equal(bound.res.statusCode, 200, "provider_key_binding_must_return_200");

  const opened = await request({
    method: "POST",
    urlPath: "/portal/api/v22/managed-environment/open",
    user,
    body: {
      workspaceId: "workspace-v22-open",
      planId: "pro_8c16g_100gb",
      fileSpaceGb: 100,
      idempotencyKey: "v22-managed-open-once",
    },
  });
  assert.equal(opened.handled, true, "managed_environment_open_must_be_handled");
  assert.equal(opened.res.statusCode, 201, "managed_environment_open_must_create");
  assert.equal(opened.res.payload.ok, true, "managed_environment_open_must_return_ok");
  assert.equal(opened.res.payload.managedEnvironmentEnabled, true, "managed_environment_must_be_enabled");
  assert.equal(opened.res.payload.userNarrative.statusLabel, "托管运行环境已开通", "user_status_label_mismatch");
  assert.deepEqual(opened.res.payload.userNarrative.visibleConcepts, ["托管运行环境", "工作空间", "文件空间", "套餐", "余额", "预扣费"], "user_visible_concepts_mismatch");
  assertNoCloudConsoleLanguage(opened.res.payload.userNarrative, "open_user_narrative");
  assertNoSecretLeak(opened.res.payload, "managed_environment_open_response");

  assert.equal(opened.res.payload.selectedPlan.id, "pro_8c16g_100gb", "selected_plan_id_mismatch");
  assert.equal(opened.res.payload.selectedPlan.storageBackend, "cos_standard_workspace_quota", "selected_plan_storage_backend_mismatch");
  assert.equal(opened.res.payload.selectedPlan.basePrice, null, "selected_plan_base_price_must_be_null");
  assert.equal(opened.res.payload.selectedPlan.pendingProductApproval, true, "selected_plan_pending_product_approval_mismatch");
  assert.equal(opened.res.payload.fileSpace.capacityGb, 100, "file_space_capacity_mismatch");
  assert.equal(opened.res.payload.fileSpace.storageBackend, "cos_standard_workspace_quota", "file_space_backend_mismatch");

  const binding = opened.res.payload.resourceBinding;
  assert.ok(binding.resourceBindingId, "resource_binding_id_required");
  assert.equal(binding.tenantId, user.tenantId, "resource_binding_tenant_mismatch");
  assert.equal(binding.userId, user.id, "resource_binding_user_mismatch");
  assert.equal(binding.workspaceId, "workspace-v22-open", "resource_binding_workspace_mismatch");
  assert.equal(binding.billingAccountId, user.tenantId, "resource_binding_billing_account_mismatch");
  assert.equal(binding.auditTag, `tenant:${user.tenantId}/user:${user.id}/workspace:workspace-v22-open`, "resource_binding_audit_tag_mismatch");
  assert.equal(binding.costAllocationTag, `medopl:v22:${user.tenantId}:workspace-v22-open`, "resource_binding_cost_allocation_tag_mismatch");

  assert.equal(db.userComputeInstances.length, 1, "backend_compute_resource_must_be_created");
  assert.equal(db.userStorageBuckets.length, 1, "backend_storage_resource_must_be_created");
  assert.equal(db.workspaceResourceBindings.length, 1, "workspace_resource_binding_must_be_created");
  assert.equal(db.weeklyProtectionFreezes.length, 1, "weekly_freeze_must_be_created");
  assert.equal(db.userComputeInstances[0].implementationKind, "platform-managed CVM / runtime", "backend_compute_implementation_kind_mismatch");
  assert.equal(db.userStorageBuckets[0].implementationKind, "platform-managed COS", "backend_storage_implementation_kind_mismatch");

  const freeze = opened.res.payload.freeze;
  assert.ok(freeze.id, "freeze_id_required");
  assert.equal(freeze.resourceBindingId, binding.resourceBindingId, "freeze_binding_mismatch");
  assert.equal(freeze.status, "active_pending_product_approval", "freeze_status_mismatch");
  assert.equal(freeze.preauthStatus, "pending_product_approval", "freeze_preauth_status_mismatch");
  assert.equal(freeze.basePrice, null, "freeze_base_price_must_be_null");
  assert.equal(freeze.pendingProductApproval, true, "freeze_pending_product_approval_mismatch");

  const state = await request({
    urlPath: "/portal/api/canonical-state?workspaceId=workspace-v22-open",
    user,
  });
  assert.equal(state.res.statusCode, 200, "canonical_state_status_mismatch");
  assert.equal(state.res.payload.managedEnvironmentEnabled, true, "canonical_state_managed_environment_enabled_mismatch");
  assert.equal(state.res.payload.runtimeEnabled, true, "canonical_state_runtime_enabled_mismatch");
  assert.equal(state.res.payload.workspace.workspaceId, "workspace-v22-open", "canonical_state_workspace_mismatch");
  assert.equal(state.res.payload.fileSpace.capacityGb, 100, "canonical_state_file_space_mismatch");
  assert.equal(state.res.payload.fileSpace.storageBackend, "cos_standard_workspace_quota", "canonical_state_file_space_backend_mismatch");
  assert.equal(state.res.payload.selectedPlan.id, "pro_8c16g_100gb", "canonical_state_selected_plan_mismatch");
  assert.equal(state.res.payload.selectedPlan.basePrice, null, "canonical_state_selected_plan_base_price_must_be_null");
  assert.equal(state.res.payload.selectedPlan.pendingProductApproval, true, "canonical_state_selected_plan_pending_mismatch");
  assert.equal(state.res.payload.resourceBinding.resourceBindingId, binding.resourceBindingId, "canonical_state_resource_binding_mismatch");
  assert.equal(state.res.payload.resourceBinding.billingAccountId, user.tenantId, "canonical_state_billing_account_mismatch");
  assert.equal(state.res.payload.freeze.resourceBindingId, binding.resourceBindingId, "canonical_state_freeze_mismatch");
  assert.equal(state.res.payload.balance.balanceCents, 50000, "canonical_state_balance_mismatch");
  assertNoSecretLeak(state.res.payload, "canonical_state_after_open");
  assertNoCloudConsoleLanguage(state.res.payload.userNarrative, "canonical_state_user_narrative");

  const contract = await readFile("docs/contracts/v22-managed-environment-open-boundary.md", "utf8");
  for (const required of [
    "provider_key_required",
    "starter_2c4g_10gb",
    "pro_8c16g_100gb",
    "cos_standard_workspace_quota",
    "basePrice",
    "pendingProductApproval",
    "resourceBinding",
    "billingAccount",
    "auditTag",
    "managedEnvironmentEnabled",
  ]) {
    assert(contract.includes(required), `contract_missing:${required}`);
  }

  console.log(JSON.stringify({
    ok: true,
    contract: "v22_managed_environment_open_flow",
    resourceBindingId: binding.resourceBindingId,
    selectedPlanId: opened.res.payload.selectedPlan.id,
  }, null, 2));
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}
