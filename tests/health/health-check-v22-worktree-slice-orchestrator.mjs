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

const [packageJson, manifest, classificationSource, orchestratorSource, agentsSource, deliverySource, testsReadmeSource] = await Promise.all([
  readFile(path.join(repoRoot, "package.json"), "utf8").then(JSON.parse),
  readFile(path.join(repoRoot, "tests/fixtures/v22/agent-verify-manifest.json"), "utf8").then(JSON.parse),
  readFile(path.join(repoRoot, "scripts/v22-test-classification.mjs"), "utf8"),
  readFile(path.join(repoRoot, "scripts/v22-worktree-slice-orchestrator.mjs"), "utf8"),
  readFile(path.join(repoRoot, "AGENTS.md"), "utf8"),
  readFile(path.join(repoRoot, "docs/delivery/README.md"), "utf8"),
  readFile(path.join(repoRoot, "tests/README.md"), "utf8"),
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
assert.equal(planPayload.landingPolicy?.featureBranchPushAllowed, true, "slice_landing_policy_must_allow_feature_branch_push");
assert.equal(planPayload.landingPolicy?.trunkMergePushAllowedAfterLandingGate, true, "slice_landing_policy_must_allow_trunk_push_after_gate");
assert.equal(planPayload.landingPolicy?.requiresFreshLandingGate, true, "slice_landing_policy_must_require_fresh_landing_gate");
assert.equal(planPayload.landingPolicy?.requiresPostPushVerify, true, "slice_landing_policy_must_require_post_push_verify");
assert.deepEqual(planPayload.landingPolicy?.flow, [
  "current truth",
  "vision gap",
  "lane owner/consumer",
  "worktree branch",
  "implement",
  "run-plan",
  "targeted gates",
  "verify/review/bloat",
  "commit",
  "push feature branch",
  "ff-only merge trunk",
  "push trunk",
  "post-push verify",
  "tombstone cleanup",
], "slice_landing_policy_flow_mismatch");
for (const command of [
  "npm run test:run-plan -- --dry-run --json",
  "npm run test:run-plan",
  "npm run verify",
  "npm run test:health",
  "npm run gate:review",
  "npm run repo:bloat",
  "npm run line:budget",
]) {
  assert(planPayload.landingPolicy?.landingGateCommands?.includes(command), `slice_landing_policy_gate_command_missing:${command}`);
}
for (const boundary of [
  "secret",
  "provider call",
  "true cloud mutation",
  "kubectl",
  "deploy",
  "build/push",
  "live-test",
]) {
  assert(planPayload.landingPolicy?.authorizedOperationBoundaries?.includes(boundary), `slice_landing_policy_authorized_boundary_missing:${boundary}`);
}
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

const executeStart = runSlice(["start", "--execute", "--slice-id", testSliceId, "--owner-surface", "backend", "--json"]);
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
assert.equal(sliceManifest.admission?.slice_type, "product", "slice_manifest_must_default_to_product_admission");
assert.equal(sliceManifest.admission?.owner_surface, "backend", "slice_manifest_must_accept_owner_surface");
assert.equal(sliceManifest.admission?.target_claim, "local product implementation slice", "slice_manifest_must_default_target_claim");
assert.equal(sliceManifest.admission?.minimum_evidence_slice, "test:run-plan plus targeted owner lane", "slice_manifest_must_default_minimum_evidence");
assert.deepEqual(sliceManifest.admission?.allowed_paths, [
  "services/",
  "tests/backend/",
  "tests/product/",
  "tests/smoke/",
  "contracts/",
  "specs/",
  "docs/active/README.md",
  "docs/delivery/README.md",
  "docs/history/README.md",
  "tests/fixtures/v22/",
], "product_slice_default_allowed_paths_mismatch");
assert(sliceManifest.admission?.forbidden_paths?.includes("changes/active/**"), "slice_manifest_must_keep_retired_changes_forbidden");
assert.equal(sliceManifest.admission?.new_top_level_scripts_allowed, false, "product_slice_must_not_allow_new_top_level_scripts");
assert.equal(sliceManifest.admission?.new_contracts_allowed, false, "product_slice_must_not_allow_new_contracts_by_default");
assert.equal(sliceManifest.admission?.new_health_tests_allowed, false, "product_slice_must_not_allow_new_health_tests");
assert.equal(sliceManifest.admission?.touches_cloud, false, "product_slice_must_not_touch_cloud_by_default");
assert.equal(sliceManifest.admission?.touches_active_docs, false, "product_slice_must_not_touch_active_docs_by_default");
assert.equal(sliceManifest.admission?.must_reduce_or_hold_bloat, true, "slice_manifest_must_hold_bloat_by_default");
assert(sliceManifest.admission?.cannot_claim?.includes("production complete"), "slice_manifest_must_keep_production_claim_blocked");
assert.equal(sliceManifest.phases.start.status, "executed", "slice_manifest_start_phase_status");
assert(sliceManifest.phases.start.evidence_ref.startsWith(`.runtime/slices/${testSliceId}/`), "slice_manifest_start_evidence_ref_must_be_runtime_pointer");

const executeLandBlocked = runSlice(["land", "--execute", "--slice-id", testSliceId, "--json"]);
assert.equal(executeLandBlocked.status, 1, "slice_land_execute_without_git_mutation_must_fail_closed");
const landBlockedPayload = JSON.parse(executeLandBlocked.stdout);
assert.equal(landBlockedPayload.ok, false, "slice_land_without_git_mutation_payload_must_fail");
assert.equal(landBlockedPayload.blockers.includes("slice_git_mutation_requires_allow_git_mutation"), true, "slice_land_without_git_mutation_blocker");
assert.equal(landBlockedPayload.usesRealMergePush, false, "slice_land_without_git_mutation_must_not_merge_push");

const executeLandWithoutGate = runSlice(["land", "--execute", "--allow-git-mutation", "--slice-id", testSliceId, "--json"]);
assert.equal(executeLandWithoutGate.status, 1, "slice_land_git_mutation_without_landing_gate_must_fail_closed");
const landWithoutGatePayload = JSON.parse(executeLandWithoutGate.stdout);
assert.equal(landWithoutGatePayload.ok, false, "slice_land_without_landing_gate_payload_must_fail");
assert.equal(landWithoutGatePayload.blockers.includes("slice_trunk_merge_push_requires_landing_gate_passed"), true, "slice_land_without_landing_gate_blocker");
assert.equal(landWithoutGatePayload.usesRealMergePush, false, "slice_land_without_landing_gate_must_not_merge_push");

const executeLandWithGate = runSlice(["land", "--execute", "--allow-git-mutation", "--landing-gate-passed", "--slice-id", testSliceId, "--json"]);
const landGatePayload = JSON.parse(executeLandWithGate.stdout);
assert.equal(landGatePayload.usesRealMergePush, true, "slice_land_with_gate_must_allow_ff_only_merge_push");
assert.equal(landGatePayload.landingPolicy.trunkMergePushAllowedAfterLandingGate, true, "slice_land_policy_must_allow_trunk_merge_push_after_gate");
assert.equal(
  executeLandWithGate.status === 0 || landGatePayload.blockers?.some((blocker) => blocker.startsWith("slice_phase_command_failed:land:")),
  true,
  "slice_land_with_gate_must_enter_landing_gate_or_report_gate_command_failure",
);

const executeCleanupWithoutPostPush = runSlice(["cleanup", "--execute", "--allow-git-mutation", "--slice-id", testSliceId, "--json"]);
assert.equal(executeCleanupWithoutPostPush.status, 1, "slice_cleanup_without_post_push_verify_must_fail_closed");
const cleanupWithoutPostPushPayload = JSON.parse(executeCleanupWithoutPostPush.stdout);
assert.equal(cleanupWithoutPostPushPayload.ok, false, "slice_cleanup_without_post_push_verify_payload_must_fail");
assert.equal(cleanupWithoutPostPushPayload.blockers.includes("slice_cleanup_requires_post_push_verified"), true, "slice_cleanup_without_post_push_verify_blocker");

const executeCleanupWithGate = runSlice(["cleanup", "--execute", "--allow-git-mutation", "--post-push-verified", "--slice-id", testSliceId, "--json"]);
const cleanupPayload = JSON.parse(executeCleanupWithGate.stdout);
assert.equal(cleanupPayload.usesRealMergePush, true, "slice_cleanup_after_post_push_verify_must_allow_cleanup");
assert.equal(
  executeCleanupWithGate.status === 0 || cleanupPayload.blockers?.some((blocker) => blocker.startsWith("slice_phase_command_failed:cleanup:")),
  true,
  "slice_cleanup_after_post_push_verify_must_enter_cleanup_gate_or_report_gate_command_failure",
);

for (const source of [agentsSource, deliverySource, testsReadmeSource]) {
  assertIncludesAll(source, [
    "push feature branch",
    "ff-only merge trunk",
    "push trunk",
    "post-push verify",
    "tombstone cleanup",
    "真实云",
    "授权包",
    "receipt",
  ], "slice_landing_policy_docs");
}

assertNotIncludesAny(orchestratorSource, [
  "changes/active",
  "changes/archive",
  "docker",
], "slice_orchestrator_source");

rmSync(testSliceDir, { recursive: true, force: true });

const automationSliceId = `automation-slice-${process.pid}`;
const automationSliceDir = path.join(repoRoot, ".runtime", "slices", automationSliceId);
rmSync(automationSliceDir, { recursive: true, force: true });
const executeAutomationStart = runSlice([
  "start",
  "--execute",
  "--slice-id",
  automationSliceId,
  "--slice-type",
  "automation",
  "--owner-surface",
  "workflow",
  "--target-claim",
  "slice executor admission control",
  "--minimum-evidence",
  "workflow gate self-test",
  "--json",
]);
assert.equal(executeAutomationStart.status, 0, "automation_slice_start_execute_must_succeed");
const automationManifest = JSON.parse(await readFile(path.join(automationSliceDir, "slice.json"), "utf8"));
assert.equal(automationManifest.admission?.slice_type, "automation", "automation_slice_manifest_type");
assert.equal(automationManifest.admission?.owner_surface, "workflow", "automation_slice_manifest_owner");
assert.equal(automationManifest.admission?.target_claim, "slice executor admission control", "automation_slice_manifest_target_claim");
assert.equal(automationManifest.admission?.minimum_evidence_slice, "workflow gate self-test", "automation_slice_manifest_minimum_evidence");
assert.equal(automationManifest.admission?.new_top_level_scripts_allowed, false, "automation_slice_must_still_default_no_new_top_level_scripts");
assert.equal(automationManifest.admission?.new_health_tests_allowed, false, "automation_slice_must_still_default_no_new_health_tests");
assert(automationManifest.admission?.allowed_paths?.includes("scripts/"), "automation_slice_must_allow_scripts_surface");
assert(automationManifest.admission?.allowed_paths?.includes("tests/hygiene/"), "automation_slice_must_allow_hygiene_surface");
assert(automationManifest.admission?.cannot_claim?.includes("product behavior changed"), "automation_slice_must_not_claim_product_behavior_changed");
rmSync(automationSliceDir, { recursive: true, force: true });

console.log(JSON.stringify({
  ok: true,
  contract: "v22_worktree_slice_orchestrator",
}, null, 2));
