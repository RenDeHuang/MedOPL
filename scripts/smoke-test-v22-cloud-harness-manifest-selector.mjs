import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

const repoRoot = path.resolve(".");
const manifestPath = path.join(repoRoot, "docs/recovery/v22-cloud-harness-manifest.json");

const selector = await import("../scripts/v22-cloud-harness-select-checks.mjs");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));

assert.equal(manifest.schemaVersion, "2026-05-cloud-harness-native", "manifest_schema_version");
assert.equal(manifest.programId, "v22-cloud-onboarding", "manifest_program_id");
assert.equal(manifest.executionModel?.portalApi, "async_request_reply", "portal_api_must_be_async_request_reply");
assert.equal(manifest.executionModel?.worker, "independent_leased_worker", "worker_must_be_independent");
assert.equal(manifest.executionModel?.reconciliation, "controller_reconcile_cleanup_first", "reconciliation_model");
assert.equal(manifest.cleanupPolicy?.baselineDesiredCapacity, 2, "baseline_must_be_two_for_cost_control");
assert.equal(manifest.cleanupPolicy?.cleanupRequiredForLiveRuns, true, "live_cleanup_required");

const gateIds = new Set(manifest.gates.map((gate) => gate.id));
for (const required of ["L1", "L2a", "L2b", "L3", "L4"]) {
  assert.equal(gateIds.has(required), true, `${required}_gate_required`);
}

const l2b = manifest.gates.find((gate) => gate.id === "L2b");
assert.equal(l2b.cleanupRequired, true, "l2b_cleanup_required");
assert.equal(l2b.requiredEvidence.includes("baselineSnapshot"), true, "l2b_baseline_snapshot_required");
assert.equal(l2b.requiredEvidence.includes("postCleanupSnapshot"), true, "l2b_post_cleanup_snapshot_required");
assert.equal(l2b.requiredSmoke.includes("scripts/smoke-test-v22-portal-cloud-operation-async-worker-loop.mjs"), true, "l2b_async_worker_smoke_required");
assert.equal(l2b.requiredSmoke.includes("scripts/smoke-test-v22-tencent-authorized-resource-lifecycle-baseline-snapshot.mjs"), true, "l2b_baseline_snapshot_smoke_required");

const l2a = manifest.gates.find((gate) => gate.id === "L2a");
assert.equal(l2a.ownedPaths.includes("scripts/v22-tencent-authorized-resource-lifecycle-node-pool-snapshot.mjs"), true, "l2a_must_own_node_pool_snapshot_runner");
assert.equal(l2a.requiredSmoke.includes("scripts/smoke-test-v22-tencent-authorized-resource-lifecycle-baseline-snapshot.mjs"), true, "l2a_baseline_snapshot_smoke_required");

const l3 = manifest.gates.find((gate) => gate.id === "L3");
assert.equal(l3.requiredSmoke.includes("scripts/smoke-test-v22-tencent-authorized-resource-lifecycle-baseline-snapshot.mjs"), true, "l3_baseline_snapshot_smoke_required");

const selection = selector.selectCloudHarnessChecks({
  manifest,
  changedPaths: [
    "services/portal/src/domain/portal-cloud-operation-production.mjs",
    "services/portal/src/portal-cloud-operation-worker.mjs",
    "services/portal/src/workers/portal-cloud-operation-worker.mjs",
  ],
});

assert.equal(selection.requiresUserAuthorization, true, "portal_worker_changes_require_authorization_review");
assert.equal(selection.requiredGates.includes("L2b"), true, "portal_worker_changes_require_l2b");
assert.equal(selection.requiredGates.includes("L3"), true, "portal_worker_changes_require_l3_cleanup_billing_gate");
assert.equal(selection.requiredSmoke.includes("scripts/smoke-test-v22-portal-cloud-operation-worker-entrypoint.mjs"), true, "selector_must_require_worker_entrypoint_smoke");
assert.equal(selection.requiredSmoke.includes("scripts/smoke-test-v22-portal-cloud-operation-async-worker-loop.mjs"), true, "selector_must_require_async_worker_smoke");
assert.equal(selection.requiredSmoke.includes("scripts/smoke-test-v22-cloud-live-cleanup-gate.mjs"), true, "selector_must_require_cleanup_gate");
assert.equal(selection.requiredSmoke.includes("scripts/smoke-test-v22-tencent-authorized-resource-lifecycle-baseline-snapshot.mjs"), true, "selector_must_require_baseline_snapshot_smoke");
assert.equal(selection.forbiddenPaths.includes("deploy/*"), true, "deploy_must_remain_forbidden");

console.log(JSON.stringify({
  ok: true,
  contract: "v22_cloud_harness_manifest_selector",
  requiredGates: selection.requiredGates,
  requiredSmoke: selection.requiredSmoke,
}, null, 2));
