import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const RAW_PROVIDER_KEY = "gflabtoken_raw_key_portal_cloud_test_backend_only";
const FORBIDDEN_PUBLIC_TERMS = /TKE|COS|TCR|Kubernetes|node pool|nodePool|bucket|object key|objectKey|SecretId|SecretKey|kubeconfig|raw response|signedUrl|signed URL/i;

const { createPortalApiRoutes } = await import("../services/portal/src/routes/portal-api.routes.mjs");
const { createProviderSecretStore } = await import("../services/portal/src/domain/provider-secret-store.mjs");

function assertNoSecretLeak(value, label) {
  const serialized = JSON.stringify(value);
  assert.equal(serialized.includes(RAW_PROVIDER_KEY), false, `${label}_must_not_leak_raw_provider_key`);
  assert.equal(/launchToken|runtimeToken|bearerToken|providerSecret|rawProviderKey|providerApiKey|apiKey/i.test(serialized), false, `${label}_must_not_expose_secret_fields`);
}

function assertNoCloudConsoleLanguage(value, label) {
  const serialized = JSON.stringify(value);
  assert.equal(FORBIDDEN_PUBLIC_TERMS.test(serialized), false, `${label}_must_not_expose_cloud_console_language`);
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

const tempRoot = await mkdtemp(path.join(os.tmpdir(), "v22-portal-cloud-test-api-"));
try {
  const providerSecretStore = createProviderSecretStore({ secretsRoot: tempRoot });
  const db = {
    users: [],
    tenants: [],
    wallets: [],
    ledger: [],
    taskSpaces: [],
    providerKeyBindings: [],
    workspaceResourceBindings: [],
    userComputeInstances: [],
    userStorageBuckets: [],
    weeklyProtectionFreezes: [],
    workspaceFiles: [],
    cloudOperations: [],
    computeAllocations: [],
    fileSpaceEntitlements: [],
    cloudResourceProjections: [],
    billingReconciliations: [],
    auditEvents: [],
    announcements: [],
  };
  const writes = [];
  function createRoute(overrides = {}) {
    return createPortalApiRoutes({
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
      ...overrides,
    });
  }

  const disabledRoute = createRoute();
  const productionRoute = createRoute({
    enableCloudOperationTestBridge: true,
    nodeEnv: "production",
  });
  const route = createRoute({
    enableCloudOperationTestBridge: true,
    nodeEnv: "test",
  });

  async function request({ method = "GET", urlPath = "/", body = null, user = null, routeHandler = route } = {}) {
    const res = responseRecorder();
    const handled = await routeHandler({
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
      tenantId: "tenant-v22-cloud-test",
      userId: "user-v22-cloud-test",
      email: "cloud-test@example.test",
      name: "Portal Cloud Test User",
      workspaceId: "workspace-v22-cloud-test",
    },
  });
  const user = db.users.find((item) => item.id === "user-v22-cloud-test");
  assert.ok(user, "prepared_user_must_exist");

  const disabledPost = await request({
    method: "POST",
    urlPath: "/portal/api/v22/cloud-operations/test/fake-live",
    routeHandler: disabledRoute,
    user,
    body: {
      workspaceId: "workspace-v22-cloud-test",
      operationType: "create_storage",
      acceptedDryRunId: "disabled-route-proof",
    },
  });
  assert.equal(disabledPost.handled, false, "test_bridge_must_be_disabled_by_default");

  const productionPost = await request({
    method: "POST",
    urlPath: "/portal/api/v22/cloud-operations/test/fake-live",
    routeHandler: productionRoute,
    user,
    body: {
      workspaceId: "workspace-v22-cloud-test",
      operationType: "create_storage",
      acceptedDryRunId: "production-route-proof",
    },
  });
  assert.equal(productionPost.handled, false, "test_bridge_must_be_disabled_in_production");

  await request({
    method: "POST",
    urlPath: "/portal/api/v22/users/credit",
    user,
    body: {
      userId: user.id,
      amount: 1000,
      idempotencyKey: "v22-portal-cloud-test-credit-once",
    },
  });

  const bound = await request({
    method: "POST",
    urlPath: "/portal/api/v22/provider-key",
    user,
    body: {
      workspaceId: "workspace-v22-cloud-test",
      provider: "gflabtoken",
      apiKey: RAW_PROVIDER_KEY,
    },
  });
  assert.equal(bound.res.statusCode, 200, "provider_key_binding_must_return_200");

  db.workspaceResourceBindings.push({
    resourceBindingId: "rb-foreign-owner",
    tenantId: "tenant-foreign",
    userId: "user-foreign",
    workspaceId: "workspace-foreign",
    status: "active",
  });
  db.fileSpaceEntitlements.push({
    id: "fs-foreign-owner",
    resourceBindingId: "rb-foreign-owner",
    tenantId: "tenant-foreign",
    userId: "user-foreign",
    workspaceId: "workspace-foreign",
    status: "available",
    capacityGb: 999,
  });

  async function execute(operationType, body = {}) {
    const response = await request({
      method: "POST",
      urlPath: "/portal/api/v22/cloud-operations/test/fake-live",
      user,
      body: {
        workspaceId: "workspace-v22-cloud-test",
        operationType,
        acceptedDryRunId: `accepted-${operationType}`,
        ...body,
      },
    });
    assert.equal(response.handled, true, `${operationType}_route_must_be_handled`);
    assert.equal(response.res.payload.ok, true, `${operationType}_must_return_ok`);
    assert.equal(response.res.payload.testOnly, true, `${operationType}_must_be_test_only`);
    assert.equal(response.res.payload.productionPortalConnected, false, `${operationType}_must_not_claim_production_portal_connected`);
    assert.equal(response.res.payload.runnerMode, "fake-live", `${operationType}_runner_mode_mismatch`);
    assert.equal(response.res.payload.realCloudCalls, false, `${operationType}_must_not_call_real_cloud`);
    assert.equal(response.res.payload.operation.status, "succeeded", `${operationType}_operation_status_mismatch`);
    assert.match(response.res.payload.operation.evidenceRef, /^\.runtime\/v22-cloud-lifecycle\/op-[a-z0-9-]+-fake-live\.json$/, `${operationType}_evidence_ref_must_be_sanitized`);
    assertNoSecretLeak(response.res.payload, `${operationType}_response`);
    assertNoCloudConsoleLanguage(response.res.payload.publicProjection, `${operationType}_public_projection`);
    return response.res.payload;
  }

  const createStorage = await execute("create_storage", { fileSpaceGb: 100, planId: "pro_8c16g_100gb" });
  const resourceBindingId = createStorage.resourceBindingId;
  assert.ok(resourceBindingId, "create_storage_must_return_resource_binding_id");

  await execute("create_compute", { resourceBindingId, planId: "pro_8c16g_100gb", computeUnits: 1 });
  await execute("expand_storage", { resourceBindingId, fileSpaceGb: 200 });
  await execute("expand_compute", { resourceBindingId, computeUnits: 2, planId: "pro_8c16g_100gb" });
  await execute("release_compute", { resourceBindingId });
  await execute("delete_storage", { resourceBindingId });

  const foreignDelete = await request({
    method: "POST",
    urlPath: "/portal/api/v22/cloud-operations/test/fake-live",
    user,
    body: {
      workspaceId: "workspace-v22-cloud-test",
      operationType: "delete_storage",
      resourceBindingId: "rb-foreign-owner",
      acceptedDryRunId: "accepted-foreign-delete",
    },
  });
  assert.equal(foreignDelete.handled, true, "foreign_delete_route_must_be_handled");
  assert.equal(foreignDelete.res.statusCode, 403, "foreign_delete_must_fail_closed");
  assert.equal(foreignDelete.res.payload.ok, false, "foreign_delete_must_return_not_ok");
  assert.equal(foreignDelete.res.payload.error, "resource_binding_owner_mismatch", "foreign_delete_error_mismatch");
  assert.equal(db.fileSpaceEntitlements.find((item) => item.id === "fs-foreign-owner")?.status, "available", "foreign_file_space_must_not_be_changed");
  assertNoSecretLeak(foreignDelete.res.payload, "foreign_delete_response");

  assert.equal(db.cloudOperations.length, 6, "six_successful_cloud_operations_must_be_written");
  assert.equal(db.cloudOperations.every((item) => item.status === "succeeded" && item.runnerMode === "fake-live" && item.realCloudCalls === false), true, "cloud_operations_must_be_fake_live_succeeded");
  assert.equal(db.computeAllocations.length, 1, "compute_allocation_must_be_canonical");
  assert.equal(db.computeAllocations[0].status, "released", "compute_release_must_release_compute_only");
  assert.equal(db.fileSpaceEntitlements.filter((item) => item.workspaceId === "workspace-v22-cloud-test").length, 1, "file_space_entitlement_must_be_canonical");
  assert.equal(db.fileSpaceEntitlements.find((item) => item.workspaceId === "workspace-v22-cloud-test")?.capacityGb, 200, "file_space_expand_must_update_capacity");
  assert.equal(db.fileSpaceEntitlements.find((item) => item.workspaceId === "workspace-v22-cloud-test")?.status, "retention_protected", "delete_storage_must_enter_protection");
  assert.equal(db.billingReconciliations.length >= 6, true, "billing_reconciliation_must_be_written");
  assert.equal(db.auditEvents.length >= 6, true, "audit_events_must_be_written");
  assert.equal(db.cloudResourceProjections.length >= 1, true, "cloud_resource_projection_must_be_written");

  const projection = await request({
    urlPath: "/portal/api/v22/cloud-operations/test/projection?workspaceId=workspace-v22-cloud-test",
    user,
  });
  assert.equal(projection.handled, true, "projection_route_must_be_handled");
  assert.equal(projection.res.statusCode, 200, "projection_must_return_200");
  assert.equal(projection.res.payload.ok, true, "projection_must_return_ok");
  assert.equal(projection.res.payload.testOnly, true, "projection_must_be_test_only");
  assert.equal(projection.res.payload.productionPortalConnected, false, "projection_must_not_claim_production_portal_connected");
  assert.equal(projection.res.payload.runnerMode, "fake-live", "projection_runner_mode_mismatch");
  assert.equal(projection.res.payload.realCloudCalls, false, "projection_must_not_call_real_cloud");
  assert.equal(projection.res.payload.resources.compute.statusLabel, "已释放", "projection_compute_must_be_released");
  assert.equal(projection.res.payload.resources.fileSpace.statusLabel, "文件保护期", "projection_file_space_must_be_protected");
  assert.equal(projection.res.payload.resources.fileSpace.capacityGb, 200, "projection_file_space_capacity_mismatch");
  assert.equal(projection.res.payload.billing.reconciliationStatusLabel, "对账中", "projection_billing_status_mismatch");
  assert.deepEqual(projection.res.payload.visibleConcepts, ["工作台资源", "计算资源", "文件空间", "套餐", "余额", "冻结金额"], "projection_visible_concepts_mismatch");
  assertNoSecretLeak(projection.res.payload, "projection_response");
  assertNoCloudConsoleLanguage(projection.res.payload, "projection_response");

  assert.equal(writes.length >= 9, true, "mutating_routes_must_persist_db");

  console.log(JSON.stringify({
    ok: true,
    contract: "v22_portal_cloud_operation_test_api_fake_live",
    operations: db.cloudOperations.map((item) => item.operationType),
    resourceBindingId,
  }, null, 2));
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}
