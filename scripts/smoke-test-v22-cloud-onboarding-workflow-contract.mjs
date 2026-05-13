import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const contractPath = "docs/contracts/v22-cloud-onboarding-workflow-boundary.md";
const readmePath = "docs/contracts/README.md";
const suitePath = "scripts/smoke-test-v22-mvp-contract-suite.mjs";
const vibePath = "docs/vibe-coding.md";

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

const [contract, readme, suite, vibe] = await Promise.all([
  readFile(contractPath, "utf8"),
  readFile(readmePath, "utf8"),
  readFile(suitePath, "utf8"),
  readFile(vibePath, "utf8"),
]);

assertIncludesAll(contract, [
  "v22 Cloud Onboarding Workflow Boundary",
  "不替代 AGENTS.md",
  "AGENTS.md 管 A/B/C/D 纪律",
  "本合同管业务推进顺序",
  "repo-tracked workflow 合同",
  "2026-05 Framework Mapping",
  "Microsoft Azure Architecture Center",
  "Async Request-Reply",
  "Kubernetes controller pattern",
  "OpenAI Harness Engineering",
  "docs/recovery/v22-cloud-harness-manifest.json",
  "L1 -> L2a -> L2b -> L3 -> L4",
  "202 Accepted + operationId/status endpoint",
  "cleanup/reconcile",
  "baseline 必须是 `2`",
  "Future Authorized Cloud Connection Path",
  "cloud_harness_native_async_lifecycle_loop",
], "cloud_onboarding_scope");

const requiredStageNames = [
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

assertIncludesAll(contract, requiredStageNames, "cloud_onboarding_required_stage_names");

assertIncludesAll(contract, [
  "Portal API test-only fake-live bridge",
  "POST /portal/api/v22/cloud-operations/test/fake-live",
  "GET /portal/api/v22/cloud-operations/test/projection",
  "testOnly=true",
  "productionPortalConnected=false",
  "runnerMode=fake-live",
  "realCloudCalls=false",
  "PORTAL_ENABLE_CLOUD_OPERATION_TEST_BRIDGE=1",
  "`NODE_ENV` 不是 `production`",
  "production 环境必须强制关闭",
  "不得把该测试 API 当作生产 Portal 已接云",
  "create_storage",
  "create_compute",
  "expand_storage",
  "expand_compute",
  "release_compute",
  "delete_storage",
  "cloudOperations",
  "computeAllocations",
  "fileSpaceEntitlements",
  "cloudResourceProjections",
  "billingReconciliations",
  "auditEvents",
], "cloud_onboarding_portal_api_test_bridge");

assertIncludesAll(contract, [
  "owner",
  "是否可并发",
  "是否必须独立 worktree",
  "是否允许读 secret",
  "是否允许真实云",
  "required contracts",
  "required smoke",
  "success status",
  "blocker 回流到谁",
  "什么时候必须停下来问用户",
], "cloud_onboarding_stage_fields");

assertIncludesAll(contract, [
  "真实外部副作用必须串行",
  "真实云 live",
  "create/release",
  "deploy/build/push/kubectl",
  "依赖安装",
  "merge/push",
], "cloud_onboarding_serial_side_effects");

assertIncludesAll(contract, [
  "可并发项",
  "docs/contracts",
  "smoke",
  "fake wrapper",
  "cleanup plan",
  "topology/deploy contract",
], "cloud_onboarding_parallel_work");

assertIncludesAll(contract, [
  "不自动 merge",
  "不自动 push",
  "不读 secret",
  "不调用真实云",
  "只能生成任务包、可跑路径和下一步建议",
  "cloud-onboarding status --json",
], "cloud_onboarding_non_goals_and_future_script");

const workflow = extractJsonBlock(contract, "v22-cloud-onboarding-workflow-contract");
assert.equal(workflow.contract, "v22_cloud_onboarding_workflow_boundary", "contract_data_name_mismatch");
assert.equal(workflow.replacesAgentsMd, false, "contract_must_not_replace_agents_md");
assert.equal(workflow.oldCoPhaseStateMachineRetired, true, "old_co_phase_state_machine_must_be_retired");
assert.equal(workflow.activeGatePrefix, "CC", "active_gate_prefix_mismatch");
assert.deepEqual(workflow.retiredLegacyGateAliases, [
  "C00",
  "C01",
  "C02",
  "C03",
  "C04",
  "CO-01..CO-14",
], "retired_legacy_aliases_mismatch");
assert.equal(workflow.loopName, "cloud_harness_native_async_lifecycle_loop", "loop_name_mismatch");
assert.equal(workflow.harnessManifest, "docs/recovery/v22-cloud-harness-manifest.json", "workflow_harness_manifest");
assert.deepEqual(workflow.productionAcceptanceLevels, ["L1", "L2a", "L2b", "L3", "L4"], "workflow_l1_l4_levels");
assert.equal(workflow.liveBaselineDesiredCapacity, 2, "workflow_live_baseline_must_be_2");
assert.equal(workflow.cleanupRequiredForLiveRuns, true, "workflow_cleanup_required");
assert.equal(workflow.automerges, false, "workflow_must_not_auto_merge");
assert.equal(workflow.autopushes, false, "workflow_must_not_auto_push");
assert.equal(workflow.readsSecretNow, false, "workflow_must_not_read_secret_now");
assert.equal(workflow.callsRealCloudNow, false, "workflow_must_not_call_real_cloud_now");
assert.equal(workflow.installsDependencyNow, false, "workflow_must_not_install_dependency_now");
assert.equal(workflow.executesMutationNow, false, "workflow_must_not_execute_mutation_now");
assert.equal(workflow.runsBuildPushKubectlNow, false, "workflow_must_not_build_push_kubectl_now");
assert.equal(workflow.generatesOnlyTaskPackagesAndNextStepSuggestions, true, "workflow_must_only_generate_task_packages");
assert.equal(workflow.scriptLaneType, "cloud-onboarding", "workflow_script_lane_type");
assert.equal(workflow.implementsScriptLogicNow, true, "workflow_script_logic_now");

assert.deepEqual(workflow.serialExternalSideEffects, [
  "真实云 live",
  "create/release",
  "deploy/build/push/kubectl",
  "依赖安装",
  "merge/push",
], "serial_side_effects_mismatch");

assert.deepEqual(workflow.parallelizableWork, [
  "docs/contracts",
  "smoke",
  "fake wrapper",
  "cleanup plan",
  "topology/deploy contract",
], "parallelizable_work_mismatch");

assert.deepEqual(workflow.authorizationPackages, [
  "dependency_install",
  "readonly_connection",
  "authorized_resource_lifecycle",
  "deploy_and_production_integration",
], "authorization_packages_mismatch");

assert.deepEqual(workflow.futureAuthorizedPath.map((step) => step.step), [
  "R-00",
  "R-01",
  "R-02",
  "R-03",
  "R-04",
  "R-05",
  "R-06",
  "R-07",
  "R-08",
  "R-09",
  "R-10",
  "R-11",
  "R-12",
  "R-13",
  "R-14",
  "R-15",
  "R-16",
  "R-17",
  "R-18",
  "R-19",
  "R-20",
  "R-21",
], "future_authorized_path_step_order_mismatch");
assert(workflow.futureAuthorizedPath.every((step) => step.gateId.startsWith("CC-")), "future_authorized_path_must_use_cc_gate_ids");
assert(workflow.futureAuthorizedPath.some((step) => step.artifactPath === ".runtime/v22-registry/<run-id>.json"), "future_authorized_path_registry_artifact_missing");
assert(workflow.futureAuthorizedPath.some((step) => step.artifactPath === ".runtime/v22-runtime-smoke/<run-id>.json"), "future_authorized_path_runtime_smoke_artifact_missing");
for (const step of workflow.futureAuthorizedPath) {
  for (const key of ["step", "gateId", "authorizationPackage", "entrypoint", "artifactPath", "blockerWriteback"]) {
    assert(Object.hasOwn(step, key), `future_authorized_path_${step.step}_missing:${key}`);
  }
}

assert.equal(workflow.portalApiTestBridge?.testOnly, true, "portal_api_test_bridge_must_be_test_only");
assert.equal(workflow.portalApiTestBridge?.productionPortalConnected, false, "portal_api_test_bridge_must_not_claim_production_connected");
assert.equal(workflow.portalApiTestBridge?.runnerMode, "fake-live", "portal_api_test_bridge_runner_mode");
assert.equal(workflow.portalApiTestBridge?.realCloudCalls, false, "portal_api_test_bridge_must_not_call_real_cloud");
assert.equal(workflow.portalApiTestBridge?.readsSecretNow, false, "portal_api_test_bridge_must_not_read_secret");
assert.equal(workflow.portalApiTestBridge?.defaultRouteEnabled, false, "portal_api_test_bridge_must_be_disabled_by_default");
assert.equal(workflow.portalApiTestBridge?.enableEnv, "PORTAL_ENABLE_CLOUD_OPERATION_TEST_BRIDGE", "portal_api_test_bridge_enable_env");
assert.equal(workflow.portalApiTestBridge?.requiresEnableEnvValue, "1", "portal_api_test_bridge_enable_env_value");
assert.equal(workflow.portalApiTestBridge?.forbidsProductionRouteRegistration, true, "portal_api_test_bridge_must_be_disabled_in_production");
assert.deepEqual(workflow.portalApiTestBridge?.apiPaths, [
  "POST /portal/api/v22/cloud-operations/test/fake-live",
  "GET /portal/api/v22/cloud-operations/test/projection",
], "portal_api_test_bridge_paths");
assert.deepEqual(workflow.portalApiTestBridge?.operations, [
  "create_storage",
  "create_compute",
  "expand_storage",
  "expand_compute",
  "release_compute",
  "delete_storage",
], "portal_api_test_bridge_operations");
assert(workflow.portalApiTestBridge?.canonicalRecords.includes("cloudOperations"), "portal_api_test_bridge_cloud_operations_record_missing");
assert(workflow.portalApiTestBridge?.canonicalRecords.includes("computeAllocations"), "portal_api_test_bridge_compute_allocations_record_missing");
assert(workflow.portalApiTestBridge?.canonicalRecords.includes("fileSpaceEntitlements"), "portal_api_test_bridge_file_space_record_missing");
assert(workflow.portalApiTestBridge?.canonicalRecords.includes("billingReconciliations"), "portal_api_test_bridge_reconciliation_record_missing");
assert.equal(workflow.portalApiTestBridge?.futureProductionPortalMustReplaceTestRoute, true, "portal_api_test_bridge_must_require_future_real_portal");
assert.equal(workflow.portalApiTestBridge?.ordinaryProjectionHidesCloudConsoleObjects, true, "portal_api_test_bridge_projection_must_hide_cloud_console_objects");

const phases = workflow.phases || [];
assert.deepEqual(phases.map((phase) => phase.name), requiredStageNames, "phase_order_mismatch");

for (const phase of phases) {
  for (const key of [
    "owner",
    "parallelizable",
    "requiresIndependentWorktree",
    "readsSecretAllowed",
    "realCloudAllowed",
    "requiredContracts",
    "requiredSmoke",
    "successStatus",
    "blockerReturnsTo",
    "mustStopAndAskUserWhen",
  ]) {
    assert(Object.hasOwn(phase, key), `phase_${phase.name}_missing:${key}`);
  }
  assert(["A", "B", "C", "D", "user"].includes(phase.owner), `phase_${phase.name}_invalid_owner:${phase.owner}`);
  assert(Array.isArray(phase.requiredContracts), `phase_${phase.name}_contracts_must_be_array`);
  assert(Array.isArray(phase.requiredSmoke), `phase_${phase.name}_smoke_must_be_array`);
  assert(Array.isArray(phase.mustStopAndAskUserWhen), `phase_${phase.name}_stop_conditions_must_be_array`);
}

for (const phaseName of [
  "user-authorized readonly live",
  "minimal authorized create/release live",
  "production deploy execution",
]) {
  const phase = phases.find((item) => item.name === phaseName);
  assert.equal(phase.parallelizable, false, `${phaseName}_must_be_serial`);
  assert.equal(phase.requiresIndependentWorktree, true, `${phaseName}_must_use_independent_worktree`);
}

assert.equal(phases.find((item) => item.name === "user-authorized readonly live").readsSecretAllowed, true, "readonly_live_requires_user_authorized_secret_read");
assert.equal(phases.find((item) => item.name === "user-authorized readonly live").realCloudAllowed, true, "readonly_live_requires_user_authorized_real_cloud");
assert.equal(phases.find((item) => item.name === "minimal authorized create/release live").readsSecretAllowed, true, "mutation_live_requires_user_authorized_secret_read");
assert.equal(phases.find((item) => item.name === "minimal authorized create/release live").realCloudAllowed, true, "mutation_live_requires_user_authorized_real_cloud");
assert.equal(phases.find((item) => item.name === "production deploy execution").realCloudAllowed, true, "deploy_execution_requires_user_authorized_real_cloud");

assertIncludesAll(readme, [
  "v22-cloud-onboarding-workflow-boundary.md",
  "cloud onboarding workflow",
  "业务推进顺序",
  "不替代 AGENTS.md",
], "readme_cloud_onboarding_workflow");

assert(suite.includes("smoke-test-v22-cloud-onboarding-workflow-contract.mjs"), "mvp_suite_must_include_cloud_onboarding_workflow_smoke");

assertIncludesAll(vibe, [
  "v22 cloud onboarding workflow",
  "docs/contracts/v22-cloud-onboarding-workflow-boundary.md",
  "AGENTS 管流程与红线，合同管语义与验收",
], "vibe_cloud_onboarding_reference");

assertNotIncludesAny(contract, [
  "\"automerges\": true",
  "\"autopushes\": true",
  "\"readsSecretNow\": true",
  "\"callsRealCloudNow\": true",
  "\"installsDependencyNow\": true",
  "\"executesMutationNow\": true",
  "\"runsBuildPushKubectlNow\": true",
  "\"gateId\": \"C00\"",
  "\"gateId\": \"C01\"",
  "\"gateId\": \"C02\"",
  "\"gateId\": \"C03\"",
  "\"gateId\": \"C04\"",
  "| C00 |",
  "| C01 |",
  "| C02 |",
  "| C03 |",
  "| C04 |",
  "会自动 merge",
  "会自动 push",
  "默认读取 secret",
  "默认调用真实云",
], "cloud_onboarding_forbidden_claims");

console.log(JSON.stringify({
  ok: true,
  contract: "v22_cloud_onboarding_workflow_boundary",
  checked: [
    "repo_tracked_business_workflow_not_agents_replacement",
    "required_cloud_onboarding_phase_order",
    "per_phase_owner_parallel_worktree_secret_cloud_contract_smoke_success_blocker_stop_fields",
    "serial_external_side_effects",
    "parallelizable_contract_smoke_fake_wrapper_cleanup_topology_work",
    "portal_api_test_bridge",
    "runnable_cloud_connection_path",
    "legacy_c00_c04_aliases_retired",
    "workflow_generates_only_task_packages_and_next_step_suggestions",
    "readme_suite_vibe_reference",
  ],
}, null, 2));
