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

assert.notEqual(current.current_cursor, cleanupCompletionStepId, "cleanup_completion_must_not_remain_current_cursor");
assert.notEqual(current.next_leaf, cleanupCompletionStepId, "cleanup_completion_must_not_remain_next_leaf");
assertIncludes(current.ordering?.selection_rule || "", "cleanup_completion remains a historical completed fact", "cleanup_completion_historical_selection_rule");
assertIncludes(current.dependency_ordering_repair?.rule || "", "cleanup_completion truth is historical", "cleanup_completion_historical_dependency_rule");
assert.equal(current.current_cursor, "leaf-portal-figma-make-react-ui-implementation", "cleanup_completion_current_cursor_must_remain_product_leaf");

const completionGap = gapById(current, cleanupCompletionGapId);
assert.equal(completionGap.stage, "S1 legacy cleanup", "cleanup_completion_gap_stage_mismatch");
assert.equal(completionGap.status, "cleaned", "cleanup_completion_gap_status_mismatch");
assert.equal(completionGap.cursor_eligible, false, "cleanup_completion_must_be_history_not_cursor_eligible");
assert.equal(completionGap.next_leaf_step, "monitor_only_after_B_absorb", "cleanup_completion_gap_must_be_monitor_only");
assert.deepEqual(completionGap.depends_on, cleanupGapIds, "cleanup_completion_gap_dependencies_mismatch");

assertIncludes(current.current_leaf.executable_when, "no secret", "current_leaf_no_secret_boundary");
assertIncludes(current.current_leaf.executable_when, "no build/push/kubectl", "current_leaf_no_build_push_kubectl_boundary");

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
assertIncludes(gapMatrix, "cleanup_completion truth is historical", "gap_matrix_cleanup_completion_historical_truth");
assertIncludes(goalState, "cleanup_completion truth", "goal_state_cleanup_completion_truth");
assertIncludes(goalState, "cleanup_completion truth is historical", "goal_state_cleanup_completion_historical_truth");

console.log(JSON.stringify({
  ok: true,
  contract: "v22_cleanup_completion_truth",
  cleanupCompletionStepId,
  finalCleanupGaps: cleanupGapIds,
  remainingNonCleanupNextStage: current.current_cursor,
  checked: files,
}, null, 2));
