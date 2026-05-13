import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const RAW_PROVIDER_KEY = "gflabtoken_raw_key_portal_production_cloud_lifecycle_backend_only";
const FORBIDDEN_PUBLIC_TERMS = /\/test\/fake-live|testOnly|TKE|COS|TCR|Kubernetes|node pool|nodePool|bucket|object key|objectKey|SecretId|SecretKey|kubeconfig|raw response|signedUrl|signed URL|mutation-secret|bucket-proof|workspace-prefix-proof|node-pool-proof/i;

const { createPortalApiRoutes } = await import("../services/portal/src/routes/portal-api.routes.mjs");
const { createProviderSecretStore } = await import("../services/portal/src/domain/provider-secret-store.mjs");
const { processQueuedPortalProductionCloudOperations } = await import("../services/portal/src/domain/portal-cloud-operation-production.mjs");

function assertNoSecretLeak(value, label) {
  const serialized = typeof value === "string" ? value : JSON.stringify(value);
  assert.equal(serialized.includes(RAW_PROVIDER_KEY), false, `${label}_must_not_leak_raw_provider_key`);
  assert.equal(/launchToken|runtimeToken|bearerToken|providerSecret|rawProviderKey|providerApiKey|apiKey/i.test(serialized), false, `${label}_must_not_expose_secret_fields`);
}

function assertNoCloudConsoleLanguage(value, label) {
  const serialized = typeof value === "string" ? value : JSON.stringify(value);
  assert.equal(FORBIDDEN_PUBLIC_TERMS.test(serialized), false, `${label}_must_not_expose_test_or_cloud_console_language`);
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

function routeFactory({ providerSecretStore, writes, secretFile } = {}) {
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
    enableCloudOperationProductionBridge: true,
    cloudOperationRunnerMode: "fake-live",
    cloudOperationSecretFile: secretFile,
    cloudOperationRunnerScript: "scripts/v22-tencent-authorized-resource-lifecycle-runner.mjs",
    cloudOperationComputeNodePoolRef: "np-backend-attribution-proof",
    nodeEnv: "test",
  });
}

async function request({ route, db, method = "GET", urlPath = "/", body = null, user = null } = {}) {
  const res = responseRecorder();
  const handled = await route({
    req: { method, body: body ? JSON.stringify(body) : "" },
    res,
    url: new URL(urlPath, "http://portal.local"),
    db,
    user,
  });
  assertNoSecretLeak(res.payload, `${method}_${urlPath}_payload`);
  assertNoCloudConsoleLanguage(res.payload, `${method}_${urlPath}_payload`);
  return { handled, res };
}

function assertProductionOperationPayload(payload = {}, operationType = "") {
  assert.equal(payload.ok, true, `${operationType}_must_return_ok`);
  assert.equal(payload.productionPortalConnected, true, `${operationType}_must_claim_production_portal_connected`);
  assert.equal(Object.hasOwn(payload, "runnerMode"), false, `${operationType}_payload_must_not_expose_runner_mode`);
  assert.equal(Object.hasOwn(payload, "realCloudCalls"), false, `${operationType}_payload_must_not_expose_real_cloud_flag`);
  assert.equal(Object.hasOwn(payload, "testOnly"), false, `${operationType}_payload_must_not_expose_test_only_flag`);
  assert.equal(payload.operation?.operationType, operationType, `${operationType}_operation_type_mismatch`);
  assert.equal(payload.operation?.status, "queued", `${operationType}_operation_status_mismatch`);
  assert.equal(Object.hasOwn(payload.operation || {}, "runnerMode"), false, `${operationType}_operation_must_not_expose_runner_mode`);
  assert.equal(Object.hasOwn(payload.operation || {}, "realCloudCalls"), false, `${operationType}_operation_must_not_expose_real_cloud_flag`);
}

async function execute(route, db, user, operationType, urlPath, body = {}, { secretFile = "" } = {}) {
  const response = await request({
    route,
    db,
    method: "POST",
    urlPath,
    user,
    body,
  });
  assert.equal(response.handled, true, `${operationType}_route_must_be_handled`);
  assert.equal(response.res.statusCode, 202, `${operationType}_must_return_202`);
  assertProductionOperationPayload(response.res.payload, operationType);
  const drain = processQueuedPortalProductionCloudOperations(db, {
    runnerMode: "fake-live",
    secretFile,
    computeNodePoolRef: "np-backend-attribution-proof",
    maxOperations: 1,
    workerId: `worker-v22-lifecycle-${operationType}`,
    repoRoot: ".",
  });
  assert.equal(drain.ok, true, `${operationType}_worker_drain_must_succeed`);
  assert.equal(drain.processed.length, 1, `${operationType}_worker_drain_must_process_one`);
  return response.res.payload;
}

const tempRoot = await mkdtemp(path.join(os.tmpdir(), "v22-portal-production-cloud-lifecycle-"));
try {
  const secretFile = path.join(tempRoot, "package-c-mutation.env");
  await writeFile(secretFile, [
    "RUN_TENCENT_CREATE_RELEASE_EXECUTION=1",
    "TENCENT_MUTATION_SECRET_ID=mutation-secret-id-proof",
    "TENCENT_MUTATION_SECRET_KEY=mutation-secret-key-proof",
    "TENCENT_MUTATION_ALLOWED_APIS=putObject,deleteObject,DescribeNodePools,ScaleNodePool",
    "TENCENT_MUTATION_REGIONS=na-siliconvalley",
    "TENCENT_MUTATION_ACCOUNT_ID=account-proof-123456",
    "TENCENT_MUTATION_DAILY_BUDGET_CNY=20",
    "TENCENT_MUTATION_MAX_OPERATION_COUNT=6",
    "TENCENT_MUTATION_TKE_CLUSTER_ID=cls-proof",
    "TENCENT_MUTATION_TKE_NODE_POOL_ID=node-pool-proof",
    "TENCENT_MUTATION_COS_BUCKET=bucket-proof",
    "TENCENT_MUTATION_COS_REGION=na-siliconvalley",
    "TENCENT_MUTATION_WORKSPACE_PREFIX_ROOT=workspace-prefix-proof",
  ].join("\n"), "utf8");

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
    cloudOperationJobs: [],
    computeAllocations: [],
    fileSpaceEntitlements: [],
    cloudResourceProjections: [],
    billingReconciliations: [],
    auditEvents: [],
    announcements: [],
  };
  const writes = [];
  const route = routeFactory({ providerSecretStore, writes, secretFile });

  await request({
    route,
    db,
    method: "POST",
    urlPath: "/portal/api/v22/users/prepare",
    body: {
      tenantId: "tenant-v22-production-cloud-lifecycle",
      userId: "user-v22-production-cloud-lifecycle",
      email: "production-cloud-lifecycle@example.test",
      name: "Portal Production Cloud Lifecycle User",
      workspaceId: "workspace-v22-production-cloud-lifecycle",
    },
  });
  const user = db.users.find((item) => item.id === "user-v22-production-cloud-lifecycle");
  assert.ok(user, "prepared_user_must_exist");

  await request({
    route,
    db,
    method: "POST",
    urlPath: "/portal/api/v22/users/credit",
    user,
    body: {
      userId: user.id,
      amount: 1000,
      idempotencyKey: "v22-portal-production-cloud-lifecycle-credit-once",
    },
  });

  const bound = await request({
    route,
    db,
    method: "POST",
    urlPath: "/portal/api/v22/provider-key",
    user,
    body: {
      workspaceId: "workspace-v22-production-cloud-lifecycle",
      provider: "gflabtoken",
      apiKey: RAW_PROVIDER_KEY,
    },
  });
  assert.equal(bound.res.statusCode, 200, "provider_key_binding_must_return_200");

  db.workspaceResourceBindings.push({
    resourceBindingId: "rb-foreign-production",
    tenantId: "tenant-foreign",
    userId: "user-foreign",
    workspaceId: "workspace-foreign",
    status: "active",
  });

  const createStorage = await execute(route, db, user, "create_storage", "/portal/api/v22/cloud-operations/storage/create", {
    workspaceId: "workspace-v22-production-cloud-lifecycle",
    fileSpaceGb: 10,
    planId: "starter_2c4g_10gb",
  }, { secretFile });
  const resourceBindingId = createStorage.resourceBindingId;
  assert.ok(resourceBindingId, "create_storage_must_return_resource_binding_id");

  await execute(route, db, user, "create_compute", "/portal/api/v22/cloud-operations/compute/create", {
    workspaceId: "workspace-v22-production-cloud-lifecycle",
    resourceBindingId,
    computeUnits: 1,
    targetDesiredCapacity: 1,
    planId: "starter_2c4g_10gb",
  }, { secretFile });
  await execute(route, db, user, "expand_storage", "/portal/api/v22/cloud-operations/storage/expand", {
    workspaceId: "workspace-v22-production-cloud-lifecycle",
    resourceBindingId,
    fileSpaceGb: 20,
  }, { secretFile });
  await execute(route, db, user, "expand_compute", "/portal/api/v22/cloud-operations/compute/expand", {
    workspaceId: "workspace-v22-production-cloud-lifecycle",
    resourceBindingId,
    computeUnits: 2,
    targetDesiredCapacity: 2,
  }, { secretFile });
  await execute(route, db, user, "release_compute", "/portal/api/v22/cloud-operations/compute/release", {
    workspaceId: "workspace-v22-production-cloud-lifecycle",
    resourceBindingId,
    targetDesiredCapacity: 0,
  }, { secretFile });
  await execute(route, db, user, "delete_storage", "/portal/api/v22/cloud-operations/storage/delete", {
    workspaceId: "workspace-v22-production-cloud-lifecycle",
    resourceBindingId,
    fileSpaceGb: 20,
  }, { secretFile });

  const foreignDelete = await request({
    route,
    db,
    method: "POST",
    urlPath: "/portal/api/v22/cloud-operations/storage/delete",
    user,
    body: {
      workspaceId: "workspace-v22-production-cloud-lifecycle",
      resourceBindingId: "rb-foreign-production",
      fileSpaceGb: 20,
    },
  });
  assert.equal(foreignDelete.handled, true, "foreign_delete_route_must_be_handled");
  assert.equal(foreignDelete.res.statusCode, 403, "foreign_delete_must_fail_closed");
  assert.equal(foreignDelete.res.payload.ok, false, "foreign_delete_must_return_not_ok");
  assert.equal(foreignDelete.res.payload.error, "resource_binding_owner_mismatch", "foreign_delete_error_mismatch");

  const projection = await request({
    route,
    db,
    urlPath: "/portal/api/v22/cloud-operations/projection?workspaceId=workspace-v22-production-cloud-lifecycle",
    user,
  });
  assert.equal(projection.handled, true, "projection_route_must_be_handled");
  assert.equal(projection.res.statusCode, 200, "projection_must_return_200");
  assert.equal(projection.res.payload.ok, true, "projection_must_return_ok");
  assert.equal(projection.res.payload.productionPortalConnected, true, "projection_must_claim_production");
  assert.equal(Object.hasOwn(projection.res.payload, "runnerMode"), false, "projection_must_not_expose_runner_mode");
  assert.equal(Object.hasOwn(projection.res.payload, "realCloudCalls"), false, "projection_must_not_expose_real_cloud_flag");
  assert.equal(Object.hasOwn(projection.res.payload, "testOnly"), false, "projection_must_not_expose_test_only_flag");
  assert.equal(projection.res.payload.resources.compute.statusLabel, "已释放", "projection_compute_must_be_released");
  assert.equal(projection.res.payload.resources.fileSpace.statusLabel, "文件保护期", "projection_file_space_must_be_protected");
  assert.equal(projection.res.payload.resources.fileSpace.capacityGb, 20, "projection_file_space_capacity_mismatch");
  assert.equal(projection.res.payload.billing.reconciliationStatusLabel, "对账中", "projection_billing_status_mismatch");
  assert.deepEqual(projection.res.payload.visibleConcepts, ["工作台资源", "计算资源", "文件空间", "套餐", "余额", "冻结金额"], "projection_visible_concepts_mismatch");

  assert.deepEqual(db.cloudOperations.map((item) => item.operationType), [
    "create_storage",
    "create_compute",
    "expand_storage",
    "expand_compute",
    "release_compute",
    "delete_storage",
  ], "production_operations_must_cover_full_package_c_loop");
  assert.equal(db.cloudOperations.every((item) => item.status === "succeeded" && item.testOnly === false && item.productionPortalConnected === true), true, "production_operations_must_be_canonical");
  const computeOperationSpecs = db.cloudOperations
    .filter((item) => String(item.operationType || "").includes("compute"))
    .map((item) => item.requestedSpec || {});
  assert.equal(computeOperationSpecs[0].targetDesiredCapacity, "1", "create_compute_must_preserve_user_plan_target");
  assert.equal(computeOperationSpecs[0].providerTargetDesiredCapacity, "2", "create_compute_provider_target_must_not_drop_below_baseline");
  assert.equal(computeOperationSpecs[2].targetDesiredCapacity, "0", "release_compute_must_preserve_user_release_intent");
  assert.equal(computeOperationSpecs[2].providerTargetDesiredCapacity, "2", "release_compute_provider_target_must_keep_baseline");
  assert.equal(db.cloudOperationJobs.length, 6, "cloud_operation_jobs_must_cover_full_loop");
  assert.equal(db.computeAllocations.length, 1, "compute_allocation_must_be_canonical");
  assert.equal(db.computeAllocations[0].status, "released", "compute_release_must_release_compute_only");
  assert.equal(db.computeAllocations[0].nodePoolRef, "np-backend-attribution-proof", "compute_allocation_must_keep_backend_node_pool_attribution");
  assert.equal(db.fileSpaceEntitlements.length, 1, "file_space_entitlement_must_be_canonical");
  assert.equal(db.fileSpaceEntitlements[0].capacityGb, 20, "file_space_expand_must_update_capacity");
  assert.equal(db.fileSpaceEntitlements[0].status, "retention_protected", "storage_delete_must_enter_protection");
  assert.equal(db.weeklyProtectionFreezes.length >= 1, true, "freeze_must_be_written");
  assert.equal(db.ledger.length >= 6, true, "ledger_must_record_each_operation");
  assert.equal(db.billingReconciliations.length >= 6, true, "billing_reconciliation_must_record_each_operation");
  assert.equal(db.auditEvents.length >= 12, true, "audit_events_must_record_operation_lifecycle");
  assert.equal(db.cloudResourceProjections.length, 1, "cloud_resource_projection_must_be_written");
  assert.equal(writes.length >= 8, true, "mutating_routes_must_persist_db");

  const lastOperation = db.cloudOperations.at(-1);
  const dryRunReport = JSON.parse(await readFile(path.resolve(lastOperation.dryRunReportRef), "utf8"));
  const executionReport = JSON.parse(await readFile(path.resolve(lastOperation.executionReportRef), "utf8"));
  assert.equal(dryRunReport.operationType, "delete_storage", "last_dry_run_operation_type_mismatch");
  assert.equal(executionReport.execution.providerMode, "fake-live", "last_execution_provider_mode");
  assert.equal(executionReport.execution.acceptedDryRunVerified, true, "last_execution_must_accept_dry_run");

  console.log(JSON.stringify({
    ok: true,
    contract: "v22_portal_production_cloud_operation_resource_lifecycle_loop",
    operations: db.cloudOperations.map((item) => item.operationType),
    resourceBindingId,
  }, null, 2));
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}
