import assert from "node:assert/strict";

export function evaluateCloudCleanupLocalGate({
  baseline = {},
  after = {},
  operations = [],
  cleanupPlan = {},
} = {}) {
  const baselineDesired = Number(baseline.nodePoolDesiredCapacity ?? baseline.desiredCapacity);
  const baselineCurrent = Number(baseline.nodePoolCurrentCapacity ?? baseline.currentCapacity ?? baseline.nodePoolCurrentNodes);
  const afterDesired = Number(after.nodePoolDesiredCapacity ?? after.desiredCapacity);
  const afterCurrent = Number(after.nodePoolCurrentCapacity ?? after.currentCapacity ?? after.nodePoolCurrentNodes);
  if (!Number.isFinite(baselineDesired)) return { ok: false, error: "baseline_snapshot_required" };
  if (baselineDesired !== 2) return { ok: false, error: "baseline_desired_capacity_must_be_2" };
  if (!Number.isFinite(baselineCurrent)) return { ok: false, error: "baseline_current_capacity_required" };
  if (baselineCurrent !== 2) return { ok: false, error: "baseline_current_capacity_must_be_2" };
  if (afterDesired !== baselineDesired) return { ok: false, error: "post_cleanup_capacity_not_baseline" };
  if (afterCurrent !== baselineCurrent) return { ok: false, error: "post_cleanup_current_capacity_not_baseline" };
  if (!cleanupPlan.cleanupRequired) return { ok: false, error: "cleanup_plan_required" };
  if (!cleanupPlan.cleanupOperationId) return { ok: false, error: "cleanup_operation_id_required" };
  if (!cleanupPlan.baselineSnapshotRef) return { ok: false, error: "cleanup_baseline_snapshot_ref_required" };
  if (!cleanupPlan.postCleanupSnapshotRef) return { ok: false, error: "cleanup_post_snapshot_ref_required" };
  const leaked = operations.find((operation) => ["queued", "running"].includes(String(operation.status || "")));
  if (leaked) return { ok: false, error: "active_operation_after_cleanup", operationId: leaked.operationId || leaked.id };
  const unreleasedCompute = operations.find((operation) => operation.resourceKind === "compute" && !["released", "failed"].includes(String(operation.status || "")) && operation.operationType !== "release_compute");
  if (unreleasedCompute) return { ok: false, error: "compute_not_released", operationId: unreleasedCompute.operationId || unreleasedCompute.id };
  const orphanBinding = operations.find((operation) => operation.resourceKind === "compute" && operation.status === "released" && !String(operation.nodePoolRef || "").trim());
  if (orphanBinding) return { ok: false, error: "released_compute_missing_node_pool_ref", operationId: orphanBinding.operationId || orphanBinding.id };
  return { ok: true };
}

const pass = evaluateCloudCleanupLocalGate({
  baseline: { nodePoolDesiredCapacity: 2, nodePoolCurrentCapacity: 2 },
  after: { nodePoolDesiredCapacity: 2, nodePoolCurrentCapacity: 2 },
  cleanupPlan: {
    cleanupRequired: true,
    cleanupOperationId: "cleanup-v22-smoke",
    baselineSnapshotRef: ".runtime/v22-cloud-cleanup/baseline.json",
    postCleanupSnapshotRef: ".runtime/v22-cloud-cleanup/post.json",
  },
  operations: [
    { operationId: "op-create", resourceKind: "compute", operationType: "release_compute", status: "released", nodePoolRef: "np-cost-capped-proof" },
    { operationId: "op-storage", resourceKind: "storage", operationType: "delete_storage", status: "retention_protected" },
  ],
});
assert.equal(pass.ok, true, "cleanup_gate_pass");

const fail = evaluateCloudCleanupLocalGate({
  baseline: { nodePoolDesiredCapacity: 2, nodePoolCurrentCapacity: 2 },
  after: { nodePoolDesiredCapacity: 3, nodePoolCurrentCapacity: 2 },
  cleanupPlan: {
    cleanupRequired: true,
    cleanupOperationId: "cleanup-v22-smoke",
    baselineSnapshotRef: ".runtime/v22-cloud-cleanup/baseline.json",
    postCleanupSnapshotRef: ".runtime/v22-cloud-cleanup/post.json",
  },
  operations: [],
});
assert.equal(fail.ok, false, "cleanup_gate_must_fail_when_capacity_not_back_to_baseline");
assert.equal(fail.error, "post_cleanup_capacity_not_baseline", "cleanup_gate_error");

const missingRef = evaluateCloudCleanupLocalGate({
  baseline: { nodePoolDesiredCapacity: 2, nodePoolCurrentCapacity: 2 },
  after: { nodePoolDesiredCapacity: 2, nodePoolCurrentCapacity: 2 },
  cleanupPlan: { cleanupRequired: true, cleanupOperationId: "cleanup-v22-smoke" },
  operations: [],
});
assert.equal(missingRef.ok, false, "cleanup_gate_must_require_snapshot_refs");
assert.equal(missingRef.error, "cleanup_baseline_snapshot_ref_required", "cleanup_gate_snapshot_ref_error");

console.log(JSON.stringify({
  ok: true,
  contract: "v22_cloud_cleanup_local_gate",
  baselineDesiredCapacity: 2,
  baselineCurrentCapacity: 2,
}, null, 2));
