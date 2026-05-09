import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const boardPath = "docs/recovery/cloud-onboarding-execution-board.md";
const statusPath = "docs/recovery/cloud-onboarding-status-table.md";
const matrixPath = "docs/recovery/status-matrix.md";
const suitePath = "scripts/smoke-test-v22-mvp-contract-suite.mjs";

const phaseNames = [
  "official SDK provider strategy",
  "official SDK wrapper",
  "official SDK dependency loader",
  "check-config",
  "default gate",
  "user-authorized readonly live",
  "readonly report review",
  "TC3 cleanup gate",
  "create/release dry-run plan",
  "mutation SDK wrapper",
  "minimal authorized create/release live",
  "production deploy execution",
  "Portal production integration",
  "canary / QA / release status update",
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

const [board, status, matrix, suite] = await Promise.all([
  readFile(boardPath, "utf8"),
  readFile(statusPath, "utf8"),
  readFile(matrixPath, "utf8"),
  readFile(suitePath, "utf8"),
]);

assertIncludesAll(board, [
  "v22 Cloud Onboarding Central Execution Board",
  "program id: v22-cloud-onboarding",
  "current trunk anchor: 148f5a0",
  "current phase: check-config / default gate / user-authorized official SDK readonly live",
  "AGENTS 管纪律，contracts 管边界，execution board 管当前 program/phase/lane/离场条件，status table 管每阶段状态和下一棒",
  "docs/contracts/v22-cloud-onboarding-workflow-boundary.md",
  "docs/recovery/cloud-onboarding-status-table.md",
  "不读 secret",
  "不调用真实云",
  "不改 deploy",
  "不 build/push/kubectl",
], "board_scope");

assertIncludesAll(board, phaseNames, "board_phase_names");

assertIncludesAll(board, [
  "current lane",
  "next lane",
  "serial real side effects",
  "parallel lane rules",
  "exit criteria",
  "blocker routing",
  "user confirmation gates",
  "真实云 live",
  "create/release",
  "deploy/build/push/kubectl",
  "依赖安装",
  "merge/push",
  "docs/contracts",
  "smoke",
  "fake wrapper",
  "cleanup plan",
  "topology/deploy contract",
], "board_execution_rules");

assertIncludesAll(board, [
  "open issue: workflow contract phase 12 required contracts still includes deploy plan contract",
  "open issue: workflow contract phase 14 required contracts still includes role surface contracts and release/status docs",
  "本分支只登记 open issue，不修改 workflow 合同",
], "board_open_issues");

assertIncludesAll(status, [
  "v22 Cloud Onboarding Status Table",
  "program id: v22-cloud-onboarding",
  "phase id",
  "phase name",
  "status",
  "evidence commit / report",
  "owner",
  "next action",
  "required smoke",
  "user gate",
], "status_scope");

assertIncludesAll(status, phaseNames, "status_phase_names");

assertIncludesAll(status, [
  "| CO-01 | official SDK provider strategy | done |",
  "| CO-02 | official SDK wrapper | done |",
  "| CO-03 | official SDK dependency loader | done |",
  "| CO-04 | check-config | active |",
  "| CO-05 | default gate | pending |",
  "| CO-06 | user-authorized readonly live | needs-user-authorization |",
  "| CO-07 | readonly report review | pending |",
  "| CO-08 | TC3 cleanup gate | blocked | pending official SDK live report |",
  "| CO-09 | create/release dry-run plan | pending |",
  "| CO-10 | mutation SDK wrapper | pending |",
  "| CO-11 | minimal authorized create/release live | pending |",
  "| CO-12 | production deploy execution | pending |",
  "| CO-13 | Portal production integration | pending |",
  "| CO-14 | canary / QA / release status update | pending |",
], "status_current_truth");

assertIncludesAll(status, [
  "official SDK provider strategy: done",
  "official SDK wrapper: done",
  "official SDK dependency loader: done",
  "cloud onboarding workflow boundary: done",
  "check-config/default gate/user-authorized official SDK readonly live: next/pending",
  "TC3 cleanup: pending official SDK live report",
  "create/release dry-run: pending",
  "mutation wrapper: pending",
  "production deploy: pending",
  "Portal production integration: pending",
  "canary/QA/release status: pending",
], "status_plain_language_summary");

const boardData = extractJsonBlock(board, "v22-cloud-onboarding-execution-board");
assert.equal(boardData.programId, "v22-cloud-onboarding", "board_program_id_mismatch");
assert.equal(boardData.currentTrunkAnchor, "148f5a0", "board_trunk_anchor_mismatch");
assert.equal(boardData.readsSecretNow, false, "board_must_not_read_secret_now");
assert.equal(boardData.callsRealCloudNow, false, "board_must_not_call_real_cloud_now");
assert.equal(boardData.modifiesDeployNow, false, "board_must_not_modify_deploy_now");
assert.equal(boardData.runsBuildPushKubectlNow, false, "board_must_not_build_push_kubectl_now");
assert.equal(boardData.automerges, false, "board_must_not_auto_merge");
assert.equal(boardData.autopushes, false, "board_must_not_auto_push");
assert.deepEqual(boardData.serialRealSideEffects, [
  "真实云 live",
  "create/release",
  "deploy/build/push/kubectl",
  "依赖安装",
  "merge/push",
], "board_serial_side_effects_mismatch");
assert.deepEqual(boardData.parallelLaneRules, [
  "docs/contracts",
  "smoke",
  "fake wrapper",
  "cleanup plan",
  "topology/deploy contract",
], "board_parallel_lane_rules_mismatch");

const statusData = extractJsonBlock(status, "v22-cloud-onboarding-status-table");
assert.equal(statusData.programId, "v22-cloud-onboarding", "status_program_id_mismatch");
assert.equal(statusData.currentTrunkAnchor, "148f5a0", "status_trunk_anchor_mismatch");
assert.equal(statusData.workflowBoundaryEvidence, "148f5a0", "status_workflow_boundary_evidence_mismatch");
assert.equal(statusData.phases.length, 14, "status_phase_count_mismatch");
assert.deepEqual(statusData.phases.map((phase) => phase.phaseName), phaseNames, "status_phase_order_mismatch");
for (const phase of statusData.phases) {
  for (const key of [
    "phaseId",
    "phaseName",
    "status",
    "evidenceCommitOrReport",
    "owner",
    "nextAction",
    "requiredSmoke",
    "userGate",
  ]) {
    assert(Object.hasOwn(phase, key), `status_phase_${phase.phaseId}_missing:${key}`);
  }
  assert(["done", "active", "pending", "blocked", "needs-user-authorization"].includes(phase.status), `status_phase_${phase.phaseId}_invalid_status:${phase.status}`);
}

const statusById = Object.fromEntries(statusData.phases.map((phase) => [phase.phaseId, phase]));
assert.equal(statusById["CO-01"].status, "done", "co01_must_be_done");
assert.equal(statusById["CO-02"].status, "done", "co02_must_be_done");
assert.equal(statusById["CO-03"].status, "done", "co03_must_be_done");
assert.equal(statusById["CO-04"].status, "active", "co04_must_be_active");
assert.equal(statusById["CO-05"].status, "pending", "co05_must_be_pending");
assert.equal(statusById["CO-06"].status, "needs-user-authorization", "co06_must_need_user_authorization");
assert.equal(statusById["CO-08"].status, "blocked", "co08_must_be_blocked_until_live_report");

assertIncludesAll(matrix, [
  "cloud onboarding execution board",
  "cloud-onboarding-execution-board.md",
  "cloud-onboarding-status-table.md",
  "v22-cloud-onboarding",
], "status_matrix_reference");

assert(suite.includes("smoke-test-v22-cloud-onboarding-board-status.mjs"), "mvp_suite_must_include_cloud_onboarding_board_status_smoke");

assertNotIncludesAny(board + status, [
  "\"readsSecretNow\": true",
  "\"callsRealCloudNow\": true",
  "\"modifiesDeployNow\": true",
  "\"runsBuildPushKubectlNow\": true",
  "\"automerges\": true",
  "\"autopushes\": true",
  "默认读取 secret",
  "默认调用真实云",
  "默认修改 deploy",
], "board_status_forbidden_claims");

console.log(JSON.stringify({
  ok: true,
  contract: "v22_cloud_onboarding_board_status",
  checked: [
    "central_execution_board_scope",
    "status_table_phase_truth",
    "current_trunk_anchor",
    "serial_and_parallel_rules",
    "open_issues_for_generic_required_contract_names",
    "status_matrix_and_suite_references",
  ],
}, null, 2));
