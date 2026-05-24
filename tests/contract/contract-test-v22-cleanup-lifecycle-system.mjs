import assert from "node:assert/strict";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");

const lifecycleGate = "node tests/contract/contract-test-v22-cleanup-lifecycle-system.mjs";
const landingCloseoutGate = "node tests/contract/contract-test-v22-landing-closeout-automation.mjs";
const hardCleanupCommit = "2a4254915f43186e312f406e5de31629c1c6700b";
const lifecycleClosureCommit = "3ca2ee48f55bb154776c60605a497d9a2e7e1752";
const currentStateIndexLoopCommit = "2e644fc774e567db9418e3d13942e1598434433e";

function repoPath(...parts) {
  return parts.join("/");
}

const docsTaxonomyDirs = [
  "active",
  "product",
  "runtime",
  "framework",
  "specs",
  "evidence",
  "policies",
  "delivery",
  "source",
  "public",
  "references",
  "history",
];

const testsTaxonomyDirs = [
  "health",
  "smoke",
  "contract",
  "regression",
  "local-rc",
  "future-authorized",
  "fixtures",
];

const forbiddenPaths = [
  repoPath("docs", "contracts"),
  repoPath("docs", "recovery"),
  repoPath("docs", "product.md"),
  repoPath("docs", "architecture.md"),
  repoPath("docs", "status.md"),
  repoPath("docs", "invariants.md"),
  repoPath("docs", "decisions.md"),
  repoPath("docs", "vibe-coding.md"),
];

async function exists(repoPath) {
  try {
    await stat(path.join(repoRoot, repoPath));
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

async function listFiles(rootPath) {
  if (!(await exists(rootPath))) return [];
  const entries = await readdir(path.join(repoRoot, rootPath), { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const repoPath = `${rootPath}/${entry.name}`.replaceAll("\\", "/");
    if (entry.isDirectory()) {
      if ([".git", "node_modules", ".runtime", "dist", "coverage"].includes(entry.name)) continue;
      files.push(...await listFiles(repoPath));
    } else if (entry.isFile()) {
      files.push(repoPath);
    }
  }
  return files.sort();
}

async function readRepoFile(repoPath) {
  return readFile(path.join(repoRoot, repoPath), "utf8");
}

async function readJson(repoPath) {
  return JSON.parse(await readRepoFile(repoPath));
}

function assertIncludesAll(source, phrases, label) {
  for (const phrase of phrases) {
    assert(source.includes(phrase), `${label}_missing:${phrase}`);
  }
}

function assertNotIncludes(source, phrase, label) {
  assert.equal(source.includes(phrase), false, `${label}_must_not_include:${phrase}`);
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
  const section = parseHistorySections(history).findLast((item) => item.status === "landed / pushed / post-push verified" && item.landedCommit);
  assert(section, "latest_landed_history_section_missing");
  return section;
}

function latestHistorySectionForCursor(history, cursor) {
  const section = parseHistorySections(history).findLast((item) => item.nextCursor === cursor);
  assert(section, `history_current_cursor_handoff_missing:${cursor}`);
  return section;
}

for (const repoPath of forbiddenPaths) {
  assert.equal(await exists(repoPath), false, `cleanup_path_must_not_exist:${repoPath}`);
}

assert.equal(await exists("docs/README.md"), true, "docs_root_readme_required");
for (const dir of docsTaxonomyDirs) {
  const files = await listFiles(`docs/${dir}`);
  assert.deepEqual(files, [`docs/${dir}/README.md`], `docs_taxonomy_dir_must_only_contain_readme:${dir}`);
}

for (const dir of testsTaxonomyDirs) {
  assert.equal(await exists(`tests/${dir}`), true, `tests_taxonomy_dir_missing:${dir}`);
}

const scriptFiles = await listFiles("scripts");
assert.deepEqual(scriptFiles, [
  "scripts/v22-landing-closeout.mjs",
  "scripts/v22-line-budget.mjs",
  "scripts/v22-repo-bloat-audit.mjs",
  "scripts/v22-repo-hygiene.mjs",
  "scripts/v22-test-classification.mjs",
  "scripts/v22-verify.mjs",
  "scripts/v22-workflow-gate.mjs",
], "scripts_must_remain_v22_control_plane_only");
assert.equal(scriptFiles.some((file) => /^scripts\/smoke-test-v22-.*\.mjs$/u.test(file)), false, "legacy_smoke_script_must_not_return");

const [
  active,
  specs,
  policies,
  history,
  testsReadme,
  verifySource,
  manifest,
  current,
] = await Promise.all([
  readRepoFile("docs/active/README.md"),
  readRepoFile("docs/specs/README.md"),
  readRepoFile("docs/policies/README.md"),
  readRepoFile("docs/history/README.md"),
  readRepoFile("tests/README.md"),
  readRepoFile("scripts/v22-verify.mjs"),
  readJson("tests/fixtures/v22/agent-verify-manifest.json"),
  readJson("tests/fixtures/v22/goal-current.json"),
]);
const latestLanded = latestLandedHistorySection(history);
const latestLandedCommit = latestLanded.landedCommit;
const currentCursor = current.current_cursor;
const currentCursorSection = latestHistorySectionForCursor(history, currentCursor);

assertIncludesAll(active, [
  lifecycleGate,
], "active_lifecycle_current_pointer");
assertIncludesAll(policies, [
  "Cleanup Lifecycle Policy",
  "truth -> gap -> eval -> implementation/cleanup -> verify -> landing gate -> post-merge closeout -> next cursor",
], "policies_lifecycle_truth");
assert(currentCursor, "current_cursor_required");
assert(active.includes(currentCursor), `active_lifecycle_truth_missing_current_cursor:${currentCursor}`);

assertIncludesAll(specs, [
  "Purpose: `v22_contract_spec_single_truth`",
  "spec:v22-smoke-eval-boundary",
], "specs_single_truth");

assertIncludesAll(policies, [
  "Cleanup Lifecycle Policy",
  "不得恢复旧 contracts 目录",
  "不得恢复旧 recovery 目录",
  "不得新增 `scripts/smoke-test-*`",
  "post-merge closeout",
], "policies_lifecycle_policy");

assertIncludesAll(testsReadme, [
  "Cleanup Lifecycle Gate Policy",
  "生命周期 gate",
  "verify manifest 必须把 cleanup lifecycle gate 纳入 `current` 和 `local-contract`",
], "tests_lifecycle_policy");

assertIncludesAll(history, [
  "landed_commit",
  "landing_gate_result",
  "post_push_verification",
  "post_merge_closeout",
  "next_cursor",
  "cleanup/v22-retirement-lifecycle-system-closure",
], "history_schema");

assertIncludesAll(history, [
  "cleanup/v22-full-taxonomy-hard-retirement",
  "Status: `landed / pushed / post-push verified`",
  `landed_commit: \`${hardCleanupCommit}\``,
  "landing_gate_result: `passed / ff-only landed / pushed`",
  "post_merge_closeout: `completed`",
  "next_cursor: `leaf-portal-postgres-redis-local-production-data-closure`",
], "history_hard_cleanup_closeout");

const hardCleanupSection = sectionAfter(history, "### 2026-05-20 cleanup/v22-full-taxonomy-hard-retirement");
assertNotIncludes(hardCleanupSection, "Status: `ready_for_landing_review`", "history_landed_hard_cleanup");

const lifecycleClosureSection = sectionAfter(history, "### 2026-05-20 cleanup/v22-retirement-lifecycle-system-closure");
assertIncludesAll(lifecycleClosureSection, [
  "Status: `landed / pushed / post-push verified`",
  `landed_commit: \`${lifecycleClosureCommit}\``,
  "landing_gate_result: `passed / ff-only landed / pushed`",
  "post_merge_closeout: `completed`",
  "next_cursor: `leaf-portal-postgres-redis-local-production-data-closure`",
], "history_lifecycle_closure_closeout");
assertNotIncludes(lifecycleClosureSection, "Status: `ready_for_landing_review`", "history_landed_lifecycle_closure");

const indexLoopSection = sectionAfter(history, "### 2026-05-21 cleanup/v22-current-state-index-loop-normalization");
assertIncludesAll(indexLoopSection, [
  "Status: `landed / pushed / post-push verified`",
  `landed_commit: \`${currentStateIndexLoopCommit}\``,
  "landing_gate_result: `passed / ff-only landed / pushed`",
  "post_merge_closeout: `completed`",
  "next_cursor: `leaf-portal-postgres-redis-local-production-data-closure`",
], "history_index_loop_closeout");
assertNotIncludes(indexLoopSection, "Status: `ready_for_landing_review`", "history_landed_index_loop");

const latestRunSection = sectionAfter(history, "### 2026-05-21 cleanup/v22-post-merge-closeout-and-gate-integrity");
assertIncludesAll(latestRunSection, [
  "Status: `landed / pushed / post-push verified`",
  "landed_commit: `c66d8d86b05d0673d320d6798d9b4192deb8d4cd`",
  "landing_gate_result: `passed / ff-only landed / pushed`",
  "post_merge_closeout: `completed`",
  "next_cursor: `leaf-portal-postgres-redis-local-production-data-closure`",
], "history_latest_closeout");
assertNotIncludes(latestRunSection, "Status: `ready_for_landing_review`", "history_landed_latest_run");

assertIncludesAll(latestLanded.source, [
  "Status: `landed / pushed / post-push verified`",
  `landed_commit: \`${latestLandedCommit}\``,
  "landing_gate_result: `passed / ff-only landed / pushed`",
  "post_merge_closeout: `completed`",
  `next_cursor: \`${latestLanded.nextCursor}\``,
], "history_dynamic_latest_closeout");
assertNotIncludes(latestLanded.source, "Status: `ready_for_landing_review`", "history_landed_dynamic_latest_run");
assertIncludesAll(currentCursorSection.source, [
  `next_cursor: \`${currentCursor}\``,
], "history_dynamic_current_cursor_handoff");
assert(
  currentCursorSection.status === "landed / pushed / post-push verified" ||
    currentCursorSection.status.startsWith("authoring"),
  `history_current_cursor_handoff_status_invalid:${currentCursorSection.status}`,
);

assert.equal(current.next_leaf, currentCursor, "next_leaf_must_match_current_cursor");
assert.equal(current.last_landed_commit, latestLandedCommit, "current_last_landed_commit_must_match_latest_closeout");
assert.equal(current.last_landed_branch, latestLanded.branch, "current_last_landed_branch_must_match_latest_closeout");
assert.equal(current.release_readiness_state.cursor_eligible, false, "release_readiness_must_not_be_cursor_eligible");

const currentLeaf = manifest.leaves.find((leaf) => leaf.leaf_id === current.current_cursor);
assert(currentLeaf, `manifest_current_leaf_missing:${current.current_cursor}`);
assert(currentLeaf.verification_commands.includes(lifecycleGate), "current_leaf_must_run_lifecycle_gate");
assert(currentLeaf.verification_commands.includes(landingCloseoutGate), "current_leaf_must_run_landing_closeout_gate");

const currentSuite = manifest.suites.find((suite) => suite.id === "current");
const localContractSuite = manifest.suites.find((suite) => suite.id === "local-contract");
assert(currentSuite?.commands.includes(lifecycleGate), "current_suite_must_run_lifecycle_gate");
assert(currentSuite?.commands.includes(landingCloseoutGate), "current_suite_must_run_landing_closeout_gate");
assert(localContractSuite?.commands.includes(lifecycleGate), "local_contract_suite_must_run_lifecycle_gate");
assert(localContractSuite?.commands.includes(landingCloseoutGate), "local_contract_must_run_landing_closeout_gate");
assert(verifySource.includes("tests/fixtures/v22/agent-verify-manifest.json"), "verify_must_read_manifest_fixture");
assert(verifySource.includes("tests/fixtures/v22/goal-current.json"), "verify_must_read_current_fixture");

console.log(JSON.stringify({
  ok: true,
  contract: "v22_cleanup_lifecycle_system",
  currentCursor: current.current_cursor,
  landedCommit: current.last_landed_commit,
  docsTaxonomyDirs: docsTaxonomyDirs.length,
  testsTaxonomyDirs: testsTaxonomyDirs.length,
}, null, 2));
