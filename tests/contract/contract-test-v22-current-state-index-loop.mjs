import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");

const files = {
  docsIndex: "docs/README.md",
  active: "docs/active/README.md",
  product: "docs/product/README.md",
  runtime: "docs/runtime/README.md",
  delivery: "docs/delivery/README.md",
  history: "docs/history/README.md",
  testsReadme: "tests/README.md",
  manifest: "tests/fixtures/v22/agent-verify-manifest.json",
  current: "tests/fixtures/v22/goal-current.json",
  packageDContract: "contracts/medopl-package-d-deploy-readiness.json",
  productionLaunchContract: "contracts/medopl-production-launch-gap-map.json",
};

const indexLoopGate = "node tests/contract/contract-test-v22-current-state-index-loop.mjs";
const landingCloseoutGate = "node tests/contract/contract-test-v22-landing-closeout-automation.mjs";

async function readRepoFile(repoPath) {
  return readFile(path.join(repoRoot, repoPath), "utf8");
}

async function readJson(repoPath) {
  return JSON.parse(await readRepoFile(repoPath));
}

function assertIncludes(source, expected, label) {
  assert(source.includes(expected), `${label}_missing:${expected}`);
}

function serializedLineCount(value) {
  return JSON.stringify(value ?? null, null, 2).split("\n").length;
}

function assertLandingCloseoutCheckPasses() {
  const result = spawnSync("node", [
    "scripts/v22-landing-closeout.mjs",
    "check",
    "--trunk-ref",
    "origin/recovery/platform-v22-trunk",
    "--json",
  ], {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: "pipe",
  });
  assert.equal(result.status, 0, `landing_closeout_check_failed:${result.stderr || result.stdout}`);
  return JSON.parse(result.stdout);
}

const [
  docsIndex,
  active,
  product,
  runtime,
  delivery,
  history,
  testsReadme,
  manifest,
  current,
  packageDContract,
  productionLaunchContract,
] = await Promise.all([
  readRepoFile(files.docsIndex),
  readRepoFile(files.active),
  readRepoFile(files.product),
  readRepoFile(files.runtime),
  readRepoFile(files.delivery),
  readRepoFile(files.history),
  readRepoFile(files.testsReadme),
  readJson(files.manifest),
  readJson(files.current),
  readJson(files.packageDContract),
  readJson(files.productionLaunchContract),
]);

const closeoutCheck = assertLandingCloseoutCheckPasses();
const latestCloseout = current.latest_landed_closeout;
assert(latestCloseout, "current_latest_landed_closeout_required");
const latestLandedCommit = latestCloseout.landed_commit;
const latestLandedBranch = latestCloseout.branch;
const currentCursor = current.current_cursor;

assert(currentCursor, "current_cursor_required");
assert.equal(current.next_leaf, currentCursor, "next_leaf_mismatch");

assertIncludes(docsIndex, "../tests/README.md", "docs_index_must_link_tests_taxonomy");
assertIncludes(docsIndex, "Truth Lookup", "docs_index_must_have_truth_lookup");
assertIncludes(docsIndex, "docs/README -> active truth -> product/runtime/framework -> specs/evidence/policies -> delivery -> tests/fixtures/manifest -> verify -> history closeout -> next cursor", "docs_index_must_define_loop");
for (const retired of [
  "docs/contracts/**",
  "docs/recovery/**",
  "scripts/smoke-test-*",
  "user_owned",
  "resource-order",
  "one-person-lab upstream",
]) {
  assertIncludes(docsIndex, retired, "docs_index_retired_entrypoint");
}

assertIncludes(docsIndex, "自治闭环按这个顺序运行", "docs_index_must_own_index_loop");
assertIncludes(active, indexLoopGate, "active_must_point_to_index_loop_gate");
assertIncludes(active, latestLandedCommit, "active_must_record_latest_landed_commit");
assertIncludes(active, latestLandedBranch, "active_must_record_latest_landed_branch");
assertIncludes(active, currentCursor, "active_must_record_current_cursor");
assertIncludes(active, "| current phase |", "active_must_record_current_phase_field");
assertIncludes(active, "| current blocker |", "active_must_record_current_blocker_field");
assertIncludes(delivery, currentCursor, "delivery_must_record_current_cursor");
assertIncludes(delivery, latestLandedBranch, "delivery_must_record_latest_landed_branch");
assertIncludes(delivery, latestLandedCommit, "delivery_must_record_latest_landed_commit");

assertIncludes(product, "Product Contract Groups", "product_contract_groups");
for (const anchor of [
  "spec-v22-mvp-managed-opl-loop",
  "spec-v22-resource-plan-boundary",
  "spec-v22-billing-freeze-boundary",
  "spec-v22-token-provider-boundary",
  "spec-v22-portal-files-billing-trace-boundary",
]) {
  assertIncludes(product, anchor, "product_must_link_spec_anchor");
}

assertIncludes(runtime, "Runtime Contract Groups", "runtime_contract_groups");
for (const anchor of [
  "spec-v22-portal-opl-connection-boundary",
  "spec-v22-upstream-opl-boundary",
  "spec-v22-runtime-bridge-session-run-file-provider-keyref-boundary",
  "spec-v22-real-opl-capability-canary-boundary",
  "spec-v22-cloud-onboarding-workflow-boundary",
]) {
  assertIncludes(runtime, anchor, "runtime_must_link_spec_anchor");
}

assertIncludes(testsReadme, "docs 负责解释 truth，tests/fixtures/manifest 负责防止 truth、cursor、history 和 eval 漂移", "tests_readme_must_close_loop");

assert.equal(current.last_landed_commit, latestLandedCommit, "current_last_landed_commit_mismatch");
assert.equal(current.base_trunk_head, latestLandedCommit, "current_base_trunk_head_mismatch");
assert.equal(current.last_landed_branch, latestLandedBranch, "current_last_landed_branch_mismatch");
assert.equal(current.history_latest_branch, latestLandedBranch, "current_history_latest_branch_mismatch");
assert.equal(current.post_merge_closeout_completed, true, "current_post_merge_closeout_must_be_completed");
assert.equal(latestCloseout.status, "landed / pushed / post-push verified", "latest_closeout_status_mismatch");
assert.equal(latestCloseout.landing_gate_result, "passed / ff-only landed / pushed", "latest_closeout_landing_gate_mismatch");
assert.equal(latestCloseout.post_merge_closeout, "completed", "latest_closeout_post_merge_mismatch");
assert.equal(latestCloseout.next_cursor, currentCursor, "latest_closeout_next_cursor_mismatch");
assert(Array.isArray(latestCloseout.post_push_verification), "latest_closeout_post_push_verification_must_be_array");
assert(latestCloseout.post_push_verification.length > 0, "latest_closeout_post_push_verification_required");
assert.equal(current.release_readiness_state.cursor_eligible, false, "release_readiness_must_not_be_cursor_eligible");
assert.equal(
  current.package_d_deploy_readiness_plan_ref?.contract_path,
  files.packageDContract,
  "current_must_point_to_package_d_contract",
);
assert.equal(
  current.production_launch_goal_gap_map_ref?.contract_path,
  files.productionLaunchContract,
  "current_must_point_to_production_launch_contract",
);
assert.equal(
  current.package_d_deploy_readiness_plan_ref?.owner_field,
  "package_d_deploy_readiness_plan",
  "package_d_contract_owner_field_mismatch",
);
assert.equal(
  current.production_launch_goal_gap_map_ref?.owner_field,
  "production_launch_goal_gap_map",
  "production_launch_contract_owner_field_mismatch",
);
assert.equal(
  packageDContract.schema_version,
  current.package_d_deploy_readiness_plan_ref?.schema_version,
  "package_d_contract_schema_mismatch",
);
assert.equal(
  productionLaunchContract.schema_version,
  current.production_launch_goal_gap_map_ref?.schema_version,
  "production_launch_contract_schema_mismatch",
);
assert.equal(
  Object.hasOwn(packageDContract, "package_d_deploy_readiness_plan"),
  true,
  "package_d_contract_payload_missing",
);
assert.equal(
  Object.hasOwn(productionLaunchContract, "production_launch_goal_gap_map"),
  true,
  "production_launch_contract_payload_missing",
);
for (const duplicatedPayload of [
  "package_d_deploy_readiness_plan",
  "production_launch_goal_gap_map",
]) {
  assert.equal(
    Object.hasOwn(current.release_readiness_state, duplicatedPayload),
    false,
    `release_readiness_state_must_not_duplicate_large_payload:${duplicatedPayload}`,
  );
}
assert(
  serializedLineCount(current.release_readiness_state) <= 120,
  `release_readiness_state_must_remain_compact:${serializedLineCount(current.release_readiness_state)}`,
);
for (const duplicatedPayload of [
  "package_d_deploy_readiness_plan",
  "production_launch_goal_gap_map",
]) {
  assert.equal(
    Object.hasOwn(current.current_leaf, duplicatedPayload),
    false,
    `current_leaf_must_not_duplicate_owner_payload:${duplicatedPayload}`,
  );
}
assert(
  serializedLineCount(current.current_leaf) <= 140,
  `current_leaf_must_remain_metadata_sized:${serializedLineCount(current.current_leaf)}`,
);
assert.equal(
  Object.hasOwn(current, "package_d_deploy_readiness_plan"),
  false,
  "current_must_not_embed_package_d_contract",
);
assert.equal(
  Object.hasOwn(current, "production_launch_goal_gap_map"),
  false,
  "current_must_not_embed_production_launch_contract",
);
assert.equal(closeoutCheck.lastLandedCommit, latestLandedCommit, "closeout_check_commit_mismatch");
assert.equal(closeoutCheck.lastLandedBranch, latestLandedBranch, "closeout_check_branch_mismatch");
assert.deepEqual(closeoutCheck.staleReadySections, [], "closeout_check_must_have_no_stale_ready_sections");
assert.equal(closeoutCheck.latestHistoryBranch, "", "closeout_check_must_not_parse_history_branch");
assert.equal(closeoutCheck.latestHistoryLandedCommit, "", "closeout_check_must_not_parse_history_commit");

const leaf = manifest.leaves.find((item) => item.leaf_id === current.current_cursor);
assert(leaf, `manifest_current_leaf_missing:${current.current_cursor}`);
assert.deepEqual(
  manifest.leaves.map((item) => item.leaf_id),
  [current.current_cursor],
  "manifest_leaves_must_only_hold_current_cursor",
);
assert.deepEqual(leaf.verification_commands, current.current_leaf.verification_commands, "current_leaf_commands_mismatch");
assert(leaf.verification_commands.includes(indexLoopGate), "current_leaf_must_run_index_loop_gate");
assert(leaf.verification_commands.includes("node tests/contract/contract-test-v22-cleanup-lifecycle-system.mjs"), "current_leaf_must_run_lifecycle_gate");
assert(leaf.verification_commands.includes(landingCloseoutGate), "current_leaf_must_run_landing_closeout_gate");

const currentSuite = manifest.suites.find((suite) => suite.id === "current");
const localContractSuite = manifest.suites.find((suite) => suite.id === "local-contract");
const historyCloseoutSuite = manifest.suites.find((suite) => suite.id === "history-closeout");
assert(currentSuite, "current_suite_missing");
assert(localContractSuite, "local_contract_suite_missing");
assert(historyCloseoutSuite, "history_closeout_suite_missing");
assert.deepEqual(currentSuite.commands, leaf.verification_commands, "current_suite_must_match_leaf_commands");
assert(currentSuite.commands.includes(indexLoopGate), "current_suite_must_run_index_loop_gate");
assert(localContractSuite.commands.includes(indexLoopGate), "local_contract_must_run_index_loop_gate");
assert(localContractSuite.commands.includes(landingCloseoutGate), "local_contract_must_run_landing_closeout_gate");
assert.deepEqual(historyCloseoutSuite.commands, [landingCloseoutGate, indexLoopGate], "history_closeout_suite_must_run_landing_and_index_loop_gates");

assert.equal(current.last_landed_commit, latestLandedCommit, "history_current_commit_must_match_goal");
assertIncludes(history, "Owner: `MedOPL`", "history_must_record_owner");
assertIncludes(history, "Purpose: `history_archive_index`", "history_must_record_purpose");
assertIncludes(history, "Machine boundary:", "history_must_record_machine_boundary");
assertIncludes(history, "tests/fixtures/v22/goal-current.json", "history_must_point_to_machine_cursor");
assertIncludes(history, "changes/archive/", "history_must_point_to_archive");
assert.equal(/^###\s+\d{4}-\d{2}-\d{2}\s+/mu.test(history), false, "history_must_not_store_run_sections_as_machine_database");

console.log(JSON.stringify({
  ok: true,
  contract: "v22_current_state_index_loop",
  currentCursor,
  latestLandedCommit,
  latestLandedBranch,
  gate: indexLoopGate,
}, null, 2));
