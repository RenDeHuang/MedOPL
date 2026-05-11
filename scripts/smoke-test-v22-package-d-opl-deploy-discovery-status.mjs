import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const boardPath = "docs/recovery/cloud-onboarding-execution-board.md";
const statusPath = "docs/recovery/cloud-onboarding-status-table.md";
const matrixPath = "docs/recovery/cloud-onboarding-verification-matrix.md";
const deployContractPath = "docs/contracts/v22-authorized-tencent-deploy-execution-boundary.md";
const suitePath = "scripts/smoke-test-v22-mvp-contract-suite.mjs";

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

const [board, status, matrix, deployContract, suite] = await Promise.all([
  readFile(boardPath, "utf8"),
  readFile(statusPath, "utf8"),
  readFile(matrixPath, "utf8"),
  readFile(deployContractPath, "utf8"),
  readFile(suitePath, "utf8"),
]);

const combinedRecovery = `${board}\n${status}\n${matrix}`;

assertIncludesAll(combinedRecovery, [
  "Package D / OPL Deployment Discovery",
  "docs/v22-package-d-opl-deploy-discovery",
  "model: gpt-5.4",
  "no secret read",
  "no kubeconfig read",
  "no kubectl",
  "no build/push/deploy",
  "kube.medopl.cn",
  "portal.medopl.cn",
  "opl.medopl.cn",
  "trace.medopl.cn",
], "discovery_scope");

assertIncludesAll(combinedRecovery, [
  "default: portal-opl, opl-web-gateway-opl, portal-opl-adapter-opl",
  "portal-v21-gray: portal, opl-web-gateway, portal-opl-adapter",
  "k8s-app/qcloud-app",
  "ownerRef",
  "workspaceId",
  "resourceBindingId",
  "operationId",
  "owner guard blocker",
  "fail-closed",
], "discovery_candidate_and_blocker");

assertIncludesAll(combinedRecovery, [
  "cannot infer ownership by deployment name, namespace, IP, creation time, qcloud-app label, or manual memory",
  "不能靠 deployment 名字、namespace、IP、创建时间、qcloud-app 或人工记忆判断归属",
  "not Package D rollout",
  "does not prove build/push/kubectl/deploy completion",
  "不代表 deploy/build/push/kubectl 已完成",
], "discovery_must_not_claim_rollout");

assertIncludesAll(combinedRecovery, [
  "Portal/Gateway/Adapter/trace may be platform service targets",
  "workspace runtime targets still require workspaceId/resourceBindingId",
  "OPL deployment ownership / release plan sub-contract",
  "target class",
  "platform service target",
  "workspace runtime target",
], "discovery_contract_problem");

assertIncludesAll(deployContract, [
  "Implementation note: OPL deployment discovery",
  "This note does not loosen the current Package D contract",
  "platform service target",
  "workspace runtime target",
  "workspaceId/resourceBindingId",
  "Until a repo-tracked OPL deployment ownership / release plan sub-contract exists, Package D real rollout remains blocked",
], "deploy_contract_implementation_note");

const boardData = extractJsonBlock(board, "v22-cloud-onboarding-execution-board");
assert.equal(boardData.packageDDiscovery?.branch, "docs/v22-package-d-opl-deploy-discovery", "board_discovery_branch");
assert.equal(boardData.packageDDiscovery?.model, "gpt-5.4", "board_discovery_model");
assert.equal(boardData.packageDDiscovery?.readsSecretNow, false, "board_discovery_must_not_read_secret");
assert.equal(boardData.packageDDiscovery?.readsKubeconfigNow, false, "board_discovery_must_not_read_kubeconfig");
assert.equal(boardData.packageDDiscovery?.runsKubectlNow, false, "board_discovery_must_not_run_kubectl");
assert.equal(boardData.packageDDiscovery?.runsBuildPushDeployNow, false, "board_discovery_must_not_build_push_deploy");
assert.equal(boardData.packageDDiscovery?.rolloutDone, false, "board_discovery_must_not_mark_rollout_done");
assert.equal(boardData.packageDDiscovery?.ownerGuardBlocked, true, "board_discovery_owner_guard_blocker");
assert.equal(boardData.packageDDiscovery?.requiresOwnershipReleasePlanSubContract, true, "board_discovery_requires_subcontract");
assert.deepEqual(boardData.packageDDiscovery?.runtimeSurfaces, [
  "portal.medopl.cn",
  "opl.medopl.cn",
  "trace.medopl.cn"
], "board_discovery_runtime_surfaces");

const statusData = extractJsonBlock(status, "v22-cloud-onboarding-status-table");
assert.equal(statusData.packageDDiscovery?.branch, "docs/v22-package-d-opl-deploy-discovery", "status_discovery_branch");
assert.equal(statusData.packageDDiscovery?.status, "blocked_by_owner_guard_and_release_plan_contract", "status_discovery_state");
assert.equal(statusData.packageDDiscovery?.rolloutDone, false, "status_discovery_must_not_mark_rollout_done");
assert.equal(statusData.packageDDiscovery?.requiresOwnershipReleasePlanSubContract, true, "status_discovery_requires_subcontract");

const matrixData = extractJsonBlock(matrix, "v22-cloud-onboarding-verification-matrix");
assert.equal(matrixData.packageDDiscovery?.doesNotAuthorizeRollout, true, "matrix_discovery_no_rollout");
assert.equal(matrixData.packageDDiscovery?.ownerGuardMustRemainHard, true, "matrix_owner_guard_hard");
assert.equal(matrixData.packageDDiscovery?.requiresTargetClassContract, true, "matrix_requires_target_class_contract");

assert(suite.includes("smoke-test-v22-package-d-opl-deploy-discovery-status.mjs"), "mvp_suite_must_include_package_d_opl_discovery_status_smoke");

assertNotIncludesAny(combinedRecovery + deployContract, [
  "Package D rollout complete",
  "Package D deploy complete",
  "Package D deploy/build/push/kubectl 已完成",
  "真实 deploy/build/push/kubectl 已完成",
  "\"rolloutDone\": true",
  "\"runsKubectlNow\": true",
  "\"runsBuildPushDeployNow\": true",
  "\"ownerGuardBlocked\": false",
  "may infer ownership by deployment name",
  "may infer ownership by namespace",
  "may infer ownership by qcloud-app",
], "discovery_forbidden_claims");

console.log(JSON.stringify({
  ok: true,
  smoke: "v22_package_d_opl_deploy_discovery_status",
  branch: "docs/v22-package-d-opl-deploy-discovery",
  model: "gpt-5.4",
  rolloutDone: false,
  ownerGuardBlocked: true,
  requiresOwnershipReleasePlanSubContract: true
}, null, 2));
