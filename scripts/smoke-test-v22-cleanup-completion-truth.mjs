import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

const files = {
  current: "docs/recovery/v22-goal-current.json",
  gapMatrix: "docs/recovery/v22-current-vs-ideal-gap-matrix.md",
  goalState: "docs/recovery/v22-goal-state.md",
  statusMatrix: "docs/recovery/status-matrix.md",
  contractsReadme: "docs/contracts/README.md",
  legacyBacklog: "docs/recovery/legacy-cleanup-backlog.md",
  repoZoning: "docs/recovery/repo-zoning.md",
};

const cleanupCompletionStepId = "leaf-cleanup-completion-truth-writeback";
const cleanupCompletionGapId = "cleanup-completion-truth";
const cleanupGapIds = [
  "legacy-cleanup-user-owned",
  "legacy-cleanup-resource-order",
  "legacy-cleanup-secret-hygiene",
  "legacy-cleanup-legacy-scripts",
];

const finalCleanupStatuses = new Set([
  "cleaned",
  "tombstone_only",
  "archive_only",
  "intentionally_retained",
]);

async function readRepoFile(filePath) {
  return readFile(path.join(repoRoot, filePath), "utf8");
}

async function readJson(filePath) {
  return JSON.parse(await readRepoFile(filePath));
}

function assertIncludes(source, expected, label) {
  assert(source.includes(expected), `${label}_missing:${expected}`);
}

function gapById(current, gapId) {
  const gap = current.gaps.find((candidate) => candidate.id === gapId);
  assert(gap, `gap_missing:${gapId}`);
  return gap;
}

const [
  current,
  gapMatrix,
  goalState,
  statusMatrix,
  contractsReadme,
  legacyBacklog,
  repoZoning,
] = await Promise.all([
  readJson(files.current),
  readRepoFile(files.gapMatrix),
  readRepoFile(files.goalState),
  readRepoFile(files.statusMatrix),
  readRepoFile(files.contractsReadme),
  readRepoFile(files.legacyBacklog),
  readRepoFile(files.repoZoning),
]);

const blockingCleanupGaps = cleanupGapIds
  .map((gapId) => gapById(current, gapId))
  .filter((gap) => !finalCleanupStatuses.has(gap.status))
  .map((gap) => `${gap.id}:${gap.status}`);

assert.deepEqual(
  blockingCleanupGaps,
  [],
  `cleanup_completion_blocking_gaps:${blockingCleanupGaps.join(",")}`,
);

assert.equal(current.current_cursor, cleanupCompletionStepId, "cleanup_completion_cursor_mismatch");
assert.equal(current.next_leaf, cleanupCompletionStepId, "cleanup_completion_next_leaf_mismatch");
assert.equal(current.current_stage, "S1 legacy cleanup", "cleanup_completion_stage_mismatch");
assert(current.current_blockers.includes("none_for_cleanup_completion_truth_writeback"), "cleanup_completion_blocker_truth_missing");
assertIncludes(current.current_problem, "cleanup_completion", "cleanup_completion_current_problem");
assertIncludes(current.current_problem, "leaf-cloud-lane-readonly-status-audit", "cleanup_completion_remaining_next_stage");

const completionGap = gapById(current, cleanupCompletionGapId);
assert.equal(completionGap.stage, "S1 legacy cleanup", "cleanup_completion_gap_stage_mismatch");
assert.equal(completionGap.status, "cleaned", "cleanup_completion_gap_status_mismatch");
assert.equal(completionGap.cursor_eligible, true, "cleanup_completion_gap_cursor_eligible_mismatch");
assert.equal(completionGap.next_leaf_step, cleanupCompletionStepId, "cleanup_completion_gap_leaf_mismatch");
assert.deepEqual(completionGap.depends_on, cleanupGapIds, "cleanup_completion_gap_dependencies_mismatch");

assert.equal(current.current_leaf.step_id, cleanupCompletionStepId, "current_leaf_cleanup_completion_step_mismatch");
assert.equal(current.current_leaf.gap_id, cleanupCompletionGapId, "current_leaf_cleanup_completion_gap_mismatch");
assert.equal(current.current_leaf.stage, "S1 legacy cleanup", "current_leaf_cleanup_completion_stage_mismatch");
assert.deepEqual(current.current_leaf.depends_on, cleanupGapIds, "current_leaf_cleanup_completion_dependencies_mismatch");
assertIncludes(current.current_leaf.executable_when, "cleanup-only", "current_leaf_cleanup_only_boundary");
assertIncludes(current.current_leaf.executable_when, "no secret", "current_leaf_no_secret_boundary");
assertIncludes(current.current_leaf.executable_when, "no build/push/kubectl", "current_leaf_no_build_push_kubectl_boundary");
assert(current.current_leaf.verification_commands.includes("node scripts/smoke-test-v22-cleanup-completion-truth.mjs"), "cleanup_completion_verification_command_missing");

for (const phrase of [
  "`user_owned` primary path",
  "`resource-order` primary path",
  "med-autoscience-runner",
  "resource-provisioner",
  "OpenCost",
  "Langfuse",
]) {
  assertIncludes(statusMatrix, phrase, "status_matrix_cleanup_target");
}

assertIncludes(contractsReadme, "### Cleanup 合同包", "contracts_cleanup_package");
assertIncludes(contractsReadme, "cleanup 分支必须证明：退役后每个核心域只剩一个正式入口。", "contracts_cleanup_single_entry");
assertIncludes(legacyBacklog, "OpenCost and Langfuse Primary Narrative Retirement", "legacy_backlog_observability_slice");
assertIncludes(legacyBacklog, "completed by cleanup/v22-cleanup-completion-truth", "legacy_backlog_observability_completion");
assertIncludes(repoZoning, "observability/billing primary narrative cleanup completed by `cleanup/v22-cleanup-completion-truth`", "repo_zoning_observability_completion");
assertIncludes(gapMatrix, "### Gap: cleanup-completion-truth", "gap_matrix_cleanup_completion_gap");
assertIncludes(gapMatrix, "cleanup_completion truth", "gap_matrix_cleanup_completion_truth");
assertIncludes(goalState, "cleanup_completion truth", "goal_state_cleanup_completion_truth");

console.log(JSON.stringify({
  ok: true,
  contract: "v22_cleanup_completion_truth",
  cleanupCompletionStepId,
  finalCleanupGaps: cleanupGapIds,
  remainingNonCleanupNextStage: "leaf-cloud-lane-readonly-status-audit",
  checked: files,
}, null, 2));
