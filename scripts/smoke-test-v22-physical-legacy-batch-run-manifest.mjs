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
  "slice-2-legacy-script-archive-delete-boundary",
  "slice-3-observability-runner-physical-retirement-boundary",
  "slice-final-completion-truth-and-temporary-goal-removal",
];

const forbiddenTargets = [
  "deploy/**",
  "adapters/**",
  "infra/**",
  ".sentrux/**",
  "one-person-lab upstream",
  "public 410 tombstone",
  "schema/drop/migration collection",
  "secret-like paths",
  "live-test/build/push/kubectl/true cloud",
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

function assertNoForbiddenWriteSet(slice) {
  const writeSet = [
    ...(slice.allowed_write_set ?? []),
    ...(slice.target_paths ?? []),
  ];
  for (const target of writeSet) {
    for (const forbidden of ["deploy/", "adapters/", "infra/", ".sentrux/", "one-person-lab"]) {
      assert(!String(target).startsWith(forbidden), `slice_write_set_forbidden:${slice.id}:${target}`);
    }
  }
}

const [manifest, goal, inventory] = await Promise.all([
  readJson(manifestPath),
  readRepoFile(goalPath),
  readRepoFile(inventoryPath),
]);

assert.equal(manifest.schema_version, 1, "manifest_schema_version_mismatch");
assert.equal(manifest.manifest_role, "temporary_physical_delete_goal_run_manifest", "manifest_role_mismatch");
assert.equal(manifest.model, "gpt-5.4", "manifest_model_mismatch");
assert.equal(manifest.agent_run_mode, "physical_delete_goal_batch_driven", "manifest_agent_run_mode_mismatch");
assert.equal(manifest.base_branch, "origin/recovery/platform-v22-trunk", "manifest_base_branch_mismatch");
assert.equal(manifest.target_branch, "recovery/platform-v22-trunk", "manifest_target_branch_mismatch");
assert.equal(manifest.current_status, "batch_manifest_ready", "manifest_current_status_mismatch");
assert.equal(manifest.batch_policy?.enabled, true, "manifest_batch_policy_enabled_mismatch");
assert.equal(manifest.batch_policy?.max_slices_per_branch, 3, "manifest_batch_policy_max_slices_mismatch");
assert.equal(manifest.batch_policy?.commit_policy, "one_commit_per_slice_plus_optional_final_truth", "manifest_commit_policy_mismatch");
assert.equal(manifest.batch_policy?.b_absorb_policy, "B_may_absorb_whole_batch_after_all_slice_gates_pass", "manifest_b_absorb_policy_mismatch");

assertArrayIncludesAll(manifest.global_forbidden_targets, forbiddenTargets, "manifest_global_forbidden_target");
assertArrayIncludesAll(manifest.required_global_gates, [
  "node scripts/smoke-test-v22-physical-legacy-batch-run-manifest.mjs",
  "node scripts/smoke-test-v22-physical-legacy-file-retirement-goal.mjs",
  "node scripts/smoke-test-v22-physical-legacy-file-retirement-inventory.mjs",
  "node scripts/smoke-test-v22-cleanup-completion-truth.mjs",
  "node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk",
  "git diff --check -- docs/recovery docs/contracts scripts services",
], "manifest_required_global_gate");

assert.deepEqual(manifest.completed_slices, [
  "slice-1-user-owned-retired-domain-store-physical-delete",
], "manifest_completed_slices_mismatch");

assert.equal(manifest.current_slice, "slice-2-legacy-script-archive-delete-boundary", "manifest_current_slice_mismatch");
assert.deepEqual(manifest.next_slices, expectedSlices, "manifest_next_slices_mismatch");

const sliceById = new Map((manifest.slices ?? []).map((slice) => [slice.id, slice]));
for (const expectedSlice of [
  "slice-1-user-owned-retired-domain-store-physical-delete",
  ...expectedSlices,
]) {
  assert(sliceById.has(expectedSlice), `manifest_slice_missing:${expectedSlice}`);
}

const slice2 = sliceById.get("slice-2-legacy-script-archive-delete-boundary");
assert.equal(slice2.status, "ready", "slice2_status_mismatch");
assert.equal(slice2.decision_scope, "archive_reference_to_default-exclusion_or_explicit_delete_candidates_only", "slice2_decision_scope_mismatch");
assert.equal(slice2.red_gate_policy, "must_fail_before_slice_if_default_suite_or_default_docs_reference_legacy_scripts", "slice2_red_gate_policy_mismatch");
assertArrayIncludesAll(slice2.required_gates, [
  "node scripts/smoke-test-v22-physical-legacy-batch-run-manifest.mjs",
  "node scripts/smoke-test-v22-legacy-script-archive-boundary.mjs",
  "node scripts/smoke-test-v22-physical-legacy-file-retirement-inventory.mjs",
], "slice2_required_gate");
assertArrayIncludesAll(slice2.allowed_write_set, [
  "docs/recovery/physical-legacy-file-retirement-inventory.md",
  "docs/recovery/physical-legacy-file-retirement-run-manifest.json",
  "scripts/smoke-test-v22-physical-legacy-batch-run-manifest.mjs",
], "slice2_allowed_write_set");
assertNoForbiddenWriteSet(slice2);

const slice3 = sliceById.get("slice-3-observability-runner-physical-retirement-boundary");
assert.equal(slice3.status, "ready_after_slice_2", "slice3_status_mismatch");
assert.equal(slice3.decision_scope, "archive_reference_or_migrate_only_for_langfuse_and_blocked_without_auth_for_runner_provider", "slice3_decision_scope_mismatch");
assertArrayIncludesAll(slice3.required_gates, [
  "node scripts/smoke-test-v22-physical-legacy-batch-run-manifest.mjs",
  "node scripts/smoke-test-v22-langfuse-observability-metadata-contract.mjs",
  "node scripts/smoke-test-v22-physical-legacy-file-retirement-inventory.mjs",
], "slice3_required_gate");
assertArrayIncludesAll(slice3.observe_only_forbidden_paths, [
  "adapters/resource-provisioner/**",
  "adapters/med-autoscience-runner/**",
  "infra/opencost/**",
], "slice3_observe_only_forbidden_path");
assertNoForbiddenWriteSet(slice3);

const finalSlice = sliceById.get("slice-final-completion-truth-and-temporary-goal-removal");
assert.equal(finalSlice.status, "ready_after_slice_2_and_slice_3", "final_slice_status_mismatch");
assert.equal(finalSlice.decision_scope, "truth_writeback_only_no_more_deletion", "final_slice_decision_scope_mismatch");
assertArrayIncludesAll(finalSlice.required_gates, manifest.required_global_gates, "final_slice_required_gate");
assertNoForbiddenWriteSet(finalSlice);

for (const phrase of [
  "agent_run_batch_mode: physical_delete_goal_batch_driven",
  "batch manifest",
  "next_slice queue",
  "one commit per slice",
  "B may absorb the whole batch",
]) {
  assertIncludes(goal, phrase, "goal_batch_mode");
}

for (const phrase of [
  "run_manifest: `docs/recovery/physical-legacy-file-retirement-run-manifest.json`",
  "next_slice queue",
  "slice-2-legacy-script-archive-delete-boundary",
  "slice-3-observability-runner-physical-retirement-boundary",
]) {
  assertIncludes(inventory, phrase, "inventory_batch_mode");
}

console.log(JSON.stringify({
  ok: true,
  contract: "v22_physical_legacy_batch_run_manifest",
  manifestPath,
  currentSlice: manifest.current_slice,
  nextSlices: manifest.next_slices,
}, null, 2));
