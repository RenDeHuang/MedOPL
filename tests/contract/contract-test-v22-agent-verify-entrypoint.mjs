import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");

const files = {
  runner: "scripts/v22-verify.mjs",
  manifest: "tests/fixtures/v22/agent-verify-manifest.json",
  current: "tests/fixtures/v22/goal-current.json",
  active: "docs/active/README.md",
  specs: "docs/specs/README.md",
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

for (const filePath of Object.values(files)) await assertFileExists(filePath);

const [runnerSource, activeSource, specsSource, workflowGateSource, manifest, current] = await Promise.all([
  readRepoFile(files.runner),
  readRepoFile(files.active),
  readRepoFile(files.specs),
  readRepoFile(files.workflowGate),
  readJson(files.manifest),
  readJson(files.current),
]);

assert.equal(manifest.schema_version, 2, "manifest_schema_version_mismatch");
assert.equal(current.schema_version, 2, "current_schema_version_mismatch");
assert.equal(manifest.canonical, true, "manifest_must_be_canonical");
assert.equal(current.canonical, true, "current_must_be_canonical");
assert.equal(manifest.runner, "scripts/v22-verify.mjs", "manifest_runner_mismatch");
assert.equal(manifest.default_agent_entrypoint, "node scripts/v22-verify.mjs current --base origin/recovery/platform-v22-trunk", "default_agent_entrypoint_mismatch");
assert.equal(manifest.change_lifecycle_policy?.root, "changes/README.md", "manifest_change_lifecycle_root_mismatch");
assert.equal(manifest.change_lifecycle_policy?.active_dir, "changes/active", "manifest_change_lifecycle_active_dir_mismatch");
assert.equal(manifest.change_lifecycle_policy?.archive_dir, "changes/archive", "manifest_change_lifecycle_archive_dir_mismatch");
assert.equal(manifest.change_lifecycle_policy?.formal_engineering_requires_change_package, true, "manifest_change_lifecycle_must_require_package");
assert.equal(manifest.change_lifecycle_policy?.trunk_allows_empty_active_changes, true, "manifest_change_lifecycle_trunk_empty_active");
assert(manifest.control_plane_files.includes("changes/README.md"), "manifest_control_plane_must_include_changes_readme");
assert(manifest.control_plane_files.includes("specs/README.md"), "manifest_control_plane_must_include_specs_readme");
assert.equal(current.human_truth, "docs/active/README.md", "current_human_truth_mismatch");
assert.equal(current.spec_truth, "docs/specs/README.md", "current_spec_truth_mismatch");
assert.equal(current.verify_manifest, files.manifest, "current_manifest_path_mismatch");

assertIncludes(runnerSource, files.manifest, "runner_must_read_fixture_manifest");
assertIncludes(runnerSource, files.current, "runner_must_read_fixture_current");
assertNotIncludes(runnerSource, ["docs", "recovery", "v22-agent-verify-manifest.json"].join("/"), "runner_must_not_read_old_manifest");
assertNotIncludes(runnerSource, ["docs", "recovery", "v22-goal-current.json"].join("/"), "runner_must_not_read_old_current");
assertNotIncludes(runnerSource, "kubectl", "runner_must_not_embed_kubectl");
assertNotIncludes(runnerSource, "docker build", "runner_must_not_embed_docker_build");
assertNotIncludes(runnerSource, "git push", "runner_must_not_embed_git_push");

assertIncludes(activeSource, "唯一人读 current truth", "active_truth_role");
assertIncludes(specsSource, "Purpose: `v22_contract_spec_single_truth`", "specs_truth_role");
assertIncludes(workflowGateSource, "node scripts/v22-verify.mjs current --base origin/recovery/platform-v22-trunk", "workflow_gate_recommends_verify_current");

const currentLeaf = manifest.leaves.find((leaf) => leaf.leaf_id === current.current_cursor);
assert(currentLeaf, `manifest_current_leaf_missing:${current.current_cursor}`);
assert.deepEqual(currentLeaf.verification_commands, current.current_leaf.verification_commands, "current_leaf_commands_mismatch");
assert.deepEqual(currentLeaf.allowed_files, current.current_leaf.allowed_files, "current_leaf_allowed_files_mismatch");
assert.deepEqual(currentLeaf.forbidden_files, current.current_leaf.forbidden_files, "current_leaf_forbidden_files_mismatch");
assert.equal(currentLeaf.live_external_allowed, false, "current_leaf_must_not_allow_live_external");
assert(currentLeaf.forbidden_ops.includes("secret"), "current_leaf_must_forbid_secret");
assert(currentLeaf.forbidden_ops.includes("live-cloud"), "current_leaf_must_forbid_live_cloud");
assert(currentLeaf.forbidden_ops.includes("build-push-kubectl"), "current_leaf_must_forbid_build_push_kubectl");

const currentSuite = manifest.suites.find((suite) => suite.id === "current");
assert(currentSuite, "current_suite_missing");
assert.deepEqual(currentSuite.commands, currentLeaf.verification_commands, "current_suite_must_use_current_leaf_commands");

const goldenPathSuite = manifest.suites.find((suite) => suite.id === "golden-path");
assert(goldenPathSuite, "golden_path_suite_missing");
assert.equal(goldenPathSuite.entrypoint, "node scripts/v22-verify.mjs suite golden-path --base origin/recovery/platform-v22-trunk", "golden_path_entrypoint_mismatch");
assert.deepEqual(goldenPathSuite.commands, [
  "node tests/contract/contract-test-v22-golden-smoke-suite.mjs",
], "golden_path_suite_commands_mismatch");
assert.equal(currentLeaf.verification_commands[0], "node tests/contract/contract-test-v22-golden-smoke-suite.mjs", "current_leaf_must_start_with_golden_path_health");
assert.equal(current.current_leaf.verification_commands[0], "node tests/contract/contract-test-v22-golden-smoke-suite.mjs", "current_fixture_must_start_with_golden_path_health");
assert.equal(current.golden_path?.suite, "golden-path", "current_fixture_golden_path_suite_mismatch");
assert.equal(current.golden_path?.role, "default_first_product_health", "current_fixture_golden_path_role_mismatch");

const override = manifest.branch_override_suites.find((suite) => suite.id === "opl-framework-workflow-convergence");
assert(override, "framework_workflow_branch_override_missing");
assert(override.branches.includes("cleanup/v22-opl-framework-workflow-convergence"), "framework_workflow_branch_missing");
assert(override.commands.includes("node tests/contract/contract-test-v22-framework-workflow-convergence.mjs"), "framework_workflow_override_must_run_gate");
for (const forbidden of ["services/*", "deploy/*", "adapters/*", ".sentrux/*", "infra/*", "one-person-lab/*", "upstream/*", ".runtime/*"]) {
  assert(override.forbidden_files.includes(forbidden), `framework_workflow_forbidden_file_missing:${forbidden}`);
}
for (const forbiddenOp of ["secret", "live-cloud", "true-cloud-mutation", "build-push-kubectl", "deploy", "live-test", "git-push"]) {
  assert(override.forbidden_ops.includes(forbiddenOp), `framework_workflow_forbidden_op_missing:${forbiddenOp}`);
}

const listResult = runVerify(["list", "--json"]);
assert.equal(listResult.status, 0, `verify_list_must_exit_zero:${listResult.stderr || listResult.stdout}`);
const listPayload = JSON.parse(listResult.stdout);
assert.equal(listPayload.ok, true, "verify_list_ok_mismatch");
assert.equal(listPayload.defaultAgentEntrypoint, manifest.default_agent_entrypoint, "verify_list_default_entrypoint_mismatch");
assert(listPayload.leaves.includes(current.current_cursor), "verify_list_must_include_current_cursor");

const currentPlan = runVerify(["current", "--branch", current.authoring_branch, "--dry-run", "--json"]);
assert.equal(currentPlan.status, 0, `verify_current_dry_run_must_exit_zero:${currentPlan.stderr || currentPlan.stdout}`);
const currentPayload = JSON.parse(currentPlan.stdout);
assert.equal(currentPayload.ok, true, "verify_current_plan_ok");
assert.equal(currentPayload.leafId, current.current_cursor, "verify_current_leaf_mismatch");
assert.equal(currentPayload.branchOverride, undefined, "feature_branch_must_not_use_cleanup_override");

const cleanupPlan = runVerify(["current", "--branch", "cleanup/v22-opl-framework-workflow-convergence", "--dry-run", "--json"]);
assert.equal(cleanupPlan.status, 0, `verify_cleanup_dry_run_must_exit_zero:${cleanupPlan.stderr || cleanupPlan.stdout}`);
const cleanupPayload = JSON.parse(cleanupPlan.stdout);
assert.equal(cleanupPayload.ok, true, "verify_cleanup_plan_ok");
assert.equal(cleanupPayload.branchOverride?.suiteId, "opl-framework-workflow-convergence", "cleanup_override_mismatch");
assert(cleanupPayload.commands.includes("node tests/contract/contract-test-v22-framework-workflow-convergence.mjs"), "cleanup_plan_must_run_gate");

const productLoop = current.product_engineering_loop;
assert(productLoop, "product_engineering_loop_missing");
const productLoopOverride = manifest.branch_override_suites.find((suite) => suite.id === "product-engineering-loop-index");
if (productLoop.status === "closed") {
  assert.equal(productLoopOverride, undefined, "product_engineering_loop_index_branch_override_must_be_removed_after_closeout");
  assert(
    current.gaps?.some((gap) => gap.id === current.current_cursor && gap.cursor_eligible === true && gap.status === "active"),
    "closed_product_loop_cursor_must_follow_active_productization_roadmap_gap",
  );
  assert.equal(current.release_readiness_state?.next_cursor, "real-cloud-authorization-boundary", "real_cloud_boundary_must_remain_deferred_authorized_stage");
} else {
  assert(productLoopOverride, "product_engineering_loop_index_branch_override_missing");
  assert(productLoopOverride.branches.includes("feat/v22-product-engineering-loop-index"), "product_engineering_loop_index_branch_missing");
  assert(productLoopOverride.commands.includes("node tests/contract/contract-test-v22-product-engineering-loop-index.mjs"), "product_engineering_loop_index_override_must_run_gate");
  assert(productLoopOverride.forbidden_files.includes("services/*"), "product_engineering_loop_index_must_forbid_services");

  const productLoopPlan = runVerify(["current", "--branch", "feat/v22-product-engineering-loop-index", "--dry-run", "--json"]);
  assert.equal(productLoopPlan.status, 0, `verify_product_loop_dry_run_must_exit_zero:${productLoopPlan.stderr || productLoopPlan.stdout}`);
  const productLoopPayload = JSON.parse(productLoopPlan.stdout);
  assert.equal(productLoopPayload.ok, true, "verify_product_loop_plan_ok");
  assert.equal(productLoopPayload.branchOverride?.suiteId, "product-engineering-loop-index", "product_loop_override_mismatch");
  assert(productLoopPayload.commands.includes("node tests/contract/contract-test-v22-product-engineering-loop-index.mjs"), "product_loop_plan_must_run_gate");
}

console.log(JSON.stringify({
  ok: true,
  contract: "v22_agent_verify_entrypoint",
  manifest: files.manifest,
  current: files.current,
  currentCursor: current.current_cursor,
}, null, 2));
