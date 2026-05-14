import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

const files = {
  current: "docs/recovery/v22-goal-current.json",
  scoreboard: "docs/recovery/v22-product-completion-scoreboard.json",
  schema: "docs/recovery/v22-goal-leaf-manifest.schema.json",
  goalState: "docs/recovery/v22-goal-state.md",
  goalLoop: "docs/recovery/v22-codex-goal-loop.md",
  gapMatrix: "docs/recovery/v22-current-vs-ideal-gap-matrix.md",
};

const allowedStatuses = new Set([
  "open",
  "in_progress",
  "needs_eval",
  "gated",
  "cleaned",
  "characterized",
  "completed",
  "intentionally_retained",
  "pending",
  "deferred_authorized_current_path",
  "deferred_authorized_future_stage",
]);

const expectedStageOrder = [
  "S1 legacy cleanup",
  "S2 architecture refactor",
  "S3 OPL connection productionization",
  "S4 Cloud lane productionization",
  "S5 frontend/backend product completion",
  "S6 release readiness",
];

const releasePrerequisites = [
  "legacy-cleanup-resource-order",
  "legacy-cleanup-secret-hygiene",
  "legacy-cleanup-legacy-scripts",
  "architecture-refactor-portal-layering",
  "opl-connection-gateway-preflight-runtime-file-run-artifact-trace",
  "cloud-lane-mock-readonly-dry-run-authorized",
  "frontend-product-vue-vite-ts-pinia",
  "backend-product-node22-esm-layering",
  "billing-audit-preauth-ledger-release-t1",
];

const requiredCapabilityIds = [
  "identity-user-created",
  "credit-account-funded",
  "portal-login-without-provider-key",
  "opl-login-with-provider-key",
  "managed-environment-open",
  "plan-and-file-space-selection",
  "user-visible-managed-workspace-state",
  "admin-ops-internal-resource-facts",
  "billing-day-reconciliation",
  "clean-upstream-opl-boundary",
  "opl-message-send",
  "opl-file-upload",
  "opl-file-backed-run",
  "opl-output-download",
  "portal-workspace-files",
  "portal-billing-projection",
  "portal-session-trace",
  "managed-environment-release",
  "release-stop-billing",
  "release-audit-record",
  "secret-token-browser-hygiene",
  "cloud-lane-readonly-dry-run-authorized-order",
  "release-readiness-deploy-runtime-smoke",
];

async function readRepoFile(filePath) {
  return readFile(path.join(repoRoot, filePath), "utf8");
}

async function readJson(filePath) {
  const source = await readRepoFile(filePath);
  return JSON.parse(source);
}

function assertIncludes(source, expected, label) {
  assert(source.includes(expected), `${label}_missing:${expected}`);
}

function assertNotIncludes(source, forbidden, label) {
  assert(!source.includes(forbidden), `${label}_forbidden:${forbidden}`);
}

function assertPlainObject(value, label) {
  assert(value && typeof value === "object" && !Array.isArray(value), `${label}_must_be_object`);
}

function extractGoalStateSummary(goalState) {
  const jsonMatch = goalState.match(/^- canonical current state: `([^`]+)`$/mu);
  const cursorMatch = goalState.match(/^- current cursor summary: `([^`]+)`$/mu);
  const leafMatch = goalState.match(/^- highest-priority executable leaf summary: `([^`]+)`$/mu);
  const releaseMatch = goalState.match(/^- release readiness summary: `([^`]+)`$/mu);

  assert(jsonMatch?.[1], "goal_state_canonical_json_pointer_missing");
  assert(cursorMatch?.[1], "goal_state_cursor_summary_missing");
  assert(leafMatch?.[1], "goal_state_highest_priority_leaf_summary_missing");
  assert(releaseMatch?.[1], "goal_state_release_readiness_summary_missing");

  return {
    jsonPath: jsonMatch[1],
    currentCursor: cursorMatch[1],
    highestPriorityExecutableLeafStep: leafMatch[1],
    releaseReadinessStatus: releaseMatch[1],
  };
}

function extractGapSection(gapMatrix, gapId) {
  const pattern = new RegExp(
    `### Gap: ${gapId}\\n(?<section>[\\s\\S]*?)(?=\\n### Gap: |\\n## Product Completion Scoreboard|\\ntruth writeback section:|\\n$)`,
    "u",
  );
  const match = gapMatrix.match(pattern);
  assert(match?.groups?.section, `gap_section_missing:${gapId}`);
  return match.groups.section;
}

function extractField(section, fieldName) {
  const pattern = new RegExp(`^- ${fieldName}: (?<value>.+)$`, "mu");
  const match = section.match(pattern);
  assert(match?.groups?.value, `gap_field_missing:${fieldName}`);
  return match.groups.value.trim();
}

function parseListField(value) {
  const trimmed = value.trim();
  if (trimmed === "[]") return [];
  const match = trimmed.match(/^\[(?<items>.*)\]$/u);
  assert(match?.groups, `list_field_malformed:${value}`);
  return match.groups.items
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function asGapMap(gaps) {
  assert(Array.isArray(gaps), "current_gaps_must_be_array");
  return new Map(gaps.map((gap) => {
    assertPlainObject(gap, "gap_entry");
    assert(typeof gap.id === "string" && gap.id.length > 0, "gap_id_missing");
    return [gap.id, gap];
  }));
}

function assertCurrentShape(current) {
  assert.equal(current.schemaVersion, 1, "current_schema_version_must_be_1");
  assert.equal(current.canonical, true, "current_must_mark_canonical_true");
  assert.equal(current.machineReadableCurrentTruth, true, "current_must_mark_machine_readable_truth");
  assert.equal(current.markdownRole, "summary_history_pointer_only", "markdown_role_must_be_pointer_only");
  assert.equal(current.branchBaseline, "origin/recovery/platform-v22-trunk", "branch_baseline_mismatch");
  assert.equal(current.model, "gpt-5.4", "current_model_mismatch");
  assert.deepEqual(current.stageOrder, expectedStageOrder, "stage_order_mismatch");
  assert.equal(current.currentCursor, current.highestPriorityExecutableLeafStep, "current_cursor_must_equal_highest_priority_leaf");
  assert.equal(current.currentCursor, current.currentLeaf?.stepId, "current_leaf_step_id_mismatch");
  assert.equal(current.releaseReadiness?.status, "deferred_authorized_future_stage", "release_readiness_status_mismatch");
  assert.equal(current.releaseReadiness?.cursorEligible, false, "release_readiness_must_not_be_cursor_eligible");
  assert.equal(current.releaseReadiness?.authorizedIntentRecorded, true, "release_readiness_authorized_intent_missing");
  assert(Array.isArray(current.releaseReadiness?.missingEvidence), "release_readiness_missing_evidence_must_be_array");
  for (const missing of [
    "concrete Package D release plan",
    "concrete region",
    "accepted preflight/build-push/dry-run evidence",
    "rollback evidence",
    "baseline/cleanup evidence",
  ]) {
    assert(current.releaseReadiness.missingEvidence.includes(missing), `release_readiness_missing_evidence_not_recorded:${missing}`);
  }
  assert(Array.isArray(current.gaps), "current_gaps_missing");
  assert(current.gaps.length >= 12, "current_gaps_incomplete");
  assertPlainObject(current.currentLeaf, "current_leaf");
  assert.equal(current.currentLeaf.cursorEligible, true, "current_leaf_must_be_cursor_eligible");
  assert(Array.isArray(current.currentLeaf.dependsOn), "current_leaf_depends_on_missing");
  assert(Array.isArray(current.currentLeaf.verificationCommands), "current_leaf_verification_commands_missing");
}

function assertScoreboardShape(scoreboard) {
  assert.equal(scoreboard.schemaVersion, 1, "scoreboard_schema_version_must_be_1");
  assert.equal(scoreboard.product, "MedOPL v22", "scoreboard_product_mismatch");
  assert(Array.isArray(scoreboard.capabilities), "scoreboard_capabilities_missing");
  const capabilityIds = new Set(scoreboard.capabilities.map((capability) => capability.id));
  for (const capabilityId of requiredCapabilityIds) {
    assert(capabilityIds.has(capabilityId), `scoreboard_capability_missing:${capabilityId}`);
  }
  for (const capability of scoreboard.capabilities) {
    assert(typeof capability.title === "string" && capability.title.length > 0, `scoreboard_capability_title_missing:${capability.id}`);
    assert(typeof capability.stage === "string" && expectedStageOrder.includes(capability.stage), `scoreboard_capability_stage_invalid:${capability.id}`);
    assert(allowedStatuses.has(capability.status), `scoreboard_capability_status_invalid:${capability.id}:${capability.status}`);
    assert(Array.isArray(capability.contracts) && capability.contracts.length > 0, `scoreboard_capability_contracts_missing:${capability.id}`);
    assert(Array.isArray(capability.evidence) && capability.evidence.length > 0, `scoreboard_capability_evidence_missing:${capability.id}`);
  }
}

function assertSchemaShape(schema) {
  assert.equal(schema.$id, "docs/recovery/v22-goal-leaf-manifest.schema.json", "schema_id_mismatch");
  assert.equal(schema.type, "object", "schema_type_must_be_object");
  assert(Array.isArray(schema.required), "schema_required_missing");
  for (const field of ["schemaVersion", "canonical", "currentCursor", "highestPriorityExecutableLeafStep", "stageOrder", "gaps", "currentLeaf", "releaseReadiness"]) {
    assert(schema.required.includes(field), `schema_required_field_missing:${field}`);
  }
}

function assertGapConsistency(current, gapMatrix) {
  const gapMap = asGapMap(current.gaps);
  for (const [gapId, gap] of gapMap.entries()) {
    const section = extractGapSection(gapMatrix, gapId);
    assert.equal(extractField(section, "stage"), gap.stage, `gap_stage_mismatch:${gapId}`);
    assert.equal(extractField(section, "status"), gap.status, `gap_status_mismatch:${gapId}`);
    assert.equal(extractField(section, "cursor_eligible") === "true", gap.cursorEligible, `gap_cursor_eligible_mismatch:${gapId}`);
    assert.equal(extractField(section, "next_leaf_step"), gap.nextLeafStep, `gap_next_leaf_step_mismatch:${gapId}`);
    assert.deepEqual(parseListField(extractField(section, "depends_on")), gap.dependsOn, `gap_depends_on_mismatch:${gapId}`);
  }
}

function computeExecutableLeaf(current) {
  const gapMap = asGapMap(current.gaps);
  const satisfiedStatuses = new Set(["cleaned", "intentionally_retained", "gated", "characterized", "completed", "deferred_authorized_future_stage"]);
  const candidates = current.gaps
    .filter((gap) => gap.cursorEligible)
    .filter((gap) => gap.nextLeafStep && !["monitor_only_after_B_absorb", "write_eval_shell"].includes(gap.nextLeafStep))
    .filter((gap) => gap.dependsOn.every((dependencyId) => satisfiedStatuses.has(gapMap.get(dependencyId)?.status)))
    .sort((left, right) => left.priority - right.priority);

  assert(candidates.length > 0, "no_executable_leaf_candidates");
  return candidates[0].nextLeafStep;
}

function assertOrderingConsistency(current) {
  assert.equal(computeExecutableLeaf(current), current.highestPriorityExecutableLeafStep, "computed_highest_priority_leaf_mismatch");
  const releaseGap = asGapMap(current.gaps).get("release-readiness-authorized-deploy-only");
  assert(releaseGap, "release_readiness_gap_missing");
  assert.equal(releaseGap.cursorEligible, false, "release_readiness_gap_must_not_be_cursor_eligible");
  assert.equal(releaseGap.status, current.releaseReadiness.status, "release_gap_status_mismatch");
  for (const prerequisite of releasePrerequisites) {
    assert(releaseGap.dependsOn.includes(prerequisite), `release_readiness_prerequisite_missing:${prerequisite}`);
  }
}

const [current, scoreboard, schema, goalState, goalLoop, gapMatrix] = await Promise.all([
  readJson(files.current),
  readJson(files.scoreboard),
  readJson(files.schema),
  readRepoFile(files.goalState),
  readRepoFile(files.goalLoop),
  readRepoFile(files.gapMatrix),
]);

assertCurrentShape(current);
assertScoreboardShape(scoreboard);
assertSchemaShape(schema);

const markdownSummary = extractGoalStateSummary(goalState);
assert.equal(markdownSummary.jsonPath, files.current, "goal_state_json_pointer_mismatch");
assert.equal(markdownSummary.currentCursor, current.currentCursor, "goal_state_cursor_summary_mismatch");
assert.equal(markdownSummary.highestPriorityExecutableLeafStep, current.highestPriorityExecutableLeafStep, "goal_state_highest_priority_summary_mismatch");
assert.equal(markdownSummary.releaseReadinessStatus, current.releaseReadiness.status, "goal_state_release_readiness_summary_mismatch");

assertIncludes(goalState, "JSON 是机器可读 current truth", "goal_state_canonical_json_language");
assertIncludes(goalState, "Markdown 是人类说明/历史", "goal_state_markdown_role_language");
assertNotIncludes(goalState, "## Current Executable Leaf Step", "goal_state_must_not_host_canonical_leaf_manifest");
assertNotIncludes(goalState, "## 当前 execution line 的前 5 个 leaf steps", "goal_state_must_not_host_execution_manifest");

assertIncludes(goalLoop, "8-step goal loop", "goal_loop_must_keep_8_step_loop");
assertIncludes(goalLoop, "Authorization model", "goal_loop_must_keep_auth_model");
assertIncludes(goalLoop, "Failure truth writeback", "goal_loop_must_keep_failure_rules");
assertIncludes(goalLoop, "B absorb", "goal_loop_must_keep_b_absorb_rules");
assertNotIncludes(goalLoop, "Dependency Graph / Execution Order Policy", "goal_loop_must_not_host_current_state_ordering");

assertIncludes(gapMatrix, "Product Completion Scoreboard", "gap_matrix_scoreboard_pointer_missing");
assertIncludes(gapMatrix, files.scoreboard, "gap_matrix_scoreboard_json_pointer_missing");
assertGapConsistency(current, gapMatrix);
assertOrderingConsistency(current);

console.log(JSON.stringify({
  ok: true,
  contract: "v22_goal_state_consistency",
  canonicalCurrentState: files.current,
  scoreboard: files.scoreboard,
  schema: files.schema,
  currentCursor: current.currentCursor,
  highestPriorityExecutableLeafStep: current.highestPriorityExecutableLeafStep,
  releaseReadinessStatus: current.releaseReadiness.status,
  computedExecutableLeaf: computeExecutableLeaf(current),
  capabilitiesChecked: requiredCapabilityIds.length,
}, null, 2));
