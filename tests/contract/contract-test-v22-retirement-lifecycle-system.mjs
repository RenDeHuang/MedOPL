import assert from "node:assert/strict";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");

const lifecycleGate = "node tests/contract/contract-test-v22-retirement-lifecycle-system.mjs";
const hardRetirementCommit = "2a4254915f43186e312f406e5de31629c1c6700b";

const docsTaxonomyDirs = [
  "active",
  "product",
  "runtime",
  "specs",
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
  "future-authorized",
  "fixtures",
];

const forbiddenPaths = [
  "docs/contracts",
  "docs/recovery",
  "docs/product.md",
  "docs/architecture.md",
  "docs/status.md",
  "docs/invariants.md",
  "docs/decisions.md",
  "docs/vibe-coding.md",
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

for (const repoPath of forbiddenPaths) {
  assert.equal(await exists(repoPath), false, `retired_path_must_not_exist:${repoPath}`);
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
  "scripts/sync-workspace-file-to-minio.ps1",
  "scripts/v22-test-classification.mjs",
  "scripts/v22-verify.mjs",
  "scripts/v22-workflow-gate.mjs",
], "scripts_must_remain_runner_classifier_workflow_only_plus_service_sync_helper");
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

assertIncludesAll(active, [
  "OPL-style 清退生命周期真相",
  "truth -> gap -> eval -> implementation/cleanup -> verify -> B absorb -> post-absorb truth closeout -> next cursor",
  "leaf-portal-postgres-redis-local-production-data-closure",
  lifecycleGate,
], "active_lifecycle_truth");

assertIncludesAll(specs, [
  "Purpose: `v22_contract_spec_single_truth`",
  "spec:v22-smoke-eval-boundary",
], "specs_single_truth");

assertIncludesAll(policies, [
  "Retirement Lifecycle Policy",
  "不得恢复 `docs/contracts/`",
  "不得恢复 `docs/recovery/`",
  "不得新增 `scripts/smoke-test-*`",
  "post-absorb truth closeout",
], "policies_lifecycle_policy");

assertIncludesAll(testsReadme, [
  "Lifecycle Gate Policy",
  "生命周期 gate",
  "verify manifest 必须把 lifecycle gate 纳入 `current` 和 `local-contract`",
], "tests_lifecycle_policy");

assertIncludesAll(history, [
  "absorbed_commit",
  "b_review_result",
  "post_push_verification",
  "post_absorb_truth_closeout",
  "next_cursor",
  "cleanup/v22-retirement-lifecycle-system-closure",
], "history_schema");

assertIncludesAll(history, [
  "cleanup/v22-full-taxonomy-hard-retirement",
  "Status: `absorbed / pushed / post-push verified`",
  `absorbed_commit: \`${hardRetirementCommit}\``,
  "b_review_result: `passed / ff-only absorbed / pushed`",
  "post_absorb_truth_closeout: `completed`",
  "next_cursor: `leaf-portal-postgres-redis-local-production-data-closure`",
], "history_hard_retirement_closeout");

assertNotIncludes(history, "Status: `ready_for_b_review`", "history_absorbed_runs");

assert.equal(current.current_cursor, "leaf-portal-postgres-redis-local-production-data-closure", "current_cursor_must_remain_business_leaf");
assert.equal(current.next_leaf, "leaf-portal-postgres-redis-local-production-data-closure", "next_leaf_must_remain_business_leaf");
assert.equal(current.last_absorbed_commit, hardRetirementCommit, "current_last_absorbed_commit_must_match_hard_retirement");
assert.equal(current.release_readiness_state.cursor_eligible, false, "release_readiness_must_not_be_cursor_eligible");

const currentLeaf = manifest.leaves.find((leaf) => leaf.leaf_id === current.current_cursor);
assert(currentLeaf, `manifest_current_leaf_missing:${current.current_cursor}`);
assert(currentLeaf.verification_commands.includes(lifecycleGate), "current_leaf_must_run_lifecycle_gate");

const currentSuite = manifest.suites.find((suite) => suite.id === "current");
const localContractSuite = manifest.suites.find((suite) => suite.id === "local-contract");
assert(currentSuite?.commands.includes(lifecycleGate), "current_suite_must_run_lifecycle_gate");
assert(localContractSuite?.commands.includes(lifecycleGate), "local_contract_suite_must_run_lifecycle_gate");
assert(verifySource.includes("tests/fixtures/v22/agent-verify-manifest.json"), "verify_must_read_manifest_fixture");
assert(verifySource.includes("tests/fixtures/v22/goal-current.json"), "verify_must_read_current_fixture");

console.log(JSON.stringify({
  ok: true,
  contract: "v22_retirement_lifecycle_system",
  currentCursor: current.current_cursor,
  absorbedCommit: current.last_absorbed_commit,
  docsTaxonomyDirs: docsTaxonomyDirs.length,
  testsTaxonomyDirs: testsTaxonomyDirs.length,
}, null, 2));
