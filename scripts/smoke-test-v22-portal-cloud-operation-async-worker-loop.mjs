import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const {
  buildPortalProductionCloudOperationProjection,
  executePortalProductionCloudOperation,
  processQueuedPortalProductionCloudOperations,
} = await import("../services/portal/src/domain/portal-cloud-operation-production.mjs");

const forbiddenOutputPattern = /SecretId|SecretKey|token|kubeconfig|objectKey|storageKey|cosPrefix|signedUrl|bucket-proof|workspace-prefix-proof|node-pool-proof|mutation-secret/i;

function assertNoForbidden(value, label) {
  const serialized = typeof value === "string" ? value : JSON.stringify(value);
  assert.equal(forbiddenOutputPattern.test(serialized), false, `${label}_must_not_leak_secret_or_cloud_console_shape`);
}

function dbFixture() {
  return {
    users: [],
    tenants: [],
    wallets: [],
    ledger: [],
    taskSpaces: [],
    workspaceResourceBindings: [],
    weeklyProtectionFreezes: [],
    cloudOperations: [],
    cloudOperationJobs: [],
    computeAllocations: [],
    fileSpaceEntitlements: [],
    cloudResourceProjections: [],
    billingReconciliations: [],
    auditEvents: [],
  };
}

const user = {
  id: "user-v22-async-cloud",
  tenantId: "tenant-v22-async-cloud",
};

const tempRoot = await mkdtemp(path.join(os.tmpdir(), "v22-portal-cloud-async-worker-"));
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

  const db = dbFixture();
  const createStorage = executePortalProductionCloudOperation(db, user, {
    workspaceId: "workspace-v22-async-cloud",
    fileSpaceGb: 10,
    planId: "starter_2c4g_10gb",
  }, {
    operationType: "create_storage",
    runnerMode: "fake-live",
    secretFile,
    repoRoot: ".",
  });

  assert.equal(createStorage.ok, true, "create_storage_must_be_accepted");
  assert.equal(createStorage.operation.status, "queued", "portal_api_must_only_queue_operation");
  assert.equal(createStorage.workerExecutedNow, false, "portal_api_must_not_execute_worker_inline");
  assert.equal(db.cloudOperations.length, 1, "cloud_operation_must_be_recorded");
  assert.equal(db.cloudOperationJobs.length, 1, "cloud_operation_job_must_be_recorded");
  assert.equal(db.fileSpaceEntitlements.length, 0, "storage_must_not_be_created_before_worker_drain");
  assert.equal(db.cloudOperations[0].status, "queued", "operation_row_must_start_queued");
  assert.equal(db.cloudOperationJobs[0].queueMode, "independent_worker", "job_queue_mode_must_be_independent_worker");

  const projectionBefore = buildPortalProductionCloudOperationProjection(db, user, {
    workspaceId: "workspace-v22-async-cloud",
  });
  assert.equal(projectionBefore.resources.fileSpace.statusLabel, "未开通", "queued_projection_must_not_claim_file_space_available");

  const drain = processQueuedPortalProductionCloudOperations(db, {
    runnerMode: "fake-live",
    secretFile,
    computeNodePoolRef: "np-backend-attribution-proof",
    maxOperations: 1,
    workerId: "worker-v22-async-smoke",
  });
  assert.equal(drain.ok, true, "worker_drain_must_succeed");
  assert.equal(drain.processed.length, 1, "worker_must_process_one_operation");
  assert.equal(db.cloudOperations[0].status, "succeeded", "operation_must_succeed_after_worker");
  assert.equal(db.fileSpaceEntitlements.length, 1, "storage_must_be_created_after_worker");
  assert.equal(db.fileSpaceEntitlements[0].status, "available", "file_space_status_after_worker");
  assert.equal(db.cloudOperationJobs[0].leaseOwner, "worker-v22-async-smoke", "job_must_record_lease_owner");

  const createCompute = executePortalProductionCloudOperation(db, user, {
    workspaceId: "workspace-v22-async-cloud",
    resourceBindingId: createStorage.resourceBindingId,
    computeUnits: 1,
    targetDesiredCapacity: 1,
    planId: "starter_2c4g_10gb",
  }, {
    operationType: "create_compute",
    runnerMode: "fake-live",
    secretFile,
    repoRoot: ".",
  });
  assert.equal(createCompute.ok, true, "create_compute_must_be_accepted");

  const blockedDrain = processQueuedPortalProductionCloudOperations(db, {
    runnerMode: "fake-live",
    secretFile,
    maxOperations: 1,
    workerId: "worker-v22-async-smoke",
  });
  assert.equal(blockedDrain.ok, false, "compute_without_node_pool_ref_must_fail_closed");
  assert.equal(blockedDrain.error, "compute_node_pool_ref_required", "compute_attribution_error");
  assert.equal(db.computeAllocations.length, 0, "compute_allocation_without_node_pool_ref_must_not_be_written");
  const blockedOperation = db.cloudOperations.find((item) => item.operationId === createCompute.operation.operationId);
  const blockedJob = db.cloudOperationJobs.find((item) => item.operationId === createCompute.operation.operationId);
  assert.equal(blockedOperation?.status, "failed", "compute_without_node_pool_ref_must_mark_operation_failed");
  assert.equal(blockedOperation?.failureReason, "compute_node_pool_ref_required", "compute_without_node_pool_ref_operation_failure_reason");
  assert.equal(blockedJob?.status, "failed", "compute_without_node_pool_ref_must_mark_job_failed");
  assert.equal(blockedJob?.failureReason, "compute_node_pool_ref_required", "compute_without_node_pool_ref_job_failure_reason");

  const createComputeWithAttribution = executePortalProductionCloudOperation(db, user, {
    workspaceId: "workspace-v22-async-cloud",
    resourceBindingId: createStorage.resourceBindingId,
    computeUnits: 1,
    targetDesiredCapacity: 1,
    planId: "starter_2c4g_10gb",
  }, {
    operationType: "create_compute",
    runnerMode: "fake-live",
    secretFile,
    repoRoot: ".",
  });
  assert.equal(createComputeWithAttribution.ok, true, "create_compute_with_attribution_must_be_accepted");

  const computeDrain = processQueuedPortalProductionCloudOperations(db, {
    runnerMode: "fake-live",
    secretFile,
    computeNodePoolRef: "np-backend-attribution-proof",
    maxOperations: 1,
    workerId: "worker-v22-async-smoke-2",
  });
  assert.equal(computeDrain.ok, true, "compute_worker_drain_must_succeed_with_node_pool_ref");
  assert.equal(db.computeAllocations.length, 1, "compute_allocation_must_be_written");
  assert.equal(db.computeAllocations[0].nodePoolRef, "np-backend-attribution-proof", "node_pool_ref_must_be_recorded_for_admin_attribution");

  const projectionAfter = buildPortalProductionCloudOperationProjection(db, user, {
    workspaceId: "workspace-v22-async-cloud",
  });
  assert.equal(projectionAfter.resources.fileSpace.statusLabel, "可用", "projection_file_space_available_after_worker");
  assert.equal(projectionAfter.resources.compute.statusLabel, "可用", "projection_compute_available_after_worker");
  assertNoForbidden(projectionAfter, "projection_after_worker");

  console.log(JSON.stringify({
    ok: true,
    contract: "v22_portal_cloud_operation_async_worker_loop",
    operations: db.cloudOperations.map((item) => ({ type: item.operationType, status: item.status })),
    queueMode: db.cloudOperationJobs[0].queueMode,
  }, null, 2));
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}
