import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
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
  "tombstone_only",
  "archive_only",
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

const additiveTruthBranches = new Set([
  "contract/v22-saas-control-plane-ux-truth",
]);

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

const expectedScoreLevels = [
  "0_not_started",
  "1_contract_defined",
  "2_local_api",
  "3_local_ui",
  "4_fake_live",
  "5_authorized_canary",
  "6_productionized",
  "7_monitored",
];

const expectedAbsorbedHeadResolution = {
  mode: "runtime_git_head_after_ff_only_absorb",
  target_branch: "recovery/platform-v22-trunk",
  reason: "commit_sha_cannot_be_embedded_in_the_same_commit_without_changing_the_commit_sha",
};

const requiredCurrentFields = [
  "schema_version",
  "base_trunk_head",
  "expected_absorbed_head",
  "trunk_head",
  "current_branch",
  "current_branch_role",
  "authoring_branch",
  "target_branch",
  "current_cursor",
  "next_leaf",
  "current_stage",
  "current_risk_class",
  "current_blockers",
  "release_readiness_state",
  "dependency_ordering_repair",
  "last_absorbed_commit",
  "last_updated_at",
  "truth_source_files",
];

const requiredCurrentSchemaFields = [
  "schema_version",
  "trunk_head",
  "current_branch",
  "current_cursor",
  "next_leaf",
  "current_stage",
  "current_risk_class",
  "current_blockers",
  "release_readiness_state",
  "dependency_ordering_repair",
  "last_absorbed_commit",
  "last_updated_at",
  "truth_source_files",
  "canonical",
  "current_truth_role",
  "markdown_role",
  "last_updated_at",
  "model",
  "branch_baseline",
  "base_trunk_head",
  "expected_absorbed_head",
  "git_observation",
  "current_problem",
  "scoreboard_boundary",
  "execution_order_source",
  "stage_order",
  "ordering",
  "gaps",
  "current_leaf",
  "verification_commands",
];

const forbiddenLegacyCurrentFields = [
  "schemaVersion",
  "machineReadableCurrentTruth",
  "markdownRole",
  "branchBaseline",
  "currentCursor",
  "highestPriorityExecutableLeafStep",
  "currentProblem",
  "stageOrder",
  "currentLeaf",
  "releaseReadiness",
  "verificationCommands",
  "git",
];

const scoreboardOrderingFields = [
  "current_cursor",
  "currentCursor",
  "next_leaf",
  "highestPriorityExecutableLeafStep",
  "current_stage",
  "currentStage",
  "cursor_eligible",
  "cursorEligible",
  "depends_on",
  "dependsOn",
  "executable_when",
  "executableWhen",
  "dependency_ordering_repair",
  "dependencyOrderingRepair",
  "priority",
  "stage_order",
  "stageOrder",
  "computed_executable_leaf",
  "computedExecutableLeaf",
  "next_leaf_step",
  "nextLeafStep",
  "ordering",
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

function runGit(args) {
  const result = spawnSync("git", args, {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: "pipe",
  });
  assert.equal(result.status, 0, `git_${args.join("_")}_failed:${result.stderr || result.stdout}`);
  return result.stdout.trim();
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
    current_cursor: cursorMatch[1],
    next_leaf: leafMatch[1],
    release_readiness_state: releaseMatch[1],
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
  for (const field of requiredCurrentFields) {
    assert(Object.hasOwn(current, field), `current_required_field_missing:${field}`);
  }
  for (const field of forbiddenLegacyCurrentFields) {
    assert(!Object.hasOwn(current, field), `current_legacy_field_forbidden:${field}`);
  }
  assert.equal(current.schema_version, 1, "current_schema_version_must_be_1");
  assert.equal(current.canonical, true, "current_must_mark_canonical_true");
  assert.equal(current.current_truth_role, "single_write_entry", "current_truth_role_must_be_single_write_entry");
  assert.equal(current.markdown_role, "human_summary_history_rules_only", "markdown_role_must_be_summary_history_rules_only");
  assert.equal(current.model, "gpt-5.4", "current_model_mismatch");
  assert.equal(current.branch_baseline, "origin/recovery/platform-v22-trunk", "branch_baseline_mismatch");
  assert.equal(current.target_branch, "recovery/platform-v22-trunk", "target_branch_mismatch");
  assert.equal(current.authoring_branch, "cleanup/v22-cleanup-completion-truth", "authoring_branch_mismatch");
  assert.equal(current.current_branch, current.authoring_branch, "current_branch_must_be_authoring_source_branch");
  assert.equal(
    current.current_branch_role,
    "authoring_source_branch_not_runtime_git_branch",
    "current_branch_role_mismatch",
  );
  const runtimeBranch = runGit(["branch", "--show-current"]);
  assert(
    runtimeBranch === current.authoring_branch ||
      runtimeBranch === current.target_branch ||
      additiveTruthBranches.has(runtimeBranch),
    `runtime_branch_must_be_authoring_or_target_or_additive_truth:${runtimeBranch}`,
  );
  assert.deepEqual(current.stage_order, expectedStageOrder, "stage_order_mismatch");
  assert.equal(current.current_cursor, "leaf-cleanup-completion-truth-writeback", "current_cursor_must_preserve_cleanup_completion_fact");
  assert.equal(current.next_leaf, current.current_cursor, "next_leaf_must_match_current_cursor_for_active_leaf");
  assert.equal(current.current_stage, "S1 legacy cleanup", "current_stage_mismatch");
  assert.equal(current.current_risk_class, "local_doc_eval", "current_risk_class_mismatch");
  assert.equal(current.release_readiness_state?.status, "deferred_authorized_future_stage", "release_readiness_status_mismatch");
  assert.equal(current.release_readiness_state?.cursor_eligible, false, "release_readiness_must_not_be_cursor_eligible");
  assert.equal(current.release_readiness_state?.authorized_intent_recorded, true, "release_readiness_authorized_intent_missing");
  assert(Array.isArray(current.release_readiness_state?.missing_evidence), "release_readiness_missing_evidence_must_be_array");
  for (const missing of [
    "concrete Package D release plan",
    "concrete region",
    "accepted preflight/build-push/dry-run evidence",
    "rollback evidence",
    "baseline/cleanup evidence",
  ]) {
    assert(current.release_readiness_state.missing_evidence.includes(missing), `release_readiness_missing_evidence_not_recorded:${missing}`);
  }
  assert(Array.isArray(current.current_blockers), "current_blockers_must_be_array");
  assert(
    current.current_blockers.includes("none_for_cleanup_completion_truth_writeback"),
    "current_blockers_must_record_no_cleanup_completion_blocker",
  );
  assertPlainObject(current.dependency_ordering_repair, "dependency_ordering_repair");
  assert.equal(current.dependency_ordering_repair.status, "active", "dependency_ordering_repair_status_mismatch");
  assert.equal(current.dependency_ordering_repair.repaired_current_cursor, current.current_cursor, "dependency_ordering_repair_cursor_mismatch");
  assert(Array.isArray(current.truth_source_files), "truth_source_files_must_be_array");
  for (const filePath of Object.values(files)) {
    assert(current.truth_source_files.includes(filePath), `truth_source_file_missing:${filePath}`);
  }
  assertPlainObject(current.git_observation, "git_observation");
  assert(!Object.hasOwn(current.git_observation, "originTrunkHead"), "git_observation_legacy_originTrunkHead_forbidden");
  assert(!Object.hasOwn(current.git_observation, "branchBaseHead"), "git_observation_legacy_branchBaseHead_forbidden");
  const originTrunkHead = runGit(["rev-parse", "origin/recovery/platform-v22-trunk"]);
  const localHead = runGit(["rev-parse", "HEAD"]);
  const localHeadParent = runGit(["rev-parse", "HEAD^"]);
  assert.match(current.base_trunk_head, /^[0-9a-f]{40}$/u, "base_trunk_head_must_be_sha");
  assert.deepEqual(
    current.expected_absorbed_head,
    expectedAbsorbedHeadResolution,
    "expected_absorbed_head_must_be_runtime_resolution_not_self_referential_sha",
  );
  assert.deepEqual(
    current.git_observation.expected_trunk_head,
    current.expected_absorbed_head,
    "expected_trunk_head_must_match_expected_absorbed_head_resolution",
  );
  assert.equal(current.git_observation.observed_git_head, current.base_trunk_head, "observed_git_head_must_record_base_trunk_head");
  assert.equal(current.trunk_head, "compatibility_alias_for_expected_absorbed_head_not_static_base", "trunk_head_compatibility_alias_mismatch");
  assert.equal(current.last_absorbed_commit, current.base_trunk_head, "last_absorbed_commit_must_record_previous_absorbed_fact");
  if (runtimeBranch === current.authoring_branch) {
    assert.equal(originTrunkHead, current.base_trunk_head, "authoring_branch_origin_trunk_must_equal_base_trunk_head");
    if (localHead === current.base_trunk_head) {
      const pendingDiff = runGit(["status", "--porcelain"]);
      assert(pendingDiff.length > 0, "authoring_branch_at_base_requires_pending_cleanup_completion_diff");
    } else {
      assert.equal(localHeadParent, current.base_trunk_head, "authoring_branch_head_parent_must_equal_base_trunk_head");
    }
    assert(
      typeof current.git_observation.branch_ahead_explanation === "string" &&
      current.git_observation.branch_ahead_explanation.length > 0,
      "authoring_branch_requires_branch_ahead_explanation",
    );
  } else if (runtimeBranch === current.target_branch) {
    assert.equal(localHead, originTrunkHead, "target_branch_head_must_equal_origin_trunk_head");
    assert.notEqual(localHead, current.base_trunk_head, "target_branch_head_must_not_remain_at_base_trunk_head");
    assert.equal(localHeadParent, current.base_trunk_head, "target_branch_head_parent_must_equal_base_trunk_head");
  } else if (additiveTruthBranches.has(runtimeBranch)) {
    if (localHead === originTrunkHead) {
      const pendingDiff = runGit(["status", "--porcelain"]);
      assert(pendingDiff.length > 0, "additive_truth_branch_at_origin_requires_pending_diff");
    } else {
      runGit(["merge-base", "--is-ancestor", originTrunkHead, localHead]);
      const aheadCount = Number(runGit(["rev-list", "--count", `${originTrunkHead}..${localHead}`]));
      assert(Number.isInteger(aheadCount) && aheadCount > 0, "additive_truth_branch_must_be_ahead_of_origin_trunk");
    }
    assert.equal(
      current.current_cursor,
      "leaf-cleanup-completion-truth-writeback",
      "additive_truth_branch_must_not_advance_current_cursor",
    );
  } else {
    assert.fail(`runtime_branch_must_be_authoring_or_target_or_additive_truth:${runtimeBranch}`);
  }
  assert(Array.isArray(current.gaps), "current_gaps_missing");
  assert(current.gaps.length >= 12, "current_gaps_incomplete");
  assertPlainObject(current.current_leaf, "current_leaf");
  assert.equal(current.current_leaf.step_id, current.current_cursor, "current_leaf_step_id_mismatch");
  assert.equal(current.current_leaf.cursor_eligible, true, "current_leaf_must_be_cursor_eligible");
  assert(Array.isArray(current.current_leaf.depends_on), "current_leaf_depends_on_missing");
  assert(Array.isArray(current.current_leaf.verification_commands), "current_leaf_verification_commands_missing");
  assert.equal(current.scoreboard_boundary, "product_completion_only_not_execution_order", "scoreboard_boundary_mismatch");
  assert.equal(current.execution_order_source, "v22-goal-current.json + gap matrix depends_on/executable_when/cursor_eligible", "execution_order_source_mismatch");
}

function assertScoreboardShape(scoreboard) {
  assert.equal(scoreboard.schema_version, 1, "scoreboard_schema_version_must_be_1");
  assert.equal(scoreboard.product, "MedOPL v22", "scoreboard_product_mismatch");
  assert.equal(scoreboard.boundary, "product_completion_only_not_execution_order", "scoreboard_boundary_mismatch");
  assert.equal(scoreboard.execution_order_authority, false, "scoreboard_must_not_be_execution_order_authority");
  assert.deepEqual(scoreboard.score_levels, expectedScoreLevels, "scoreboard_score_levels_mismatch");
  assert(Array.isArray(scoreboard.capabilities), "scoreboard_capabilities_missing");
  for (const field of scoreboardOrderingFields) {
    assert(!Object.hasOwn(scoreboard, field), `scoreboard_top_level_ordering_field_forbidden:${field}`);
  }
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
    for (const field of scoreboardOrderingFields) {
      assert(!Object.hasOwn(capability, field), `scoreboard_capability_ordering_field_forbidden:${capability.id}:${field}`);
    }
  }
}

function assertSchemaShape(schema) {
  assert.equal(schema.$id, "docs/recovery/v22-goal-leaf-manifest.schema.json", "schema_id_mismatch");
  assert.equal(schema.type, "object", "schema_type_must_be_object");
  assert.equal(schema.additionalProperties, false, "schema_top_level_must_fail_closed");
  assert(Array.isArray(schema.required), "schema_required_missing");
  for (const field of requiredCurrentSchemaFields) {
    assert(schema.required.includes(field), `schema_required_field_missing:${field}`);
  }
}

function assertGapConsistency(current, gapMatrix) {
  const gapMap = asGapMap(current.gaps);
  for (const [gapId, gap] of gapMap.entries()) {
    const section = extractGapSection(gapMatrix, gapId);
    assert.equal(extractField(section, "stage"), gap.stage, `gap_stage_mismatch:${gapId}`);
    assert.equal(extractField(section, "status"), gap.status, `gap_status_mismatch:${gapId}`);
    assert.equal(extractField(section, "cursor_eligible") === "true", gap.cursor_eligible, `gap_cursor_eligible_mismatch:${gapId}`);
    assert.equal(extractField(section, "next_leaf_step"), gap.next_leaf_step, `gap_next_leaf_step_mismatch:${gapId}`);
    assert.deepEqual(parseListField(extractField(section, "depends_on")), gap.depends_on, `gap_depends_on_mismatch:${gapId}`);
    assertIncludes(section, "executable_when:", `gap_executable_when_missing:${gapId}`);
  }
}

function computeExecutableLeaf(current) {
  const gapMap = asGapMap(current.gaps);
  const satisfiedStatuses = new Set([
    "cleaned",
    "tombstone_only",
    "archive_only",
    "intentionally_retained",
    "gated",
    "characterized",
    "completed",
    "deferred_authorized_future_stage",
  ]);
  const candidates = current.gaps
    .filter((gap) => gap.cursor_eligible)
    .filter((gap) => gap.next_leaf_step && !["monitor_only_after_B_absorb", "write_eval_shell"].includes(gap.next_leaf_step))
    .filter((gap) => gap.depends_on.every((dependencyId) => satisfiedStatuses.has(gapMap.get(dependencyId)?.status)))
    .sort((left, right) => left.priority - right.priority);

  assert(candidates.length > 0, "no_executable_leaf_candidates");
  return candidates[0].next_leaf_step;
}

function assertOrderingConsistency(current) {
  assert.equal(computeExecutableLeaf(current), current.next_leaf, "computed_highest_priority_leaf_mismatch");
  const releaseGap = asGapMap(current.gaps).get("release-readiness-authorized-deploy-only");
  assert(releaseGap, "release_readiness_gap_missing");
  assert.equal(releaseGap.cursor_eligible, false, "release_readiness_gap_must_not_be_cursor_eligible");
  assert.equal(releaseGap.status, current.release_readiness_state.status, "release_gap_status_mismatch");
  for (const prerequisite of releasePrerequisites) {
    assert(releaseGap.depends_on.includes(prerequisite), `release_readiness_prerequisite_missing:${prerequisite}`);
  }
}

function assertCurrentLeafConsistency(current) {
  const currentGap = asGapMap(current.gaps).get(current.current_leaf.gap_id);
  assert(currentGap, `current_leaf_gap_missing:${current.current_leaf.gap_id}`);
  assert.equal(current.current_leaf.step_id, current.current_cursor, "current_leaf_step_id_mismatch");
  assert.equal(current.current_leaf.step_id, current.next_leaf, "current_leaf_step_next_leaf_mismatch");
  assert.equal(current.current_leaf.stage, currentGap.stage, "current_leaf_stage_gap_mismatch");
  assert.equal(current.current_leaf.cursor_eligible, currentGap.cursor_eligible, "current_leaf_cursor_eligible_gap_mismatch");
  assert.deepEqual(current.current_leaf.depends_on, currentGap.depends_on, "current_leaf_depends_on_gap_mismatch");
  assert.equal(currentGap.next_leaf_step, current.current_leaf.step_id, "current_leaf_gap_next_leaf_mismatch");
  assert(
    typeof current.current_leaf.executable_when === "string" &&
    current.current_leaf.executable_when.includes("no secret") &&
    current.current_leaf.executable_when.includes("no build/push/kubectl"),
    "current_leaf_executable_when_must_preserve_low_risk_boundary",
  );
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
assert.equal(markdownSummary.current_cursor, current.current_cursor, "goal_state_cursor_summary_mismatch");
assert.equal(markdownSummary.next_leaf, current.next_leaf, "goal_state_next_leaf_summary_mismatch");
assert.equal(markdownSummary.release_readiness_state, current.release_readiness_state.status, "goal_state_release_readiness_summary_mismatch");

assertIncludes(goalState, "JSON 是机器可读 current truth", "goal_state_canonical_json_language");
assertIncludes(goalState, "Markdown 是人类说明/历史", "goal_state_markdown_role_language");
assertIncludes(goalState, "Migration order rule", "goal_state_migration_order_rule_missing");
assertIncludes(goalState, "Single write entry rule", "goal_state_single_write_entry_rule_missing");
assertIncludes(goalState, "Scoreboard boundary rule", "goal_state_scoreboard_boundary_rule_missing");
assertNotIncludes(goalState, "## Current Executable Leaf Step", "goal_state_must_not_host_canonical_leaf_manifest");
assertNotIncludes(goalState, "## 当前 execution line 的前 5 个 leaf steps", "goal_state_must_not_host_execution_manifest");

assertIncludes(goalLoop, "8-step goal loop", "goal_loop_must_keep_8_step_loop");
assertIncludes(goalLoop, "Authorization model", "goal_loop_must_keep_auth_model");
assertIncludes(goalLoop, "Failure truth writeback", "goal_loop_must_keep_failure_rules");
assertIncludes(goalLoop, "B absorb", "goal_loop_must_keep_b_absorb_rules");
assertIncludes(goalLoop, "single write entry", "goal_loop_single_write_entry_rule_missing");
assertIncludes(goalLoop, "must not decide execution order", "goal_loop_scoreboard_boundary_rule_missing");
assertNotIncludes(goalLoop, "Dependency Graph / Execution Order Policy", "goal_loop_must_not_host_current_state_ordering");

assertIncludes(gapMatrix, "Product Completion Scoreboard", "gap_matrix_scoreboard_pointer_missing");
assertIncludes(gapMatrix, files.scoreboard, "gap_matrix_scoreboard_json_pointer_missing");
assertIncludes(gapMatrix, "scoreboard 只表达产品能力完成度，不决定 leaf execution order", "gap_matrix_scoreboard_boundary_rule_missing");
assertGapConsistency(current, gapMatrix);
assertOrderingConsistency(current);
assertCurrentLeafConsistency(current);

console.log(JSON.stringify({
  ok: true,
  contract: "v22_goal_state_consistency",
  canonicalCurrentState: files.current,
  scoreboard: files.scoreboard,
  schema: files.schema,
  current_cursor: current.current_cursor,
  next_leaf: current.next_leaf,
  release_readiness_state: current.release_readiness_state.status,
  computedExecutableLeaf: computeExecutableLeaf(current),
  capabilitiesChecked: requiredCapabilityIds.length,
}, null, 2));
