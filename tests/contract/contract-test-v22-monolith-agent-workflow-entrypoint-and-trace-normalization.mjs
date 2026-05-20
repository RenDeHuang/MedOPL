import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { smokeEvalMetadataOf } from "../../scripts/v22-test-classification.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");

const branchName = "cleanup/v22-monolith-agent-workflow-entrypoint-and-trace-normalization";
const baseTrunkHead = "d35d65ed94cef7fac0493c21643e36a690f57e4c";
const thisGate = "tests/contract/contract-test-v22-monolith-agent-workflow-entrypoint-and-trace-normalization.mjs";
const indexPath = "docs/recovery/v22-monolith-agent-workflow-entrypoint-and-trace-normalization-index.md";
const runPath = "docs/recovery/agent-runs/2026-05-20-cleanup-v22-monolith-agent-workflow-entrypoint-and-trace-normalization.md";
const agentRunReadmePath = "docs/recovery/agent-runs/README.md";
const agentRunSchemaPath = "docs/recovery/agent-runs/schema.md";
const absorbedTruthRepoRunPath = "docs/recovery/agent-runs/2026-05-20-cleanup-v22-truth-repo-narrative-reference-unification.md";
const absorbedTruthRepoCommit = "d35d65ed94cef7fac0493c21643e36a690f57e4c";
const oldMvpTitle = "默认本地 MVP suite";
const legacyMvpTitle = "Legacy 本地 MVP regression alias";

const blockedRetain = Object.freeze([
  "tests/contract/contract-test-v22-mvp-contract-suite.mjs",
  "scripts/v22-agent-workflow.mjs",
  "tests/regression/portal/regression-test-v22-portal-runtime-suite.mjs",
  "tests/future-authorized/cloud/future-authorized-test-v22-cloud-resource-contract-suite.mjs",
  "docs/recovery/v22-program-board.md",
  "docs/recovery/v22-program-status-table.md",
  "docs/recovery/cloud-onboarding-execution-board.md",
  "docs/recovery/cloud-onboarding-status-table.md",
  "docs/recovery/cloud-onboarding-verification-matrix.md",
  "docs/specs/README.md",
  "docs/specs/README.md",
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

function assertIncludesAll(text, tokens, label) {
  for (const token of tokens) assert(text.includes(token), `${label}_missing:${token}`);
}

function assertNotIncludesAny(text, tokens, label) {
  for (const token of tokens) assert.equal(text.includes(token), false, `${label}_must_not_include:${token}`);
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

function parseMeta(recordText) {
  const match = recordText.match(/^## meta\n+([\s\S]*?)(?:\n## |\n$)/mu);
  assert(match, "agent_run_meta_section_missing");
  const meta = {};
  for (const line of match[1].split(/\r?\n/u)) {
    const item = line.match(/^- ([a-zA-Z0-9_]+):\s*(.+)$/u);
    if (item) meta[item[1]] = item[2].trim();
  }
  return meta;
}

const [
  indexText,
  runText,
  readme,
  mvpAcceptance,
  productGoal,
  codexLoop,
  schemaText,
  agentRunsReadme,
  truthRepoRun,
  manifestText,
  classificationText,
] = await Promise.all([
  source(indexPath),
  source(runPath),
  source("README.md"),
  source("docs/recovery/mvp-contract-acceptance.md"),
  source("docs/recovery/v22-product-goal.md"),
  source("docs/recovery/v22-codex-goal-loop.md"),
  source(agentRunSchemaPath),
  source(agentRunReadmePath),
  source(absorbedTruthRepoRunPath),
  source("docs/recovery/v22-agent-verify-manifest.json"),
  source("scripts/v22-test-classification.mjs"),
]);

assertIncludesAll(indexText, [
  branchName,
  `base trunk: \`${baseTrunkHead}\``,
  "delete-ready files: `0`",
  "Default agent verification entrypoint",
  "legacy local-regression alias",
  "suite-wrapper",
  "Agent-run records are evidence, not product truth",
  "Physical Retirement Rule",
], "index");
for (const repoPath of blockedRetain) {
  assert(indexText.includes(repoPath), `index_must_record_blocked_retain:${repoPath}`);
}

assertIncludesAll(truthRepoRun, [
  "## absorbed_commit",
  absorbedTruthRepoCommit,
  "passed / ff-only absorbed / pushed",
  "post_absorb_verification",
], "absorbed_truth_repo_run");

const meta = parseMeta(runText);
assert.equal(meta.schema_version, "1", "agent_run_schema_version_mismatch");
assert.equal(meta.leaf_id, "cleanup-v22-monolith-agent-workflow-entrypoint-and-trace-normalization", "agent_run_leaf_id_mismatch");
assert.equal(meta.run_kind, "cleanup", "agent_run_kind_mismatch");
assert.equal(meta.status, "pending_b_review", "agent_run_status_mismatch");
assert.equal(meta.model, "gpt-5.4", "agent_run_model_mismatch");
assert.equal(meta.branch, branchName, "agent_run_branch_mismatch");
assert.equal(meta.base_trunk_head, baseTrunkHead, "agent_run_base_mismatch");
assert.equal(meta.absorbed_commit, "none", "pending_agent_run_absorbed_commit_must_be_none");
assert.equal(meta.post_absorb_verification, undefined, "post_absorb_verification_must_be_section_not_meta");
assertIncludesAll(runText, [
  "## subagents_and_models",
  "gpt-5.4",
  "no secret read",
  "no real cloud call",
  "no upstream modification",
  "no build/deploy/kubectl/live-test",
  "pending_B_review",
  "not_applicable_yet",
], "agent_run");

assertIncludesAll(schemaText, [
  "schema_version: 1",
  "run_kind: implementation | cleanup | post_absorb_truth | trace_only",
  "status: pending_b_review | absorbed | superseded",
  "model: gpt-5.4 | gpt-5.3-codex | gpt-5.4-mini",
  "`absorbed_commit` must be `none`",
  "`absorbed_commit` must be a 40-character commit SHA",
], "schema");
assertIncludesAll(agentRunsReadme, [
  "evidence, not product truth",
  "Authority Order",
  "New records created after",
  "pending_b_review",
  "absorbed",
  "superseded",
], "agent_runs_readme");

assertIncludesAll(readme, [
  "scripts/v22-verify.mjs",
  "legacy local-regression alias",
  "node scripts/v22-verify.mjs current --base origin/recovery/platform-v22-trunk",
  "node scripts/v22-verify.mjs suite smoke --base origin/recovery/platform-v22-trunk",
], "readme");
assertNotIncludesAny(readme, [
  "当前 v22 contract/API smoke 入口",
  "node tests/contract/contract-test-v22-mvp-contract-suite.mjs",
], "readme");

assertIncludesAll(mvpAcceptance, [
  legacyMvpTitle,
  "默认 agent 验证入口",
  "node scripts/v22-verify.mjs current --base origin/recovery/platform-v22-trunk",
  "legacy local-regression alias",
  "不再被称为默认 smoke",
], "mvp_acceptance");
assertNotIncludesAny(mvpAcceptance, [
  "默认本地 v22 MVP contract acceptance suite",
  oldMvpTitle,
], "mvp_acceptance");

for (const gatePath of [
  "tests/health/health-check-v22-contract-conflict-boundary.mjs",
  "tests/regression/portal/regression-test-v22-observability-billing-narrative-boundary.mjs",
  "tests/health/health-check-v22-zero-compat-active-surface-gate.mjs",
]) {
  const gateSource = await source(gatePath);
  assert(gateSource.includes(legacyMvpTitle), `legacy_mvp_title_gate_must_be_updated:${gatePath}`);
  assert.equal(gateSource.includes(oldMvpTitle), false, `old_mvp_title_gate_must_not_remain:${gatePath}`);
}

for (const text of [productGoal, codexLoop]) {
  assert(text.includes("node scripts/v22-verify.mjs current --base origin/recovery/platform-v22-trunk"), "goal_docs_must_use_current_verify");
  assert(text.includes("node scripts/v22-verify.mjs suite local-contract --base origin/recovery/platform-v22-trunk"), "goal_docs_must_use_local_contract_verify");
}

const portalRuntimeMetadata = smokeEvalMetadataOf("tests/regression/portal/regression-test-v22-portal-runtime-suite.mjs");
const cloudResourceMetadata = smokeEvalMetadataOf("tests/future-authorized/cloud/future-authorized-test-v22-cloud-resource-contract-suite.mjs");
assert.equal(portalRuntimeMetadata.entryKind, "suite-wrapper", "portal_runtime_suite_must_be_wrapper");
assert.equal(portalRuntimeMetadata.tier, "local-regression", "portal_runtime_suite_tier_mismatch");
assert.equal(cloudResourceMetadata.entryKind, "suite-wrapper", "cloud_resource_suite_must_be_wrapper");
assert.equal(cloudResourceMetadata.tier, "future-authorized", "cloud_resource_suite_tier_mismatch");
assert(classificationText.includes("tests/contract/contract-test-v22-monolith-agent-workflow-entrypoint-and-trace-normalization.mjs"), "this_gate_must_be_classified");

const manifest = JSON.parse(manifestText);
const override = manifest.branch_override_suites.find((suite) => suite.id === "monolith-agent-workflow-entrypoint-and-trace-normalization");
assert(override, "branch_override_missing");
assert.equal(override.branch, branchName, "branch_override_branch_mismatch");
assert(override.commands.includes(`node ${thisGate}`), "branch_override_must_run_this_gate");
assert(override.commands.includes("node tests/contract/contract-test-v22-agent-run-record-gate.mjs"), "branch_override_must_run_agent_record_gate");
assert(override.allowed_files.includes(agentRunReadmePath), "branch_override_must_allow_agent_runs_readme");
assert(override.allowed_files.includes(agentRunSchemaPath), "branch_override_must_allow_agent_runs_schema");
assert(override.allowed_files.includes(runPath), "branch_override_must_allow_run");
assert(override.allowed_files.includes("tests/health/health-check-v22-smoke-eval-boundary.mjs"), "branch_override_must_allow_smoke_eval_boundary");
assert(override.allowed_files.includes("tests/health/health-check-v22-contract-conflict-boundary.mjs"), "branch_override_must_allow_contract_conflict_gate");
assert(override.allowed_files.includes("tests/contract/contract-test-v22-contract-smoke-eval-index-compaction.mjs"), "branch_override_must_allow_contract_smoke_eval_index_compaction_gate");
assert(override.allowed_files.includes("tests/regression/portal/regression-test-v22-observability-billing-narrative-boundary.mjs"), "branch_override_must_allow_observability_billing_gate");
assert(override.allowed_files.includes("tests/contract/contract-test-v22-truth-repo-narrative-reference-unification.mjs"), "branch_override_must_allow_truth_repo_narrative_gate");
assert(override.allowed_files.includes("tests/health/health-check-v22-zero-compat-active-surface-gate.mjs"), "branch_override_must_allow_zero_compat_gate");
assert(override.forbidden_files.includes("services/*"), "branch_override_must_forbid_services");
assert(override.forbidden_ops.includes("git-push"), "branch_override_must_forbid_push");

const dryRun = runNode([
  "scripts/v22-verify.mjs",
  "current",
  "--base",
  "origin/recovery/platform-v22-trunk",
  "--branch",
  branchName,
  "--dry-run",
  "--json",
]);
assert.equal(dryRun.status, 0, `verify_current_branch_dry_run_failed:${dryRun.stderr || dryRun.stdout}`);
const dryRunPayload = JSON.parse(dryRun.stdout);
assert.equal(dryRunPayload.ok, true, "verify_current_branch_dry_run_ok_mismatch");
assert.equal(dryRunPayload.branchOverride?.suiteId, "monolith-agent-workflow-entrypoint-and-trace-normalization", "verify_current_branch_override_mismatch");
assert.deepEqual(dryRunPayload.commands, override.commands, "verify_current_branch_commands_mismatch");

const agentRunFiles = (await readdir(path.join(repoRoot, "docs/recovery/agent-runs")))
  .filter((name) => name.endsWith(".md"))
  .sort();
assert(agentRunFiles.includes("README.md"), "agent_runs_readme_must_exist");
assert(agentRunFiles.includes("schema.md"), "agent_runs_schema_must_exist");
assert(agentRunFiles.includes(path.basename(runPath)), "new_agent_run_must_exist");

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
assert.deepEqual(forbiddenChanged, [], `forbidden_paths_changed:${forbiddenChanged.join(",")}`);

console.log(JSON.stringify({
  ok: true,
  contract: "v22_monolith_agent_workflow_entrypoint_and_trace_normalization",
  deleteReady: 0,
  blockedRetainCount: blockedRetain.length,
  agentRunSchema: "forward_only_for_new_records",
  suiteWrappers: [
    "tests/contract/contract-test-v22-golden-smoke-suite.mjs",
    "tests/contract/contract-test-v22-mvp-contract-suite.mjs",
    "tests/regression/portal/regression-test-v22-portal-runtime-suite.mjs",
    "tests/future-authorized/cloud/future-authorized-test-v22-cloud-resource-contract-suite.mjs",
  ],
}, null, 2));
