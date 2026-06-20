import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");

function runSlice(args = []) {
  return spawnSync(process.execPath, ["scripts/v22-worktree-slice-orchestrator.mjs", ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: "pipe",
  });
}

function assertIncludesAll(source, phrases, label) {
  for (const phrase of phrases) {
    assert(source.includes(phrase), `${label}_missing:${phrase}`);
  }
}

function assertNotIncludesAny(source, phrases, label) {
  for (const phrase of phrases) {
    assert.equal(source.includes(phrase), false, `${label}_must_not_include:${phrase}`);
  }
}

const [packageJson, manifest, classificationSource, orchestratorSource] = await Promise.all([
  readFile(path.join(repoRoot, "package.json"), "utf8").then(JSON.parse),
  readFile(path.join(repoRoot, "tests/fixtures/v22/agent-verify-manifest.json"), "utf8").then(JSON.parse),
  readFile(path.join(repoRoot, "scripts/v22-test-classification.mjs"), "utf8"),
  readFile(path.join(repoRoot, "scripts/v22-worktree-slice-orchestrator.mjs"), "utf8"),
]);

assert.equal(packageJson.scripts?.["slice:start"], "node scripts/v22-worktree-slice-orchestrator.mjs start --json", "slice_start_script_must_exist");
assert.equal(packageJson.scripts?.["slice:plan"], "node scripts/v22-worktree-slice-orchestrator.mjs plan --json", "slice_plan_script_must_exist");
assert.equal(packageJson.scripts?.["slice:verify"], "node scripts/v22-worktree-slice-orchestrator.mjs verify --json", "slice_verify_script_must_exist");
assert.equal(packageJson.scripts?.["slice:land"], "node scripts/v22-worktree-slice-orchestrator.mjs land --json", "slice_land_script_must_exist");
assert.equal(packageJson.scripts?.["slice:post-push-verify"], "node scripts/v22-worktree-slice-orchestrator.mjs post-push-verify --json", "slice_post_push_verify_script_must_exist");
assert.equal(packageJson.scripts?.["slice:cleanup"], "node scripts/v22-worktree-slice-orchestrator.mjs cleanup --json", "slice_cleanup_script_must_exist");

assert(
  manifest.package_suites.some((suite) => suite.id === "test-lanes" && suite.commands.includes("node tests/health/health-check-v22-worktree-slice-orchestrator.mjs")),
  "slice_orchestrator_gate_must_be_registered_in_test_lanes",
);

assert(
  classificationSource.includes("tests/health/health-check-v22-worktree-slice-orchestrator.mjs"),
  "slice_orchestrator_test_must_be_registered_in_classification",
);

const runResult = runSlice(["start", "--json"]);
assert.equal(runResult.status, 0, "slice_orchestrator_json_run_must_succeed");
const planPayload = JSON.parse(runResult.stdout);
assert.equal(planPayload.ok, true, "slice_orchestrator_plan_payload_must_be_ok");
assert.equal(planPayload.kind, "v22_worktree_slice_orchestrator_plan", "slice_orchestrator_plan_kind_mismatch");
assert.equal(planPayload.phase, "start", "slice_orchestrator_phase_mismatch");
assert.equal(planPayload.dryRun, true, "slice_orchestrator_must_default_dry_run");
assert.equal(planPayload.failClosed, true, "slice_orchestrator_must_default_fail_closed");
assert.equal(planPayload.executesCommands, false, "slice_orchestrator_must_not_execute_commands");
assert.equal(planPayload.executionMode, "plan-only", "slice_orchestrator_must_be_plan_only");
assert.equal(planPayload.usesRealMergePush, false, "slice_orchestrator_must_not_use_real_merge_push");
assert.equal(planPayload.executionAllowed, false, "slice_orchestrator_default_must_not_allow_execution");
assert.equal(planPayload.previousPhase, "", "slice_orchestrator_start_must_have_no_previous_phase");
assert.equal(planPayload.nextPhase, "plan", "slice_orchestrator_start_must_point_to_plan");
assert.deepEqual(planPayload.requires, [
  "clean worktree or isolated feature worktree",
  "base ref origin/recovery/platform-v22-trunk",
], "slice_orchestrator_start_requires_mismatch");
assert.deepEqual(planPayload.commands, [
  "node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk",
], "slice_orchestrator_start_commands_mismatch");
assert(planPayload.produces.includes("slice metadata plan"), "slice_orchestrator_start_must_produce_metadata_plan");
assertIncludesAll(JSON.stringify(planPayload), [
  "scripts/v22-verify.mjs",
  "scripts/v22-workflow-gate.mjs",
  "scripts/v22-landing-closeout.mjs",
], "slice_orchestrator_dependencies");

const testSliceId = `health-slice-${process.pid}`;
const testSliceDir = path.join(repoRoot, ".runtime", "slices", testSliceId);
rmSync(testSliceDir, { recursive: true, force: true });

const executeStart = runSlice(["start", "--execute", "--slice-id", testSliceId, "--json"]);
assert.equal(executeStart.status, 0, "slice_start_execute_must_succeed_without_git_mutation");
const executePayload = JSON.parse(executeStart.stdout);
assert.equal(executePayload.ok, true, "slice_start_execute_payload_must_be_ok");
assert.equal(executePayload.dryRun, false, "slice_start_execute_must_not_be_dry_run");
assert.equal(executePayload.executionMode, "controlled-executor", "slice_start_execute_must_use_controlled_executor");
assert.equal(executePayload.executesCommands, true, "slice_start_execute_must_execute_local_evidence_write");
assert.equal(executePayload.usesRealMergePush, false, "slice_start_execute_must_not_use_merge_push_without_extra_flag");
assert.equal(executePayload.slice.id, testSliceId, "slice_start_execute_must_report_slice_id");
assert.equal(executePayload.slice.manifestPath, `.runtime/slices/${testSliceId}/slice.json`, "slice_start_execute_manifest_path");
assert.equal(existsSync(path.join(testSliceDir, "slice.json")), true, "slice_start_execute_must_write_runtime_manifest");
const sliceManifest = JSON.parse(await readFile(path.join(testSliceDir, "slice.json"), "utf8"));
assert.equal(sliceManifest.kind, "v22_worktree_slice_execution", "slice_manifest_kind");
assert.equal(sliceManifest.slice_id, testSliceId, "slice_manifest_slice_id");
assert.equal(sliceManifest.current_phase, "start", "slice_manifest_current_phase");
assert.equal(sliceManifest.execution_mode, "controlled-executor", "slice_manifest_execution_mode");
assert.equal(sliceManifest.git_mutation_allowed, false, "slice_manifest_must_default_git_mutation_off");
assert.equal(sliceManifest.phases.start.status, "executed", "slice_manifest_start_phase_status");
assert(sliceManifest.phases.start.evidence_ref.startsWith(`.runtime/slices/${testSliceId}/`), "slice_manifest_start_evidence_ref_must_be_runtime_pointer");

const executeLandBlocked = runSlice(["land", "--execute", "--slice-id", testSliceId, "--json"]);
assert.equal(executeLandBlocked.status, 1, "slice_land_execute_without_git_mutation_must_fail_closed");
const landBlockedPayload = JSON.parse(executeLandBlocked.stdout);
assert.equal(landBlockedPayload.ok, false, "slice_land_without_git_mutation_payload_must_fail");
assert.equal(landBlockedPayload.blockers.includes("slice_git_mutation_requires_allow_git_mutation"), true, "slice_land_without_git_mutation_blocker");
assert.equal(landBlockedPayload.usesRealMergePush, false, "slice_land_without_git_mutation_must_not_merge_push");

assertNotIncludesAny(orchestratorSource, [
  "changes/active",
  "changes/archive",
  "kubectl",
  "docker",
], "slice_orchestrator_source");

rmSync(testSliceDir, { recursive: true, force: true });

console.log(JSON.stringify({
  ok: true,
  contract: "v22_worktree_slice_orchestrator",
}, null, 2));
