import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

const manifestPath = "docs/recovery/physical-legacy-file-retirement-run-manifest.json";
const goalPath = "docs/recovery/physical-legacy-file-retirement-goal.md";
const inventoryPath = "docs/recovery/physical-legacy-file-retirement-inventory.md";

const expectedSlices = [
  "slice-a-strict-monolith-policy",
  "slice-b-user-owned-resource-order-compat-delete",
  "slice-c-legacy-script-delete",
  "slice-d-retired-adapter-deploy-infra-delete",
  "slice-e-legacy-schema-store-retirement",
  "slice-f-unified-verifier-archive-gate-alignment",
  "slice-g-residual-legacy-test-anchor-retirement",
  "slice-h-readonly-inventory-fixture-attribution",
  "slice-i-readonly-inventory-local-attribution",
  "slice-j-zero-compat-active-surface-gate",
  "slice-k-delete-residual-adapter-compatibility-surface",
  "slice-l-delete-residual-deploy-compatibility-assets",
  "slice-m-delete-residual-live-canary-runner-surfaces",
  "slice-n-remove-residual-compatibility-narrative",
  "slice-o-record-zero-compat-active-surface-completion",
];

const strictMonolithCompletedSlices = [
  "slice-a-strict-monolith-policy",
  "slice-b-user-owned-resource-order-compat-delete",
  "slice-c-legacy-script-delete",
  "slice-d-retired-adapter-deploy-infra-delete",
  "slice-e-legacy-schema-store-retirement",
];

const zeroCompatCompletedSlices = [
  "slice-i-readonly-inventory-local-attribution",
  "slice-j-zero-compat-active-surface-gate",
  "slice-k-delete-residual-adapter-compatibility-surface",
  "slice-l-delete-residual-deploy-compatibility-assets",
  "slice-m-delete-residual-live-canary-runner-surfaces",
  "slice-n-remove-residual-compatibility-narrative",
  "slice-o-record-zero-compat-active-surface-completion",
];

async function readRepoFile(filePath) {
  return readFile(path.join(repoRoot, filePath), "utf8");
}

async function readJson(filePath) {
  return JSON.parse(await readRepoFile(filePath));
}

function assertIncludes(source, expected, label) {
  assert(source.includes(expected), `${label}_missing:${expected}`);
}

function assertArrayIncludesAll(actual, expected, label) {
  assert(Array.isArray(actual), `${label}_must_be_array`);
  for (const item of expected) {
    assert(actual.includes(item), `${label}_missing:${item}`);
  }
}

const [manifest, goal, inventory] = await Promise.all([
  readJson(manifestPath),
  readRepoFile(goalPath),
  readRepoFile(inventoryPath),
]);

assert.equal(manifest.schema_version, 2, "manifest_schema_version_mismatch");
assert.equal(manifest.manifest_role, "strict_monolith_legacy_retirement_run_manifest", "manifest_role_mismatch");
assert.equal(manifest.model, "gpt-5.4", "manifest_model_mismatch");
assert.equal(manifest.agent_run_mode, "strict_monolith_legacy_retirement", "manifest_agent_run_mode_mismatch");
assert.equal(manifest.base_branch, "origin/recovery/platform-v22-trunk", "manifest_base_branch_mismatch");
assert.equal(manifest.target_branch, "recovery/platform-v22-trunk", "manifest_target_branch_mismatch");
assert.equal(manifest.working_branch, "cleanup/v22-strict-monolith-ideal-gap-and-legacy-retirement", "manifest_working_branch_mismatch");
assert.equal(manifest.current_status, "strict_monolith_retirement_completed", "manifest_current_status_mismatch");
assert(
  ["f_g_completed_h_pending", "f_g_h_completed"].includes(manifest.residual_cleanup_status),
  `manifest_residual_cleanup_status_mismatch:${manifest.residual_cleanup_status}`,
);

const completedSlices = manifest.completed_slices ?? [];
const remainingSlices = manifest.next_slices ?? [];
assertArrayIncludesAll([...completedSlices, ...remainingSlices], expectedSlices, "manifest_slice_queue_or_completed");
if (manifest.current_status === "strict_monolith_retirement_completed") {
  assertArrayIncludesAll(completedSlices, strictMonolithCompletedSlices, "manifest_completed_batch_completed_slices");
}
if (manifest.residual_cleanup_status === "f_g_completed_h_pending") {
  assertArrayIncludesAll(completedSlices, [
    ...strictMonolithCompletedSlices,
    "slice-f-unified-verifier-archive-gate-alignment",
    "slice-g-residual-legacy-test-anchor-retirement",
  ], "manifest_residual_f_g_completed_slices");
  assertArrayIncludesAll(remainingSlices, ["slice-h-readonly-inventory-fixture-attribution"], "manifest_residual_h_pending_next_slices");
}
if (manifest.residual_cleanup_status === "f_g_h_completed") {
  assertArrayIncludesAll(completedSlices, [
    ...strictMonolithCompletedSlices,
    "slice-f-unified-verifier-archive-gate-alignment",
    "slice-g-residual-legacy-test-anchor-retirement",
    "slice-h-readonly-inventory-fixture-attribution",
  ], "manifest_residual_completed_slices");
}
if (manifest.zero_compat_active_surface_status === "in_progress") {
  assertArrayIncludesAll(completedSlices, [
    ...zeroCompatCompletedSlices.slice(0, -1),
  ], "manifest_zero_compat_completed_slices");
  assertArrayIncludesAll(remainingSlices, [
    "slice-o-record-zero-compat-active-surface-completion",
  ], "manifest_zero_compat_remaining_slices");
} else if (manifest.zero_compat_active_surface_status === "completed") {
  assertArrayIncludesAll(completedSlices, zeroCompatCompletedSlices, "manifest_zero_compat_completed_slices");
  assert.deepEqual(remainingSlices, [], "manifest_zero_compat_remaining_slices_must_be_empty_when_completed");
  assert.equal(
    manifest.current_slice,
    "slice-o-record-zero-compat-active-surface-completion",
    "manifest_zero_compat_current_slice_completed_mismatch",
  );
} else {
  assert.fail(`manifest_zero_compat_status_mismatch:${manifest.zero_compat_active_surface_status}`);
}
for (const sliceId of completedSlices) {
  assert(expectedSlices.includes(sliceId), `manifest_completed_slice_unknown:${sliceId}`);
}
for (const sliceId of remainingSlices) {
  assert(expectedSlices.includes(sliceId), `manifest_next_slice_unknown:${sliceId}`);
  assert(!completedSlices.includes(sliceId), `manifest_slice_must_not_be_both_completed_and_next:${sliceId}`);
}

assert.equal(manifest.batch_policy?.enabled, true, "manifest_batch_policy_enabled_mismatch");
assert.equal(manifest.batch_policy?.commit_policy, "one_commit_per_slice", "manifest_commit_policy_mismatch");
assert.equal(manifest.batch_policy?.b_absorb_policy, "B_may_absorb_whole_batch_after_all_slice_gates_pass", "manifest_b_absorb_policy_mismatch");

assertArrayIncludesAll(manifest.authorization_boundary?.authorized_deletions, [
  "old public retired route shells",
  "v19/v20/v21 legacy smoke/check/daily/live-prepare scripts",
  "old user-owned/resource-order compatibility surfaces",
  "retired resource-provisioner and med-autoscience-runner adapters",
  "old OpenCost/Langfuse deploy/infra/compose assets",
  "residual non-v22 Portal/Billing smoke anchors and local start/install helper remnants",
  "residual adapter compatibility surface",
  "residual deploy compatibility assets",
  "residual live/canary/authorized runner executable surfaces",
  "residual compatibility narrative and deleted runner command references",
  "Runtime Bridge retired resource-order and user-owned compatibility aliases",
], "manifest_authorized_deletions");

assertArrayIncludesAll(manifest.authorization_boundary?.forbidden_operations, [
  "read secret",
  "read .env",
  "read kubeconfig",
  "read token",
  "live cloud",
  "live-test execution",
  "build/push/kubectl",
  "deploy",
  "real DB migration execution",
  ".sentrux modification",
  "upstream write",
], "manifest_forbidden_operation");

assertArrayIncludesAll(manifest.authorization_boundary?.zero_compat_migration_delete_targets, [
  "adapters/billing-aggregator/**",
  "deploy/local/dockerfiles/portal.Dockerfile",
  "deploy/local/dockerfiles/opl-web-gateway.Dockerfile",
  "deploy/local/dockerfiles/opl-runtime-bridge.Dockerfile",
  "scripts/*live*",
  "scripts/*canary*",
], "manifest_zero_compat_delete_target");

assertArrayIncludesAll(manifest.authorization_boundary?.must_retain_active_v22_paths, [
  "services/portal/src/integrations/langfuse-trace-client.mjs",
  "services/opl-runtime-bridge/src/langfuse-publisher.mjs",
], "manifest_retain_active_v22_path");

assertArrayIncludesAll(manifest.required_global_gates, [
  "node scripts/smoke-test-v22-physical-legacy-file-retirement-inventory.mjs",
  "node scripts/smoke-test-v22-physical-legacy-batch-run-manifest.mjs",
  "node scripts/smoke-test-v22-physical-legacy-file-retirement-goal.mjs",
  "node scripts/smoke-test-v22-retire-user-owned-primary-path.mjs",
  "node scripts/smoke-test-v22-retire-resource-order-primary-path.mjs",
  "node scripts/smoke-test-v22-cleanup-completion-truth.mjs",
  "node scripts/smoke-test-v22-default-entry-narrative-gate.mjs",
  "node scripts/smoke-test-v22-zero-compat-active-surface-gate.mjs",
  "node scripts/v22-verify.mjs current --base origin/recovery/platform-v22-trunk --dry-run --json",
  "node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk",
  "git diff --check -- docs/recovery docs/contracts scripts services deploy adapters infra",
], "manifest_required_global_gate");

const slices = new Map((manifest.slices ?? []).map((slice) => [slice.id, slice]));
for (const sliceId of expectedSlices) {
  assert(slices.has(sliceId), `manifest_slice_missing:${sliceId}`);
  const slice = slices.get(sliceId);
  const expectedStatus = completedSlices.includes(sliceId)
    ? "completed"
    : remainingSlices.includes(sliceId)
      ? "pending"
      : null;
  assert(expectedStatus, `manifest_slice_status_untracked:${sliceId}`);
  assert.equal(slice.status, expectedStatus, `manifest_slice_status_mismatch:${sliceId}`);
  assert(slice.red_gate, `slice_red_gate_missing:${sliceId}`);
  assert(Array.isArray(slice.green_gates) && slice.green_gates.length > 0, `slice_green_gates_missing:${sliceId}`);
  assert(slice.commit?.startsWith("cleanup: "), `slice_commit_mismatch:${sliceId}`);
}

assertIncludes(goal, "Slice A: Story And Inventory Policy Retirement", "goal_slice_a");
assertIncludes(goal, "Slice E: Legacy Schema And Store Remnant Retirement", "goal_slice_e");
assertIncludes(inventory, "slice-a-strict-monolith-policy", "inventory_slice_queue");
assertIncludes(inventory, "slice-e-legacy-schema-store-retirement", "inventory_slice_queue");

console.log(JSON.stringify({
  ok: true,
  contract: "v22_strict_monolith_legacy_retirement_run_manifest",
  manifestPath,
  slices: expectedSlices,
}, null, 2));
