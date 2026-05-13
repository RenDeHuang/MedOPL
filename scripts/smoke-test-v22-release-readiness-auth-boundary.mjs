import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

const files = {
  goalState: "docs/recovery/v22-goal-state.md",
  gapMatrix: "docs/recovery/v22-current-vs-ideal-gap-matrix.md",
  goalLoop: "docs/recovery/v22-codex-goal-loop.md",
  deployContract: "docs/contracts/v22-authorized-tencent-deploy-execution-boundary.md",
  ownershipContract: "docs/contracts/v22-opl-deployment-ownership-release-plan-boundary.md",
};

const authRecordFields = [
  "step_id",
  "authorized_operation_type",
  "secret_scope",
  "cloud_scope",
  "region",
  "resource_scope",
  "budget_limit",
  "baseline_requirement",
  "rollback_plan",
  "cleanup_plan",
  "evidence_path",
  "stop_conditions",
];

const releasePlanFields = [
  "runId",
  "versionTag",
  "namespace",
  "targets[]",
  "runtimeSmokeTargets[]",
  "ownerRef",
  "operationId",
  "expectedVersionMarker",
];

const forbiddenRiskyOperations = [
  "build/push/kubectl",
  "live-test",
  "deploy",
  "true cloud",
  "secret",
];

async function readRepoFile(filePath) {
  return readFile(path.join(repoRoot, filePath), "utf8");
}

function assertIncludes(source, expected, label) {
  assert(source.includes(expected), `${label}_missing:${expected}`);
}

function assertNotIncludes(source, forbidden, label) {
  assert(!source.includes(forbidden), `${label}_must_not_include:${forbidden}`);
}

const sources = Object.fromEntries(await Promise.all(
  Object.entries(files).map(async ([key, filePath]) => [key, await readRepoFile(filePath)]),
));

const allRecovery = `${sources.goalState}\n${sources.gapMatrix}\n${sources.goalLoop}`;

assertIncludes(sources.goalState, "当前 goal cursor: `leaf-release-readiness-auth-boundary`", "goal_state_cursor");
assertIncludes(sources.goalState, "highest-priority executable leaf step: `deferred_authorized`", "goal_state_deferred_status");
assertIncludes(sources.gapMatrix, "id: release-readiness-authorized-deploy-only", "gap_matrix_release_readiness_id");
assertIncludes(sources.gapMatrix, "status: deferred_authorized", "gap_matrix_release_readiness_status");

for (const field of authRecordFields) {
  assertIncludes(allRecovery, field, "auth_record_required_field");
}

for (const phrase of [
  "Release readiness auth boundary deferred authorization",
  "generic_chat_authorization_insufficient_for_risky_release",
  "用户笼统允许不等于可执行 build/push/kubectl/live-test/deploy/cloud/secret",
  "no_release_deploy_operation_executed",
  "deferred_authorized",
  "step-local auth record",
  "docs/recovery 只写脱敏摘要和 truth writeback",
]) {
  assertIncludes(allRecovery, phrase, "release_readiness_auth_boundary_truth");
}

for (const operation of forbiddenRiskyOperations) {
  assertIncludes(allRecovery, operation, "release_readiness_forbidden_operation_record");
}

for (const field of releasePlanFields) {
  assertIncludes(sources.deployContract, field, "deploy_contract_release_plan_field");
}

for (const phrase of [
  "runsBuildPushKubectlNow\": false",
  "doesNotAuthorizeBuildPushKubectl\": true",
  "不授权 build/push/kubectl",
  "不读取 secret",
  "不调用真实云",
]) {
  assertIncludes(`${sources.deployContract}\n${sources.ownershipContract}`, phrase, "deploy_contract_non_authorization_truth");
}

assertIncludes(
  sources.gapMatrix,
  "node scripts/smoke-test-v22-release-readiness-auth-boundary.mjs",
  "gap_matrix_release_readiness_eval",
);
assertIncludes(
  sources.goalState,
  "node scripts/smoke-test-v22-release-readiness-auth-boundary.mjs",
  "goal_state_release_readiness_eval",
);

for (const forbidden of [
  "release_readiness_authorized_to_run_build_push_kubectl_now",
  "release_readiness_authorized_to_read_secret_now",
  "release_readiness_authorized_to_call_true_cloud_now",
  "release_readiness_authorized_to_run_live_test_now",
]) {
  assertNotIncludes(allRecovery, forbidden, "release_readiness_must_not_claim_risky_authorization");
}

console.log(JSON.stringify({
  ok: true,
  contract: "v22_release_readiness_auth_boundary",
  cursor: "leaf-release-readiness-auth-boundary",
  status: "deferred_authorized",
  authorizationTruth: "generic_chat_authorization_insufficient_for_risky_release",
  riskyOperationsExecuted: false,
  checked: {
    authRecordFields,
    releasePlanFields,
    files,
  },
}, null, 2));
