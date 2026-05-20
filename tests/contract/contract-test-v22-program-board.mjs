import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { isSmokeClassifiedIn } from "../../scripts/v22-test-classification.mjs";

const boardPath = "docs/recovery/v22-program-board.md";
const statusTablePath = "docs/recovery/v22-program-status-table.md";
const statusPath = "docs/status.md";
const matrixPath = "docs/recovery/status-matrix.md";
const suitePath = "tests/contract/contract-test-v22-mvp-contract-suite.mjs";

const windowIds = ["Window A", "Window B", "Window C", "Window D"];
const programIds = ["portal-product-surface", "cloud-onboarding", "one-person-lab-sync"];

const requiredProgramFields = [
  "program id",
  "owner window",
  "current phase",
  "active lane",
  "next lane",
  "lane worktree policy",
  "branch naming pattern",
  "write scope",
  "forbidden scope",
  "owner self-test boundary",
  "B revalidation boundary",
  "required smoke / verification",
  "parallelizable",
  "requires user authorization",
  "serial side effects",
  "B absorption status",
  "evidence commit",
  "next action",
];

const cloudOnboardingLanes = [
  "readonly-live",
  "readonly-report-review",
  "tc3-cleanup",
  "create-release-dry-run",
  "mutation-wrapper",
  "deploy-plan",
  "portal-production-integration",
  "canary-qa-release-status",
];

const portalProductSurfaceLanes = [
  "local-dev-url",
  "current-ui-qa",
  "user-flow-hardening",
  "mobile-usability",
  "production-projection-after-cloud-report",
];

const onePersonLabSyncLanes = [
  "sync-contract",
  "read-only-download-spike",
  "version-manifest",
  "integration-boundary",
  "auto-update-runner",
];

function assertIncludesAll(source, phrases, label) {
  for (const phrase of phrases) {
    assert(source.includes(phrase), `${label}_missing:${phrase}`);
  }
}

function assertNotIncludesAny(source, phrases, label) {
  for (const phrase of phrases) {
    assert.equal(source.includes(phrase), false, `${label}_must_not_include:${phrase}`);
  }
}

function extractJsonBlock(source, markerName) {
  const start = `<!-- ${markerName}:start -->`;
  const end = `<!-- ${markerName}:end -->`;
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end);
  assert(startIndex >= 0, `${markerName}_start_marker_missing`);
  assert(endIndex > startIndex, `${markerName}_end_marker_missing`);
  const block = source.slice(startIndex + start.length, endIndex);
  const match = /```json\s*([\s\S]*?)\s*```/.exec(block);
  assert(match, `${markerName}_json_fence_missing`);
  return JSON.parse(match[1]);
}

const [board, statusTable, status, matrix, suite] = await Promise.all([
  readFile(boardPath, "utf8"),
  readFile(statusTablePath, "utf8"),
  readFile(statusPath, "utf8"),
  readFile(matrixPath, "utf8"),
  readFile(suitePath, "utf8"),
]);

assertIncludesAll(board, [
  "# v22 Program Board",
  "repo-tracked truth",
  "Window A",
  "Window B",
  "Window C",
  "Window D",
  "portal-product-surface",
  "cloud-onboarding",
  "one-person-lab-sync",
  "不读 secret",
  "不调用真实云",
  "不改 services",
  "不改 deploy/.sentrux/adapters/upstream/Gateway/Runtime Bridge",
  "不 build/push/kubectl",
  "不推进 CO-06",
  "不 merge",
  "不 push",
], "board_scope");

assertIncludesAll(board, [
  "implementation owner",
  "integration/review/absorption owner",
  "docs/contracts/status owner",
  "authorized side-effect/live coordination owner",
  "不得 merge/push",
  "ff-only merge",
  "遇到 dirty/不能 ff-only 必须停",
  "默认不得执行副作用",
], "window_role_boundaries");

assertIncludesAll(board, requiredProgramFields, "board_program_fields");
assertIncludesAll(board, portalProductSurfaceLanes, "portal_product_surface_lanes");
assertIncludesAll(board, cloudOnboardingLanes, "cloud_onboarding_lanes");
assertIncludesAll(board, onePersonLabSyncLanes, "one_person_lab_sync_lanes");

assertIncludesAll(board, [
  "owner self-test",
  "B revalidation",
  "user-authorized test",
  "forbidden test",
  "readonly live、create/release、deploy/build/push/kubectl、dependency install、merge/push 必须串行",
  "除 B 的 merge/push 外，其他真实副作用必须用户显式授权",
  "任何窗口不得把聊天里的授权扩大到下一次执行",
], "test_and_side_effect_boundaries");

assertIncludesAll(statusTable, [
  "# v22 Program Status Table",
  "program id",
  "owner window",
  "current phase",
  "active lane",
  "next lane",
  "B absorption status",
  "evidence commit",
  "next action",
], "status_table_scope");

assertIncludesAll(statusTable, programIds, "status_table_program_ids");
assertIncludesAll(statusTable, [
  "docs/recovery/v22-program-board.md",
  "docs/recovery/v22-program-status-table.md",
], "status_table_cross_references");

assertIncludesAll(status, [
  "total program board: `docs/recovery/v22-program-board.md`",
  "total program status table: `docs/recovery/v22-program-status-table.md`",
], "status_references");

assertIncludesAll(matrix, [
  "v22 program board",
  "v22-program-board.md",
  "v22-program-status-table.md",
], "status_matrix_references");

assert(isSmokeClassifiedIn("tests/contract/contract-test-v22-program-board.mjs"), "mvp_suite_must_include_program_board_smoke");

const boardData = extractJsonBlock(board, "v22-program-board");
assert.equal(boardData.boardId, "v22-program-board", "board_id_mismatch");
assert.equal(boardData.readsSecretNow, false, "board_must_not_read_secret_now");
assert.equal(boardData.callsRealCloudNow, false, "board_must_not_call_real_cloud_now");
assert.equal(boardData.modifiesServicesNow, false, "board_must_not_modify_services_now");
assert.equal(boardData.runsBuildPushKubectlNow, false, "board_must_not_build_push_kubectl_now");
assert.equal(boardData.advancesCo06Now, false, "board_must_not_advance_co06_now");
assert.equal(boardData.automerges, false, "board_must_not_auto_merge");
assert.equal(boardData.autopushes, false, "board_must_not_auto_push");
assert.deepEqual(boardData.programs.map((program) => program.programId), programIds, "program_order_mismatch");
assert.deepEqual(boardData.serialSideEffects, [
  "readonly live",
  "create/release",
  "deploy/build/push/kubectl",
  "dependency install",
  "merge/push",
], "serial_side_effects_mismatch");

const windowsById = Object.fromEntries(boardData.windows.map((window) => [window.windowId, window]));
for (const windowId of windowIds) {
  assert(windowsById[windowId], `window_missing:${windowId}`);
  assert.equal(typeof windowsById[windowId].role, "string", `window_role_missing:${windowId}`);
}
assert.equal(windowsById["Window A"].role, "implementation owner", "window_a_role_mismatch");
assert.equal(windowsById["Window B"].role, "integration/review/absorption owner", "window_b_role_mismatch");
assert.equal(windowsById["Window C"].role, "docs/contracts/status owner", "window_c_role_mismatch");
assert.equal(windowsById["Window D"].role, "authorized side-effect/live coordination owner", "window_d_role_mismatch");
assert.equal(windowsById["Window A"].mayMergePush, false, "window_a_must_not_merge_push");
assert.equal(windowsById["Window C"].mayCallRealCloudByDefault, false, "window_c_must_not_call_cloud");
assert.equal(windowsById["Window D"].mayRunSideEffectsByDefault, false, "window_d_side_effect_default_must_be_false");

const programsById = Object.fromEntries(boardData.programs.map((program) => [program.programId, program]));
for (const programId of programIds) {
  const program = programsById[programId];
  assert(program, `program_missing:${programId}`);
  for (const field of [
    "ownerWindow",
    "currentPhase",
    "activeLane",
    "nextLane",
    "laneWorktreePolicy",
    "branchNamingPattern",
    "writeScope",
    "forbiddenScope",
    "ownerSelfTestBoundary",
    "bRevalidationBoundary",
    "requiredSmokeOrVerification",
    "parallelizable",
    "requiresUserAuthorization",
    "serialSideEffects",
    "bAbsorptionStatus",
    "evidenceCommit",
    "nextAction",
    "lanes",
  ]) {
    assert(Object.hasOwn(program, field), `program_${programId}_missing:${field}`);
  }
  assert(Array.isArray(program.lanes), `program_${programId}_lanes_must_be_array`);
  assert(program.writeScope.every((item) => !item.startsWith("services/")), `program_${programId}_write_scope_must_not_include_services`);
  assert(program.forbiddenScope.includes("services/"), `program_${programId}_must_forbid_services`);
}
assert.deepEqual(programsById["portal-product-surface"].lanes, portalProductSurfaceLanes, "portal_lanes_mismatch");
assert.deepEqual(programsById["cloud-onboarding"].lanes, cloudOnboardingLanes, "cloud_lanes_mismatch");
assert.deepEqual(programsById["one-person-lab-sync"].lanes, onePersonLabSyncLanes, "opl_sync_lanes_mismatch");
assert.equal(programsById["cloud-onboarding"].requiresUserAuthorization, true, "cloud_onboarding_must_require_user_authorization");
assert.equal(programsById["one-person-lab-sync"].forbiddenScope.includes("upstream/"), true, "opl_sync_must_forbid_upstream_write");

const statusData = extractJsonBlock(statusTable, "v22-program-status-table");
assert.equal(statusData.boardId, "v22-program-board", "status_table_board_id_mismatch");
assert.deepEqual(statusData.programs.map((program) => program.programId), programIds, "status_table_program_order_mismatch");
for (const program of statusData.programs) {
  for (const field of [
    "programId",
    "ownerWindow",
    "currentPhase",
    "activeLane",
    "nextLane",
    "bAbsorptionStatus",
    "evidenceCommit",
    "nextAction",
  ]) {
    assert(Object.hasOwn(program, field), `status_table_${program.programId}_missing:${field}`);
  }
}

assertNotIncludesAny(board + statusTable, [
  "\"readsSecretNow\": true",
  "\"callsRealCloudNow\": true",
  "\"modifiesServicesNow\": true",
  "\"runsBuildPushKubectlNow\": true",
  "\"advancesCo06Now\": true",
  "\"automerges\": true",
  "\"autopushes\": true",
  "默认读 secret",
  "默认调用真实云",
  "默认执行 deploy",
], "program_board_forbidden_claims");

console.log(JSON.stringify({
  ok: true,
  contract: "v22_program_board",
  checked: [
    "window_roles",
    "three_programs",
    "lane_lists",
    "program_required_fields",
    "test_boundaries",
    "serial_side_effects",
    "status_references",
    "mvp_suite_integration",
    "no_secret_or_cloud_default",
  ],
}, null, 2));
