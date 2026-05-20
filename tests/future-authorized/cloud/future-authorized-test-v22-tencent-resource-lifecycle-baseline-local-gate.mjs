import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const manifestPath = "docs/recovery/v22-cloud-harness-manifest.json";
const statusPath = "docs/recovery/cloud-onboarding-status-table.md";

function baselineSnapshot({ desired = 2, current = 2, joining = 0 } = {}) {
  const blockedReason = desired !== 2
    ? "node_pool_desired_capacity_not_baseline"
    : current !== 2
      ? "node_pool_current_capacity_not_baseline"
      : joining !== 0
        ? "node_pool_joining_capacity_not_zero"
        : "";
  return {
    ok: !blockedReason,
    mode: "local-baseline",
    providerMode: "local-fixture",
    nodePoolDesiredCapacity: desired,
    nodePoolCurrentCapacity: current,
    nodePoolJoiningCapacity: joining,
    expectedDesiredCapacity: 2,
    expectedCurrentCapacity: 2,
    cleanupGateBaseline: true,
    risk: {
      callsRealCloudNow: false,
      executesMutationNow: false,
      requiredApis: ["DescribeNodePools"],
    },
    blockedReason,
  };
}

const [manifest, status] = await Promise.all([
  readFile(manifestPath, "utf8"),
  readFile(statusPath, "utf8"),
]);

assert.equal(manifest.includes("scripts/v22-tencent-authorized-resource-lifecycle-node-pool-snapshot.mjs"), false, "manifest_must_not_reference_deleted_snapshot_runner");
assert.equal(manifest.includes("scripts/v22-tencent-authorized-resource-lifecycle-runner.mjs"), false, "manifest_must_not_reference_deleted_lifecycle_runner");
assert.equal(manifest.includes("tests/future-authorized/cloud/future-authorized-test-v22-tencent-resource-lifecycle-baseline-local-gate.mjs"), true, "manifest_must_reference_local_baseline_gate");

const ok = baselineSnapshot();
assert.equal(ok.ok, true, "baseline_ok");
assert.equal(ok.nodePoolDesiredCapacity, 2, "desired_capacity");
assert.equal(ok.nodePoolCurrentCapacity, 2, "current_capacity");
assert.equal(ok.nodePoolJoiningCapacity, 0, "joining_capacity");
assert.equal(ok.risk.callsRealCloudNow, false, "local_baseline_must_not_call_real_cloud");
assert.equal(ok.risk.executesMutationNow, false, "local_baseline_must_not_execute_mutation");

const desiredBlocked = baselineSnapshot({ desired: 3, current: 2 });
assert.equal(desiredBlocked.ok, false, "desired_mismatch_must_fail");
assert.equal(desiredBlocked.blockedReason, "node_pool_desired_capacity_not_baseline", "desired_mismatch_error");

const currentBlocked = baselineSnapshot({ desired: 2, current: 1 });
assert.equal(currentBlocked.ok, false, "current_mismatch_must_fail");
assert.equal(currentBlocked.blockedReason, "node_pool_current_capacity_not_baseline", "current_mismatch_error");

const joinedBlocked = baselineSnapshot({ desired: 2, current: 2, joining: 1 });
assert.equal(joinedBlocked.ok, false, "joining_mismatch_must_fail");
assert.equal(joinedBlocked.blockedReason, "node_pool_joining_capacity_not_zero", "joining_mismatch_error");

assert.equal(/ScaleNodePool|ModifyNodePool|CreateClusterNodePool|DeleteClusterNodePool|putObject|deleteObject/.test(JSON.stringify(ok)), false, "baseline_gate_must_not_include_mutation_api");
assert(status.includes("node pool baseline") || status.includes("baseline"), "status_must_record_baseline_boundary");

console.log(JSON.stringify({
  ok: true,
  contract: "v22_tencent_resource_lifecycle_baseline_local_gate",
  checked: [
    "local_baseline_desired_current_two",
    "local_baseline_joining_zero",
    "deleted_lifecycle_runner_not_referenced_by_manifest",
    "no_real_cloud_or_mutation",
  ],
}, null, 2));
