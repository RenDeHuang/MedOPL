import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

const files = {
  gapMatrix: "docs/recovery/v22-current-vs-ideal-gap-matrix.md",
  goalLoop: "docs/recovery/v22-codex-goal-loop.md",
  goalState: "docs/recovery/v22-goal-state.md",
};

async function readRepoFile(filePath) {
  return readFile(path.join(repoRoot, filePath), "utf8");
}

function assertIncludes(source, expected, label) {
  assert(source.includes(expected), `${label}_missing:${expected}`);
}

function assertNotIncludes(source, forbidden, label) {
  assert(!source.includes(forbidden), `${label}_forbidden:${forbidden}`);
}

function extractCurrentCursor(goalState) {
  const match = goalState.match(/^- 当前 goal cursor: `([^`]+)`/mu);
  assert(match, "current_goal_cursor_missing");
  return match[1];
}

function extractGapSection(gapMatrix, gapId) {
  const pattern = new RegExp(
    `### Gap: ${gapId}\\n(?<section>[\\s\\S]*?)(?=\\n### Gap: |\\ntruth writeback section:|\\n$)`,
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

function assertStatusIn(section, gapId, allowedStatuses) {
  const status = extractField(section, "status");
  assert(
    allowedStatuses.includes(status),
    `gap_status_not_cloud_eligible:${gapId}:${status}:expected=${allowedStatuses.join("|")}`,
  );
  return status;
}

const sources = Object.fromEntries(await Promise.all(
  Object.entries(files).map(async ([key, filePath]) => [key, await readRepoFile(filePath)]),
));
const allDocs = Object.values(sources).join("\n");

const dependencyFields = [
  "depends_on:",
  "blocked_by:",
  "executable_when:",
  "stage:",
  "priority:",
  "cursor_eligible:",
];

const leafDependencyFields = [
  "depends_on:",
  "executable_when:",
  "cursor_eligible:",
  "stage:",
  "failure_state:",
];

const stageOrder = [
  "S1 legacy cleanup",
  "S2 architecture refactor",
  "S3 OPL connection productionization",
  "S4 Cloud lane productionization",
  "S5 frontend/backend product completion",
  "S6 release readiness",
];

const releaseReadinessGatePhrases = [
  "Release readiness dependency gate",
  "resource-order store/Postgres/schema cleaned 或 intentionally_retained",
  "secret hygiene cleaned",
  "legacy scripts archive cleaned",
  "Portal architecture refactor characterized/cleaned",
  "OPL connection productionization completed 或 deferred_authorized with B-accepted future-stage blocker",
  "Cloud lane productionization completed 或 deferred_authorized with B-accepted future-stage blocker",
  "frontend/backend product completion completed",
  "release readiness 未满足依赖时不能成为 current cursor",
  "Codex 不得请求 deploy/cloud 授权",
  "highest-priority executable cleanup/refactor/product leaf",
];

const deferredStatusPhrases = [
  "deferred_authorized_current_path",
  "deferred_authorized_future_stage",
  "future-stage blocker 不阻塞当前 cleanup/refactor/dev leaf",
];

const cursorRepairPhrases = [
  "cursor_ordering_repair",
  "将 current cursor 改回 highest-priority executable leaf",
  "不得把 future-stage deferred blocker 当作当前 blocker",
];

const releaseReadinessFactPhrases = [
  "用户授权意图已记录",
  "缺 concrete Package D release plan",
  "accepted preflight/build-push/dry-run evidence",
  "rollback evidence",
  "baseline/cleanup evidence",
  "release readiness 保持 deferred_authorized_future_stage",
];

const cleanupStageGatePhrases = [
  "Cleanup stage completion gate",
  "Cloud lane 不得跳过未完成 cleanup",
  "legacy cleanup prerequisites satisfied before Cloud lane cursor_eligible=true",
  "resource-order store/Postgres/schema status must be cleaned or intentionally_retained before Cloud lane",
  "open / in_progress / needs_eval / deferred_authorized_current_path cleanup gaps block Cloud lane cursor eligibility",
];

for (const field of dependencyFields) assertIncludes(sources.gapMatrix, field, "gap_dependency_field");
for (const field of leafDependencyFields) assertIncludes(sources.goalState, field, "leaf_dependency_field");
for (const stage of stageOrder) assertIncludes(allDocs, stage, "stage_order");
for (const phrase of releaseReadinessGatePhrases) assertIncludes(allDocs, phrase, "release_readiness_dependency_gate");
for (const phrase of deferredStatusPhrases) assertIncludes(allDocs, phrase, "deferred_authorized_status");
for (const phrase of cursorRepairPhrases) assertIncludes(allDocs, phrase, "cursor_ordering_repair");
for (const phrase of releaseReadinessFactPhrases) assertIncludes(allDocs, phrase, "release_readiness_authorized_blocker_fact");
for (const phrase of cleanupStageGatePhrases) assertIncludes(allDocs, phrase, "cleanup_stage_completion_gate");

const currentCursor = extractCurrentCursor(sources.goalState);
assert.notEqual(
  currentCursor,
  "leaf-release-readiness-auth-boundary",
  "release_readiness_must_not_be_current_cursor_when_dependencies_unmet",
);
assertIncludes(
  sources.goalState,
  "- 当前 goal cursor: `leaf-cloud-lane-readonly-status-audit`",
  "current_cursor_highest_priority_executable_leaf",
);
assertIncludes(
  sources.goalState,
  "- highest-priority executable leaf step: `leaf-cloud-lane-readonly-status-audit`",
  "highest_priority_executable_leaf",
);
assertIncludes(
  sources.goalState,
  "release readiness 当前状态: `deferred_authorized_future_stage`",
  "release_readiness_future_stage_state",
);
assertNotIncludes(
  sources.goalState,
  "- highest-priority executable leaf step: `deferred_authorized`",
  "deferred_authorized_is_not_executable_leaf",
);

const cleanupPrerequisites = [
  ["legacy-cleanup-user-owned", ["cleaned", "intentionally_retained"]],
  ["legacy-cleanup-resource-order", ["cleaned", "intentionally_retained"]],
  ["legacy-cleanup-secret-hygiene", ["cleaned", "gated"]],
  ["legacy-cleanup-legacy-scripts", ["cleaned", "gated"]],
];

const priorStagePrerequisites = [
  ["architecture-refactor-portal-layering", ["characterized", "cleaned", "gated"]],
  ["opl-connection-gateway-preflight-runtime-file-run-artifact-trace", ["completed", "gated", "deferred_authorized_future_stage"]],
];

const cloudLaneSection = extractGapSection(sources.gapMatrix, "cloud-lane-mock-readonly-dry-run-authorized");
const cloudLaneDependsOn = extractField(cloudLaneSection, "depends_on");

if (currentCursor === "leaf-cloud-lane-readonly-status-audit") {
  for (const [gapId, allowedStatuses] of [...cleanupPrerequisites, ...priorStagePrerequisites]) {
    const section = extractGapSection(sources.gapMatrix, gapId);
    assertStatusIn(section, gapId, allowedStatuses);
    assertIncludes(
      cloudLaneDependsOn,
      gapId,
      `cloud_lane_must_depend_on_prior_stage_${gapId}`,
    );
  }
  assertIncludes(
    cloudLaneSection,
    "cursor_eligible: true",
    "cloud_lane_cursor_eligible_true_only_after_prerequisites",
  );
}

console.log(JSON.stringify({
  ok: true,
  contract: "v22_product_goal_execution_order",
  currentCursor,
  releaseReadinessState: "deferred_authorized_future_stage",
  checked: {
    dependencyFields,
    leafDependencyFields,
    stageOrder,
  },
}, null, 2));
