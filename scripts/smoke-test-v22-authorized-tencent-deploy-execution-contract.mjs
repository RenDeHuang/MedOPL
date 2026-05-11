import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const contractPath = "docs/contracts/v22-authorized-tencent-deploy-execution-boundary.md";
const workflowPath = "docs/contracts/v22-cloud-onboarding-workflow-boundary.md";
const readmePath = "docs/contracts/README.md";
const boardPath = "docs/recovery/cloud-onboarding-execution-board.md";
const statusPath = "docs/recovery/cloud-onboarding-status-table.md";
const verificationMatrixPath = "docs/recovery/cloud-onboarding-verification-matrix.md";
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

const [contract, workflow, readme, board, status, verificationMatrix, suite] = await Promise.all([
  readFile(contractPath, "utf8"),
  readFile(workflowPath, "utf8"),
  readFile(readmePath, "utf8"),
  readFile(boardPath, "utf8"),
  readFile(statusPath, "utf8"),
  readFile(verificationMatrixPath, "utf8"),
  readFile(suitePath, "utf8"),
]);

assertIncludesAll(contract, [
  "v22 Authorized Tencent Deploy Execution Boundary",
  "Package D: deploy and production integration",
  "本合同只定义 TCR 镜像、push 版本、kubectl/deploy 和 runtime smoke 的授权边界",
  "不授权 Package C 的资源生命周期动作",
  "不创建、删除、释放或扩缩容 TKE node pool",
  "不创建、删除、清空或扩容 COS bucket / prefix / object",
], "deploy_contract_scope");

assertIncludesAll(contract, [
  "TCR repository/tag preflight",
  "multi-image build and push unique test tag",
  "deploy dry-run",
  "authorized deploy rollout",
  "runtime smoke",
  "rollback / stop condition",
  "final deploy evidence",
], "deploy_contract_loop_steps");

assertIncludesAll(contract, [
  "RUN_TENCENT_DEPLOY_EXECUTION",
  "TCR_ID",
  "TCR_SECRET",
  "TENCENT_TCR_REGISTRY",
  "TENCENT_TCR_NAMESPACE",
  "TENCENT_TCR_REGION",
  "TENCENT_DEPLOY_CLUSTER_ID",
  "TENCENT_DEPLOY_KUBECONFIG_REF",
], "deploy_contract_secret_allowlist");

assertIncludesAll(contract, [
  "Release Plan",
  "`--release-plan <json>`",
  "`targets[]`",
  "`runtimeSmokeTargets[]`",
  "`targetClass`",
  "v22-opl-deployment-ownership-release-plan-boundary.md",
  "platform_service_target",
  "workspace_runtime_target",
  "`component`",
  "`repository`",
  "`dockerfile`",
  "`buildContext`",
  "`namespace`、`workload`、`container`",
  "`ownerRef`、`operationId`",
  "`portal`、`opl`、`trace`",
  "`https://portal.medopl.cn/healthz`",
  "`https://opl.medopl.cn/healthz`",
  "`https://trace.medopl.cn/api/public/health`",
  "`trace.medopl.cn` 是 Langfuse/admin trace surface",
  "不得被默认建模成“本仓库 Langfuse 镜像 target”",
], "deploy_contract_release_plan");

assertNotIncludesAny(contract, [
  "- `TENCENT_TCR_REPOSITORY`",
  "- `TENCENT_DEPLOY_NAMESPACE`",
  "- `TENCENT_DEPLOY_WORKLOAD`",
  "- `TENCENT_DEPLOY_CONTAINER`",
  "- `TENCENT_DEPLOY_RUNTIME_SMOKE_URL`",
], "deploy_contract_single_target_secret_removed");

assertIncludesAll(contract, [
  "只能操作指定 TCR registry / namespace，以及 release plan 中列出的 repositories",
  "只能 push 唯一 test tag",
  "禁止使用 `latest`",
  "tag 必须包含 run id 或不可重复版本号",
  "必须记录 digest",
  "不得覆盖已有 tag",
], "deploy_contract_tcr_scope");

assertIncludesAll(contract, [
  "只能操作指定 TKE cluster",
  "只能操作 release plan 中的单一 namespace",
  "只能操作 release plan 中列出的 workload",
  "只能更新 release plan 中列出的 container image",
  "必须先 `kubectl diff` 或 server-side dry-run",
  "必须有 rollout status",
  "必须有 rollback evidence",
], "deploy_contract_kubectl_scope");

assertIncludesAll(contract, [
  "Ownership Guard",
  "targetClass",
  "ownerRef",
  "workspaceId",
  "resourceBindingId",
  "operationId",
  "expected labels",
  "fail-closed",
  "不靠名称、创建时间、IP、规格或人工记忆推断归属",
], "deploy_contract_ownership_guard");

assertIncludesAll(contract, [
  "禁止 `kubectl delete`",
  "禁止 `DeleteNodePool`",
  "禁止 `CreateNodePool`",
  "禁止 `ScaleNodePool`",
  "禁止 `ModifyNodePoolDesiredCapacityAboutAsg`",
  "禁止删除 bucket",
  "禁止删除 prefix",
  "禁止删除对象",
  "禁止清空 bucket",
  "禁止跨 namespace",
  "禁止 cluster-wide mutation",
  "禁止修改 Secret",
  "禁止修改 CRD",
  "禁止修改 Ingress",
], "deploy_contract_forbidden_side_effects");

assertIncludesAll(contract, [
  "runtime smoke 必须命中 release plan 中的已授权 endpoint",
  "必须证明 pushed version 正在运行",
  "不能只证明镜像存在",
  "runtime smoke surface 到 target component 的覆盖关系",
  "raw token",
  "kubeconfig",
  "registry secret",
  "object key",
  "signed URL",
], "deploy_contract_runtime_smoke_redaction");

assertIncludesAll(contract, [
  "R-14",
  "R-15",
  "R-16",
  "R-17",
  "R-18",
  "portal.medopl.cn",
  "opl.medopl.cn",
  "trace.medopl.cn",
  "scripts/v22-tencent-authorized-deploy-execution-runner.mjs",
  "scripts/smoke-test-v22-tencent-authorized-deploy-execution-runner.mjs",
  "scripts/smoke-test-v22-tencent-authorized-deploy-execution-live-gate.mjs",
  ".runtime/v22-registry/",
  ".runtime/v22-cloud-deploy/",
  ".runtime/v22-runtime-smoke/",
  "accepted-preflight-id",
  "deploy_accepted_preflight_required",
], "deploy_contract_artifacts");

assertIncludesAll(contract, [
  "普通用户不展示 TCR、TKE、Kubernetes、namespace、workload、image digest、kubectl",
  "Portal 只能展示工作台版本、运行状态、更新时间和审计状态",
  "管理员/运维也只能看到脱敏 registry/deploy/runtime evidence",
], "deploy_contract_portal_projection");

assertIncludesAll(contract, [
  "\"contract\": \"v22_authorized_tencent_deploy_execution_boundary\"",
  "\"authorizationPackage\": \"deploy_and_production_integration\"",
  "\"readsDeploySecretNow\": false",
  "\"runsBuildPushKubectlNow\": false",
  "\"modifiesTkeNodePool\": false",
  "\"modifiesCosStorage\": false",
  "\"forbidsLatestTag\": true",
  "\"requiresUniqueTag\": true",
  "\"requiresDigestVerification\": true",
  "\"requiresDeployDryRunBeforeApply\": true",
  "\"requiresRuntimeSmokeForPushedVersion\": true",
  "\"requiresRollbackEvidence\": true",
], "deploy_contract_machine_data");

const deployData = extractJsonBlock(contract, "v22-authorized-tencent-deploy-execution-contract");
assert.equal(deployData.contract, "v22_authorized_tencent_deploy_execution_boundary", "deploy_data_contract");
assert.equal(deployData.authorizationPackage, "deploy_and_production_integration", "deploy_data_package");
assert.equal(deployData.readsDeploySecretNow, false, "deploy_must_not_read_secret_now");
assert.equal(deployData.runsBuildPushKubectlNow, false, "deploy_must_not_run_now");
assert.equal(deployData.modifiesTkeNodePool, false, "deploy_must_not_modify_node_pool");
assert.equal(deployData.modifiesCosStorage, false, "deploy_must_not_modify_cos");
assert.equal(deployData.forbidsLatestTag, true, "deploy_must_forbid_latest");
assert.equal(deployData.requiresUniqueTag, true, "deploy_must_require_unique_tag");
assert.equal(deployData.requiresDigestVerification, true, "deploy_must_require_digest");
assert.equal(deployData.requiresDeployDryRunBeforeApply, true, "deploy_must_require_dry_run");
assert.equal(deployData.requiresRuntimeSmokeForPushedVersion, true, "deploy_must_require_runtime_smoke");
assert.equal(deployData.requiresRollbackEvidence, true, "deploy_must_require_rollback");
assert.deepEqual(deployData.runnableSteps, ["R-14", "R-15", "R-16", "R-17", "R-18"], "deploy_steps");
assert.equal(deployData.secretAllowlist.includes("TENCENT_TCR_REPOSITORY"), false, "deploy_repository_must_not_be_secret");
assert.equal(deployData.secretAllowlist.includes("TENCENT_DEPLOY_CONTAINER"), false, "deploy_container_must_not_be_secret");
assert.equal(deployData.secretAllowlist.includes("TENCENT_DEPLOY_RUNTIME_SMOKE_URL"), false, "deploy_runtime_smoke_url_must_not_be_secret");
assert.equal(deployData.releasePlan?.required, true, "deploy_release_plan_required");
assert.equal(deployData.releasePlan?.requiresMultipleTargets, true, "deploy_release_plan_multi_target_required");
assert.equal(deployData.releasePlan?.forbidsSingleImageAllInOneAssumption, true, "deploy_release_plan_forbid_single_image");
assert.deepEqual(deployData.releasePlan?.runtimeSmokeTargetsRequired, ["portal", "opl", "trace"], "deploy_release_plan_smoke_surfaces");
assert.equal(deployData.releasePlan?.defaultRuntimeSmokeUrls?.portal, "https://portal.medopl.cn/healthz", "deploy_portal_smoke_url");
assert.equal(deployData.releasePlan?.defaultRuntimeSmokeUrls?.opl, "https://opl.medopl.cn/healthz", "deploy_opl_smoke_url");
assert.equal(deployData.releasePlan?.defaultRuntimeSmokeUrls?.trace, "https://trace.medopl.cn/api/public/health", "deploy_trace_smoke_url");
assert.equal(deployData.releasePlan?.traceSurfaceIsNotImplicitImageTarget, true, "deploy_trace_not_implicit_image_target");
assert(deployData.allowedKubectlActions.includes("kubectl diff"), "deploy_kubectl_diff_missing");
assert(deployData.allowedKubectlActions.includes("kubectl apply"), "deploy_kubectl_apply_missing");
assert(deployData.forbiddenActions.includes("kubectl delete"), "deploy_forbid_kubectl_delete");
assert(deployData.forbiddenActions.includes("DeleteNodePool"), "deploy_forbid_delete_nodepool");
assert(deployData.forbiddenActions.includes("deleteObject"), "deploy_forbid_delete_object");
assert.equal(deployData.ownershipGuard.failClosedOnMissingOrConflictingOwner, true, "deploy_ownership_fail_closed");
assert.equal(deployData.runner?.entrypoint, "scripts/v22-tencent-authorized-deploy-execution-runner.mjs", "deploy_runner_entrypoint");
assert.equal(deployData.runner?.smoke, "scripts/smoke-test-v22-tencent-authorized-deploy-execution-runner.mjs", "deploy_runner_smoke");
assert.equal(deployData.runner?.liveGateSmoke, "scripts/smoke-test-v22-tencent-authorized-deploy-execution-live-gate.mjs", "deploy_live_gate_smoke");
assert(deployData.runner?.requiresExplicitNonSecretExecutionParameters.includes("releasePlan"), "deploy_runner_release_plan_param");
assert(deployData.runner?.requiresExplicitNonSecretExecutionParameters.includes("acceptedPreflightId"), "deploy_runner_preflight_param");
assert.equal(deployData.runner?.buildPushRequiresAcceptedPreflightId, true, "deploy_build_push_must_require_preflight");
assert.equal(deployData.runner?.defaultProviderMode, "config-only", "deploy_runner_default_mode");
assert.equal(deployData.runner?.realProviderMode, "real", "deploy_runner_real_mode");

assertIncludesAll(workflow, [
  "v22-authorized-tencent-deploy-execution-boundary.md",
  "Package D release plan",
  "portal.medopl.cn",
  "opl.medopl.cn",
  "trace.medopl.cn",
  "禁止 `kubectl delete`",
  "Package D 不授权 Package C 的资源生命周期动作",
], "workflow_deploy_contract_reference");

const workflowData = extractJsonBlock(workflow, "v22-cloud-onboarding-workflow-contract");
assert.equal(workflowData.packageD?.forbidsLatestTag, true, "workflow_package_d_forbid_latest");
assert.equal(workflowData.packageD?.modifiesTkeNodePool, false, "workflow_package_d_no_node_pool");
assert.equal(workflowData.packageD?.modifiesCosStorage, false, "workflow_package_d_no_cos");
assert.equal(workflowData.packageD?.secretAllowlist.includes("TENCENT_DEPLOY_CONTAINER"), false, "workflow_package_d_container_not_secret");
assert.equal(workflowData.packageD?.secretAllowlist.includes("TENCENT_DEPLOY_RUNTIME_SMOKE_URL"), false, "workflow_package_d_runtime_url_not_secret");
assert.equal(workflowData.packageD?.releasePlan?.required, true, "workflow_package_d_release_plan_required");
assert.deepEqual(workflowData.packageD?.releasePlan?.runtimeSmokeTargetsRequired, ["portal", "opl", "trace"], "workflow_package_d_runtime_surfaces");
assert(workflowData.packageD?.forbiddenActions.includes("kubectl delete"), "workflow_package_d_forbid_kubectl_delete");
assert(workflowData.packageD?.forbiddenActions.includes("DeleteNodePool"), "workflow_package_d_forbid_delete_nodepool");
assert(workflowData.packageD?.forbiddenActions.includes("deleteObject"), "workflow_package_d_forbid_delete_object");

assertIncludesAll(readme, [
  "v22-authorized-tencent-deploy-execution-boundary.md",
  "authorized/tencent deploy execution",
  "Package D",
  "v22-opl-deployment-ownership-release-plan-boundary.md",
  "OPL deployment ownership release plan",
], "readme_deploy_contract");

assertIncludesAll(board + status + verificationMatrix, [
  "Package D 不授权 Package C 的资源生命周期动作",
  "不得删除、关闭或扩缩容别人的节点和存储",
  "禁止 `kubectl delete`",
  "禁止 `DeleteNodePool`",
  "禁止删除 bucket/prefix/object",
  "OPL deployment ownership / release plan",
  "platform_service_target",
  "workspace_runtime_target",
  "cloud-lane/feat/v22-package-d-image-push-gate",
  "accepted R-14 preflight id",
], "recovery_deploy_safety");

assert(suite.includes("smoke-test-v22-authorized-tencent-deploy-execution-contract.mjs"), "suite_must_include_deploy_contract_smoke");
assert(suite.includes("smoke-test-v22-tencent-authorized-deploy-execution-runner.mjs"), "suite_must_include_deploy_runner_smoke");
assert(suite.includes("smoke-test-v22-tencent-authorized-deploy-execution-live-gate.mjs"), "suite_must_include_deploy_live_gate_smoke");

assertNotIncludesAny(contract + workflow + board + status + verificationMatrix, [
  "\"runsBuildPushKubectlNow\": true",
  "\"modifiesTkeNodePool\": true",
  "\"modifiesCosStorage\": true",
  "\"forbidsLatestTag\": false",
  "Package D 可以删除节点池",
  "Package D 可以清空 bucket",
  "默认使用 latest",
  "real push done",
], "deploy_forbidden_claims");

assertNotIncludesAny(contract + workflow + board + status + verificationMatrix, [
  "Package D deploy/build/push/kubectl 已完成",
], "deploy_status_must_not_claim_done");

console.log(JSON.stringify({
  ok: true,
  contract: "v22_authorized_tencent_deploy_execution_boundary",
  checked: [
    "package_d_scope",
    "tcr_unique_tag_digest",
    "multi_target_release_plan",
    "portal_opl_trace_runtime_smoke_surfaces",
    "deploy_dry_run_rollout_runtime_smoke",
    "ownership_guard_fail_closed",
    "no_node_pool_or_cos_mutation",
    "no_kubectl_delete_or_cluster_wide_mutation",
    "portal_projection_sanitized",
    "workflow_readme_recovery_suite_references",
  ],
}, null, 2));
