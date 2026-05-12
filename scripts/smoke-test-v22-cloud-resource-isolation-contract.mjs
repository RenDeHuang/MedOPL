import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const files = {
  createRelease: "docs/contracts/v22-authorized-tencent-create-release-boundary.md",
  execution: "docs/contracts/v22-authorized-tencent-create-release-execution-boundary.md",
  resourcePlan: "docs/contracts/v22-resource-plan-boundary.md",
  pricing: "docs/contracts/v22-pricing-snapshot-boundary.md",
  topology: "docs/contracts/v22-production-cloud-topology-boundary.md",
  deploy: "docs/contracts/v22-authorized-tencent-deploy-execution-boundary.md",
  workflow: "docs/contracts/v22-cloud-onboarding-workflow-boundary.md",
  readme: "docs/contracts/README.md",
  status: "docs/recovery/cloud-onboarding-status-table.md",
  board: "docs/recovery/cloud-onboarding-execution-board.md",
  matrix: "docs/recovery/cloud-onboarding-verification-matrix.md",
  suite: "scripts/smoke-test-v22-mvp-contract-suite.mjs",
};

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

const sources = Object.fromEntries(await Promise.all(
  Object.entries(files).map(async ([key, filePath]) => [key, await readFile(filePath, "utf8")]),
));

assertIncludesAll(sources.createRelease, [
  "用户购买的是计算资源套餐和工作台能力，不是节点、节点池或云控制台资源",
  "标准套餐使用共享用户计算池 + workspace namespace ResourceQuota / LimitRange / admission policy",
  "超过 compute allocation 的 workload 必须 fail-closed",
  "不得自动扩容并由平台垫付",
  "计算升级必须先完成 Portal 套餐变更、冻结金额或余额校验、cloud operation 和审计记录",
  "专属计算池属于高级隔离套餐",
  "dedicated_node_pool",
  "shared_quota",
], "create_release_resource_isolation");

assertIncludesAll(sources.execution, [
  "标准套餐不是一用户一个 node pool",
  "Package C 必须先写 compute allocation，再写 ResourceQuota / LimitRange / admission policy",
  "共享用户计算池只能做池级容量补足",
  "专属 node pool 只能绑定到一个 resourceBindingId 或一个明确的账号组",
  "专属池必须使用 taint / label / nodeSelector / toleration 防止平台服务和其他用户调度进入",
  "当前混跑 Portal/OPL/trace/billing/system 的节点池不得缩到 0",
  "replicas_0_1_0 只允许用于空闲测试池或专属计算池的闭环 canary",
], "execution_resource_isolation");

const executionData = extractJsonBlock(sources.execution, "v22-authorized-tencent-create-release-execution-contract");
assert.equal(executionData.resourceLifecycle.standardPlansUseSharedUserComputePool, true, "standard_plans_shared_pool_required");
assert.equal(executionData.resourceLifecycle.standardPlansRequireNamespaceQuota, true, "standard_plans_quota_required");
assert.equal(executionData.resourceLifecycle.overAllocationMustFailClosed, true, "over_allocation_fail_closed_required");
assert.equal(executionData.resourceLifecycle.dedicatedNodePoolSupportedAsAdvancedIsolation, true, "dedicated_pool_required");
assert.equal(executionData.resourceLifecycle.nativeNodePoolCanaryLoop, "replicas_0_1_0_only_for_idle_canary_or_dedicated_pool", "native_loop_scope");
for (const key of [
  "TENCENT_MUTATION_TKE_CLUSTER_ID",
  "TENCENT_MUTATION_TKE_NODE_POOL_ID",
  "TENCENT_MUTATION_COS_BUCKET",
  "TENCENT_MUTATION_COS_REGION",
  "TENCENT_MUTATION_WORKSPACE_PREFIX_ROOT",
]) {
  assert(executionData.mutationSecretAllowlist.includes(key), `execution_secret_allowlist_missing:${key}`);
}

assertIncludesAll(sources.resourcePlan, [
  "isolationMode",
  "shared_quota",
  "dedicated_node_pool",
  "dedicated_node",
  "默认套餐使用 `shared_quota`",
  "高级套餐可以使用 `dedicated_node_pool`",
  "用户不购买节点池；节点池是平台供给库存",
], "resource_plan_isolation_modes");

const pricingData = extractJsonBlock(sources.pricing, "v22-pricing-snapshot-contract");
for (const plan of pricingData.plans) {
  assert.equal(plan.compute.isolationMode, "shared_quota", `${plan.id}_default_isolation_mode`);
  assert.equal(plan.compute.userBuysNodePool, false, `${plan.id}_must_not_sell_node_pool`);
}
assert.equal(pricingData.advancedIsolationModes.includes("dedicated_node_pool"), true, "pricing_advanced_dedicated_pool_missing");

assertIncludesAll(sources.topology, [
  "platform service node pool",
  "shared user compute pool",
  "dedicated user compute pool",
  "平台服务不得调度到 dedicated user compute pool",
  "用户 workload 不得调度到 platform service node pool",
], "topology_pool_roles");

assertIncludesAll(sources.workflow, [
  "平台服务 target 使用 `platform_service_target`，只强制 `ownerRef/operationId`",
  "workspace runtime target 使用 `workspace_runtime_target`，必须额外绑定 `workspaceId/resourceBindingId`",
], "workflow_package_d_target_class_alignment");
assertNotIncludesAny(sources.workflow, [
  "逐 target 绑定 repository、dockerfile、buildContext、namespace、workload、container、ownerRef、workspaceId、resourceBindingId、operationId 和 expectedVersionMarker",
], "workflow_old_global_workspace_binding");

const deployData = extractJsonBlock(sources.deploy, "v22-authorized-tencent-deploy-execution-contract");
assert.deepEqual(
  deployData.ownershipGuard.requiredLabelsByTargetClass.platform_service_target,
  ["ownerRef", "operationId"],
  "deploy_platform_service_owner_guard",
);
assert.deepEqual(
  deployData.ownershipGuard.requiredLabelsByTargetClass.workspace_runtime_target,
  ["ownerRef", "operationId", "workspaceId", "resourceBindingId"],
  "deploy_workspace_runtime_owner_guard",
);
assert.equal("requiredLabels" in deployData.ownershipGuard, false, "deploy_global_required_labels_must_be_removed");

assertIncludesAll(sources.readme + sources.status + sources.board + sources.matrix, [
  "共享用户计算池 + 硬 quota",
  "高级隔离套餐",
  "dedicated_node_pool",
  "Package D 不授权 Package C 的资源生命周期动作",
], "recovery_and_index_resource_isolation");

assert(sources.suite.includes("smoke-test-v22-cloud-resource-isolation-contract.mjs"), "mvp_suite_missing_resource_isolation_smoke");

console.log(JSON.stringify({
  ok: true,
  contract: "v22_cloud_resource_isolation",
  checked: files,
}, null, 2));
