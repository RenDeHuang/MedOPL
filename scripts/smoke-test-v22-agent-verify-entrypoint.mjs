import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

const files = {
  runner: "scripts/v22-verify.mjs",
  manifest: "docs/recovery/v22-agent-verify-manifest.json",
  current: "docs/recovery/v22-goal-current.json",
  goalState: "docs/recovery/v22-goal-state.md",
  goalLoop: "docs/recovery/v22-codex-goal-loop.md",
  productHarness: "scripts/smoke-test-v22-product-goal-harness.mjs",
  workflowGate: "scripts/v22-workflow-gate.mjs",
};

async function readRepoFile(filePath) {
  return readFile(path.join(repoRoot, filePath), "utf8");
}

async function readJson(filePath) {
  return JSON.parse(await readRepoFile(filePath));
}

async function assertFileExists(filePath) {
  await access(path.join(repoRoot, filePath)).catch((error) => {
    throw new Error(`required_file_missing:${filePath}:${error.message}`);
  });
}

function assertIncludes(source, expected, label) {
  assert(source.includes(expected), `${label}_missing:${expected}`);
}

function assertNotIncludes(source, forbidden, label) {
  assert(!source.includes(forbidden), `${label}_forbidden:${forbidden}`);
}

function runVerify(args) {
  return spawnSync(process.execPath, ["scripts/v22-verify.mjs", ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: "pipe",
  });
}

for (const filePath of Object.values(files)) {
  await assertFileExists(filePath);
}

const [runnerSource, productHarnessSource, workflowGateSource, goalState, goalLoop, manifest, current] = await Promise.all([
  readRepoFile(files.runner),
  readRepoFile(files.productHarness),
  readRepoFile(files.workflowGate),
  readRepoFile(files.goalState),
  readRepoFile(files.goalLoop),
  readJson(files.manifest),
  readJson(files.current),
]);

assert.equal(manifest.schema_version, 1, "manifest_schema_version_mismatch");
assert.equal(manifest.canonical, true, "manifest_must_be_canonical");
assert.equal(manifest.default_agent_entrypoint, "node scripts/v22-verify.mjs current --base origin/recovery/platform-v22-trunk", "default_agent_entrypoint_mismatch");
assert.equal(manifest.allowlist_authority, "manifest_not_smoke", "allowlist_authority_mismatch");
assert.equal(manifest.smoke_role, "atomic_gate_only", "smoke_role_mismatch");
assert.equal(manifest.runner, "scripts/v22-verify.mjs", "manifest_runner_mismatch");
assert.deepEqual(manifest.risk_classes, [
  "local_doc_eval",
  "local_service_code",
  "sensitive_boundary",
  "live_external",
], "risk_classes_mismatch");
assert(Array.isArray(manifest.leaves), "manifest_leaves_must_be_array");
assert(manifest.leaves.length >= 1, "manifest_must_have_current_leaf");

const currentLeaf = manifest.leaves.find((leaf) => leaf.leaf_id === current.current_cursor);
assert(currentLeaf, `manifest_current_leaf_missing:${current.current_cursor}`);
assert.equal(currentLeaf.risk_class, current.current_risk_class, "current_leaf_risk_class_mismatch");
assert.deepEqual(currentLeaf.allowed_files, current.current_leaf.allowed_files, "current_leaf_allowed_files_must_match_current_state");
assert.deepEqual(currentLeaf.forbidden_files, current.current_leaf.forbidden_files, "current_leaf_forbidden_files_must_match_current_state");
assert.deepEqual(currentLeaf.verification_commands, current.current_leaf.verification_commands, "current_leaf_verification_commands_must_match_current_state");
assert.equal(currentLeaf.live_external_allowed, false, "current_leaf_must_not_allow_live_external");
assert.equal(currentLeaf.requires_step_local_auth_record, false, "current_leaf_must_not_require_auth_record");
assert(currentLeaf.forbidden_ops.includes("secret"), "current_leaf_must_forbid_secret");
assert(currentLeaf.forbidden_ops.includes("live-cloud"), "current_leaf_must_forbid_live_cloud");
assert(currentLeaf.forbidden_ops.includes("build-push-kubectl"), "current_leaf_must_forbid_build_push_kubectl");

assert(Array.isArray(manifest.suites), "manifest_suites_must_be_array");
const currentSuite = manifest.suites.find((suite) => suite.id === "current");
assert(currentSuite, "current_suite_missing");
assert.deepEqual(currentSuite.commands, currentLeaf.verification_commands, "current_suite_must_use_current_leaf_commands");
assert.equal(currentSuite.entrypoint, "node scripts/v22-verify.mjs current --base origin/recovery/platform-v22-trunk", "current_suite_entrypoint_mismatch");

assertIncludes(runnerSource, "docs/recovery/v22-agent-verify-manifest.json", "runner_must_read_manifest");
assertIncludes(runnerSource, "docs/recovery/v22-goal-current.json", "runner_must_read_current_state");
assertIncludes(runnerSource, "spawnSync", "runner_must_execute_manifest_commands");
assertNotIncludes(runnerSource, "kubectl", "runner_must_not_embed_kubectl");
assertNotIncludes(runnerSource, "docker build", "runner_must_not_embed_docker_build");
assertNotIncludes(runnerSource, "git push", "runner_must_not_embed_git_push");

assertIncludes(productHarnessSource, "docs/recovery/v22-agent-verify-manifest.json", "product_harness_must_subscribe_manifest");
assertIncludes(productHarnessSource, "allowlist_authority", "product_harness_must_check_manifest_allowlist_authority");
assertNotIncludes(productHarnessSource, "cleanup/v22-agent-verify-manifest-entrypoint\", new Set", "product_harness_must_not_add_branch_allowlist_for_this_branch");
assertIncludes(workflowGateSource, "node scripts/v22-verify.mjs current --base origin/recovery/platform-v22-trunk", "workflow_gate_must_recommend_unified_current_entrypoint");
assertIncludes(goalState, "v22-agent-verify-manifest.json", "goal_state_must_point_to_verify_manifest");
assertIncludes(goalLoop, "node scripts/v22-verify.mjs current --base origin/recovery/platform-v22-trunk", "goal_loop_must_define_unified_current_entrypoint");

const listResult = runVerify(["list", "--json"]);
assert.equal(listResult.status, 0, `verify_list_must_exit_zero:${listResult.stderr || listResult.stdout}`);
const listPayload = JSON.parse(listResult.stdout);
assert.equal(listPayload.ok, true, "verify_list_ok_mismatch");
assert.equal(listPayload.defaultAgentEntrypoint, manifest.default_agent_entrypoint, "verify_list_default_entrypoint_mismatch");
assert(listPayload.leaves.includes(current.current_cursor), "verify_list_must_include_current_cursor");

const planResult = runVerify(["current", "--base", "origin/recovery/platform-v22-trunk", "--dry-run", "--json"]);
assert.equal(planResult.status, 0, `verify_current_dry_run_must_exit_zero:${planResult.stderr || planResult.stdout}`);
const planPayload = JSON.parse(planResult.stdout);
assert.equal(planPayload.ok, true, "verify_current_dry_run_ok_mismatch");
assert.equal(planPayload.mode, "current", "verify_current_mode_mismatch");
assert.equal(planPayload.leafId, current.current_cursor, "verify_current_leaf_mismatch");
assert.deepEqual(planPayload.commands, currentLeaf.verification_commands, "verify_current_commands_mismatch");
assert.deepEqual(planPayload.allowedFiles, currentLeaf.allowed_files, "verify_current_allowed_files_mismatch");
assert.deepEqual(planPayload.forbiddenFiles, currentLeaf.forbidden_files, "verify_current_forbidden_files_mismatch");
assert.equal(planPayload.dryRun, true, "verify_current_dry_run_flag_mismatch");

const mvpPlanResult = runVerify(["suite", "mvp", "--base", "origin/recovery/platform-v22-trunk", "--dry-run", "--json"]);
assert.equal(mvpPlanResult.status, 0, `verify_mvp_dry_run_must_exit_zero:${mvpPlanResult.stderr || mvpPlanResult.stdout}`);
const mvpPlanPayload = JSON.parse(mvpPlanResult.stdout);
assert.equal(mvpPlanPayload.ok, true, "verify_mvp_dry_run_ok_mismatch");
assert.equal(mvpPlanPayload.mode, "suite", "verify_mvp_mode_mismatch");
assert.equal(mvpPlanPayload.suiteId, "mvp", "verify_mvp_suite_id_mismatch");
assert.deepEqual(mvpPlanPayload.allowedFiles, [], "verify_mvp_allowed_files_must_not_echo_forbidden_files");
assert(mvpPlanPayload.forbiddenFiles.includes("deploy/*"), "verify_mvp_forbidden_files_missing_global_boundary");

console.log(JSON.stringify({
  ok: true,
  contract: "v22_agent_verify_entrypoint",
  defaultAgentEntrypoint: manifest.default_agent_entrypoint,
  currentLeaf: current.current_cursor,
  checked: {
    manifest: files.manifest,
    runner: files.runner,
    commandCount: currentLeaf.verification_commands.length,
    smokeRole: manifest.smoke_role,
    allowlistAuthority: manifest.allowlist_authority,
  },
}, null, 2));
