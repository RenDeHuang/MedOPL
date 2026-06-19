import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
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

assertNotIncludesAny(orchestratorSource, [
  "changes/active",
  "changes/archive",
  "git push",
  "git merge",
  "kubectl",
  "docker",
], "slice_orchestrator_source");

console.log(JSON.stringify({
  ok: true,
  contract: "v22_worktree_slice_orchestrator",
}, null, 2));
