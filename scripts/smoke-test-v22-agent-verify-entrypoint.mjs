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
const portalUiTruthOverride = manifest.branch_override_suites.find((suite) => suite.id === "portal-ui-contract-truth-convergence");
assert(portalUiTruthOverride, "portal_ui_truth_convergence_branch_override_missing");
assert.equal(portalUiTruthOverride.branch, "cleanup/v22-portal-old-ui-smoke-residue-cleanup", "portal_ui_truth_convergence_override_branch_mismatch");
assert.deepEqual(portalUiTruthOverride.branches, [
  "cleanup/v22-portal-ui-contract-truth-convergence",
  "cleanup/v22-portal-old-ui-smoke-residue-cleanup",
], "portal_ui_truth_convergence_override_branches_mismatch");
assertIncludes(portalUiTruthOverride.reason, `current product cursor remains ${current.current_cursor}`, "portal_ui_truth_convergence_override_reason_current_truth");
assert(portalUiTruthOverride.commands.includes("node scripts/smoke-test-v22-archive-smoke-contract-physical-retirement-gate.mjs"), "portal_ui_truth_convergence_override_must_include_retired_frontend_gate");
assertNotIncludes(portalUiTruthOverride.commands.join("\n"), "npm --prefix services/portal/frontend run build", "portal_ui_truth_convergence_override_must_not_run_build");

const strictCleanupOverride = manifest.branch_override_suites.find((suite) => suite.id === "strict-monolith-cleanup");
assert(strictCleanupOverride, "strict_monolith_cleanup_branch_override_missing");
assert.equal(strictCleanupOverride.branch, "cleanup/v22-strict-monolith-ideal-gap-and-legacy-retirement", "strict_monolith_cleanup_override_branch_mismatch");
assert.deepEqual(strictCleanupOverride.branches, [
  "cleanup/v22-strict-monolith-ideal-gap-and-legacy-retirement",
  "cleanup/v22-strict-monolith-residual-test-anchor-retirement",
  "cleanup/v22-strict-monolith-zero-compat-active-surface",
], "strict_monolith_cleanup_override_branches_mismatch");
assertIncludes(strictCleanupOverride.reason, `current product cursor remains ${current.current_cursor}`, "strict_monolith_cleanup_override_reason_current_truth");
assertIncludes(strictCleanupOverride.reason, "without weakening the UI authoring gate", "strict_monolith_cleanup_override_reason_no_ui_gate_weakening");
assertNotIncludes(strictCleanupOverride.commands.join("\n"), "node scripts/smoke-test-v22-portal-ui-design-quality-audit.mjs", "strict_monolith_cleanup_override_must_not_run_ui_authoring_gate");
assert(strictCleanupOverride.commands.includes("node scripts/smoke-test-v22-observability-billing-narrative-boundary.mjs"), "strict_monolith_cleanup_override_must_include_observability_boundary");
assert(strictCleanupOverride.commands.includes("node scripts/smoke-test-v22-archive-smoke-contract-physical-retirement-gate.mjs"), "strict_monolith_cleanup_override_must_include_archive_physical_retirement_gate");
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
assertIncludes(contractIndexCleanupOverride.reason, `current product cursor remains ${current.current_cursor}`, "contract_index_cleanup_override_reason_current_truth");
assertIncludes(contractIndexCleanupOverride.reason, "without weakening the UI authoring gate", "contract_index_cleanup_override_reason_no_ui_gate_weakening");
assert(contractIndexCleanupOverride.commands.includes("node scripts/smoke-test-v22-saas-control-plane-user-experience-boundary.mjs"), "contract_index_cleanup_override_must_include_ux_boundary");
assert(contractIndexCleanupOverride.commands.includes("node scripts/smoke-test-v22-zero-compat-active-surface-gate.mjs"), "contract_index_cleanup_override_must_include_zero_compat_gate");
assert(contractIndexCleanupOverride.commands.includes("node scripts/smoke-test-v22-archive-smoke-contract-physical-retirement-gate.mjs"), "contract_index_cleanup_override_must_include_archive_physical_retirement_gate");
assertNotIncludes(contractIndexCleanupOverride.commands.join("\n"), "node scripts/smoke-test-v22-portal-ui-design-quality-audit.mjs", "contract_index_cleanup_override_must_not_run_ui_authoring_gate");
assertNotIncludes(contractIndexCleanupOverride.commands.join("\n"), "node scripts/smoke-test-v22-retire-resource-order-primary-path.mjs", "contract_index_cleanup_override_must_not_run_deleted_resource_order_physical_branch_gate");

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
assert.equal(planPayload.branchOverride, undefined, "verify_current_feature_branch_must_not_use_cleanup_override");
assert.deepEqual(planPayload.commands, currentLeaf.verification_commands, "verify_current_commands_mismatch");
assert.deepEqual(planPayload.allowedFiles, currentLeaf.allowed_files, "verify_current_allowed_files_mismatch");
assert.deepEqual(planPayload.forbiddenFiles, currentLeaf.forbidden_files, "verify_current_forbidden_files_mismatch");
assert.equal(planPayload.dryRun, true, "verify_current_dry_run_flag_mismatch");

const portalUiTruthPlanResult = runVerify([
  "current",
  "--base",
  "origin/recovery/platform-v22-trunk",
  "--branch",
  "cleanup/v22-portal-old-ui-smoke-residue-cleanup",
  "--dry-run",
  "--json",
]);
assert.equal(portalUiTruthPlanResult.status, 0, `verify_current_portal_ui_truth_dry_run_must_exit_zero:${portalUiTruthPlanResult.stderr || portalUiTruthPlanResult.stdout}`);
const portalUiTruthPlanPayload = JSON.parse(portalUiTruthPlanResult.stdout);
assert.equal(portalUiTruthPlanPayload.ok, true, "verify_current_portal_ui_truth_dry_run_ok_mismatch");
assert.equal(portalUiTruthPlanPayload.mode, "current", "verify_current_portal_ui_truth_mode_mismatch");
assert.equal(portalUiTruthPlanPayload.leafId, current.current_cursor, "verify_current_portal_ui_truth_must_not_change_current_leaf");
assert.equal(portalUiTruthPlanPayload.branchOverride?.suiteId, "portal-ui-contract-truth-convergence", "verify_current_portal_ui_truth_branch_override_mismatch");
assert.deepEqual(portalUiTruthPlanPayload.commands, portalUiTruthOverride.commands, "verify_current_portal_ui_truth_commands_mismatch");
assert.deepEqual(portalUiTruthPlanPayload.allowedFiles, portalUiTruthOverride.allowed_files, "verify_current_portal_ui_truth_allowed_files_mismatch");
assert.deepEqual(portalUiTruthPlanPayload.forbiddenFiles, portalUiTruthOverride.forbidden_files, "verify_current_portal_ui_truth_forbidden_files_mismatch");
assert.equal(portalUiTruthPlanPayload.dryRun, true, "verify_current_portal_ui_truth_dry_run_flag_mismatch");

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
  "node scripts/smoke-test-v22-archive-smoke-contract-physical-retirement-gate.mjs",
  "node scripts/smoke-test-v22-default-entry-narrative-gate.mjs",
  "node scripts/smoke-test-v22-observability-billing-narrative-boundary.mjs",
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
assert(contractIndexCleanupPlanPayload.commands.includes("node scripts/smoke-test-v22-archive-smoke-contract-physical-retirement-gate.mjs"), "verify_current_contract_index_cleanup_must_run_archive_physical_retirement_gate");
assertNotIncludes(
  contractIndexCleanupPlanPayload.commands.join("\n"),
  "node scripts/smoke-test-v22-retire-resource-order-primary-path.mjs",
  "verify_current_contract_index_cleanup_must_not_run_deleted_resource_order_physical_branch_gate",
);
assertNotIncludes(
  contractIndexCleanupPlanPayload.commands.join("\n"),
  "node scripts/smoke-test-v22-portal-ui-design-quality-audit.mjs",
  "verify_current_contract_index_cleanup_must_not_run_ui_authoring_gate",
);
assert.equal(contractIndexCleanupPlanPayload.dryRun, true, "verify_current_contract_index_cleanup_dry_run_flag_mismatch");

const contractSmokeEvalIndexCompactionOverride = manifest.branch_override_suites.find((suite) => suite.id === "contract-smoke-eval-index-compaction");
assert(contractSmokeEvalIndexCompactionOverride, "contract_smoke_eval_index_compaction_override_missing");
assert.equal(contractSmokeEvalIndexCompactionOverride.branch, "cleanup/v22-contract-smoke-eval-index-compaction", "contract_smoke_eval_index_compaction_branch_mismatch");
assert.deepEqual(contractSmokeEvalIndexCompactionOverride.branches, [
  "cleanup/v22-contract-smoke-eval-index-compaction",
], "contract_smoke_eval_index_compaction_branches_mismatch");
assertIncludes(contractSmokeEvalIndexCompactionOverride.reason, `current product cursor remains ${current.current_cursor}`, "contract_smoke_eval_index_compaction_reason_current_truth");
assert(contractSmokeEvalIndexCompactionOverride.commands.includes("node scripts/smoke-test-v22-contract-smoke-eval-index-compaction.mjs"), "contract_smoke_eval_index_compaction_must_run_own_gate");
assert(contractSmokeEvalIndexCompactionOverride.commands.includes("node scripts/smoke-test-v22-smoke-classification-gate.mjs"), "contract_smoke_eval_index_compaction_must_run_classification_gate");
assert(contractSmokeEvalIndexCompactionOverride.commands.includes("node scripts/smoke-test-v22-smoke-eval-boundary.mjs"), "contract_smoke_eval_index_compaction_must_run_boundary_gate");
assert(contractSmokeEvalIndexCompactionOverride.forbidden_files.includes("services/*"), "contract_smoke_eval_index_compaction_must_forbid_services");
assert(contractSmokeEvalIndexCompactionOverride.forbidden_ops.includes("postgres-redis-implementation"), "contract_smoke_eval_index_compaction_must_forbid_postgres_redis");

const contractSmokeEvalIndexCompactionPlanResult = runVerify([
  "current",
  "--base",
  "origin/recovery/platform-v22-trunk",
  "--branch",
  "cleanup/v22-contract-smoke-eval-index-compaction",
  "--dry-run",
  "--json",
]);
assert.equal(contractSmokeEvalIndexCompactionPlanResult.status, 0, `verify_current_contract_smoke_eval_index_compaction_dry_run_must_exit_zero:${contractSmokeEvalIndexCompactionPlanResult.stderr || contractSmokeEvalIndexCompactionPlanResult.stdout}`);
const contractSmokeEvalIndexCompactionPlanPayload = JSON.parse(contractSmokeEvalIndexCompactionPlanResult.stdout);
assert.equal(contractSmokeEvalIndexCompactionPlanPayload.ok, true, "verify_current_contract_smoke_eval_index_compaction_dry_run_ok_mismatch");
assert.equal(contractSmokeEvalIndexCompactionPlanPayload.leafId, current.current_cursor, "verify_current_contract_smoke_eval_index_compaction_must_not_change_current_leaf");
assert.equal(contractSmokeEvalIndexCompactionPlanPayload.branchOverride?.suiteId, "contract-smoke-eval-index-compaction", "verify_current_contract_smoke_eval_index_compaction_suite_id_mismatch");
assert.deepEqual(contractSmokeEvalIndexCompactionPlanPayload.commands, contractSmokeEvalIndexCompactionOverride.commands, "verify_current_contract_smoke_eval_index_compaction_commands_mismatch");
assert.deepEqual(contractSmokeEvalIndexCompactionPlanPayload.allowedFiles, contractSmokeEvalIndexCompactionOverride.allowed_files, "verify_current_contract_smoke_eval_index_compaction_allowed_files_mismatch");
assert.equal(contractSmokeEvalIndexCompactionPlanPayload.dryRun, true, "verify_current_contract_smoke_eval_index_compaction_dry_run_flag_mismatch");

const post20fe9acOverride = manifest.branch_override_suites.find((suite) => suite.id === "post-20fe9ac-agent-workflow-truth-and-repo-classification");
assert(post20fe9acOverride, "post_20fe9ac_agent_workflow_truth_override_missing");
assert.equal(post20fe9acOverride.branch, "cleanup/v22-post-20fe9ac-agent-workflow-truth-and-repo-classification", "post_20fe9ac_branch_mismatch");
assert.deepEqual(post20fe9acOverride.branches, [
  "cleanup/v22-post-20fe9ac-agent-workflow-truth-and-repo-classification",
], "post_20fe9ac_branches_mismatch");
assertIncludes(post20fe9acOverride.reason, `current product cursor remains ${current.current_cursor}`, "post_20fe9ac_reason_current_truth");
assert(post20fe9acOverride.commands.includes("node scripts/smoke-test-v22-post-20fe9ac-agent-workflow-truth-and-repo-classification.mjs"), "post_20fe9ac_must_run_own_gate");
assert(post20fe9acOverride.commands.includes("node scripts/smoke-test-v22-goal-state-consistency.mjs"), "post_20fe9ac_must_run_goal_state_gate");
assert(post20fe9acOverride.commands.includes("node scripts/smoke-test-v22-agent-run-record-gate.mjs"), "post_20fe9ac_must_run_agent_record_gate");
assert(post20fe9acOverride.allowed_files.includes("docs/recovery/v22-post-20fe9ac-agent-workflow-truth-and-repo-classification-index.md"), "post_20fe9ac_must_allow_index");
assert(post20fe9acOverride.allowed_files.includes("docs/recovery/agent-runs/2026-05-20-cleanup-v22-contract-smoke-eval-index-compaction.md"), "post_20fe9ac_must_allow_absorbed_run");
assert(post20fe9acOverride.forbidden_files.includes("services/*"), "post_20fe9ac_must_forbid_services");
assert(post20fe9acOverride.forbidden_ops.includes("ff-only-absorb"), "post_20fe9ac_must_forbid_absorb_in_a_window");
assert(post20fe9acOverride.forbidden_ops.includes("git-push"), "post_20fe9ac_must_forbid_push_in_a_window");

const post20fe9acPlanResult = runVerify([
  "current",
  "--base",
  "origin/recovery/platform-v22-trunk",
  "--branch",
  "cleanup/v22-post-20fe9ac-agent-workflow-truth-and-repo-classification",
  "--dry-run",
  "--json",
]);
assert.equal(post20fe9acPlanResult.status, 0, `verify_current_post_20fe9ac_dry_run_must_exit_zero:${post20fe9acPlanResult.stderr || post20fe9acPlanResult.stdout}`);
const post20fe9acPlanPayload = JSON.parse(post20fe9acPlanResult.stdout);
assert.equal(post20fe9acPlanPayload.ok, true, "verify_current_post_20fe9ac_dry_run_ok_mismatch");
assert.equal(post20fe9acPlanPayload.leafId, current.current_cursor, "verify_current_post_20fe9ac_must_not_change_current_leaf");
assert.equal(post20fe9acPlanPayload.branchOverride?.suiteId, "post-20fe9ac-agent-workflow-truth-and-repo-classification", "verify_current_post_20fe9ac_suite_id_mismatch");
assert.deepEqual(post20fe9acPlanPayload.commands, post20fe9acOverride.commands, "verify_current_post_20fe9ac_commands_mismatch");
assert.deepEqual(post20fe9acPlanPayload.allowedFiles, post20fe9acOverride.allowed_files, "verify_current_post_20fe9ac_allowed_files_mismatch");
assert.equal(post20fe9acPlanPayload.dryRun, true, "verify_current_post_20fe9ac_dry_run_flag_mismatch");

const truthRepoOverride = manifest.branch_override_suites.find((suite) => suite.id === "truth-repo-narrative-reference-unification");
assert(truthRepoOverride, "truth_repo_narrative_reference_unification_override_missing");
assert.equal(truthRepoOverride.branch, "cleanup/v22-truth-repo-narrative-reference-unification", "truth_repo_branch_mismatch");
assert.deepEqual(truthRepoOverride.branches, [
  "cleanup/v22-truth-repo-narrative-reference-unification",
], "truth_repo_branches_mismatch");
assertIncludes(truthRepoOverride.reason, `current product cursor remains ${current.current_cursor}`, "truth_repo_reason_current_truth");
assert(truthRepoOverride.commands.includes("node scripts/smoke-test-v22-truth-repo-narrative-reference-unification.mjs"), "truth_repo_must_run_own_gate");
assert(truthRepoOverride.commands.includes("node scripts/smoke-test-v22-post-20fe9ac-agent-workflow-truth-and-repo-classification.mjs"), "truth_repo_must_run_post_20fe9ac_gate");
assert(truthRepoOverride.commands.includes("node scripts/smoke-test-v22-long-term-governance-surfaces.mjs"), "truth_repo_must_run_governance_gate");
assert(truthRepoOverride.commands.includes("node scripts/smoke-test-v22-agent-run-record-gate.mjs"), "truth_repo_must_run_agent_record_gate");
assert(truthRepoOverride.allowed_files.includes("docs/recovery/v22-truth-repo-narrative-reference-unification-index.md"), "truth_repo_must_allow_index");
assert(truthRepoOverride.allowed_files.includes("docs/recovery/agent-runs/2026-05-20-cleanup-v22-truth-repo-narrative-reference-unification.md"), "truth_repo_must_allow_run");
assert(truthRepoOverride.allowed_files.includes("scripts/smoke-test-v22-truth-repo-narrative-reference-unification.mjs"), "truth_repo_must_allow_gate");
assert(truthRepoOverride.forbidden_files.includes("services/*"), "truth_repo_must_forbid_services");
assert(truthRepoOverride.forbidden_ops.includes("ff-only-absorb"), "truth_repo_must_forbid_absorb_in_a_window");
assert(truthRepoOverride.forbidden_ops.includes("git-push"), "truth_repo_must_forbid_push_in_a_window");

const truthRepoPlanResult = runVerify([
  "current",
  "--base",
  "origin/recovery/platform-v22-trunk",
  "--branch",
  "cleanup/v22-truth-repo-narrative-reference-unification",
  "--dry-run",
  "--json",
]);
assert.equal(truthRepoPlanResult.status, 0, `verify_current_truth_repo_dry_run_must_exit_zero:${truthRepoPlanResult.stderr || truthRepoPlanResult.stdout}`);
const truthRepoPlanPayload = JSON.parse(truthRepoPlanResult.stdout);
assert.equal(truthRepoPlanPayload.ok, true, "verify_current_truth_repo_dry_run_ok_mismatch");
assert.equal(truthRepoPlanPayload.leafId, current.current_cursor, "verify_current_truth_repo_must_not_change_current_leaf");
assert.equal(truthRepoPlanPayload.branchOverride?.suiteId, "truth-repo-narrative-reference-unification", "verify_current_truth_repo_suite_id_mismatch");
assert.deepEqual(truthRepoPlanPayload.commands, truthRepoOverride.commands, "verify_current_truth_repo_commands_mismatch");
assert.deepEqual(truthRepoPlanPayload.allowedFiles, truthRepoOverride.allowed_files, "verify_current_truth_repo_allowed_files_mismatch");
assert.equal(truthRepoPlanPayload.dryRun, true, "verify_current_truth_repo_dry_run_flag_mismatch");

const monolithEntryTraceOverride = manifest.branch_override_suites.find((suite) => suite.id === "monolith-agent-workflow-entrypoint-and-trace-normalization");
assert(monolithEntryTraceOverride, "monolith_entry_trace_override_missing");
assert.equal(monolithEntryTraceOverride.branch, "cleanup/v22-monolith-agent-workflow-entrypoint-and-trace-normalization", "monolith_entry_trace_branch_mismatch");
assert.deepEqual(monolithEntryTraceOverride.branches, [
  "cleanup/v22-monolith-agent-workflow-entrypoint-and-trace-normalization",
], "monolith_entry_trace_branches_mismatch");
assertIncludes(monolithEntryTraceOverride.reason, `current product cursor remains ${current.current_cursor}`, "monolith_entry_trace_reason_current_truth");
assert(monolithEntryTraceOverride.commands.includes("node scripts/smoke-test-v22-monolith-agent-workflow-entrypoint-and-trace-normalization.mjs"), "monolith_entry_trace_must_run_own_gate");
assert(monolithEntryTraceOverride.commands.includes("node scripts/smoke-test-v22-agent-run-record-gate.mjs"), "monolith_entry_trace_must_run_agent_record_gate");
assert(monolithEntryTraceOverride.commands.includes("node scripts/smoke-test-v22-smoke-classification-gate.mjs"), "monolith_entry_trace_must_run_classification_gate");
assert(monolithEntryTraceOverride.allowed_files.includes("docs/recovery/agent-runs/README.md"), "monolith_entry_trace_must_allow_agent_runs_readme");
assert(monolithEntryTraceOverride.allowed_files.includes("docs/recovery/agent-runs/schema.md"), "monolith_entry_trace_must_allow_agent_runs_schema");
assert(monolithEntryTraceOverride.allowed_files.includes("docs/recovery/v22-monolith-agent-workflow-entrypoint-and-trace-normalization-index.md"), "monolith_entry_trace_must_allow_index");
assert(monolithEntryTraceOverride.allowed_files.includes("scripts/smoke-test-v22-monolith-agent-workflow-entrypoint-and-trace-normalization.mjs"), "monolith_entry_trace_must_allow_gate");
assert(monolithEntryTraceOverride.forbidden_files.includes("services/*"), "monolith_entry_trace_must_forbid_services");
assert(monolithEntryTraceOverride.forbidden_ops.includes("ff-only-absorb"), "monolith_entry_trace_must_forbid_absorb_in_a_window");
assert(monolithEntryTraceOverride.forbidden_ops.includes("git-push"), "monolith_entry_trace_must_forbid_push_in_a_window");

const monolithEntryTracePlanResult = runVerify([
  "current",
  "--base",
  "origin/recovery/platform-v22-trunk",
  "--branch",
  "cleanup/v22-monolith-agent-workflow-entrypoint-and-trace-normalization",
  "--dry-run",
  "--json",
]);
assert.equal(monolithEntryTracePlanResult.status, 0, `verify_current_monolith_entry_trace_dry_run_must_exit_zero:${monolithEntryTracePlanResult.stderr || monolithEntryTracePlanResult.stdout}`);
const monolithEntryTracePlanPayload = JSON.parse(monolithEntryTracePlanResult.stdout);
assert.equal(monolithEntryTracePlanPayload.ok, true, "verify_current_monolith_entry_trace_dry_run_ok_mismatch");
assert.equal(monolithEntryTracePlanPayload.leafId, current.current_cursor, "verify_current_monolith_entry_trace_must_not_change_current_leaf");
assert.equal(monolithEntryTracePlanPayload.branchOverride?.suiteId, "monolith-agent-workflow-entrypoint-and-trace-normalization", "verify_current_monolith_entry_trace_suite_id_mismatch");
assert.deepEqual(monolithEntryTracePlanPayload.commands, monolithEntryTraceOverride.commands, "verify_current_monolith_entry_trace_commands_mismatch");
assert.deepEqual(monolithEntryTracePlanPayload.allowedFiles, monolithEntryTraceOverride.allowed_files, "verify_current_monolith_entry_trace_allowed_files_mismatch");
assert.equal(monolithEntryTracePlanPayload.dryRun, true, "verify_current_monolith_entry_trace_dry_run_flag_mismatch");

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
