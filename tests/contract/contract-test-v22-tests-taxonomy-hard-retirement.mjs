import assert from "node:assert/strict";
import { access, readdir, readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  SMOKE_CLASSIFICATION,
  listSmokeEvalScripts,
  smokeEvalMetadataOf,
} from "../../scripts/v22-test-classification.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
const thisGate = "tests/contract/contract-test-v22-tests-taxonomy-hard-retirement.mjs";
const branchName = "cleanup/v22-tests-taxonomy-hard-retirement";
const branchOverrideId = "tests-taxonomy-hard-retirement";
const agentRunPath = "docs/recovery/agent-runs/2026-05-20-cleanup-v22-tests-taxonomy-hard-retirement.md";

function git(args) {
  const result = spawnSync("git", args, {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: "pipe",
  });
  assert.equal(result.status, 0, `git_failed:${args.join(" ")}:${result.stderr || result.stdout}`);
  return result.stdout.trim();
}

async function exists(repoPath) {
  try {
    await access(path.join(repoRoot, repoPath));
    return true;
  } catch (error) {
    if (error && error.code === "ENOENT") return false;
    throw error;
  }
}

async function source(repoPath) {
  return readFile(path.join(repoRoot, repoPath), "utf8");
}

function trackedFiles() {
  return git(["ls-files"]).split(/\r?\n/u).filter(Boolean).sort();
}

function changedFiles() {
  const outputs = [
    git(["diff", "--name-only", "origin/recovery/platform-v22-trunk...HEAD"]),
    git(["diff", "--name-only", "--cached"]),
    git(["diff", "--name-only"]),
    git(["ls-files", "--others", "--exclude-standard"]),
  ];
  return [...new Set(outputs.flatMap((output) => output.split(/\r?\n/u).filter(Boolean)))].sort();
}

async function listTestFiles(dir, prefix = "tests") {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const repoPath = `${prefix}/${entry.name}`;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await listTestFiles(fullPath, repoPath));
    } else if (/\.mjs$/u.test(entry.name)) {
      files.push(repoPath);
    }
  }
  return files.sort();
}

for (const requiredPath of [
  "tests/README.md",
  "scripts/v22-test-classification.mjs",
  "docs/recovery/v22-agent-verify-manifest.json",
  agentRunPath,
  thisGate,
]) {
  assert.equal(await exists(requiredPath), true, `required_tests_taxonomy_file_missing:${requiredPath}`);
}

assert.equal(await exists("scripts/v22-smoke-classification.mjs"), false, "legacy_smoke_classification_file_must_not_exist");

const files = trackedFiles();
const legacyScriptSmokeFiles = files.filter((file) => /^scripts\/smoke-test-v22-.+\.mjs$/u.test(file));
assert.deepEqual(legacyScriptSmokeFiles, [], `legacy_scripts_smoke_tests_must_not_be_tracked:${legacyScriptSmokeFiles.join(",")}`);

const testEvalFiles = await listTestFiles(path.join(repoRoot, "tests"));
assert.equal(testEvalFiles.length, 155, `tests_eval_file_count_mismatch:${testEvalFiles.length}`);
assert.deepEqual(Object.keys(SMOKE_CLASSIFICATION).sort(), testEvalFiles, "tests_eval_files_must_match_classification");

const tierCounts = Object.fromEntries([
  "health-check",
  "smoke-golden",
  "contract-local",
  "local-regression",
  "future-authorized",
  "retired",
].map((tier) => [tier, listSmokeEvalScripts({ tiers: [tier] }).length]));
assert.deepEqual(tierCounts, {
  "health-check": 6,
  "smoke-golden": 11,
  "contract-local": 28,
  "local-regression": 62,
  "future-authorized": 48,
  retired: 0,
}, "tests_eval_tier_counts_mismatch");

for (const scriptPath of testEvalFiles) {
  const metadata = smokeEvalMetadataOf(scriptPath);
  assert(metadata.contractRefs.includes("docs/contracts/v22-smoke-eval-boundary.md"), `smoke_eval_contract_ref_missing:${scriptPath}`);
  assert(["atomic", "suite-wrapper", "gate-self-test"].includes(metadata.entryKind), `entry_kind_invalid:${scriptPath}`);
  assert(["none", "future-authorized"].includes(metadata.authorization), `authorization_invalid:${scriptPath}`);
}

const manifest = JSON.parse(await source("docs/recovery/v22-agent-verify-manifest.json"));
const serializedManifest = JSON.stringify(manifest);
assert.equal(/node scripts\/smoke-test-v22-/u.test(serializedManifest), false, "manifest_must_not_execute_legacy_scripts_smoke_tests");
const override = manifest.branch_override_suites.find((suite) => suite.id === branchOverrideId);
assert(override, "tests_taxonomy_hard_retirement_branch_override_missing");
assert.equal(override.branch, branchName, "tests_taxonomy_branch_mismatch");
assert(override.branches.includes(branchName), "tests_taxonomy_branches_must_include_branch");
assert(override.commands.includes(`node ${thisGate}`), "tests_taxonomy_override_must_run_this_gate");
assert(override.commands.includes("node tests/health/health-check-v22-smoke-classification-gate.mjs"), "tests_taxonomy_override_must_run_classification_gate");
assert(override.commands.includes("node tests/health/health-check-v22-smoke-eval-boundary.mjs"), "tests_taxonomy_override_must_run_boundary_gate");
assert(override.allowed_files.includes("tests/**/*.mjs"), "tests_taxonomy_override_must_allow_tests_migration");
assert(override.retired_files.includes("scripts/smoke-test-v22-*.mjs"), "tests_taxonomy_override_must_record_legacy_scripts_retirement");
for (const forbidden of ["services/*", "deploy/*", "adapters/*", ".sentrux/*", "infra/*", "one-person-lab/*", "upstream/*", ".runtime/*"]) {
  assert(override.forbidden_files.includes(forbidden), `tests_taxonomy_forbidden_file_missing:${forbidden}`);
}
for (const forbiddenOp of ["secret", "live-cloud", "true-cloud-mutation", "build-push-kubectl", "deploy", "live-test", "services-implementation", "upstream-write", "postgres-redis-implementation", "git-push"]) {
  assert(override.forbidden_ops.includes(forbiddenOp), `tests_taxonomy_forbidden_op_missing:${forbiddenOp}`);
}

const testsReadme = await source("tests/README.md");
for (const token of [
  "Purpose: `tests_taxonomy`",
  "scripts/smoke-test-v22-*` 已物理退役",
  "- total: 155",
  "scripts/v22-test-classification.mjs",
  "scripts/v22-verify.mjs",
]) {
  assert(testsReadme.includes(token), `tests_readme_token_missing:${token}`);
}

const agentRun = await source(agentRunPath);
for (const token of [
  "schema_version: 1",
  "leaf_id: cleanup-v22-tests-taxonomy-hard-retirement",
  "run_kind: cleanup",
  "status: pending_b_review",
  "model: gpt-5.4",
  "branch: cleanup/v22-tests-taxonomy-hard-retirement",
  "base_trunk_head: 69c08908b84f68e252884fa532c5aef71ef4230e",
  "branch_override_id: tests-taxonomy-hard-retirement",
  "Anscombe",
  "gpt-5.4",
  "不调用真实云",
  "不读取 secret",
  "不修改 upstream",
  "不 build/deploy/kubectl/live-test",
]) {
  assert(agentRun.includes(token), `agent_run_token_missing:${token}`);
}

const forbiddenChanged = changedFiles().filter((file) => (
  file.startsWith("services/") ||
  file.startsWith("deploy/") ||
  file.startsWith(".sentrux/") ||
  file.startsWith("adapters/") ||
  file.startsWith("infra/") ||
  file.startsWith("one-person-lab/") ||
  file.startsWith("upstream/") ||
  file.startsWith(".runtime/")
));
assert.deepEqual(forbiddenChanged, [], `tests_taxonomy_must_not_touch_forbidden_paths:${forbiddenChanged.join(",")}`);

console.log(JSON.stringify({
  ok: true,
  contract: "v22_tests_taxonomy_hard_retirement",
  testsEvalFiles: testEvalFiles.length,
  tierCounts,
  retiredEntrypoints: [
    "scripts/smoke-test-v22-*.mjs",
    "scripts/v22-smoke-classification.mjs",
  ],
}, null, 2));
