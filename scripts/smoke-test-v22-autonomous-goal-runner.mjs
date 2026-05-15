import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

const files = {
  contract: "docs/recovery/v22-autonomous-goal-runner.md",
  policy: "docs/recovery/v22-autonomous-goal-runner-policy.json",
  manifest: "docs/recovery/v22-agent-verify-manifest.json",
  goalLoop: "docs/recovery/v22-codex-goal-loop.md",
  goalState: "docs/recovery/v22-goal-state.md",
  gapMatrix: "docs/recovery/v22-current-vs-ideal-gap-matrix.md",
  runner: "scripts/v22-verify.mjs",
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

for (const filePath of Object.values(files)) await assertFileExists(filePath);

const [contract, goalLoop, goalState, gapMatrix, runnerSource, policy, manifest] = await Promise.all([
  readRepoFile(files.contract),
  readRepoFile(files.goalLoop),
  readRepoFile(files.goalState),
  readRepoFile(files.gapMatrix),
  readRepoFile(files.runner),
  readJson(files.policy),
  readJson(files.manifest),
]);

assert.equal(policy.schema_version, 1, "policy_schema_version_mismatch");
assert.equal(policy.mode, "autonomous_goal_runner", "policy_mode_mismatch");
assert.equal(policy.entrypoint, "node scripts/v22-verify.mjs current --base origin/recovery/platform-v22-trunk", "policy_entrypoint_mismatch");
assert.deepEqual(policy.truth_sources, [
  "docs/recovery/v22-goal-current.json",
  "docs/recovery/v22-agent-verify-manifest.json",
], "policy_truth_sources_mismatch");
assert.deepEqual(policy.auto_run_allowed_risk_classes, ["local_doc_eval"], "auto_run_risk_class_mismatch");
assert.deepEqual(policy.auto_review_allowed_risk_classes, ["local_doc_eval"], "auto_review_risk_class_mismatch");
assert.deepEqual(policy.manual_stop_risk_classes, ["sensitive_boundary", "live_external"], "manual_stop_risk_class_mismatch");
assert.equal(policy.max_leafs_per_session, 3, "max_leafs_per_session_mismatch");
assert.equal(policy.requires_branch_per_leaf, true, "branch_per_leaf_required");
assert.equal(policy.requires_b_absorb_before_next_leaf, true, "b_absorb_required_before_next_leaf");
assert.equal(policy.receipt_path, ".runtime/v22-autonomous-goal-runner/", "receipt_path_mismatch");
assert.equal(policy.cursor_advancement_source, "post_absorb_trunk_only", "cursor_advancement_source_mismatch");

for (const forbidden of [
  "secret",
  "live-cloud",
  "true-cloud-mutation",
  "build-push-kubectl",
  "deploy",
  "live-test",
  "upstream-write",
  "dependency-upgrade",
]) {
  assert(policy.forbidden_ops_always_stop.includes(forbidden), `policy_forbidden_op_missing:${forbidden}`);
}

for (const category of [
  "contract_wrong",
  "eval_wrong",
  "implementation_wrong",
  "authorization_missing",
  "problem_should_split",
]) {
  assert(policy.failure_categories.includes(category), `policy_failure_category_missing:${category}`);
}

const autonomousSuite = manifest.suites.find((suite) => suite.id === "autonomous");
assert(autonomousSuite, "manifest_autonomous_suite_missing");
assert.equal(autonomousSuite.entrypoint, "node scripts/v22-verify.mjs suite autonomous --base origin/recovery/platform-v22-trunk", "autonomous_suite_entrypoint_mismatch");
assert.deepEqual(autonomousSuite.commands, [
  "node scripts/smoke-test-v22-autonomous-goal-runner.mjs",
  "node scripts/smoke-test-v22-agent-verify-entrypoint.mjs",
  "node scripts/smoke-test-v22-product-goal-harness.mjs",
], "autonomous_suite_commands_mismatch");
assert(manifest.control_plane_files.includes(files.contract), "manifest_control_plane_contract_missing");
assert(manifest.control_plane_files.includes(files.policy), "manifest_control_plane_policy_missing");
assert(manifest.control_plane_files.includes("scripts/smoke-test-v22-autonomous-goal-runner.mjs"), "manifest_control_plane_smoke_missing");

for (const phrase of [
  "Autonomous Goal Runner",
  "合同 + manifest + runner 驱动",
  "代码跟上合同",
  "AGENTS.md 只保留稳定纪律",
  "skills/scripts 承接可执行工作流",
  "manifest 是 allowlist 和验证入口权威",
  "smoke 只做 atomic gate",
  "A 不得伪装 B 吸收",
  "每个 leaf 仍然独立 branch、verify、receipt、commit、B absorb",
  "local_doc_eval",
  "sensitive_boundary",
  "live_external",
  "post_absorb_trunk_only",
]) {
  assertIncludes(contract, phrase, "autonomous_contract_phrase");
}

for (const phrase of [
  "v22-autonomous-goal-runner-policy.json",
  "node scripts/v22-verify.mjs suite autonomous --base origin/recovery/platform-v22-trunk",
  "Autonomous Goal Runner",
]) {
  assertIncludes(goalLoop, phrase, "goal_loop_autonomous_reference");
  assertIncludes(goalState, phrase, "goal_state_autonomous_reference");
}

assertIncludes(gapMatrix, "runner governance，不改变 current cursor", "gap_matrix_autonomous_boundary");
assertIncludes(runnerSource, "suite", "runner_suite_mode_required");
assertNotIncludes(contract, "自动合并所有风险分支", "contract_must_not_auto_merge_risky_work");
assertNotIncludes(contract, "自动读取 secret", "contract_must_not_authorize_secret");
assertNotIncludes(contract, "自动执行真实云", "contract_must_not_authorize_live_cloud");

const listResult = runVerify(["list", "--json"]);
assert.equal(listResult.status, 0, `verify_list_failed:${listResult.stderr || listResult.stdout}`);
const listPayload = JSON.parse(listResult.stdout);
assert(listPayload.suites.includes("autonomous"), "verify_list_must_include_autonomous_suite");

const planResult = runVerify(["suite", "autonomous", "--base", "origin/recovery/platform-v22-trunk", "--dry-run", "--json"]);
assert.equal(planResult.status, 0, `verify_autonomous_dry_run_failed:${planResult.stderr || planResult.stdout}`);
const planPayload = JSON.parse(planResult.stdout);
assert.equal(planPayload.ok, true, "verify_autonomous_dry_run_ok_mismatch");
assert.equal(planPayload.mode, "suite", "verify_autonomous_mode_mismatch");
assert.equal(planPayload.suiteId, "autonomous", "verify_autonomous_suite_id_mismatch");
assert.deepEqual(planPayload.commands, autonomousSuite.commands, "verify_autonomous_commands_mismatch");

console.log(JSON.stringify({
  ok: true,
  contract: "v22_autonomous_goal_runner",
  policy: files.policy,
  suite: "autonomous",
  entrypoint: autonomousSuite.entrypoint,
  checked: {
    autoRunRiskClasses: policy.auto_run_allowed_risk_classes,
    manualStopRiskClasses: policy.manual_stop_risk_classes,
    maxLeafsPerSession: policy.max_leafs_per_session,
    receiptPath: policy.receipt_path,
  },
}, null, 2));
