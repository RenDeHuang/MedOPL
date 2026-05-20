import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { smokeEvalMetadataOf } from "./v22-smoke-classification.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

const acceptedCommit = "20fe9ac2f4a8b94a0281032e44592c820ac7502c";
const traceAbsorbedCommit = "49b99d6739fff6f033118b009c36b53d29c675a5";
const thisGate = "scripts/smoke-test-v22-post-20fe9ac-agent-workflow-truth-and-repo-classification.mjs";
const indexPath = "docs/recovery/v22-post-20fe9ac-agent-workflow-truth-and-repo-classification-index.md";
const runPath = "docs/recovery/agent-runs/2026-05-20-cleanup-v22-post-20fe9ac-agent-workflow-truth-and-repo-classification.md";
const absorbedRunPath = "docs/recovery/agent-runs/2026-05-20-cleanup-v22-contract-smoke-eval-index-compaction.md";

const blockedRetainPaths = Object.freeze([
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

function runNode(args) {
  return spawnSync(process.execPath, args, {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: "pipe",
  });
}

function assertAncestor(ancestor, descendantRef, message) {
  const result = spawnSync("git", ["merge-base", "--is-ancestor", ancestor, descendantRef], {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: "pipe",
  });
  assert.equal(result.status, 0, `${message}:${result.stderr || result.stdout}`);
}

for (const repoPath of [
  indexPath,
  runPath,
  absorbedRunPath,
  thisGate,
  "docs/recovery/v22-agent-verify-manifest.json",
  "scripts/smoke-test-v22-goal-state-consistency.mjs",
]) {
  assert.equal(await exists(repoPath), true, `required_file_missing:${repoPath}`);
}

const originHead = git(["rev-parse", "origin/recovery/platform-v22-trunk"]);
assert.notEqual(originHead, "", "origin_trunk_head_must_resolve");
assertAncestor(acceptedCommit, "origin/recovery/platform-v22-trunk", "accepted_20fe9ac_must_remain_origin_trunk_ancestor");
assertAncestor(traceAbsorbedCommit, "origin/recovery/platform-v22-trunk", "post_20fe9ac_trace_commit_must_remain_origin_trunk_ancestor");

const indexText = await source(indexPath);
for (const token of [
  "contracts / truth / index / eval / agent-runs",
  "accepted absorbed commit: `20fe9ac2f4a8b94a0281032e44592c820ac7502c`",
  "trace absorbed commit: `49b99d6739fff6f033118b009c36b53d29c675a5`",
  "20fe9ac must remain an ancestor of `origin/recovery/platform-v22-trunk`",
  "A/B 边界偏差",
  "无 delete-ready",
  "HEAD == origin/recovery/platform-v22-trunk",
  "leaf-portal-postgres-redis-local-production-data-closure",
]) {
  assert(indexText.includes(token), `index_token_missing:${token}`);
}
for (const repoPath of blockedRetainPaths) {
  assert.equal(await exists(repoPath), true, `blocked_retain_path_must_still_exist:${repoPath}`);
  assert(indexText.includes(repoPath), `index_must_record_blocked_retain_path:${repoPath}`);
}

const absorbedRun = await source(absorbedRunPath);
for (const token of [
  "commit_sha",
  "absorbed_commit",
  acceptedCommit,
  "accepted_content / ff-only absorbed / pushed",
  "A/B boundary deviation",
  "A windows may prepare commits and B-review packets only",
  "post_absorb_verification",
]) {
  assert(absorbedRun.includes(token), `absorbed_run_token_missing:${token}`);
}
assert(!absorbedRun.includes("`pending_B_review`"), "accepted_20fe9ac_run_must_not_remain_pending");

const thisRun = await source(runPath);
for (const token of [
  "leaf_id",
  "model",
  "subagents_and_models",
  "base_trunk_head",
  "commit_sha",
  "absorbed_commit",
  traceAbsorbedCommit,
  "contract_subscription",
  "allowed_write_scope",
  "forbidden_scope",
  "verification_commands",
  "b_review_result",
  "passed / ff-only absorbed / pushed",
  "post_absorb_verification",
  "不读取 secret",
  "不调用真实云",
  "不修改 upstream",
  "未物理删除文件",
]) {
  assert(thisRun.includes(token), `this_run_token_missing:${token}`);
}

const goalGateSource = await source("scripts/smoke-test-v22-goal-state-consistency.mjs");
for (const token of [
  "isDetachedTargetTrunk",
  "runtimeBranch === \"\" && localHead === originTrunkHead",
  "detached_target_trunk_head_must_descend_from_base_trunk_head",
]) {
  assert(goalGateSource.includes(token), `goal_state_gate_detached_token_missing:${token}`);
}

const manifest = JSON.parse(await source("docs/recovery/v22-agent-verify-manifest.json"));
const override = manifest.branch_override_suites.find((suite) => suite.id === "post-20fe9ac-agent-workflow-truth-and-repo-classification");
assert(override, "post_20fe9ac_branch_override_missing");
assert.equal(override.branch, "cleanup/v22-post-20fe9ac-agent-workflow-truth-and-repo-classification", "post_20fe9ac_branch_mismatch");
assert(override.branches.includes("cleanup/v22-post-20fe9ac-agent-workflow-truth-and-repo-classification"), "post_20fe9ac_branch_list_missing");
assert(override.commands.includes(`node ${thisGate}`), "post_20fe9ac_override_must_run_own_gate");
assert(override.commands.includes("node scripts/smoke-test-v22-goal-state-consistency.mjs"), "post_20fe9ac_override_must_run_goal_state_gate");
assert(override.commands.includes("node scripts/smoke-test-v22-agent-run-record-gate.mjs"), "post_20fe9ac_override_must_run_agent_record_gate");
assert(override.allowed_files.includes(indexPath), "post_20fe9ac_override_must_allow_index");
assert(override.allowed_files.includes(runPath), "post_20fe9ac_override_must_allow_this_run");
assert(override.allowed_files.includes(absorbedRunPath), "post_20fe9ac_override_must_allow_absorbed_run");
assert(override.forbidden_files.includes("services/*"), "post_20fe9ac_override_must_forbid_services");
assert(override.forbidden_ops.includes("postgres-redis-implementation"), "post_20fe9ac_override_must_forbid_postgres_redis");

const metadata = smokeEvalMetadataOf(thisGate);
assert.equal(metadata.tier, "contract-local", "this_gate_must_be_contract_local");
assert.equal(metadata.surface, "control-plane", "this_gate_must_be_control_plane");
assert.equal(metadata.entryKind, "atomic", "this_gate_must_be_atomic");
assert.equal(metadata.authorization, "none", "this_gate_must_not_authorize_future_cloud");

const files = trackedFiles();
assert(files.includes(thisGate), "this_gate_must_be_tracked_after_git_add");
assert(files.includes(indexPath), "this_index_must_be_tracked_after_git_add");
for (const repoPath of blockedRetainPaths) {
  assert(files.includes(repoPath), `blocked_retain_path_must_remain_tracked:${repoPath}`);
}

const dryRun = runNode([
  "scripts/v22-verify.mjs",
  "current",
  "--base",
  "origin/recovery/platform-v22-trunk",
  "--branch",
  "cleanup/v22-post-20fe9ac-agent-workflow-truth-and-repo-classification",
  "--dry-run",
  "--json",
]);
assert.equal(dryRun.status, 0, `verify_dry_run_failed:${dryRun.stderr || dryRun.stdout}`);
const dryRunPayload = JSON.parse(dryRun.stdout);
assert.equal(dryRunPayload.ok, true, "verify_dry_run_ok_mismatch");
assert.equal(dryRunPayload.leafId, "leaf-portal-postgres-redis-local-production-data-closure", "post_20fe9ac_must_not_change_current_leaf");
assert.equal(dryRunPayload.branchOverride?.suiteId, "post-20fe9ac-agent-workflow-truth-and-repo-classification", "post_20fe9ac_dry_run_override_mismatch");
assert.deepEqual(dryRunPayload.commands, override.commands, "post_20fe9ac_dry_run_commands_mismatch");
assert.deepEqual(dryRunPayload.allowedFiles, override.allowed_files, "post_20fe9ac_dry_run_allowed_files_mismatch");

console.log(JSON.stringify({
  ok: true,
  contract: "v22_post_20fe9ac_agent_workflow_truth_and_repo_classification",
  acceptedCommit,
  blockedRetainCount: blockedRetainPaths.length,
  deleteReady: 0,
}, null, 2));
