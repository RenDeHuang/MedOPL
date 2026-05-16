import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const RAW_PROVIDER_KEY = "gflabtoken_raw_key_package_click_cloud_backend_only";
const FORBIDDEN_PUBLIC_TERMS = /\/test\/local-executor|testOnly|TKE|COS|TCR|Kubernetes|node pool|nodePool|bucket|object key|objectKey|SecretId|SecretKey|kubeconfig|raw response|signedUrl|mutation-secret|bucket-proof|workspace-prefix-proof|node-pool-proof/i;

const { createPortalApiRoutes } = await import("../services/portal/src/routes/portal-api.routes.mjs");
const { createLabPackageRoutes } = await import("../services/portal/src/routes/lab-package.routes.mjs");
const { createProviderSecretStore } = await import("../services/portal/src/domain/provider-secret-store.mjs");
const { processQueuedPortalProductionCloudOperations } = await import("../services/portal/src/domain/portal-cloud-operation-production.mjs");

function assertNoSecretLeak(value, label) {
  const serialized = typeof value === "string" ? value : JSON.stringify(value);
  assert.equal(serialized.includes(RAW_PROVIDER_KEY), false, `${label}_must_not_leak_raw_provider_key`);
  assert.equal(/launchToken|runtimeToken|bearerToken|providerSecret|rawProviderKey|providerApiKey|apiKey/i.test(serialized), false, `${label}_must_not_expose_secret_fields`);
}

function assertNoCloudConsoleLanguage(value, label) {
  const serialized = typeof value === "string" ? value : JSON.stringify(value);
  assert.equal(FORBIDDEN_PUBLIC_TERMS.test(serialized), false, `${label}_must_not_expose_cloud_console_or_internal_terms`);
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

async function routeRequest(route, { db, method = "GET", urlPath = "/", body = null, user = null } = {}) {
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

function baseDb() {
  return {
    users: [],
    tenants: [],
    wallets: [],
    ledger: [],
    taskSpaces: [],
    providerKeyBindings: [],
    workspaceResourceBindings: [],
    weeklyProtectionFreezes: [],
    workspaceFiles: [],
    cloudOperations: [],
    cloudOperationJobs: [],
    computeAllocations: [],
    fileSpaceEntitlements: [],
    cloudResourceProjections: [],
    billingReconciliations: [],
    auditEvents: [],
    labSubscriptions: [],
    labPackageEvents: [],
    labStorageAddons: [],
    labDailyCharges: [],
    oplWorkSessions: [],
    oplWorkRuns: [],
    oplWorkTraceMetadata: [],
    announcements: [],
  };
}

function routeFactories({ db, providerSecretStore, writes, secretFile } = {}) {
  const common = {
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
  };
  return {
    apiRoute: createPortalApiRoutes({
      ...common,
      enableCloudOperationProductionBridge: true,
      cloudOperationRunnerMode: "local-executor",
      cloudOperationSecretFile: secretFile,
      cloudOperationRunnerScript: "scripts/v22-cloud-operation-local-executor.mjs",
      cloudOperationComputeNodePoolRef: "np-backend-attribution-proof",
      nodeEnv: "test",
    }),
    labRoute: createLabPackageRoutes({
      readBody,
      sendJson,
      writeDb: common.writeDb,
      enableCloudOperationProductionBridge: true,
      cloudOperationRunnerMode: "local-executor",
      cloudOperationSecretFile: secretFile,
      cloudOperationRunnerScript: "scripts/v22-cloud-operation-local-executor.mjs",
      cloudOperationComputeNodePoolRef: "np-backend-attribution-proof",
      repoRoot: ".",
    }),
  };
}

async function request({ route, db, method = "GET", urlPath = "/", body = null, user = null } = {}) {
  const { handled, res } = await routeRequest(route, { db, method, urlPath, body, user });
  assertNoSecretLeak(res.payload, `${method}_${urlPath}_payload`);
  assertNoCloudConsoleLanguage(res.payload, `${method}_${urlPath}_payload`);
  return { handled, res };
}

function assertPackageCloudResult(payload = {}, { packageId, planId, fileSpaceGb, operationTypes }) {
  assert.equal(payload.ok, true, `${packageId}_package_click_must_return_ok`);
  assert.equal(payload.cloudOperationPackage?.productionPortalConnected, true, `${packageId}_must_use_production_cloud_operation_bridge`);
  assert.equal(payload.cloudOperationPackage?.planId, planId, `${packageId}_plan_id_mismatch`);
  assert.equal(payload.cloudOperationPackage?.fileSpaceGb, fileSpaceGb, `${packageId}_file_space_mismatch`);
  assert.ok(payload.cloudOperationPackage?.resourceBindingId, `${packageId}_resource_binding_required`);
  assert.deepEqual(payload.cloudOperationPackage?.operations?.map((item) => item.operationType), operationTypes, `${packageId}_operations_mismatch`);
  assert.equal(payload.cloudOperationPackage?.operations?.every((item) => item.status === "queued"), true, `${packageId}_operations_must_start_queued`);
  assert.equal(Object.hasOwn(payload.cloudOperationPackage || {}, "runnerMode"), false, `${packageId}_must_not_expose_runner_mode`);
  assert.equal(Object.hasOwn(payload.cloudOperationPackage || {}, "realCloudCalls"), false, `${packageId}_must_not_expose_real_cloud_flag`);
}

function drainQueued(db, secretFile, expectedCount, label) {
  for (let index = 0; index < expectedCount; index += 1) {
    const result = processQueuedPortalProductionCloudOperations(db, {
      runnerMode: "local-executor",
      secretFile,
      computeNodePoolRef: "np-backend-attribution-proof",
      maxOperations: 1,
      workerId: `worker-v22-package-click-${label}-${index}`,
      repoRoot: ".",
    });
    assert.equal(result.ok, true, `${label}_${index}_worker_drain_must_succeed`);
    assert.equal(result.processed.length, 1, `${label}_${index}_worker_drain_must_process_one`);
  }
}

async function prepareUser(apiRoute, db, { tenantId, userId, workspaceId }) {
  await request({
    route: apiRoute,
    db,
    method: "POST",
    urlPath: "/portal/api/v22/users/prepare",
    body: {
      tenantId,
      userId,
      email: `${userId}@example.test`,
      name: userId,
      workspaceId,
    },
  });
  const user = db.users.find((item) => item.id === userId);
  assert.ok(user, `${userId}_must_exist`);
  await request({
    route: apiRoute,
    db,
    method: "POST",
    urlPath: "/portal/api/v22/users/credit",
    user,
    body: { userId, amount: 1000, idempotencyKey: `${userId}-credit-once` },
  });
  await request({
    route: apiRoute,
    db,
    method: "POST",
    urlPath: "/portal/api/v22/provider-key",
    user,
    body: { workspaceId, provider: "gflabtoken", apiKey: RAW_PROVIDER_KEY },
  });
  return user;
}

async function uploadThroughOpl(apiRoute, db, user, { workspaceId, fileName }) {
  const session = await request({
    route: apiRoute,
    db,
    method: "POST",
    urlPath: "/portal/api/v22/opl-work/sessions",
    user,
    body: { workspaceId, entrypoint: "portal_package_click_smoke" },
  });
  assert.equal(session.res.statusCode, 201, `${workspaceId}_session_must_create`);
  const sessionId = session.res.payload.oplSession.sessionId;
  const uploaded = await request({
    route: apiRoute,
    db,
    method: "POST",
    urlPath: "/portal/api/v22/opl-work/files",
    user,
    body: {
      workspaceId,
      sessionId,
      fileName,
      contentType: "text/csv",
      sizeBytes: 12,
    },
  });
  assert.equal(uploaded.res.statusCode, 201, `${workspaceId}_upload_must_create`);
  assert.equal(uploaded.res.payload.fileRef.workspaceId, workspaceId, `${workspaceId}_upload_workspace_mismatch`);
  return uploaded.res.payload.fileRef;
}

const tempRoot = await mkdtemp(path.join(os.tmpdir(), "v22-portal-package-click-cloud-loop-"));
try {
  const secretFile = path.join(tempRoot, "package-c-mutation.env");
  await writeFile(secretFile, [
    "RUN_TENCENT_CREATE_RELEASE_EXECUTION=1",
    "TENCENT_MUTATION_SECRET_ID=mutation-secret-id-proof",
    "TENCENT_MUTATION_SECRET_KEY=mutation-secret-key-proof",
    "TENCENT_MUTATION_ALLOWED_APIS=putObject,deleteObject,DescribeNodePools,ScaleNodePool",
    "TENCENT_MUTATION_REGIONS=na-siliconvalley",
    "TENCENT_MUTATION_ACCOUNT_ID=account-proof-123456",
    "TENCENT_MUTATION_DAILY_BUDGET_CNY=200",
    "TENCENT_MUTATION_MAX_OPERATION_COUNT=20",
    "TENCENT_MUTATION_TKE_CLUSTER_ID=cls-proof",
    "TENCENT_MUTATION_TKE_NODE_POOL_ID=node-pool-proof",
    "TENCENT_MUTATION_COS_BUCKET=bucket-proof",
    "TENCENT_MUTATION_COS_REGION=na-siliconvalley",
    "TENCENT_MUTATION_WORKSPACE_PREFIX_ROOT=workspace-prefix-proof",
  ].join("\n"), "utf8");

  const providerSecretStore = createProviderSecretStore({ secretsRoot: tempRoot });
  const db = baseDb();
  const writes = [];
  const { apiRoute, labRoute } = routeFactories({ db, providerSecretStore, writes, secretFile });

  {
    const regressionDb = baseDb();
    const fullWrites = [];
    const labSubsetWrites = [];
    const regressionRoute = createLabPackageRoutes({
      readBody,
      sendJson,
      writeDb: Object.assign(async (targetDb) => {
        fullWrites.push(JSON.parse(JSON.stringify(targetDb)));
      }, {
        persistLabBillingState: async (payload = {}) => {
          labSubsetWrites.push(JSON.parse(JSON.stringify(payload)));
        },
      }),
      enableCloudOperationProductionBridge: true,
      cloudOperationRunnerMode: "local-executor",
      cloudOperationSecretFile: secretFile,
      cloudOperationRunnerScript: "scripts/v22-cloud-operation-local-executor.mjs",
      cloudOperationComputeNodePoolRef: "np-backend-attribution-proof",
      repoRoot: ".",
    });
    const regressionUser = {
      id: "user-package-click-regression",
      tenantId: "tenant-package-click-regression",
      currentTaskSlug: "workspace-package-click-regression",
      status: "active",
    };
    regressionDb.users.push(regressionUser);
    regressionDb.wallets.push({ userId: regressionUser.id, balance: 1000, updatedAt: new Date().toISOString() });
    const regression = await routeRequest(regressionRoute, {
      db: regressionDb,
      method: "POST",
      urlPath: "/portal/api/lab-packages/activate",
      user: regressionUser,
      body: {
        workspaceId: "workspace-package-click-regression",
        packageId: "starter",
        idempotencyKey: "regression-cloud-persist",
      },
    });
    assert.equal(regression.res.statusCode, 201, "regression_activate_must_create");
    assert.equal(regressionDb.cloudOperationJobs.length, 2, "regression_activate_must_create_queued_jobs");
    assert.equal(fullWrites.length, 1, "cloud_bridge_package_activate_must_full_persist_once");
    assert.equal(fullWrites[0].cloudOperationJobs.length, 2, "full_persist_must_include_cloud_operation_jobs");
    assert.equal(labSubsetWrites.length, 0, "cloud_bridge_package_activate_must_not_use_lab_subset_persist");
  }

  const starterUser = await prepareUser(apiRoute, db, {
    tenantId: "tenant-package-click-a",
    userId: "user-package-click-a",
    workspaceId: "workspace-package-click-a",
  });
  const proUser = await prepareUser(apiRoute, db, {
    tenantId: "tenant-package-click-b",
    userId: "user-package-click-b",
    workspaceId: "workspace-package-click-b",
  });

  const starter = await request({
    route: labRoute,
    db,
    method: "POST",
    urlPath: "/portal/api/lab-packages/activate",
    user: starterUser,
    body: { workspaceId: "workspace-package-click-a", packageId: "starter", idempotencyKey: "starter-click-open" },
  });
  assert.equal(starter.res.statusCode, 201, "starter_click_must_create");
  assertPackageCloudResult(starter.res.payload, {
    packageId: "starter",
    planId: "starter_2c4g_10gb",
    fileSpaceGb: 10,
    operationTypes: ["create_storage", "create_compute"],
  });
  drainQueued(db, secretFile, 2, "starter_open");
  const starterBindingId = starter.res.payload.cloudOperationPackage.resourceBindingId;
  const starterFile = await uploadThroughOpl(apiRoute, db, starterUser, {
    workspaceId: "workspace-package-click-a",
    fileName: "inputs/starter.csv",
  });
  assert.equal(starterFile.resourceBindingId, starterBindingId, "starter_upload_must_bind_to_own_resource_binding");

  const pro = await request({
    route: labRoute,
    db,
    method: "POST",
    urlPath: "/portal/api/lab-packages/activate",
    user: proUser,
    body: { workspaceId: "workspace-package-click-b", packageId: "pro", idempotencyKey: "pro-click-open" },
  });
  assert.equal(pro.res.statusCode, 201, "pro_click_must_create");
  assertPackageCloudResult(pro.res.payload, {
    packageId: "pro",
    planId: "pro_8c16g_100gb",
    fileSpaceGb: 100,
    operationTypes: ["create_storage", "create_compute"],
  });
  drainQueued(db, secretFile, 2, "pro_open");
  const proBindingId = pro.res.payload.cloudOperationPackage.resourceBindingId;
  const proFile = await uploadThroughOpl(apiRoute, db, proUser, {
    workspaceId: "workspace-package-click-b",
    fileName: "inputs/pro.csv",
  });
  assert.equal(proFile.resourceBindingId, proBindingId, "pro_upload_must_bind_to_own_resource_binding");

  const foreignDelete = await request({
    route: apiRoute,
    db,
    method: "POST",
    urlPath: "/portal/api/v22/cloud-operations/storage/delete",
    user: starterUser,
    body: { workspaceId: "workspace-package-click-b", resourceBindingId: proBindingId, fileSpaceGb: 100 },
  });
  assert.equal(foreignDelete.res.statusCode, 403, "cross_user_storage_delete_must_fail_closed");
  assert.equal(foreignDelete.res.payload.error, "resource_binding_owner_mismatch", "cross_user_delete_error_mismatch");

  const upgraded = await request({
    route: labRoute,
    db,
    method: "POST",
    urlPath: "/portal/api/lab-packages/upgrade",
    user: starterUser,
    body: { workspaceId: "workspace-package-click-a", packageId: "pro", idempotencyKey: "starter-upgrade-to-pro" },
  });
  assert.equal(upgraded.res.statusCode, 200, "starter_upgrade_must_return_200");
  assertPackageCloudResult(upgraded.res.payload, {
    packageId: "upgrade_pro",
    planId: "pro_8c16g_100gb",
    fileSpaceGb: 100,
    operationTypes: ["expand_storage", "expand_compute"],
  });
  drainQueued(db, secretFile, 2, "starter_upgrade");
  assert.equal(upgraded.res.payload.cloudOperationPackage.resourceBindingId, starterBindingId, "upgrade_must_keep_existing_binding");

  const addon = await request({
    route: labRoute,
    db,
    method: "POST",
    urlPath: "/portal/api/lab-storage/addons",
    user: starterUser,
    body: { workspaceId: "workspace-package-click-a", addStorageGb: 100, idempotencyKey: "starter-storage-addon-100" },
  });
  assert.equal(addon.res.statusCode, 201, "storage_addon_must_create");
  assertPackageCloudResult(addon.res.payload, {
    packageId: "storage_addon",
    planId: "pro_8c16g_100gb",
    fileSpaceGb: 200,
    operationTypes: ["expand_storage"],
  });
  drainQueued(db, secretFile, 1, "starter_storage_addon");
  assert.equal(addon.res.payload.cloudOperationPackage.resourceBindingId, starterBindingId, "storage_addon_must_keep_existing_binding");

  const proComputeExpand = await request({
    route: apiRoute,
    db,
    method: "POST",
    urlPath: "/portal/api/v22/cloud-operations/compute/expand",
    user: proUser,
    body: {
      workspaceId: "workspace-package-click-b",
      resourceBindingId: proBindingId,
      computeUnits: 3,
      targetDesiredCapacity: 3,
      planId: "pro_8c16g_100gb",
    },
  });
  assert.equal(proComputeExpand.res.statusCode, 202, "pro_compute_expand_must_accept");
  assert.equal(proComputeExpand.res.payload.operation?.operationType, "expand_compute", "pro_compute_expand_operation_type_mismatch");
  assert.equal(proComputeExpand.res.payload.operation?.status, "queued", "pro_compute_expand_must_start_queued");
  assert.equal(proComputeExpand.res.payload.resourceBindingId, proBindingId, "pro_compute_expand_must_keep_own_binding");
  drainQueued(db, secretFile, 1, "pro_compute_expand");

  const proStorageAddon = await request({
    route: labRoute,
    db,
    method: "POST",
    urlPath: "/portal/api/lab-storage/addons",
    user: proUser,
    body: { workspaceId: "workspace-package-click-b", addStorageGb: 100, idempotencyKey: "pro-storage-addon-100" },
  });
  assert.equal(proStorageAddon.res.statusCode, 201, "pro_storage_addon_must_create");
  assertPackageCloudResult(proStorageAddon.res.payload, {
    packageId: "pro_storage_addon",
    planId: "pro_8c16g_100gb",
    fileSpaceGb: 200,
    operationTypes: ["expand_storage"],
  });
  drainQueued(db, secretFile, 1, "pro_storage_addon");
  assert.equal(proStorageAddon.res.payload.cloudOperationPackage.resourceBindingId, proBindingId, "pro_storage_addon_must_keep_own_binding");

  for (const [label, user, workspaceId, resourceBindingId, fileSpaceGb] of [
    ["starter", starterUser, "workspace-package-click-a", starterBindingId, 200],
    ["pro", proUser, "workspace-package-click-b", proBindingId, 200],
  ]) {
    const release = await request({
      route: apiRoute,
      db,
      method: "POST",
      urlPath: "/portal/api/v22/cloud-operations/compute/release",
      user,
      body: { workspaceId, resourceBindingId, targetDesiredCapacity: 0 },
    });
    assert.equal(release.res.statusCode, 202, `${label}_compute_release_must_accept`);
    assert.equal(release.res.payload.operation?.status, "queued", `${label}_compute_release_must_start_queued`);
    drainQueued(db, secretFile, 1, `${label}_compute_release`);
    const deleteStorage = await request({
      route: apiRoute,
      db,
      method: "POST",
      urlPath: "/portal/api/v22/cloud-operations/storage/delete",
      user,
      body: { workspaceId, resourceBindingId, fileSpaceGb },
    });
    assert.equal(deleteStorage.res.statusCode, 202, `${label}_storage_delete_must_accept`);
    assert.equal(deleteStorage.res.payload.operation?.status, "queued", `${label}_storage_delete_must_start_queued`);
    drainQueued(db, secretFile, 1, `${label}_storage_delete`);
  }

  assert.equal(db.workspaceResourceBindings.length, 2, "two_users_must_have_two_bindings");
  assert.equal(new Set(db.workspaceResourceBindings.map((item) => item.resourceBindingId)).size, 2, "bindings_must_be_distinct");
  assert.equal(db.workspaceResourceBindings.every((item) => item.tenantId && item.userId && item.workspaceId), true, "bindings_must_have_owner_scope");
  assert.equal(db.workspaceFiles.length, 2, "uploads_must_record_two_files");
  assert.equal(db.workspaceFiles.every((item) => item.resourceBindingId && item.userId && item.workspaceId), true, "workspace_files_must_keep_binding_scope");
  assert.equal(db.computeAllocations.length, 2, "compute_allocations_must_be_per_binding");
  assert.equal(db.fileSpaceEntitlements.length, 2, "file_space_entitlements_must_be_per_binding");
  const computeOperationSpecs = db.cloudOperations
    .filter((item) => String(item.operationType || "").includes("compute"))
    .map((item) => ({
      operationType: item.operationType,
      targetDesiredCapacity: item.requestedSpec?.targetDesiredCapacity,
      providerTargetDesiredCapacity: item.requestedSpec?.providerTargetDesiredCapacity,
    }));
  assert.equal(computeOperationSpecs.some((item) => item.operationType === "create_compute" && item.targetDesiredCapacity === "1" && item.providerTargetDesiredCapacity === "2"), true, "starter_compute_must_keep_user_plan_but_not_scale_provider_below_baseline");
  assert.equal(computeOperationSpecs.every((item) => Number(item.providerTargetDesiredCapacity || 0) >= 2), true, "compute_provider_target_must_never_drop_below_baseline");
  assert.equal(computeOperationSpecs.filter((item) => item.operationType === "release_compute").every((item) => item.targetDesiredCapacity === "0" && item.providerTargetDesiredCapacity === "2"), true, "compute_release_must_release_user_allocation_without_scaling_shared_pool_to_zero");
  assert.equal(db.computeAllocations.every((item) => item.status === "released"), true, "compute_release_must_release_each_user_compute");
  assert.equal(db.fileSpaceEntitlements.every((item) => item.status === "retention_protected"), true, "storage_delete_must_protect_each_user_file_space");
  assert.equal(db.billingReconciliations.length >= 13, true, "billing_reconciliation_must_cover_package_lifecycle");
  assert.equal(db.auditEvents.length >= 26, true, "audit_events_must_cover_package_lifecycle");
  assert.equal(writes.length >= 12, true, "package_click_loop_must_persist_mutations");

  console.log(JSON.stringify({
    ok: true,
    contract: "v22_portal_package_click_cloud_resource_loop",
    packages: ["starter_2c4g_10gb", "pro_8c16g_100gb"],
    checked: [
      "package_button_entry_uses_production_cloud_operation_bridge",
      "two_users_have_distinct_resource_bindings",
      "uploads_bind_to_owner_resource_binding",
      "cross_user_delete_fails_closed",
      "starter_can_upgrade_compute_and_storage_to_pro",
      "storage_addon_expands_file_space",
      "pro_can_expand_compute_and_storage",
      "compute_release_and_storage_delete_are_owner_scoped",
    ],
  }, null, 2));
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}
