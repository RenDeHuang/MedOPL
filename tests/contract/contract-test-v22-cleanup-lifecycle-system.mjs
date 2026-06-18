import assert from "node:assert/strict";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");

const lifecycleGate = "node tests/contract/contract-test-v22-cleanup-lifecycle-system.mjs";
const landingCloseoutGate = "node tests/contract/contract-test-v22-landing-closeout-automation.mjs";

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
const topLevelScriptFiles = scriptFiles.filter((file) => /^scripts\/[^/]+$/u.test(file));
const workflowGateModuleFiles = scriptFiles.filter((file) => /^scripts\/workflow-gate\/[^/]+$/u.test(file));
const otherScriptModuleFiles = scriptFiles.filter((file) => file.includes("/") && !topLevelScriptFiles.includes(file) && !workflowGateModuleFiles.includes(file));
assert.deepEqual(topLevelScriptFiles, [
  "scripts/v22-landing-closeout.mjs",
  "scripts/v22-line-budget.mjs",
  "scripts/v22-local-services.mjs",
  "scripts/v22-repo-bloat-audit.mjs",
  "scripts/v22-repo-hygiene.mjs",
  "scripts/v22-test-classification.mjs",
  "scripts/v22-verify.mjs",
  "scripts/v22-workflow-gate.mjs",
], "scripts_must_remain_v22_control_plane_only");
assert.deepEqual(workflowGateModuleFiles, [
  "scripts/workflow-gate/change-package.mjs",
  "scripts/workflow-gate/command-reference.mjs",
  "scripts/workflow-gate/git-diff.mjs",
  "scripts/workflow-gate/policy.mjs",
  "scripts/workflow-gate/report.mjs",
], "workflow_gate_modules_must_remain_bounded_owner_surface");
assert.deepEqual(otherScriptModuleFiles, [], "unexpected_script_module_owner_surface");
assert.equal(scriptFiles.some((file) => /^scripts\/smoke-test-v22-.*\.mjs$/u.test(file)), false, "legacy_smoke_script_must_not_return");

const [
  active,
  specs,
  policies,
  history,
  testsReadme,
  verifySource,
  rootSpecs,
  manifest,
  current,
] = await Promise.all([
  readRepoFile("docs/active/README.md"),
  readRepoFile("docs/specs/README.md"),
  readRepoFile("docs/policies/README.md"),
  readRepoFile("docs/history/README.md"),
  readRepoFile("tests/README.md"),
  readRepoFile("scripts/v22-verify.mjs"),
  readRepoFile("specs/README.md"),
  readJson("tests/fixtures/v22/agent-verify-manifest.json"),
  readJson("tests/fixtures/v22/goal-current.json"),
]);
const currentCursor = current.current_cursor;
const latestCloseout = current.latest_landed_closeout;
assert(latestCloseout, "current_latest_landed_closeout_required");
const latestLandedCommit = latestCloseout.landed_commit;

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
  "Purpose: `v22_contract_spec_index`",
  "spec:v22-smoke-eval-boundary",
  "specs/source/spec.md",
], "specs_index_truth");
assert.equal(specs.split("\n").length <= 400, true, `specs_index_line_budget_exceeded:${specs.split("\n").length}`);
assert.equal(/```json/u.test(specs), false, "specs_index_must_not_embed_machine_json");
assertIncludesAll(rootSpecs, [
  "Purpose: `durable_behavior_specs`",
  "root `specs/**` contains durable behavior specs",
  "docs/specs/README.md remains the human contract index",
], "root_specs_durable_truth");

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
  "Owner: `MedOPL`",
  "Purpose: `history_archive_index`",
  "Machine boundary:",
  "tests/fixtures/v22/goal-current.json",
  "changes/archive/",
  "Tombstone Map",
], "history_summary_only_boundary");
assert.equal(/^###\s+\d{4}-\d{2}-\d{2}\s+/mu.test(history), false, "history_must_not_store_landed_run_sections");
assert.equal(history.includes("Status: `ready_for_landing_review`"), false, "history_must_not_store_ready_for_landing_review_sections");
assert.equal(history.includes("Status: `landed / pushed / post-push verified`"), false, "history_must_not_store_landed_status_sections");

assert.equal(latestCloseout.status, "landed / pushed / post-push verified", "latest_closeout_status_mismatch");
assert.equal(latestCloseout.branch, current.last_landed_branch, "latest_closeout_branch_mismatch");
assert.equal(latestCloseout.landed_commit, latestLandedCommit, "latest_closeout_commit_mismatch");
assert.equal(latestCloseout.landing_gate_result, "passed / ff-only landed / pushed", "latest_closeout_landing_gate_mismatch");
assert.equal(latestCloseout.post_merge_closeout, "completed", "latest_closeout_post_merge_mismatch");
assert.equal(latestCloseout.next_cursor, currentCursor, "latest_closeout_next_cursor_mismatch");
assert(Array.isArray(latestCloseout.post_push_verification), "latest_closeout_post_push_verification_must_be_array");
assert(latestCloseout.post_push_verification.length > 0, "latest_closeout_post_push_verification_required");

assert.equal(current.next_leaf, currentCursor, "next_leaf_must_match_current_cursor");
assert.equal(current.last_landed_commit, latestLandedCommit, "current_last_landed_commit_must_match_latest_closeout");
assert.equal(current.last_landed_branch, latestCloseout.branch, "current_last_landed_branch_must_match_latest_closeout");
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
