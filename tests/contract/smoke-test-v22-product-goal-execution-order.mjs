import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");

const files = {
  current: "docs/recovery/v22-goal-current.json",
  gapMatrix: "docs/recovery/v22-current-vs-ideal-gap-matrix.md",
  goalState: "docs/recovery/v22-goal-state.md",
};

const stageOrder = [
  "S1 legacy cleanup",
  "S2 architecture refactor",
  "S3 OPL connection productionization",
  "S4 Cloud lane productionization",
  "S5 frontend/backend product completion",
  "S6 release readiness",
];

const satisfiedStatuses = new Set([
  "cleaned",
  "intentionally_retained",
  "gated",
  "characterized",
  "completed",
  "deferred_authorized_future_stage",
]);

const releasePrerequisites = [
  "legacy-cleanup-resource-order",
  "legacy-cleanup-secret-hygiene",
  "legacy-cleanup-legacy-scripts",
  "architecture-refactor-portal-layering",
  "opl-connection-gateway-preflight-runtime-file-run-artifact-trace",
  "cloud-lane-mock-readonly-dry-run-authorized",
  "portal-ui-contract-truth-convergence",
  "frontend-product-react-vite-figma-make",
  "backend-product-node22-esm-layering",
  "billing-audit-preauth-ledger-release-t1",
];

async function readRepoFile(filePath) {
  return readFile(path.join(repoRoot, filePath), "utf8");
}

async function readJson(filePath) {
  return JSON.parse(await readRepoFile(filePath));
}

function assertIncludes(source, expected, label) {
  assert(source.includes(expected), `${label}_missing:${expected}`);
}

function assertNotIncludes(source, forbidden, label) {
  assert(!source.includes(forbidden), `${label}_forbidden:${forbidden}`);
}

function runConsistencyGate() {
  const result = spawnSync(process.execPath, ["tests/contract/smoke-test-v22-goal-state-consistency.mjs"], {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: "pipe",
  });
  if (result.status !== 0) {
    if (result.stdout) process.stderr.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    throw new Error("goal_state_consistency_gate_failed");
  }
}

function gapMap(current) {
  return new Map(current.gaps.map((gap) => [gap.id, gap]));
}

function stageIndex(stage) {
  const index = stageOrder.indexOf(stage);
  assert(index >= 0, `unknown_stage:${stage}`);
  return index;
}

function assertAcyclicDependencies(current) {
  const gaps = gapMap(current);
  const visiting = new Set();
  const visited = new Set();

  function visit(gapId, pathIds = []) {
    if (visited.has(gapId)) return;
    assert(!visiting.has(gapId), `dependency_cycle_detected:${[...pathIds, gapId].join("->")}`);
    const gap = gaps.get(gapId);
    assert(gap, `dependency_gap_missing:${gapId}`);
    visiting.add(gapId);
    for (const dependencyId of gap.depends_on) {
      assert(gaps.has(dependencyId), `dependency_reference_missing:${gapId}:${dependencyId}`);
      const dependency = gaps.get(dependencyId);
      assert(
        stageIndex(dependency.stage) <= stageIndex(gap.stage),
        `dependency_stage_order_violation:${gapId}:${dependencyId}`,
      );
      visit(dependencyId, [...pathIds, gapId]);
    }
    visiting.delete(gapId);
    visited.add(gapId);
  }

  for (const gap of current.gaps) visit(gap.id);
}

function computeExecutableLeaf(current) {
  const gaps = gapMap(current);
  const candidates = current.gaps
    .filter((gap) => gap.cursor_eligible)
    .filter((gap) => gap.next_leaf_step && !["monitor_only_after_B_absorb", "write_eval_shell"].includes(gap.next_leaf_step))
    .filter((gap) => gap.depends_on.every((dependencyId) => satisfiedStatuses.has(gaps.get(dependencyId)?.status)))
    .sort((left, right) => left.priority - right.priority);

  assert(candidates.length > 0, "no_executable_leaf_candidates");
  return candidates[0];
}

function assertReleaseReadinessOrdering(current) {
  const gaps = gapMap(current);
  const releaseGap = gaps.get("release-readiness-authorized-deploy-only");
  assert(releaseGap, "release_readiness_gap_missing");
  assert.equal(releaseGap.status, "deferred_authorized_future_stage", "release_readiness_status_mismatch");
  assert.equal(releaseGap.cursor_eligible, false, "release_readiness_must_not_be_cursor_eligible");
  assert.equal(current.release_readiness_state.status, "deferred_authorized_future_stage", "release_readiness_current_state_status_mismatch");
  assert.equal(current.release_readiness_state.cursor_eligible, false, "release_readiness_current_state_cursor_eligible_mismatch");
  for (const prerequisite of releasePrerequisites) {
    assert(releaseGap.depends_on.includes(prerequisite), `release_readiness_prerequisite_missing:${prerequisite}`);
  }
}

runConsistencyGate();

const [current, gapMatrix, goalState] = await Promise.all([
  readJson(files.current),
  readRepoFile(files.gapMatrix),
  readRepoFile(files.goalState),
]);

assert.deepEqual(current.stage_order, stageOrder, "stage_order_mismatch");
assertAcyclicDependencies(current);

const executable = computeExecutableLeaf(current);
assert.equal(executable.next_leaf_step, current.next_leaf, "highest_priority_executable_leaf_mismatch");
assert.equal(current.current_cursor, current.next_leaf, "current_cursor_must_match_highest_priority_leaf");
assert.equal(executable.id, current.current_leaf.gap_id, "current_leaf_gap_mismatch");
assert.equal(executable.stage, current.current_leaf.stage, "current_leaf_stage_mismatch");

assertReleaseReadinessOrdering(current);

assertIncludes(gapMatrix, "Dependency Stage Order", "gap_matrix_stage_order");
assertIncludes(gapMatrix, "Release readiness dependency gate", "gap_matrix_release_readiness_gate");
assertIncludes(gapMatrix, "Product Completion Scoreboard", "gap_matrix_scoreboard_pointer");
assertIncludes(goalState, "canonical current state: `docs/recovery/v22-goal-current.json`", "goal_state_current_json_pointer");
assertNotIncludes(goalState, "- highest-priority executable leaf step: `deferred_authorized`", "deferred_authorized_is_not_current_executable_leaf");

console.log(JSON.stringify({
  ok: true,
  contract: "v22_product_goal_execution_order",
  currentCursor: current.current_cursor,
  computedExecutableLeaf: executable.next_leaf_step,
  releaseReadinessState: current.release_readiness_state.status,
  checked: {
    canonicalCurrentState: files.current,
    stageOrder,
    releasePrerequisites,
  },
}, null, 2));
