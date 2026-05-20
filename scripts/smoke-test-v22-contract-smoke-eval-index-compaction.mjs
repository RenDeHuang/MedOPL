import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  SMOKE_CLASSIFICATION,
  listSmokeEvalScripts,
  smokeEvalMetadataOf,
} from "./v22-smoke-classification.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

const indexPath = "docs/recovery/v22-contract-smoke-eval-index-compaction-index.md";
const agentRunPath = "docs/recovery/agent-runs/2026-05-20-cleanup-v22-contract-smoke-eval-index-compaction.md";
const previousSmokeEvalRunPath = "docs/recovery/agent-runs/2026-05-20-cleanup-v22-smoke-eval-physical-compaction.md";
const previousSmokeEvalAbsorbedCommit = "422547d2ed61c7ecc231e07e1d9b1214dc5df715";

const blockedContractCandidates = Object.freeze([
  "docs/contracts/v22-admin-ops-console-boundary.md",
  "docs/contracts/v22-user-credit-provider-key-boundary.md",
  "docs/contracts/v22-billing-freeze-boundary.md",
  "docs/contracts/v22-real-opl-capability-canary-boundary.md",
  "docs/contracts/v22-real-opl-provider-message-canary-boundary.md",
  "docs/contracts/v22-real-opl-file-run-artifact-canary-boundary.md",
  "docs/contracts/v22-portal-ui-design-quality-audit-boundary.md",
  "docs/contracts/v22-portal-figma-make-ui-implementation-boundary.md",
  "docs/contracts/v22-cloud-onboarding-workflow-boundary.md",
  "docs/contracts/v22-tencent-tc3-diagnostic-cleanup-plan.md",
]);

const blockedRecoveryCandidates = Object.freeze([
  "docs/recovery/active-surface.md",
  "docs/recovery/archive-policy.md",
  "docs/recovery/decisions.md",
  "docs/recovery/legacy-cleanup-backlog.md",
  "docs/recovery/system-domain-truth-layer-matrix.md",
  "docs/recovery/v22-agent-first-development-loop.md",
  "docs/recovery/v22-goal-state.md",
  "docs/recovery/v22-product-goal.md",
  "docs/recovery/v22-program-board.md",
  "docs/recovery/v22-program-status-table.md",
  "docs/recovery/cloud-onboarding-execution-board.md",
  "docs/recovery/cloud-onboarding-status-table.md",
]);

const blockedScriptCandidates = Object.freeze([
  "scripts/v22-agent-workflow.mjs",
  "scripts/sync-workspace-file-to-minio.ps1",
  "scripts/smoke-test-v22-mvp-contract-suite.mjs",
  "scripts/smoke-test-v22-workflow-gate.mjs",
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

for (const requiredPath of [
  indexPath,
  agentRunPath,
  previousSmokeEvalRunPath,
  "docs/contracts/v22-smoke-eval-boundary.md",
  "docs/recovery/v22-agent-verify-manifest.json",
  "scripts/smoke-test-v22-contract-smoke-eval-index-compaction.mjs",
]) {
  assert.equal(await exists(requiredPath), true, `required_compaction_file_missing:${requiredPath}`);
}

const files = trackedFiles();
const contractFiles = files.filter((file) => /^docs\/contracts\/v22-.+\.md$/u.test(file));
const smokeEvalScripts = files.filter((file) => /^scripts\/smoke-test-v22-.+\.mjs$/u.test(file));
const tierCounts = Object.fromEntries([
  "health-check",
  "smoke-golden",
  "contract-local",
  "local-regression",
  "future-authorized",
  "retired",
].map((tier) => [tier, listSmokeEvalScripts({ tiers: [tier] }).length]));

assert.equal(contractFiles.length, 42, `contract_file_count_mismatch:${contractFiles.length}`);
assert.deepEqual(Object.keys(SMOKE_CLASSIFICATION).sort(), smokeEvalScripts, "all_v22_eval_scripts_must_be_classified");
assert(smokeEvalScripts.length >= 149, `v22_eval_script_count_must_not_drop_below_compaction_baseline:${smokeEvalScripts.length}`);
assert.equal(tierCounts["health-check"], 6, "health_check_count_must_remain_small");
assert.equal(tierCounts["smoke-golden"], 11, "smoke_golden_count_must_remain_stable");
assert(tierCounts["contract-local"] >= 22, "contract_local_count_must_include_compaction_gates");
assert.equal(tierCounts["local-regression"], 62, "local_regression_count_must_remain_stable");
assert.equal(tierCounts["future-authorized"], 48, "future_authorized_count_must_remain_stable");
assert.equal(tierCounts.retired, 0, "retired_eval_tier_must_remain_zero");

const metadata = smokeEvalMetadataOf("scripts/smoke-test-v22-contract-smoke-eval-index-compaction.mjs");
assert.equal(metadata.tier, "contract-local", "this_gate_must_be_contract_local");
assert.equal(metadata.surface, "control-plane", "this_gate_must_be_control_plane");
assert.equal(metadata.entryKind, "atomic", "this_gate_must_be_atomic");
assert.equal(metadata.authorization, "none", "this_gate_must_not_authorize_future_cloud");

const suiteWrappers = smokeEvalScripts
  .filter((scriptPath) => smokeEvalMetadataOf(scriptPath).entryKind === "suite-wrapper")
  .sort();
assert.deepEqual(suiteWrappers, [
  "scripts/smoke-test-v22-cloud-resource-contract-suite.mjs",
  "scripts/smoke-test-v22-golden-smoke-suite.mjs",
  "scripts/smoke-test-v22-mvp-contract-suite.mjs",
  "scripts/smoke-test-v22-portal-runtime-suite.mjs",
], "suite_wrappers_must_remain_explicit");
assert.deepEqual(
  smokeEvalScripts
    .filter((scriptPath) => smokeEvalMetadataOf(scriptPath).entryKind === "gate-self-test")
    .sort(),
  ["scripts/smoke-test-v22-workflow-gate.mjs"],
  "gate_self_tests_must_remain_explicit",
);

for (const scriptPath of listSmokeEvalScripts({ tiers: ["future-authorized"] })) {
  const item = smokeEvalMetadataOf(scriptPath);
  assert.equal(item.authorization, "future-authorized", `future_tier_must_use_future_authorization:${scriptPath}`);
  assert.equal(item.surface, "cloud", `future_tier_must_stay_cloud_surface:${scriptPath}`);
}

const indexText = await source(indexPath);
for (const token of [
  "contracts / truth / index / eval / agent-runs",
  "v22 contract files: `42`",
  "v22 eval scripts after this branch: `149`",
  "contract-local: `22`",
  "本轮物理删除",
  "无。",
  "四个 subagent 都是只读审计",
  "current cursor: `leaf-portal-postgres-redis-local-production-data-closure`",
]) {
  assert(indexText.includes(token), `compaction_index_token_missing:${token}`);
}

for (const repoPath of [
  ...blockedContractCandidates,
  ...blockedRecoveryCandidates,
  ...blockedScriptCandidates,
]) {
  assert.equal(await exists(repoPath), true, `blocked_candidate_must_remain_until_refs_migrate:${repoPath}`);
  assert(indexText.includes(repoPath), `compaction_index_must_record_blocked_candidate:${repoPath}`);
}

const previousRun = await source(previousSmokeEvalRunPath);
for (const token of [
  "absorbed_commit",
  previousSmokeEvalAbsorbedCommit,
  "passed / ff-only absorbed / pushed",
  "post_absorb_verification",
]) {
  assert(previousRun.includes(token), `previous_smoke_eval_run_must_have_post_absorb_truth:${token}`);
}
assert(!previousRun.includes("`pending_B_review`"), "previous_smoke_eval_run_must_not_remain_pending");

const runRecord = await source(agentRunPath);
for (const token of [
  "leaf_id",
  "cleanup-v22-contract-smoke-eval-index-compaction",
  "model",
  "gpt-5.4",
  "commit_sha",
  "20fe9ac2f4a8b94a0281032e44592c820ac7502c",
  "absorbed_commit",
  "subagents_and_models",
  "contract_subscription",
  "allowed_write_scope",
  "forbidden_scope",
  "verification_commands",
  "b_review_result",
  "accepted_content / ff-only absorbed / pushed",
  "不调用真实云",
  "不读取 secret",
  "不修改 upstream",
]) {
  assert(runRecord.includes(token), `agent_run_record_token_missing:${token}`);
}
assert(!runRecord.includes("`pending_B_review`"), "accepted_compaction_run_must_not_remain_pending");

const boundary = await source("docs/contracts/v22-smoke-eval-boundary.md");
for (const token of [
  "entryKind",
  "authorization",
  "suite-wrapper",
  "gate-self-test",
  "future-authorized",
  "默认 suite 不执行真实云",
]) {
  assert(boundary.includes(token), `smoke_eval_boundary_must_define_new_metadata:${token}`);
}

const manifest = JSON.parse(await source("docs/recovery/v22-agent-verify-manifest.json"));
const override = manifest.branch_override_suites.find((suite) => suite.id === "contract-smoke-eval-index-compaction");
assert(override, "contract_smoke_eval_index_compaction_branch_override_missing");
assert(override.branches.includes("cleanup/v22-contract-smoke-eval-index-compaction"), "contract_smoke_eval_index_compaction_branch_missing");
assert(override.commands.includes("node scripts/smoke-test-v22-contract-smoke-eval-index-compaction.mjs"), "branch_override_must_run_this_gate");
assert(override.commands.includes("node scripts/smoke-test-v22-smoke-classification-gate.mjs"), "branch_override_must_run_classification_gate");
assert(override.commands.includes("node scripts/smoke-test-v22-smoke-eval-boundary.mjs"), "branch_override_must_run_boundary_gate");
assert(override.forbidden_files.includes("services/*"), "branch_override_must_forbid_services");
assert(override.forbidden_ops.includes("postgres-redis-implementation"), "branch_override_must_forbid_postgres_redis");

const localContract = manifest.suites.find((suite) => suite.id === "local-contract");
assert(localContract, "local_contract_suite_missing");
assert(localContract.commands.includes("node scripts/smoke-test-v22-contract-smoke-eval-index-compaction.mjs"), "local_contract_suite_must_include_this_gate");

console.log(JSON.stringify({
  ok: true,
  contract: "v22_contract_smoke_eval_index_compaction",
  contractFiles: contractFiles.length,
  smokeEvalScripts: smokeEvalScripts.length,
  tierCounts,
  blockedCounts: {
    contracts: blockedContractCandidates.length,
    recovery: blockedRecoveryCandidates.length,
    scripts: blockedScriptCandidates.length,
  },
}, null, 2));
