import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const RAW_PROVIDER_KEY = "gflabtoken_raw_key_portal_production_cloud_backend_only";
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

function routeFactory({ db, providerSecretStore, writes, secretFile, enableProductionBridge = true } = {}) {
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
    enableCloudOperationProductionBridge: enableProductionBridge,
    cloudOperationRunnerMode: "fake-live",
    cloudOperationSecretFile: secretFile,
    cloudOperationRunnerScript: "scripts/v22-tencent-authorized-resource-lifecycle-runner.mjs",
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

const tempRoot = await mkdtemp(path.join(os.tmpdir(), "v22-portal-production-cloud-loop-"));
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
  const route = routeFactory({ db, providerSecretStore, writes, secretFile });

  await request({
    route,
    db,
    method: "POST",
    urlPath: "/portal/api/v22/users/prepare",
    body: {
      tenantId: "tenant-v22-production-cloud",
      userId: "user-v22-production-cloud",
      email: "production-cloud@example.test",
      name: "Portal Production Cloud User",
      workspaceId: "workspace-v22-production-cloud",
    },
  });
  const user = db.users.find((item) => item.id === "user-v22-production-cloud");
  assert.ok(user, "prepared_user_must_exist");
  assert.equal(db.taskSpaces.length, 1, "prepared_workspace_must_exist");
  assert.equal(typeof db.taskSpaces[0].path, "string", "prepared_workspace_path_must_be_string");
  assert.ok(db.taskSpaces[0].path.includes("workspace-v22-production-cloud"), "prepared_workspace_path_must_include_workspace_id");

  await request({
    route,
    db,
    method: "POST",
    urlPath: "/portal/api/v22/users/credit",
    user,
    body: {
      userId: user.id,
      amount: 1000,
      idempotencyKey: "v22-portal-production-cloud-credit-once",
    },
  });

  const bound = await request({
    route,
    db,
    method: "POST",
    urlPath: "/portal/api/v22/provider-key",
    user,
    body: {
      workspaceId: "workspace-v22-production-cloud",
      provider: "gflabtoken",
      apiKey: RAW_PROVIDER_KEY,
    },
  });
  assert.equal(bound.res.statusCode, 200, "provider_key_binding_must_return_200");

  const createStorage = await request({
    route,
    db,
    method: "POST",
    urlPath: "/portal/api/v22/cloud-operations/storage/create",
    user,
    body: {
      workspaceId: "workspace-v22-production-cloud",
      fileSpaceGb: 10,
      planId: "starter_2c4g_10gb",
      idempotencyKey: "production-storage-create-once",
    },
  });
  assert.equal(createStorage.handled, true, "production_storage_create_route_must_be_handled");
  assert.equal(createStorage.res.statusCode, 202, "production_storage_create_must_return_202");
  assert.equal(createStorage.res.payload.ok, true, "production_storage_create_must_return_ok");
  assert.equal(createStorage.res.payload.productionPortalConnected, true, "production_storage_create_must_claim_production_portal_connected");
  assert.equal(Object.hasOwn(createStorage.res.payload, "runnerMode"), false, "production_payload_must_not_expose_runner_mode");
  assert.equal(Object.hasOwn(createStorage.res.payload, "realCloudCalls"), false, "production_payload_must_not_expose_real_cloud_flag");
  assert.equal(createStorage.res.payload.operation?.operationType, "create_storage", "operation_type_mismatch");
  assert.equal(createStorage.res.payload.operation?.status, "queued", "operation_status_mismatch");
  assert.equal(Object.hasOwn(createStorage.res.payload, "testOnly"), false, "production_payload_must_not_expose_test_only_flag");
  assert.equal(Object.hasOwn(createStorage.res.payload.operation || {}, "runnerMode"), false, "operation_payload_must_not_expose_runner_mode");
  assert.equal(Object.hasOwn(createStorage.res.payload.operation || {}, "realCloudCalls"), false, "operation_payload_must_not_expose_real_cloud_flag");
  assert.ok(createStorage.res.payload.resourceBindingId, "resource_binding_id_must_be_returned");
  assert.equal(createStorage.res.payload.publicProjection.resources.fileSpace.statusLabel, "未开通", "queued_projection_must_not_claim_file_space_available");

  const drain = processQueuedPortalProductionCloudOperations(db, {
    runnerMode: "fake-live",
    secretFile,
    maxOperations: 1,
    workerId: "worker-v22-production-storage-smoke",
    repoRoot: ".",
  });
  assert.equal(drain.ok, true, "worker_drain_must_succeed");
  assert.equal(drain.processed.length, 1, "worker_drain_must_process_storage_create");

  const projection = await request({
    route,
    db,
    urlPath: "/portal/api/v22/cloud-operations/projection?workspaceId=workspace-v22-production-cloud",
    user,
  });
  assert.equal(projection.handled, true, "production_projection_route_must_be_handled");
  assert.equal(projection.res.statusCode, 200, "production_projection_must_return_200");
  assert.equal(projection.res.payload.ok, true, "production_projection_must_return_ok");
  assert.equal(projection.res.payload.productionPortalConnected, true, "production_projection_must_claim_production");
  assert.equal(Object.hasOwn(projection.res.payload, "runnerMode"), false, "projection_must_not_expose_runner_mode");
  assert.equal(Object.hasOwn(projection.res.payload, "realCloudCalls"), false, "projection_must_not_expose_real_cloud_flag");
  assert.equal(Object.hasOwn(projection.res.payload, "testOnly"), false, "projection_must_not_expose_test_only_flag");
  assert.deepEqual(projection.res.payload.visibleConcepts, ["工作台资源", "计算资源", "文件空间", "套餐", "余额", "冻结金额"], "projection_visible_concepts_mismatch");
  assert.equal(projection.res.payload.resources.fileSpace.statusLabel, "可用", "projection_file_space_status");
  assert.equal(projection.res.payload.resources.fileSpace.capacityGb, 10, "projection_file_space_capacity");

  assert.equal(db.cloudOperations.length, 1, "cloud_operation_must_be_canonical");
  assert.equal(db.cloudOperations[0].status, "succeeded", "cloud_operation_status");
  assert.equal(db.cloudOperations[0].testOnly, false, "cloud_operation_must_not_be_test_only");
  assert.equal(db.cloudOperations[0].productionPortalConnected, true, "cloud_operation_must_mark_production_connection");
  assert.equal(db.cloudOperations[0].acceptedDryRunId, db.cloudOperations[0].operationId, "accepted_dry_run_must_match_operation_id");
  assert.equal(db.cloudOperationJobs.length, 1, "cloud_operation_job_must_be_recorded");
  assert.equal(db.cloudOperationJobs[0].status, "succeeded", "cloud_operation_job_status");
  assert.equal(db.cloudOperationJobs[0].queueMode, "independent_worker", "cloud_operation_job_queue_mode");
  assert.equal(db.cloudOperationJobs[0].leaseOwner, "worker-v22-production-storage-smoke", "cloud_operation_job_lease_owner");
  assert.equal(db.fileSpaceEntitlements.length, 1, "file_space_entitlement_must_be_canonical");
  assert.equal(db.fileSpaceEntitlements[0].capacityGb, 10, "file_space_capacity_mismatch");
  assert.equal(db.billingReconciliations.length, 1, "billing_reconciliation_must_be_written");
  assert.equal(db.auditEvents.length >= 1, true, "audit_event_must_be_written");
  assert.equal(db.cloudResourceProjections.length, 1, "cloud_resource_projection_must_be_written");
  assert.equal(writes.length >= 3, true, "mutating_routes_must_persist_db");

  const dryRunReport = JSON.parse(await readFile(path.resolve(db.cloudOperations[0].dryRunReportRef), "utf8"));
  const executionReport = JSON.parse(await readFile(path.resolve(db.cloudOperations[0].executionReportRef), "utf8"));
  assert.equal(dryRunReport.gateId, "R-06", "dry_run_gate_mismatch");
  assert.equal(executionReport.execution.providerMode, "fake-live", "execution_report_provider_mode");
  assert.equal(executionReport.execution.acceptedDryRunVerified, true, "execution_report_must_accept_dry_run");

  console.log(JSON.stringify({
    ok: true,
    contract: "v22_portal_production_cloud_operation_loop",
    checked: [
      "production_route_not_test_route",
      "canonical_cloud_operation_written",
      "independent_worker_queue_job_written",
      "package_c_runner_dry_run_and_fake_live_execute",
      "file_space_entitlement_written",
      "billing_reconciliation_written",
      "audit_event_written",
      "public_projection_sanitized",
      "no_secret_or_raw_cloud_output",
    ],
    operationId: createStorage.res.payload.operation.operationId,
    resourceBindingId: createStorage.res.payload.resourceBindingId,
  }, null, 2));
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}
