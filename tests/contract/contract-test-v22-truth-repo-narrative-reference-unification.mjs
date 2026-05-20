import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  SMOKE_CLASSIFICATION,
  smokeEvalMetadataOf,
} from "../../scripts/v22-test-classification.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");

const thisGate = "tests/contract/contract-test-v22-truth-repo-narrative-reference-unification.mjs";
const indexPath = "docs/recovery/v22-truth-repo-narrative-reference-unification-index.md";
const runPath = "docs/recovery/agent-runs/2026-05-20-cleanup-v22-truth-repo-narrative-reference-unification.md";
const post20Gate = "tests/contract/contract-test-v22-post-20fe9ac-agent-workflow-truth-and-repo-classification.mjs";
const post20RunPath = "docs/recovery/agent-runs/2026-05-20-cleanup-v22-post-20fe9ac-agent-workflow-truth-and-repo-classification.md";
const accepted20fe9ac = "20fe9ac2f4a8b94a0281032e44592c820ac7502c";
const post20Absorbed = "49b99d6739fff6f033118b009c36b53d29c675a5";
const absorbedRecoveryFileBaseline = 55;
const absorbedV22SmokeFileBaseline = 151;
const forwardOnlyGovernanceFiles = Object.freeze([
  "docs/recovery/agent-runs/README.md",
  "docs/recovery/agent-runs/schema.md",
  "docs/recovery/v22-monolith-agent-workflow-entrypoint-and-trace-normalization-index.md",
  "docs/recovery/agent-runs/2026-05-20-cleanup-v22-monolith-agent-workflow-entrypoint-and-trace-normalization.md",
  "tests/contract/contract-test-v22-monolith-agent-workflow-entrypoint-and-trace-normalization.mjs",
]);

const rootDocs = Object.freeze([
  "AGENTS.md",
  "README.md",
  "docs/product.md",
  "docs/architecture.md",
  "docs/status.md",
  "docs/vibe-coding.md",
  "docs/invariants.md",
  "docs/decisions.md",
]);

const blockedRetainPaths = Object.freeze([
  "docs/recovery/v22-program-board.md",
  "docs/recovery/v22-program-status-table.md",
  "docs/recovery/cloud-onboarding-execution-board.md",
  "docs/recovery/cloud-onboarding-status-table.md",
  "docs/recovery/cloud-onboarding-verification-matrix.md",
  "scripts/v22-agent-workflow.mjs",
  "tests/future-authorized/cloud/future-authorized-test-v22-agent-workflow-cloud-onboarding.mjs",
  "tests/future-authorized/cloud/future-authorized-test-v22-cloud-onboarding-board-status.mjs",
  "tests/future-authorized/cloud/future-authorized-test-v22-cloud-onboarding-absorption-sequence.mjs",
  "tests/future-authorized/cloud/future-authorized-test-v22-cloud-connection-runnable-path.mjs",
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

function assertAncestor(ancestor, descendantRef, message) {
  const result = spawnSync("git", ["merge-base", "--is-ancestor", ancestor, descendantRef], {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: "pipe",
  });
  assert.equal(result.status, 0, `${message}:${result.stderr || result.stdout}`);
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

function diffFiles() {
  const outputs = [
    git(["diff", "--name-only", "origin/recovery/platform-v22-trunk...HEAD"]),
    git(["diff", "--name-only", "--cached"]),
    git(["diff", "--name-only"]),
    git(["ls-files", "--others", "--exclude-standard"]),
  ];
  return [...new Set(outputs.flatMap((output) => output.split(/\r?\n/u).filter(Boolean)))].sort();
}

function runNode(args) {
  return spawnSync(process.execPath, args, {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: "pipe",
  });
}

function assertIncludesAll(sourceText, tokens, label) {
  for (const token of tokens) {
    assert(sourceText.includes(token), `${label}_missing:${token}`);
  }
}

function assertNotIncludesAll(sourceText, tokens, label) {
  for (const token of tokens) {
    assert.equal(sourceText.includes(token), false, `${label}_must_not_include:${token}`);
  }
}

for (const repoPath of [
  ...rootDocs,
  ...blockedRetainPaths,
  indexPath,
  runPath,
  post20Gate,
  post20RunPath,
  "docs/recovery/v22-agent-verify-manifest.json",
  "scripts/v22-test-classification.mjs",
]) {
  assert.equal(await exists(repoPath), true, `required_file_missing:${repoPath}`);
}

const files = trackedFiles();
const docFiles = files.filter((file) => file.startsWith("docs/"));
const contractFiles = files.filter((file) => file === "docs/specs/README.md");
const specsText = await source("docs/specs/README.md");
const specAnchorCount = (specsText.match(/^### spec:v22-/gmu) || []).length;
const recoveryFiles = files.filter((file) => file.startsWith("docs/recovery/"));
const scriptFiles = files.filter((file) => file.startsWith("scripts/"));
const legacyScriptSmokeFiles = files.filter((file) => /^scripts\/smoke-test-v22-.+\.mjs$/u.test(file));
const smokeFiles = Object.keys(SMOKE_CLASSIFICATION)
  .filter((scriptPath) => files.includes(scriptPath))
  .sort();

assert.equal(contractFiles.length, 1, `contract_file_count_mismatch:${contractFiles.length}`);
assert.equal(specAnchorCount, 42, `spec_anchor_count_mismatch:${specAnchorCount}`);
assert(recoveryFiles.length >= absorbedRecoveryFileBaseline, `recovery_file_count_must_not_drop_below_truth_repo_baseline:${recoveryFiles.length}`);
assert.deepEqual(legacyScriptSmokeFiles, [], `legacy_scripts_smoke_tests_must_not_be_tracked:${legacyScriptSmokeFiles.join(",")}`);
assert(scriptFiles.length <= 20, `scripts_must_only_hold_support_runners_after_tests_taxonomy:${scriptFiles.length}`);
assert(smokeFiles.length >= absorbedV22SmokeFileBaseline, `v22_tests_eval_file_count_must_not_drop_below_truth_repo_baseline:${smokeFiles.length}`);
assert(docFiles.includes(indexPath), "new_index_must_be_tracked_or_staged");
assert(files.includes(thisGate), "new_gate_must_be_tracked_or_staged");
for (const repoPath of forwardOnlyGovernanceFiles) {
  assert(files.includes(repoPath), `forward_only_governance_file_must_be_tracked_or_staged:${repoPath}`);
}

const indexText = await source(indexPath);
assertIncludesAll(indexText, [
  "contracts / truth / index / eval / agent-runs",
  "base trunk: `49b99d6739fff6f033118b009c36b53d29c675a5`",
  "total audited tracked files: `259`",
  "audited line count: `67205`",
  "root governance docs auditor：`gpt-5.4`",
  "contracts auditor：`gpt-5.4`",
  "recovery truth/index auditor：`gpt-5.4`",
  "scripts smoke/eval auditor：`gpt-5.4`",
  "delete-ready files: `0`",
  "Root Governance 裁定",
  "Contracts 裁定",
  "Recovery 裁定",
  "Scripts / Eval 裁定",
  "本轮收敛",
  "Blocked Retain",
  "Delete-Ready",
  "无。",
], "index");
for (const repoPath of blockedRetainPaths) {
  assert(indexText.includes(repoPath), `index_must_record_blocked_retain:${repoPath}`);
}

const status = await source("docs/status.md");
assertIncludesAll(status, [
  "v22 当前唯一人读状态入口",
  "canonical current truth: `docs/recovery/v22-goal-current.json`",
  "verify manifest: `docs/recovery/v22-agent-verify-manifest.json`",
  "eval entrypoint: `scripts/v22-verify.mjs`",
  "retained future-authorized references",
], "status");
assertNotIncludesAll(status, [
  "当前 program/phase/lane/离场条件写在 cloud onboarding execution board",
  "execution board governs the current program",
], "status");

const invariants = await source("docs/invariants.md");
assertIncludesAll(invariants, [
  "docs/recovery/v22-goal-current.json",
  "docs/recovery/v22-agent-verify-manifest.json",
  "scripts/v22-verify.mjs",
  "future-authorized / blocked-retain 参考",
], "invariants");
assertNotIncludesAll(invariants, [
  "cloud onboarding execution board tracks current program",
], "invariants");

const decisions = await source("docs/decisions.md");
assertIncludesAll(decisions, [
  "docs/recovery/v22-goal-current.json",
  "docs/recovery/v22-agent-verify-manifest.json",
  "cloud onboarding 保留为 future-authorized lane",
  "不是当前 active program 或默认执行入口",
], "decisions");
assertNotIncludesAll(decisions, [
  "The active program is `v22-cloud-onboarding`",
  "cloud onboarding 使用 execution board + status table + v22-agent-workflow 生成任务包",
], "decisions");

const vibe = await source("docs/vibe-coding.md");
assertIncludesAll(vibe, [
  "v22 cloud onboarding workflow",
  "docs/specs/README.md",
  "AGENTS 管流程与红线，合同管语义与验收",
  "scripts/v22-verify.mjs",
  "docs/recovery/v22-agent-verify-manifest.json",
  "blocked-retain / retire-candidate",
], "vibe");
assertNotIncludesAll(vibe, [
  "node scripts/v22-agent-workflow.mjs start --type",
  "node scripts/v22-agent-workflow.mjs lane init",
], "vibe");

const post20Run = await source(post20RunPath);
assertIncludesAll(post20Run, [
  "## commit_sha",
  post20Absorbed,
  "absorbed_commit",
  post20Absorbed,
  "## b_review_result",
  "passed / ff-only absorbed / pushed",
  "## post_absorb_verification",
  "post_absorb_verification",
], "post20_run");
assertAncestor(accepted20fe9ac, "origin/recovery/platform-v22-trunk", "accepted_20fe9ac_must_remain_trunk_ancestor");
assertAncestor(post20Absorbed, "origin/recovery/platform-v22-trunk", "post20_absorbed_must_remain_trunk_ancestor");

const post20GateText = await source(post20Gate);
assertIncludesAll(post20GateText, [
  "merge-base",
  "--is-ancestor",
  "accepted_20fe9ac_must_remain_origin_trunk_ancestor",
  "post_20fe9ac_trace_commit_must_remain_origin_trunk_ancestor",
], "post20_gate");
assert(!post20GateText.includes("assert.equal(originHead, acceptedCommit"), "post20_gate_must_not_equal_historical_trunk");

const manifest = JSON.parse(await source("docs/recovery/v22-agent-verify-manifest.json"));
const override = manifest.branch_override_suites.find((suite) => suite.id === "truth-repo-narrative-reference-unification");
assert(override, "truth_repo_branch_override_missing");
assert.equal(override.branch, "cleanup/v22-truth-repo-narrative-reference-unification", "truth_repo_branch_mismatch");
assert(override.commands.includes(`node ${thisGate}`), "truth_repo_override_must_run_own_gate");
assert(override.allowed_files.includes(indexPath), "truth_repo_override_must_allow_index");
assert(override.allowed_files.includes(runPath), "truth_repo_override_must_allow_run");
assert(override.forbidden_files.includes("services/*"), "truth_repo_override_must_forbid_services");
assert(override.forbidden_ops.includes("git-push"), "truth_repo_override_must_forbid_push");

const metadata = smokeEvalMetadataOf(thisGate);
assert.equal(metadata.tier, "contract-local", "this_gate_must_be_contract_local");
assert.equal(metadata.surface, "control-plane", "this_gate_must_be_control_plane");
assert.equal(metadata.entryKind, "atomic", "this_gate_must_be_atomic");
assert.equal(metadata.authorization, "none", "this_gate_must_not_authorize_future_cloud");

const dryRun = runNode([
  "scripts/v22-verify.mjs",
  "current",
  "--base",
  "origin/recovery/platform-v22-trunk",
  "--branch",
  "cleanup/v22-truth-repo-narrative-reference-unification",
  "--dry-run",
  "--json",
]);
assert.equal(dryRun.status, 0, `verify_dry_run_failed:${dryRun.stderr || dryRun.stdout}`);
const dryRunPayload = JSON.parse(dryRun.stdout);
assert.equal(dryRunPayload.ok, true, "verify_dry_run_ok_mismatch");
assert.equal(dryRunPayload.leafId, "leaf-portal-postgres-redis-local-production-data-closure", "truth_repo_must_not_change_current_leaf");
assert.equal(dryRunPayload.branchOverride?.suiteId, "truth-repo-narrative-reference-unification", "truth_repo_dry_run_override_mismatch");
assert.deepEqual(dryRunPayload.commands, override.commands, "truth_repo_dry_run_commands_mismatch");

const changed = diffFiles();
const forbiddenChanged = changed.filter((file) => (
  file.startsWith("services/") ||
  file.startsWith("deploy/") ||
  file.startsWith(".sentrux/") ||
  file.startsWith("adapters/") ||
  file.startsWith("infra/") ||
  file.startsWith("one-person-lab/") ||
  file.startsWith("upstream/") ||
  file.startsWith(".runtime/")
));
assert.deepEqual(forbiddenChanged, [], `truth_repo_must_not_touch_forbidden_paths:${forbiddenChanged.join(",")}`);

console.log(JSON.stringify({
  ok: true,
  contract: "v22_truth_repo_narrative_reference_unification",
  audited: {
    rootGovernanceDocs: rootDocs.length,
    contractFiles: contractFiles.length,
    specAnchorCount,
    recoveryFiles: recoveryFiles.length,
    scriptFiles: scriptFiles.length,
    smokeFiles: smokeFiles.length,
  },
  deleteReady: 0,
  blockedRetainCount: blockedRetainPaths.length,
}, null, 2));
