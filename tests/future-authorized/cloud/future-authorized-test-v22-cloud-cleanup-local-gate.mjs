import assert from "node:assert/strict";

export function evaluateCloudCleanupLocalGate({
  baseline = {},
  after = {},
  operations = [],
  cleanupPlan = {},
} = {}) {
  const platformBefore = baseline.platformServicePool ?? {};
  const platformAfter = after.platformServicePool ?? {};
  const baselineDesired = Number(platformBefore.desiredCapacity);
  const baselineCurrent = Number(platformBefore.currentCapacity);
  const afterDesired = Number(platformAfter.desiredCapacity);
  const afterCurrent = Number(platformAfter.currentCapacity);
  const beforeTenantPools = Array.isArray(baseline.tenantNodePools) ? baseline.tenantNodePools : [];
  const afterTenantPools = Array.isArray(after.tenantNodePools) ? after.tenantNodePools : [];
  if (!platformBefore.nodePoolRef) return { ok: false, error: "platform_service_pool_baseline_required" };
  if (!Number.isFinite(baselineDesired)) return { ok: false, error: "platform_service_pool_desired_required" };
  if (baselineDesired < 1) return { ok: false, error: "platform_service_pool_must_not_be_zero" };
  if (!Number.isFinite(baselineCurrent)) return { ok: false, error: "platform_service_pool_current_required" };
  if (baselineCurrent < 1) return { ok: false, error: "platform_service_pool_current_must_not_be_zero" };
  if (platformAfter.nodePoolRef !== platformBefore.nodePoolRef) return { ok: false, error: "platform_service_pool_ref_changed" };
  if (afterDesired !== baselineDesired) return { ok: false, error: "platform_service_pool_desired_changed" };
  if (afterCurrent !== baselineCurrent) return { ok: false, error: "platform_service_pool_current_changed" };
  if (!cleanupPlan.cleanupRequired) return { ok: false, error: "cleanup_plan_required" };
  if (!cleanupPlan.cleanupOperationId) return { ok: false, error: "cleanup_operation_id_required" };
  if (!cleanupPlan.baselineSnapshotRef) return { ok: false, error: "cleanup_baseline_snapshot_ref_required" };
  if (!cleanupPlan.postCleanupSnapshotRef) return { ok: false, error: "cleanup_post_snapshot_ref_required" };
  if (!beforeTenantPools.every((pool) => String(pool.nodePoolRef || "").trim())) return { ok: false, error: "tenant_node_pool_baseline_ref_required" };
  const leakedTenantPool = afterTenantPools.find((pool) => !["released", "deleted", "not_present"].includes(String(pool.status || "")));
  if (leakedTenantPool) return { ok: false, error: "tenant_node_pool_not_released", nodePoolRef: leakedTenantPool.nodePoolRef || leakedTenantPool.id };
  const leaked = operations.find((operation) => ["queued", "running"].includes(String(operation.status || "")));
  if (leaked) return { ok: false, error: "active_operation_after_cleanup", operationId: leaked.operationId || leaked.id };
  const unreleasedCompute = operations.find((operation) => operation.resourceKind === "compute" && !["released", "failed"].includes(String(operation.status || "")) && operation.operationType !== "release_compute");
  if (unreleasedCompute) return { ok: false, error: "compute_not_released", operationId: unreleasedCompute.operationId || unreleasedCompute.id };
  const orphanBinding = operations.find((operation) => operation.resourceKind === "compute" && operation.status === "released" && !String(operation.tenantNodePoolRef || "").trim());
  if (orphanBinding) return { ok: false, error: "released_compute_missing_tenant_node_pool_ref", operationId: orphanBinding.operationId || orphanBinding.id };
  return { ok: true };
}

const pass = evaluateCloudCleanupLocalGate({
  baseline: {
    platformServicePool: { nodePoolRef: "np-platform-proof", desiredCapacity: 1, currentCapacity: 1 },
    tenantNodePools: [{ nodePoolRef: "np-tenant-proof", status: "active" }],
  },
  after: {
    platformServicePool: { nodePoolRef: "np-platform-proof", desiredCapacity: 1, currentCapacity: 1 },
    tenantNodePools: [{ nodePoolRef: "np-tenant-proof", status: "released" }],
  },
  cleanupPlan: {
    cleanupRequired: true,
    cleanupOperationId: "cleanup-v22-smoke",
    baselineSnapshotRef: ".runtime/v22-cloud-cleanup/baseline.json",
    postCleanupSnapshotRef: ".runtime/v22-cloud-cleanup/post.json",
  },
  operations: [
    { operationId: "op-create", resourceKind: "compute", operationType: "release_compute", status: "released", tenantNodePoolRef: "np-tenant-proof" },
    { operationId: "op-storage", resourceKind: "storage", operationType: "delete_storage", status: "retention_protected" },
  ],
});
assert.equal(pass.ok, true, "cleanup_gate_pass");

const fail = evaluateCloudCleanupLocalGate({
  baseline: {
    platformServicePool: { nodePoolRef: "np-platform-proof", desiredCapacity: 1, currentCapacity: 1 },
    tenantNodePools: [{ nodePoolRef: "np-tenant-proof", status: "active" }],
  },
  after: {
    platformServicePool: { nodePoolRef: "np-platform-proof", desiredCapacity: 2, currentCapacity: 1 },
    tenantNodePools: [{ nodePoolRef: "np-tenant-proof", status: "released" }],
  },
  cleanupPlan: {
    cleanupRequired: true,
    cleanupOperationId: "cleanup-v22-smoke",
    baselineSnapshotRef: ".runtime/v22-cloud-cleanup/baseline.json",
    postCleanupSnapshotRef: ".runtime/v22-cloud-cleanup/post.json",
  },
  operations: [],
});
assert.equal(fail.ok, false, "cleanup_gate_must_fail_when_capacity_not_back_to_baseline");
assert.equal(fail.error, "platform_service_pool_desired_changed", "cleanup_gate_error");

const missingRef = evaluateCloudCleanupLocalGate({
  baseline: {
    platformServicePool: { nodePoolRef: "np-platform-proof", desiredCapacity: 1, currentCapacity: 1 },
    tenantNodePools: [{ nodePoolRef: "np-tenant-proof", status: "active" }],
  },
  after: {
    platformServicePool: { nodePoolRef: "np-platform-proof", desiredCapacity: 1, currentCapacity: 1 },
    tenantNodePools: [{ nodePoolRef: "np-tenant-proof", status: "released" }],
  },
  cleanupPlan: { cleanupRequired: true, cleanupOperationId: "cleanup-v22-smoke" },
  operations: [],
});
assert.equal(missingRef.ok, false, "cleanup_gate_must_require_snapshot_refs");
assert.equal(missingRef.error, "cleanup_baseline_snapshot_ref_required", "cleanup_gate_snapshot_ref_error");

console.log(JSON.stringify({
  ok: true,
  contract: "v22_cloud_cleanup_local_gate",
  protectedPlatformServicePool: true,
  tenantNodePoolReleased: true,
}, null, 2));
