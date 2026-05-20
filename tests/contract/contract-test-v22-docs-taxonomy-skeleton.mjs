import assert from "node:assert/strict";
import { access, readdir, readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { smokeEvalMetadataOf } from "../../scripts/v22-test-classification.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");

const branchName = "cleanup/v22-docs-taxonomy-skeleton";
const branchOverrideId = "docs-taxonomy-skeleton";
const thisGate = "tests/contract/contract-test-v22-docs-taxonomy-skeleton.mjs";
const runPath = "docs/recovery/agent-runs/2026-05-20-cleanup-v22-docs-taxonomy-skeleton.md";

const docsTruthReadmes = Object.freeze([
  "docs/active/README.md",
  "docs/product/README.md",
  "docs/runtime/README.md",
  "docs/specs/README.md",
  "docs/policies/README.md",
  "docs/delivery/README.md",
  "docs/source/README.md",
  "docs/public/README.md",
  "docs/references/README.md",
  "docs/history/README.md",
]);

const docsTruthDirs = docsTruthReadmes.map((repoPath) => path.dirname(repoPath));

const requiredReadmeTokens = Object.freeze({
  "docs/README.md": Object.freeze([
    "Purpose: `docs_taxonomy_index`",
    "State: `taxonomy_skeleton`",
    "OPL-style lifecycle taxonomy",
    "一目录一 README 真相",
    "blocked-retain",
    "docs/contracts/**",
    "docs/recovery/**",
    "tests/**/*.mjs",
  ]),
  "docs/active/README.md": Object.freeze([
    "Purpose: `current_state_vs_ideal_gap`",
    "Ideal State",
    "Current State",
    "Gap Matrix",
    "Cannot Claim",
    "leaf-portal-postgres-redis-local-production-data-closure",
  ]),
  "docs/product/README.md": Object.freeze([
    "Purpose: `product_truth_view`",
    "托管 OPL 科研工作台",
    "不是云资源控制台",
    "不是第二份 current truth",
    "Current Truth Pointer",
  ]),
  "docs/runtime/README.md": Object.freeze([
    "Purpose: `runtime_truth_view`",
    "Portal -> OPL Web Gateway -> clean One Person Lab upstream",
    "Runtime Bridge / Runtime Agent",
    "upstream",
    "Current Truth Pointer",
  ]),
  "docs/specs/README.md": Object.freeze([
    "Purpose: `specs_contract_index`",
    "docs/contracts/README.md",
    "docs/contracts/v22-*",
    "machine-boundary leaf",
    "future-authorized",
  ]),
  "docs/policies/README.md": Object.freeze([
    "Purpose: `policy_truth`",
    "secret",
    "smoke-golden",
    "contract-local",
    "future-authorized",
    "Physical Retirement Policy",
  ]),
  "docs/delivery/README.md": Object.freeze([
    "Purpose: `delivery_truth`",
    "Current Cursor",
    "Default Verification",
    "readonly inventory",
    "authorized create/release",
  ]),
  "docs/source/README.md": Object.freeze([
    "Purpose: `source_surface_truth_view`",
    "services/portal",
    "services/opl-web-gateway",
    "services/opl-runtime-bridge",
    "Forbidden Without Authorization",
  ]),
  "docs/public/README.md": Object.freeze([
    "Purpose: `public_product_truth`",
    "Public Positioning",
    "Public Non-Goals",
    "不把 MedOPL 讲成云资源控制台",
  ]),
  "docs/references/README.md": Object.freeze([
    "Purpose: `references_index`",
    "compaction indexes",
    "classification indexes",
    "不是 current product truth",
  ]),
  "docs/history/README.md": Object.freeze([
    "Purpose: `history_evidence_index`",
    "agent-run records",
    "evidence, not product truth",
    "docs/recovery/agent-runs/*",
  ]),
  "tests/README.md": Object.freeze([
    "Purpose: `tests_taxonomy`",
    "tests/",
    "health",
    "smoke",
    "contract",
    "regression",
    "future-authorized",
    "fixtures",
    "helpers",
    "scripts/v22-test-classification.mjs",
  ]),
});

const requiredTestsTaxonomyDirs = Object.freeze([
  "README.md",
  "contract",
  "future-authorized",
  "health",
  "regression",
  "smoke",
]);

const blockedRetainPaths = Object.freeze([
  "docs/contracts/README.md",
  "docs/contracts/v22-smoke-eval-boundary.md",
  "docs/recovery/status-matrix.md",
  "docs/recovery/mvp-contract-acceptance.md",
  "docs/recovery/v22-goal-current.json",
  "docs/recovery/v22-agent-verify-manifest.json",
  "docs/recovery/agent-runs/README.md",
  "docs/recovery/agent-runs/schema.md",
  "tests/contract/contract-test-v22-mvp-contract-suite.mjs",
  "tests/contract/contract-test-v22-golden-smoke-suite.mjs",
  "tests/regression/portal/regression-test-v22-portal-runtime-suite.mjs",
  "tests/future-authorized/cloud/future-authorized-test-v22-cloud-resource-contract-suite.mjs",
]);

const allowedChangedFiles = new Set([
  "docs/README.md",
  ...docsTruthReadmes,
  "tests/README.md",
  "docs/recovery/v22-repo-governance-physical-compaction-index.md",
  "docs/recovery/v22-agent-verify-manifest.json",
  runPath,
  thisGate,
  "tests/contract/contract-test-v22-repo-governance-physical-compaction.mjs",
  "tests/contract/contract-test-v22-mvp-contract-suite.mjs",
  "scripts/v22-test-classification.mjs",
]);

function git(args) {
  const result = spawnSync("git", args, {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: "pipe",
  });
  assert.equal(result.status, 0, `git_failed:${args.join(" ")}:${result.stderr || result.stdout}`);
  return result.stdout.trim();
}

function runNode(args) {
  return spawnSync(process.execPath, args, {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: "pipe",
  });
}

async function source(repoPath) {
  return readFile(path.join(repoRoot, repoPath), "utf8");
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

function changedFiles() {
  const outputs = [
    git(["diff", "--name-only", "origin/recovery/platform-v22-trunk...HEAD"]),
    git(["diff", "--name-only", "--cached"]),
    git(["diff", "--name-only"]),
    git(["ls-files", "--others", "--exclude-standard"]),
  ];
  return [...new Set(outputs.flatMap((output) => output.split(/\r?\n/u).filter(Boolean)))].sort();
}

function currentBranchName() {
  return git(["branch", "--show-current"]);
}

async function listFilesUnder(repoDir) {
  const entries = await readdir(path.join(repoRoot, repoDir), { withFileTypes: true });
  return entries.map((entry) => entry.name).sort();
}

function assertIncludesAll(text, tokens, label) {
  for (const token of tokens) assert(text.includes(token), `${label}_missing:${token}`);
}

function assertChangedFileAllowed(repoPath) {
  assert(allowedChangedFiles.has(repoPath), `changed_file_not_allowed_for_docs_taxonomy_skeleton:${repoPath}`);
  assert.equal(/^services\//u.test(repoPath), false, `forbidden_services_change:${repoPath}`);
  assert.equal(/^deploy\//u.test(repoPath), false, `forbidden_deploy_change:${repoPath}`);
  assert.equal(/^adapters\//u.test(repoPath), false, `forbidden_adapters_change:${repoPath}`);
  assert.equal(/^\.sentrux\//u.test(repoPath), false, `forbidden_sentrux_change:${repoPath}`);
  assert.equal(/^infra\//u.test(repoPath), false, `forbidden_infra_change:${repoPath}`);
  assert.equal(/(?:^|\/)(?:one-person-lab|upstream)\//u.test(repoPath), false, `forbidden_upstream_change:${repoPath}`);
  assert.equal(/^\.runtime\//u.test(repoPath), false, `forbidden_runtime_evidence_change:${repoPath}`);
}

for (const repoDir of docsTruthDirs) {
  const files = await listFilesUnder(repoDir);
  assert.deepEqual(files, ["README.md"], `docs_truth_dir_must_only_contain_readme:${repoDir}:${files.join(",")}`);
}

assert.deepEqual(await listFilesUnder("tests"), [...requiredTestsTaxonomyDirs].sort(), "tests_taxonomy_dirs_must_exist_after_test_migration");

for (const [repoPath, tokens] of Object.entries(requiredReadmeTokens)) {
  assert.equal(await exists(repoPath), true, `required_taxonomy_readme_missing:${repoPath}`);
  assertIncludesAll(await source(repoPath), tokens, repoPath);
}

for (const repoPath of blockedRetainPaths) {
  assert.equal(await exists(repoPath), true, `blocked_retain_path_must_remain_until_reference_migration:${repoPath}`);
}

if (currentBranchName() === branchName) {
  for (const repoPath of changedFiles()) assertChangedFileAllowed(repoPath);
}

const metadata = smokeEvalMetadataOf(thisGate);
assert.equal(metadata.category, "default/local-contract", "this_gate_category_mismatch");
assert.equal(metadata.tier, "contract-local", "this_gate_tier_mismatch");
assert.equal(metadata.surface, "control-plane", "this_gate_surface_mismatch");
assert.equal(metadata.entryKind, "atomic", "this_gate_entry_kind_mismatch");
assert.equal(metadata.authorization, "none", "this_gate_authorization_mismatch");
assert(metadata.contractRefs.includes("docs/contracts/v22-smoke-eval-boundary.md"), "this_gate_contract_ref_missing");
assert(metadata.contractRefs.includes("docs/recovery/v22-agent-verify-manifest.json"), "this_gate_manifest_ref_missing");

const manifest = JSON.parse(await source("docs/recovery/v22-agent-verify-manifest.json"));
const localContract = manifest.suites.find((suite) => suite.id === "local-contract");
assert(localContract, "local_contract_suite_missing");
assert(localContract.commands.includes(`node ${thisGate}`), "local_contract_suite_must_include_docs_taxonomy_skeleton_gate");

const override = manifest.branch_override_suites.find((suite) => suite.id === branchOverrideId);
assert(override, "docs_taxonomy_skeleton_branch_override_missing");
assert.equal(override.branch, branchName, "docs_taxonomy_skeleton_branch_mismatch");
assert.deepEqual(override.branches, [branchName], "docs_taxonomy_skeleton_branches_mismatch");
assert.equal(override.risk_class, "local_doc_eval", "docs_taxonomy_skeleton_risk_class_mismatch");
assert(override.commands.includes(`node ${thisGate}`), "branch_override_must_run_this_gate");
assert(override.commands.includes("node tests/health/health-check-v22-smoke-classification-gate.mjs"), "branch_override_must_run_classification_gate");
assert(override.commands.includes("node tests/health/health-check-v22-smoke-eval-boundary.mjs"), "branch_override_must_run_smoke_eval_boundary_gate");
assert(override.commands.includes("node tests/contract/contract-test-v22-agent-run-record-gate.mjs"), "branch_override_must_run_agent_record_gate");
assert(override.commands.includes("node tests/contract/contract-test-v22-agent-verify-entrypoint.mjs"), "branch_override_must_run_agent_verify_entrypoint");
assert(override.commands.includes("node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk"), "branch_override_must_run_workflow_gate");
assert(override.commands.includes("git diff --check -- docs tests scripts"), "branch_override_must_run_diff_check");

for (const repoPath of allowedChangedFiles) {
  assert(override.allowed_files.includes(repoPath), `branch_override_allowed_file_missing:${repoPath}`);
}

for (const forbiddenFile of ["services/*", "deploy/*", "adapters/*", ".sentrux/*", "infra/*", "one-person-lab/*", "upstream/*", ".runtime/*"]) {
  assert(override.forbidden_files.includes(forbiddenFile), `branch_override_forbidden_file_missing:${forbiddenFile}`);
}

for (const forbiddenOp of [
  "secret",
  "live-cloud",
  "true-cloud-mutation",
  "build-push-kubectl",
  "deploy",
  "live-test",
  "services-implementation",
  "upstream-write",
  "dependency-upgrade",
  "postgres-redis-implementation",
  "physical-delete",
  "ff-only-absorb",
  "git-push",
]) {
  assert(override.forbidden_ops.includes(forbiddenOp), `branch_override_forbidden_op_missing:${forbiddenOp}`);
}

const planResult = runNode([
  "scripts/v22-verify.mjs",
  "current",
  "--base",
  "origin/recovery/platform-v22-trunk",
  "--branch",
  branchName,
  "--dry-run",
  "--json",
]);
assert.equal(planResult.status, 0, `verify_current_docs_taxonomy_dry_run_must_exit_zero:${planResult.stderr || planResult.stdout}`);
const planPayload = JSON.parse(planResult.stdout);
assert.equal(planPayload.ok, true, "verify_current_docs_taxonomy_dry_run_ok_mismatch");
assert.equal(planPayload.branchOverride?.suiteId, branchOverrideId, "verify_current_docs_taxonomy_branch_override_mismatch");
assert.deepEqual(planPayload.commands, override.commands, "verify_current_docs_taxonomy_commands_mismatch");
assert.deepEqual(planPayload.allowedFiles, override.allowed_files, "verify_current_docs_taxonomy_allowed_files_mismatch");
assert.deepEqual(planPayload.forbiddenFiles, override.forbidden_files, "verify_current_docs_taxonomy_forbidden_files_mismatch");

const agentRun = await source(runPath);
assertIncludesAll(agentRun, [
  "schema_version: 1",
  "leaf_id: cleanup-v22-docs-taxonomy-skeleton",
  "status: pending_b_review",
  "model: gpt-5.4",
  `branch: ${branchName}`,
  "branch_override_id: docs-taxonomy-skeleton",
  "## subagents_and_models",
  "Carver: `gpt-5.4`",
  "Wegener: `gpt-5.4`",
  "Carson: `gpt-5.4`",
  "no secret read",
  "no real cloud call",
  "no upstream modification",
  "no build/deploy/kubectl/live-test",
  "no physical deletion",
  "pending_B_review",
  "not_applicable_yet",
], "agent_run");

console.log(JSON.stringify({
  ok: true,
  contract: "v22_docs_taxonomy_skeleton",
  branch: branchName,
  docsTruthDirs,
  blockedRetainCount: blockedRetainPaths.length,
  changedFiles: changedFiles(),
}, null, 2));
