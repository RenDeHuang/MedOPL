import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const {
  buildPortalProductionCloudOperationProjection,
  executePortalProductionCloudOperation,
  processQueuedPortalProductionCloudOperations,
} = await import("../../../services/portal/src/domain/portal-cloud-operation-production.mjs");

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
const runnerScript = "scripts/v22-cloud-operation-local-executor.mjs";

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
    runnerMode: "local-executor",
    runnerScript,
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

  const reconcileDb = dbFixture();
  reconcileDb.workspaceResourceBindings.push({
    id: "rb-reconciled-storage",
    resourceBindingId: "rb-reconciled-storage",
    tenantId: user.tenantId,
    userId: user.id,
    ownerTenantId: user.tenantId,
    ownerUserId: user.id,
    workspaceId: "workspace-v22-reconcile-cloud",
    planId: "starter_2c4g_10gb",
    status: "storage_available",
  });
  reconcileDb.cloudOperations.push({
    id: "op-reconciled-storage-create",
    operationId: "op-reconciled-storage-create",
    tenantId: user.tenantId,
    userId: user.id,
    workspaceId: "workspace-v22-reconcile-cloud",
    resourceBindingId: "rb-reconciled-storage",
    operationType: "create_storage",
    status: "queued",
    runnerMode: "",
    realCloudCalls: false,
    productionPortalConnected: true,
    testOnly: false,
    acceptedDryRunId: "op-reconciled-storage-create",
    dryRunReportRef: "",
    executionReportRef: "",
    requestedSpec: { fileSpaceGb: 10, planId: "starter_2c4g_10gb" },
    createdAt: "2026-05-13T00:00:00.000Z",
    updatedAt: "2026-05-13T00:00:00.000Z",
  });
  reconcileDb.cloudOperationJobs.push({
    id: "job-op-reconciled-storage-create",
    operationId: "op-reconciled-storage-create",
    tenantId: user.tenantId,
    userId: user.id,
    workspaceId: "workspace-v22-reconcile-cloud",
    resourceBindingId: "rb-reconciled-storage",
    queueMode: "independent_worker",
    status: "queued",
    runnerMode: "",
    realCloudCalls: false,
    dryRunReportRef: "",
    executionReportRef: "",
    leaseOwner: "",
    leaseAcquiredAt: "",
    failureReason: "",
    createdAt: "2026-05-13T00:00:00.000Z",
    updatedAt: "2026-05-13T00:00:00.000Z",
  });
  reconcileDb.fileSpaceEntitlements.push({
    id: "fs-rb-reconciled-storage",
    tenantId: user.tenantId,
    userId: user.id,
    workspaceId: "workspace-v22-reconcile-cloud",
    resourceBindingId: "rb-reconciled-storage",
    planId: "starter_2c4g_10gb",
    capacityGb: 10,
    status: "available",
    createdAt: "2026-05-13T00:01:00.000Z",
    updatedAt: "2026-05-13T00:01:00.000Z",
  });
  reconcileDb.cloudResourceProjections.push({
    id: "projection-rb-reconciled-storage",
    tenantId: user.tenantId,
    userId: user.id,
    workspaceId: "workspace-v22-reconcile-cloud",
    resourceBindingId: "rb-reconciled-storage",
    status: "updated",
    productionPortalConnected: true,
    runnerMode: "tencent-official-sdk-live",
    realCloudCalls: false,
    resourceMaterialized: true,
    lastOperationId: "op-reconciled-storage-create",
    visibleSummary: { resources: { fileSpace: { capacityGb: 10, statusLabel: "可用" } } },
    createdAt: "2026-05-13T00:01:00.000Z",
    updatedAt: "2026-05-13T00:01:00.000Z",
  });
  reconcileDb.billingReconciliations.push({
    id: "recon-op-reconciled-storage-create",
    tenantId: user.tenantId,
    userId: user.id,
    workspaceId: "workspace-v22-reconcile-cloud",
    resourceBindingId: "rb-reconciled-storage",
    operationId: "op-reconciled-storage-create",
    status: "reconciling",
    statusLabel: "对账中",
    source: "portal_production_cloud_operation",
    createdAt: "2026-05-13T00:01:00.000Z",
    updatedAt: "2026-05-13T00:01:00.000Z",
  });
  const reconciled = processQueuedPortalProductionCloudOperations(reconcileDb, {
    runnerMode: "tencent-official-sdk-live",
    secretFile: "",
    maxOperations: 1,
    workerId: "worker-v22-reconcile-smoke",
  });
  assert.equal(reconciled.ok, true, "materialized_storage_worker_must_reconcile_without_reexecuting_runner");
  assert.equal(reconciled.processed[0].reconciledFromMaterializedState, true, "materialized_storage_must_report_reconciled");
  assert.equal(reconcileDb.cloudOperations[0].status, "succeeded", "materialized_storage_operation_must_be_terminal");
  assert.equal(reconcileDb.cloudOperationJobs[0].status, "succeeded", "materialized_storage_job_must_be_terminal");
  assert.equal(reconcileDb.cloudOperations[0].realCloudCalls, false, "materialized_storage_must_not_infer_real_cloud_calls_from_runner_mode");
  assert.equal(reconcileDb.cloudOperationJobs[0].realCloudCalls, false, "materialized_storage_job_must_not_infer_real_cloud_calls_from_runner_mode");
  assert.equal(reconcileDb.cloudOperations[0].resourceMaterialized, true, "materialized_storage_operation_must_record_materialized_resource_separately");
  assert.equal(reconcileDb.cloudOperationJobs[0].resourceMaterialized, true, "materialized_storage_job_must_record_materialized_resource_separately");
  assert.equal(reconcileDb.cloudOperationJobs[0].leaseOwner, "worker-v22-reconcile-smoke", "materialized_storage_job_must_record_reconcile_worker");
  assert.equal(reconcileDb.fileSpaceEntitlements.length, 1, "materialized_storage_reconcile_must_not_duplicate_entitlement");

  const cleanupReconcileDb = dbFixture();
  cleanupReconcileDb.workspaceResourceBindings.push({
    id: "rb-reconciled-cleanup",
    resourceBindingId: "rb-reconciled-cleanup",
    tenantId: user.tenantId,
    userId: user.id,
    ownerTenantId: user.tenantId,
    ownerUserId: user.id,
    workspaceId: "workspace-v22-reconcile-cleanup",
    planId: "starter_2c4g_10gb",
    status: "active",
  });
  cleanupReconcileDb.computeAllocations.push({
    id: "compute-rb-reconciled-cleanup",
    tenantId: user.tenantId,
    userId: user.id,
    workspaceId: "workspace-v22-reconcile-cleanup",
    resourceBindingId: "rb-reconciled-cleanup",
    planId: "starter_2c4g_10gb",
    computeUnits: 1,
    status: "available",
    nodePoolRef: "np-backend-attribution-proof",
    createdAt: "2026-05-13T00:01:00.000Z",
    updatedAt: "2026-05-13T00:01:00.000Z",
  });
  cleanupReconcileDb.fileSpaceEntitlements.push({
    id: "fs-rb-reconciled-cleanup",
    tenantId: user.tenantId,
    userId: user.id,
    workspaceId: "workspace-v22-reconcile-cleanup",
    resourceBindingId: "rb-reconciled-cleanup",
    planId: "starter_2c4g_10gb",
    capacityGb: 10,
    status: "available",
    createdAt: "2026-05-13T00:01:00.000Z",
    updatedAt: "2026-05-13T00:01:00.000Z",
  });
  cleanupReconcileDb.cloudOperations.push({
    id: "op-reconciled-release-compute",
    operationId: "op-reconciled-release-compute",
    tenantId: user.tenantId,
    userId: user.id,
    workspaceId: "workspace-v22-reconcile-cleanup",
    resourceBindingId: "rb-reconciled-cleanup",
    operationType: "release_compute",
    status: "succeeded",
    runnerMode: "tencent-official-sdk-live",
    realCloudCalls: true,
    productionPortalConnected: true,
    testOnly: false,
    acceptedDryRunId: "op-reconciled-release-compute",
    dryRunReportRef: ".runtime/v22-cloud-lifecycle/op-reconciled-release-compute-dry-run.json",
    executionReportRef: ".runtime/v22-cloud-lifecycle/op-reconciled-release-compute-execution.json",
    requestedSpec: { targetDesiredCapacity: "0", providerTargetDesiredCapacity: "2", planId: "starter_2c4g_10gb" },
    createdAt: "2026-05-13T00:02:00.000Z",
    updatedAt: "2026-05-13T00:02:00.000Z",
  }, {
    id: "op-reconciled-delete-storage",
    operationId: "op-reconciled-delete-storage",
    tenantId: user.tenantId,
    userId: user.id,
    workspaceId: "workspace-v22-reconcile-cleanup",
    resourceBindingId: "rb-reconciled-cleanup",
    operationType: "delete_storage",
    status: "succeeded",
    runnerMode: "tencent-official-sdk-live",
    realCloudCalls: true,
    productionPortalConnected: true,
    testOnly: false,
    acceptedDryRunId: "op-reconciled-delete-storage",
    dryRunReportRef: ".runtime/v22-cloud-lifecycle/op-reconciled-delete-storage-dry-run.json",
    executionReportRef: ".runtime/v22-cloud-lifecycle/op-reconciled-delete-storage-execution.json",
    requestedSpec: { fileSpaceGb: 10, planId: "starter_2c4g_10gb" },
    createdAt: "2026-05-13T00:03:00.000Z",
    updatedAt: "2026-05-13T00:03:00.000Z",
  });
  const cleanupReconciled = processQueuedPortalProductionCloudOperations(cleanupReconcileDb, {
    runnerMode: "tencent-official-sdk-live",
    secretFile: "",
    computeNodePoolRef: "np-backend-attribution-proof",
    maxOperations: 1,
    workerId: "worker-v22-cleanup-reconcile-smoke",
  });
  assert.equal(cleanupReconciled.ok, true, "cleanup_first_reconcile_must_succeed_without_queued_job");
  assert.equal(cleanupReconcileDb.computeAllocations[0].status, "released", "succeeded_release_compute_must_reconcile_compute_allocation");
  assert.equal(cleanupReconcileDb.fileSpaceEntitlements[0].status, "retention_protected", "succeeded_delete_storage_must_reconcile_file_space_entitlement");
  const cleanupProjection = buildPortalProductionCloudOperationProjection(cleanupReconcileDb, user, {
    workspaceId: "workspace-v22-reconcile-cleanup",
  });
  assert.equal(cleanupProjection.resources.compute.statusLabel, "已释放", "cleanup_reconcile_projection_must_show_compute_released");
  assert.equal(cleanupProjection.resources.fileSpace.statusLabel, "文件保护期", "cleanup_reconcile_projection_must_show_file_protected");

  const drain = processQueuedPortalProductionCloudOperations(db, {
    runnerMode: "local-executor",
    runnerScript,
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
    runnerMode: "local-executor",
    runnerScript,
    secretFile,
    repoRoot: ".",
  });
  assert.equal(createCompute.ok, true, "create_compute_must_be_accepted");
  assert.equal(db.cloudOperations[1].requestedSpec.computeUnits, 1, "compute_units_must_keep_user_allocation");
  assert.equal(db.cloudOperations[1].requestedSpec.targetDesiredCapacity, "1", "requested_target_must_preserve_user_plan_capacity");
  assert.equal(db.cloudOperations[1].requestedSpec.providerTargetDesiredCapacity, "2", "provider_target_must_not_go_below_shared_pool_baseline");

  const blockedDrain = processQueuedPortalProductionCloudOperations(db, {
    runnerMode: "local-executor",
    runnerScript,
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
    runnerMode: "local-executor",
    runnerScript,
    secretFile,
    repoRoot: ".",
    computePoolBaselineCapacity: 2,
  });
  assert.equal(createComputeWithAttribution.ok, true, "create_compute_with_attribution_must_be_accepted");
  assert.equal(db.cloudOperations.at(-1).requestedSpec.providerTargetDesiredCapacity, "2", "attributed_compute_provider_target_must_use_baseline");

  const computeDrain = processQueuedPortalProductionCloudOperations(db, {
    runnerMode: "local-executor",
    runnerScript,
    secretFile,
    computeNodePoolRef: "np-backend-attribution-proof",
    maxOperations: 1,
    workerId: "worker-v22-async-smoke-2",
  });
  assert.equal(computeDrain.ok, true, "compute_worker_drain_must_succeed_with_node_pool_ref");
  assert.equal(db.computeAllocations.length, 1, "compute_allocation_must_be_written");
  assert.equal(db.computeAllocations[0].nodePoolRef, "np-backend-attribution-proof", "node_pool_ref_must_be_recorded_for_admin_attribution");
  db.cloudResourceProjections[0].visibleSummary = {
    resources: {
      compute: { statusLabel: "未开通", computeUnits: 0, planId: "" },
      fileSpace: { statusLabel: "可用", capacityGb: 10 },
      workbench: { statusLabel: "可用" },
    },
    billing: { reconciliationStatusLabel: "对账中" },
  };
  db.cloudResourceProjections[0].lastOperationId = createStorage.operation.operationId;

  const projectionAfter = buildPortalProductionCloudOperationProjection(db, user, {
    workspaceId: "workspace-v22-async-cloud",
  });
  assert.equal(projectionAfter.resources.fileSpace.statusLabel, "可用", "projection_file_space_available_after_worker");
  assert.equal(projectionAfter.resources.compute.statusLabel, "可用", "projection_compute_available_after_worker");
  assertNoForbidden(projectionAfter, "projection_after_worker");

  const releaseCompute = executePortalProductionCloudOperation(db, user, {
    workspaceId: "workspace-v22-async-cloud",
    resourceBindingId: createStorage.resourceBindingId,
    targetDesiredCapacity: 0,
    planId: "starter_2c4g_10gb",
  }, {
    operationType: "release_compute",
    runnerMode: "local-executor",
    runnerScript,
    secretFile,
    repoRoot: ".",
    computePoolBaselineCapacity: 2,
  });
  assert.equal(releaseCompute.ok, true, "release_compute_must_be_accepted");
  assert.equal(db.cloudOperations.at(-1).requestedSpec.targetDesiredCapacity, "0", "release_requested_target_must_preserve_user_release_intent");
  assert.equal(db.cloudOperations.at(-1).requestedSpec.providerTargetDesiredCapacity, "2", "release_provider_target_must_keep_shared_pool_baseline");

  console.log(JSON.stringify({
    ok: true,
    contract: "v22_portal_cloud_operation_async_worker_loop",
    operations: db.cloudOperations.map((item) => ({ type: item.operationType, status: item.status })),
    queueMode: db.cloudOperationJobs[0].queueMode,
  }, null, 2));
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}
