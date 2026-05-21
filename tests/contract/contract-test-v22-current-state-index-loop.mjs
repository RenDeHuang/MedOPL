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
};

const previousIndexLoopCommit = "2e644fc774e567db9418e3d13942e1598434433e";
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

function sectionAfter(source, heading) {
  const start = source.indexOf(heading);
  assert(start >= 0, `section_missing:${heading}`);
  const next = source.indexOf("\n### ", start + heading.length);
  return next >= 0 ? source.slice(start, next) : source.slice(start);
}

function parseHistorySections(history) {
  const matches = [...history.matchAll(/^###\s+\d{4}-\d{2}-\d{2}\s+(.+)$/gmu)];
  return matches.map((match, index) => {
    const start = match.index;
    const end = index + 1 < matches.length ? matches[index + 1].index : history.length;
    const source = history.slice(start, end);
    const branch = source.match(/^Branch:\s*`([^`]+)`/mu)?.[1] || match[1].trim();
    const status = source.match(/^Status:\s*`([^`]+)`/mu)?.[1] || "";
    const landedCommit = source.match(/^landed_commit:\s*`([a-f0-9]{40})`/mu)?.[1] || "";
    const nextCursor = source.match(/^next_cursor:\s*`([^`]+)`/mu)?.[1] || "";
    return { branch, status, landedCommit, nextCursor, source };
  });
}

function latestLandedHistorySection(history) {
  const section = parseHistorySections(history).find((item) => item.status === "landed / pushed / post-push verified" && item.landedCommit);
  assert(section, "latest_landed_history_section_missing");
  return section;
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
]);

const latestLanded = latestLandedHistorySection(history);
const closeoutCheck = assertLandingCloseoutCheckPasses();
const latestLandedCommit = latestLanded.landedCommit;
const latestLandedBranch = latestLanded.branch;
const currentCursor = current.current_cursor;

assert(currentCursor, "current_cursor_required");
assert.equal(current.next_leaf, currentCursor, "next_leaf_mismatch");

assertIncludes(docsIndex, "../tests/README.md", "docs_index_must_link_tests_taxonomy");
assertIncludes(docsIndex, "Truth Lookup", "docs_index_must_have_truth_lookup");
assertIncludes(docsIndex, "docs/README -> active truth -> specs/policies -> delivery -> tests/fixtures/manifest -> verify -> history closeout -> next cursor", "docs_index_must_define_loop");
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

assertIncludes(active, "Index loop", "active_gap_matrix_must_include_index_loop");
assertIncludes(active, indexLoopGate, "active_must_point_to_index_loop_gate");
assertIncludes(active, latestLandedCommit, "active_must_record_latest_landed_commit");
assertIncludes(active, latestLandedBranch, "active_must_record_latest_landed_branch");
assertIncludes(active, currentCursor, "active_must_record_current_cursor");
assertIncludes(delivery, currentCursor, "delivery_must_record_current_cursor");

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
assert.equal(current.release_readiness_state.cursor_eligible, false, "release_readiness_must_not_be_cursor_eligible");
assert.equal(closeoutCheck.lastLandedCommit, latestLandedCommit, "closeout_check_commit_mismatch");
assert.equal(closeoutCheck.lastLandedBranch, latestLandedBranch, "closeout_check_branch_mismatch");
assert.deepEqual(closeoutCheck.staleReadySections, [], "closeout_check_must_have_no_stale_ready_sections");

const leaf = manifest.leaves.find((item) => item.leaf_id === current.current_cursor);
assert(leaf, `manifest_current_leaf_missing:${current.current_cursor}`);
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

const latestRunSection = latestLanded.source;
for (const expected of [
  "Status: `landed / pushed / post-push verified`",
  `landed_commit: \`${latestLandedCommit}\``,
  "landing_gate_result: `passed / ff-only landed / pushed`",
  "post_push_verification:",
  "post_merge_closeout: `completed`",
  `next_cursor: \`${currentCursor}\``,
]) {
  assertIncludes(latestRunSection, expected, "history_lifecycle_closeout");
}
assert.equal(latestRunSection.includes("Status: `ready_for_landing_review`"), false, "landed_history_must_not_be_ready_for_landing_review");
assertIncludes(latestRunSection, "post_merge_closeout: `completed`", "history_latest_run_closeout");
assert.equal(current.last_landed_commit, latestLandedCommit, "history_current_commit_must_match_goal");

const previousRunSection = sectionAfter(history, "### 2026-05-21 cleanup/v22-current-state-index-loop-normalization");
assertIncludes(previousRunSection, `landed_commit: \`${previousIndexLoopCommit}\``, "previous_index_loop_commit_must_stay_true");

console.log(JSON.stringify({
  ok: true,
  contract: "v22_current_state_index_loop",
  currentCursor,
  latestLandedCommit,
  latestLandedBranch,
  gate: indexLoopGate,
}, null, 2));
