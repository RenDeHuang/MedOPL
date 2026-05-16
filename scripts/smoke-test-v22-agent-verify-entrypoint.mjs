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

assert(Array.isArray(manifest.branch_override_suites), "manifest_branch_override_suites_must_be_array");
const strictCleanupOverride = manifest.branch_override_suites.find((suite) => suite.id === "strict-monolith-cleanup");
assert(strictCleanupOverride, "strict_monolith_cleanup_branch_override_missing");
assert.equal(strictCleanupOverride.branch, "cleanup/v22-strict-monolith-ideal-gap-and-legacy-retirement", "strict_monolith_cleanup_override_branch_mismatch");
assert.deepEqual(strictCleanupOverride.branches, [
  "cleanup/v22-strict-monolith-ideal-gap-and-legacy-retirement",
  "cleanup/v22-strict-monolith-residual-test-anchor-retirement",
  "cleanup/v22-strict-monolith-zero-compat-active-surface",
], "strict_monolith_cleanup_override_branches_mismatch");
assertIncludes(strictCleanupOverride.reason, "current product cursor remains leaf-portal-ui-design-quality-implementation", "strict_monolith_cleanup_override_reason_current_truth");
assertIncludes(strictCleanupOverride.reason, "without weakening the UI authoring gate", "strict_monolith_cleanup_override_reason_no_ui_gate_weakening");
assertNotIncludes(strictCleanupOverride.commands.join("\n"), "node scripts/smoke-test-v22-portal-ui-design-quality-audit.mjs", "strict_monolith_cleanup_override_must_not_run_ui_authoring_gate");
assert(strictCleanupOverride.commands.includes("node scripts/smoke-test-v22-observability-billing-narrative-boundary.mjs"), "strict_monolith_cleanup_override_must_include_observability_boundary");
assert(strictCleanupOverride.commands.includes("node scripts/smoke-test-v22-strict-monolith-legacy-retirement-gate.mjs"), "strict_monolith_cleanup_override_must_include_strict_gate");
assert(strictCleanupOverride.forbidden_files.some((item) => item.includes("only deletion of explicit retired assets is authorized")), "strict_monolith_cleanup_override_must_forbid_zone4_add_modify");
assert(strictCleanupOverride.forbidden_ops.includes("real-db-migration-execution"), "strict_monolith_cleanup_override_must_forbid_real_db_migration");

assertIncludes(
  await readRepoFile("scripts/smoke-test-v22-mvp-contract-suite.mjs"),
  "branchOverrideSuiteForCurrentBranch",
  "mvp_suite_must_route_manifest_branch_override_through_current_verify",
);

const contractIndexCleanupOverride = manifest.branch_override_suites.find((suite) => suite.id === "contract-index-runtime-bridge-alignment");
assert(contractIndexCleanupOverride, "contract_index_cleanup_branch_override_missing");
assert.equal(contractIndexCleanupOverride.branch, "cleanup/v22-zero-compat-contract-index-runtime-bridge-alignment", "contract_index_cleanup_override_branch_mismatch");
assert.deepEqual(contractIndexCleanupOverride.branches, [
  "cleanup/v22-zero-compat-contract-index-runtime-bridge-alignment",
], "contract_index_cleanup_override_branches_mismatch");
assertIncludes(contractIndexCleanupOverride.reason, "current product cursor remains leaf-portal-ui-design-quality-implementation", "contract_index_cleanup_override_reason_current_truth");
assertIncludes(contractIndexCleanupOverride.reason, "without weakening the UI authoring gate", "contract_index_cleanup_override_reason_no_ui_gate_weakening");
assert(contractIndexCleanupOverride.commands.includes("node scripts/smoke-test-v22-saas-control-plane-user-experience-boundary.mjs"), "contract_index_cleanup_override_must_include_ux_boundary");
assert(contractIndexCleanupOverride.commands.includes("node scripts/smoke-test-v22-zero-compat-active-surface-gate.mjs"), "contract_index_cleanup_override_must_include_zero_compat_gate");
assert(contractIndexCleanupOverride.commands.includes("node scripts/smoke-test-v22-strict-monolith-legacy-retirement-gate.mjs"), "contract_index_cleanup_override_must_include_strict_gate");
assertNotIncludes(contractIndexCleanupOverride.commands.join("\n"), "node scripts/smoke-test-v22-portal-ui-design-quality-audit.mjs", "contract_index_cleanup_override_must_not_run_ui_authoring_gate");
assertNotIncludes(contractIndexCleanupOverride.commands.join("\n"), "node scripts/smoke-test-v22-retire-resource-order-primary-path.mjs", "contract_index_cleanup_override_must_not_run_resource_order_physical_branch_gate");

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

const planResult = runVerify([
  "current",
  "--base",
  "origin/recovery/platform-v22-trunk",
  "--branch",
  current.authoring_branch,
  "--dry-run",
  "--json",
]);
assert.equal(planResult.status, 0, `verify_current_dry_run_must_exit_zero:${planResult.stderr || planResult.stdout}`);
const planPayload = JSON.parse(planResult.stdout);
assert.equal(planPayload.ok, true, "verify_current_dry_run_ok_mismatch");
assert.equal(planPayload.mode, "current", "verify_current_mode_mismatch");
assert.equal(planPayload.leafId, current.current_cursor, "verify_current_leaf_mismatch");
assert.deepEqual(planPayload.commands, currentLeaf.verification_commands, "verify_current_commands_mismatch");
assert.deepEqual(planPayload.allowedFiles, currentLeaf.allowed_files, "verify_current_allowed_files_mismatch");
assert.deepEqual(planPayload.forbiddenFiles, currentLeaf.forbidden_files, "verify_current_forbidden_files_mismatch");
assert.equal(planPayload.dryRun, true, "verify_current_dry_run_flag_mismatch");

const strictCleanupPlanResult = runVerify([
  "current",
  "--base",
  "origin/recovery/platform-v22-trunk",
  "--branch",
  "cleanup/v22-strict-monolith-ideal-gap-and-legacy-retirement",
  "--dry-run",
  "--json",
]);
assert.equal(strictCleanupPlanResult.status, 0, `verify_current_strict_cleanup_dry_run_must_exit_zero:${strictCleanupPlanResult.stderr || strictCleanupPlanResult.stdout}`);
const strictCleanupPlanPayload = JSON.parse(strictCleanupPlanResult.stdout);
assert.equal(strictCleanupPlanPayload.ok, true, "verify_current_strict_cleanup_dry_run_ok_mismatch");
assert.equal(strictCleanupPlanPayload.mode, "current", "verify_current_strict_cleanup_mode_mismatch");
assert.equal(strictCleanupPlanPayload.leafId, current.current_cursor, "verify_current_strict_cleanup_must_not_change_current_leaf");
assert.equal(strictCleanupPlanPayload.branchOverride?.branch, "cleanup/v22-strict-monolith-ideal-gap-and-legacy-retirement", "verify_current_strict_cleanup_branch_override_mismatch");
assert.equal(strictCleanupPlanPayload.branchOverride?.suiteId, "strict-monolith-cleanup", "verify_current_strict_cleanup_suite_id_mismatch");
assert.deepEqual(strictCleanupPlanPayload.commands, [
  "node scripts/smoke-test-v22-physical-legacy-file-retirement-inventory.mjs",
  "node scripts/smoke-test-v22-physical-legacy-batch-run-manifest.mjs",
  "node scripts/smoke-test-v22-physical-legacy-file-retirement-goal.mjs",
  "node scripts/smoke-test-v22-retire-user-owned-primary-path.mjs",
  "node scripts/smoke-test-v22-retire-resource-order-primary-path.mjs",
  "node scripts/smoke-test-v22-cleanup-completion-truth.mjs",
  "node scripts/smoke-test-v22-default-entry-narrative-gate.mjs",
  "node scripts/smoke-test-v22-observability-billing-narrative-boundary.mjs",
  "node scripts/smoke-test-v22-strict-monolith-legacy-retirement-gate.mjs",
  "node scripts/smoke-test-v22-contract-conflict-boundary.mjs",
  "node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk",
  "git diff --check -- docs/recovery docs/contracts scripts services deploy adapters infra",
], "verify_current_strict_cleanup_commands_mismatch");
assertNotIncludes(
  strictCleanupPlanPayload.commands.join("\n"),
  "node scripts/smoke-test-v22-portal-ui-design-quality-audit.mjs",
  "verify_current_strict_cleanup_must_not_run_ui_authoring_gate",
);
assert.equal(strictCleanupPlanPayload.dryRun, true, "verify_current_strict_cleanup_dry_run_flag_mismatch");

const residualCleanupPlanResult = runVerify([
  "current",
  "--base",
  "origin/recovery/platform-v22-trunk",
  "--branch",
  "cleanup/v22-strict-monolith-residual-test-anchor-retirement",
  "--dry-run",
  "--json",
]);
assert.equal(residualCleanupPlanResult.status, 0, `verify_current_residual_cleanup_dry_run_must_exit_zero:${residualCleanupPlanResult.stderr || residualCleanupPlanResult.stdout}`);
const residualCleanupPlanPayload = JSON.parse(residualCleanupPlanResult.stdout);
assert.equal(residualCleanupPlanPayload.ok, true, "verify_current_residual_cleanup_dry_run_ok_mismatch");
assert.equal(residualCleanupPlanPayload.leafId, current.current_cursor, "verify_current_residual_cleanup_must_not_change_current_leaf");
assert.equal(residualCleanupPlanPayload.branchOverride?.branch, "cleanup/v22-strict-monolith-residual-test-anchor-retirement", "verify_current_residual_cleanup_branch_override_mismatch");
assert.equal(residualCleanupPlanPayload.branchOverride?.suiteId, "strict-monolith-cleanup", "verify_current_residual_cleanup_suite_id_mismatch");
assertNotIncludes(
  residualCleanupPlanPayload.commands.join("\n"),
  "node scripts/smoke-test-v22-portal-ui-design-quality-audit.mjs",
  "verify_current_residual_cleanup_must_not_run_ui_authoring_gate",
);
assert.equal(residualCleanupPlanPayload.dryRun, true, "verify_current_residual_cleanup_dry_run_flag_mismatch");

const zeroCompatCleanupPlanResult = runVerify([
  "current",
  "--base",
  "origin/recovery/platform-v22-trunk",
  "--branch",
  "cleanup/v22-strict-monolith-zero-compat-active-surface",
  "--dry-run",
  "--json",
]);
assert.equal(zeroCompatCleanupPlanResult.status, 0, `verify_current_zero_compat_cleanup_dry_run_must_exit_zero:${zeroCompatCleanupPlanResult.stderr || zeroCompatCleanupPlanResult.stdout}`);
const zeroCompatCleanupPlanPayload = JSON.parse(zeroCompatCleanupPlanResult.stdout);
assert.equal(zeroCompatCleanupPlanPayload.ok, true, "verify_current_zero_compat_cleanup_dry_run_ok_mismatch");
assert.equal(zeroCompatCleanupPlanPayload.leafId, current.current_cursor, "verify_current_zero_compat_cleanup_must_not_change_current_leaf");
assert.equal(zeroCompatCleanupPlanPayload.branchOverride?.branch, "cleanup/v22-strict-monolith-zero-compat-active-surface", "verify_current_zero_compat_cleanup_branch_override_mismatch");
assert.equal(zeroCompatCleanupPlanPayload.branchOverride?.suiteId, "strict-monolith-cleanup", "verify_current_zero_compat_cleanup_suite_id_mismatch");
assertNotIncludes(
  zeroCompatCleanupPlanPayload.commands.join("\n"),
  "node scripts/smoke-test-v22-portal-ui-design-quality-audit.mjs",
  "verify_current_zero_compat_cleanup_must_not_run_ui_authoring_gate",
);
assert.equal(zeroCompatCleanupPlanPayload.dryRun, true, "verify_current_zero_compat_cleanup_dry_run_flag_mismatch");

const contractIndexCleanupPlanResult = runVerify([
  "current",
  "--base",
  "origin/recovery/platform-v22-trunk",
  "--branch",
  "cleanup/v22-zero-compat-contract-index-runtime-bridge-alignment",
  "--dry-run",
  "--json",
]);
assert.equal(contractIndexCleanupPlanResult.status, 0, `verify_current_contract_index_cleanup_dry_run_must_exit_zero:${contractIndexCleanupPlanResult.stderr || contractIndexCleanupPlanResult.stdout}`);
const contractIndexCleanupPlanPayload = JSON.parse(contractIndexCleanupPlanResult.stdout);
assert.equal(contractIndexCleanupPlanPayload.ok, true, "verify_current_contract_index_cleanup_dry_run_ok_mismatch");
assert.equal(contractIndexCleanupPlanPayload.leafId, current.current_cursor, "verify_current_contract_index_cleanup_must_not_change_current_leaf");
assert.equal(contractIndexCleanupPlanPayload.branchOverride?.branch, "cleanup/v22-zero-compat-contract-index-runtime-bridge-alignment", "verify_current_contract_index_cleanup_branch_override_mismatch");
assert.equal(contractIndexCleanupPlanPayload.branchOverride?.suiteId, "contract-index-runtime-bridge-alignment", "verify_current_contract_index_cleanup_suite_id_mismatch");
assert(contractIndexCleanupPlanPayload.commands.includes("node scripts/smoke-test-v22-saas-control-plane-user-experience-boundary.mjs"), "verify_current_contract_index_cleanup_must_run_ux_boundary");
assert(contractIndexCleanupPlanPayload.commands.includes("node scripts/smoke-test-v22-zero-compat-active-surface-gate.mjs"), "verify_current_contract_index_cleanup_must_run_zero_compat_gate");
assertNotIncludes(
  contractIndexCleanupPlanPayload.commands.join("\n"),
  "node scripts/smoke-test-v22-retire-resource-order-primary-path.mjs",
  "verify_current_contract_index_cleanup_must_not_run_resource_order_physical_branch_gate",
);
assertNotIncludes(
  contractIndexCleanupPlanPayload.commands.join("\n"),
  "node scripts/smoke-test-v22-portal-ui-design-quality-audit.mjs",
  "verify_current_contract_index_cleanup_must_not_run_ui_authoring_gate",
);
assert.equal(contractIndexCleanupPlanPayload.dryRun, true, "verify_current_contract_index_cleanup_dry_run_flag_mismatch");

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
