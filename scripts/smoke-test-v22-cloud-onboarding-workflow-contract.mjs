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
  "状态机",
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
  "只能生成任务包和下一步建议",
  "本分支不实现脚本逻辑",
  "cloud-onboarding lane type",
], "cloud_onboarding_non_goals_and_future_script");

const workflow = extractJsonBlock(contract, "v22-cloud-onboarding-workflow-contract");
assert.equal(workflow.contract, "v22_cloud_onboarding_workflow_boundary", "contract_data_name_mismatch");
assert.equal(workflow.replacesAgentsMd, false, "contract_must_not_replace_agents_md");
assert.equal(workflow.automerges, false, "workflow_must_not_auto_merge");
assert.equal(workflow.autopushes, false, "workflow_must_not_auto_push");
assert.equal(workflow.readsSecretNow, false, "workflow_must_not_read_secret_now");
assert.equal(workflow.callsRealCloudNow, false, "workflow_must_not_call_real_cloud_now");
assert.equal(workflow.generatesOnlyTaskPackagesAndNextStepSuggestions, true, "workflow_must_only_generate_task_packages");

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
    "workflow_generates_only_task_packages_and_next_step_suggestions",
    "readme_suite_vibe_reference",
  ],
}, null, 2));
