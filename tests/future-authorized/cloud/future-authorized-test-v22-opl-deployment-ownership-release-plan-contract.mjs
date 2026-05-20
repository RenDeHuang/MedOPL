import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const contractPath = "docs/contracts/v22-opl-deployment-ownership-release-plan-boundary.md";
const deployContractPath = "docs/contracts/v22-authorized-tencent-deploy-execution-boundary.md";
const contractsIndexPath = "docs/contracts/README.md";
const statusPath = "docs/recovery/cloud-onboarding-status-table.md";
const boardPath = "docs/recovery/cloud-onboarding-execution-board.md";
const matrixPath = "docs/recovery/cloud-onboarding-verification-matrix.md";
const suitePath = "tests/contract/contract-test-v22-mvp-contract-suite.mjs";

function text(value = "") {
  return String(value ?? "").trim();
}

function assertIncludesAll(source, phrases, label) {
  for (const phrase of phrases) {
    assert(source.includes(phrase), `${label}_missing:${phrase}`);
  }
}

function assertDeploymentOwnership(deployment = {}, target = {}) {
  if (deployment.kind !== "Deployment") throw new Error("deploy_target_kind_mismatch");
  if (text(deployment.metadata?.name) !== text(target.workload)) throw new Error("deploy_target_workload_mismatch");
  if (text(deployment.metadata?.namespace) !== text(target.namespace)) throw new Error("deploy_target_namespace_mismatch");
  const labels = deployment.metadata?.labels || {};
  const expected = {
    targetClass: target.targetClass,
    ownerRef: target.ownerRef,
    operationId: target.operationId,
  };
  if (text(target.targetClass) === "workspace_runtime_target") {
    expected.workspaceId = target.workspaceId;
    expected.resourceBindingId = target.resourceBindingId;
  }
  for (const [key, value] of Object.entries(expected)) {
    if (text(labels[key]) !== text(value)) throw new Error("deploy_ownership_guard_failed");
  }
  const containers = deployment.spec?.template?.spec?.containers || [];
  if (!containers.some((container) => text(container.name) === text(target.container))) {
    throw new Error("deploy_target_container_missing");
  }
}

function targetClassCounts(targets = []) {
  return targets.reduce((counts, target) => {
    const targetClass = text(target.targetClass);
    if (targetClass === "platform_service_target") counts.platformService += 1;
    if (targetClass === "workspace_runtime_target") counts.workspaceRuntime += 1;
    return counts;
  }, { platformService: 0, workspaceRuntime: 0 });
}

function validateReleasePlan(plan = {}) {
  if (!text(plan.runId)) return { ok: false, blockedReason: "deploy_run_id_required" };
  if (!text(plan.versionTag) || text(plan.versionTag) === "latest") return { ok: false, blockedReason: "deploy_latest_tag_forbidden" };
  if (!Array.isArray(plan.targets) || plan.targets.length < 2) return { ok: false, blockedReason: "deploy_multi_target_release_plan_required" };
  const globalNamespace = text(plan.namespace);
  const targetClasses = targetClassCounts(plan.targets);
  for (const target of plan.targets) {
    for (const field of ["component", "targetClass", "repository", "imageTargetRef", "sourceRoot", "namespace", "workload", "container", "ownerRef", "operationId", "expectedVersionMarker"]) {
      if (!text(target[field])) {
        return { ok: false, blockedReason: field === "ownerRef" || field === "operationId" ? "deploy_platform_owner_guard_required" : "deploy_target_field_required" };
      }
    }
    if (!["services/portal", "services/opl-web-gateway", "services/opl-runtime-bridge"].includes(text(target.sourceRoot))) {
      return { ok: false, blockedReason: "deploy_source_root_must_be_active_service" };
    }
    if (globalNamespace && text(target.namespace) !== globalNamespace) return { ok: false, blockedReason: "deploy_cross_namespace_target_forbidden" };
    if (!["platform_service_target", "workspace_runtime_target"].includes(text(target.targetClass))) {
      return { ok: false, blockedReason: "deploy_target_class_invalid" };
    }
    if (text(target.targetClass) === "workspace_runtime_target" && (!text(target.workspaceId) || !text(target.resourceBindingId))) {
      return { ok: false, blockedReason: "deploy_workspace_runtime_owner_guard_required" };
    }
  }
  const pushedVersionCoverage = new Set();
  const surfaces = new Set();
  for (const smokeTarget of plan.runtimeSmokeTargets || []) {
    surfaces.add(text(smokeTarget.surface));
    if (smokeTarget.provesPushedVersion !== false) {
      for (const component of smokeTarget.provesComponents || []) pushedVersionCoverage.add(text(component));
    }
  }
  for (const requiredSurface of ["portal", "opl", "trace"]) {
    if (!surfaces.has(requiredSurface)) return { ok: false, blockedReason: "deploy_runtime_smoke_surface_required" };
  }
  for (const target of plan.targets) {
    if (!pushedVersionCoverage.has(text(target.component))) return { ok: false, blockedReason: "deploy_runtime_smoke_component_coverage_required" };
  }
  return { ok: true, summary: { releasePlan: { targetClasses } } };
}

function releasePlan(overrides = {}) {
  return {
    runId: "opl-d1-proof",
    versionTag: "opl-d1-proof-20260511-000001",
    namespace: "platform-namespace-proof",
    targets: [
      { component: "portal", targetClass: "platform_service_target", repository: "portal-proof", imageTargetRef: "portal-service-image", sourceRoot: "services/portal", namespace: "platform-namespace-proof", workload: "portal-proof", container: "portal", ownerRef: "platform-owner-proof", operationId: "operation-platform-proof", expectedVersionMarker: "opl-d1-proof-20260511-000001" },
      { component: "opl-web-gateway", targetClass: "platform_service_target", repository: "opl-web-gateway-proof", imageTargetRef: "opl-web-gateway-service-image", sourceRoot: "services/opl-web-gateway", namespace: "platform-namespace-proof", workload: "opl-web-gateway-proof", container: "opl-web-gateway", ownerRef: "platform-owner-proof", operationId: "operation-platform-proof", expectedVersionMarker: "opl-d1-proof-20260511-000001" },
      { component: "opl-runtime-bridge", targetClass: "platform_service_target", repository: "opl-runtime-bridge-proof", imageTargetRef: "opl-runtime-bridge-service-image", sourceRoot: "services/opl-runtime-bridge", namespace: "platform-namespace-proof", workload: "opl-runtime-bridge-proof", container: "opl-runtime-bridge", ownerRef: "platform-owner-proof", operationId: "operation-platform-proof", expectedVersionMarker: "opl-d1-proof-20260511-000001" },
    ],
    runtimeSmokeTargets: [
      { surface: "portal", url: "https://portal.medopl.cn/healthz", expectedVersionMarker: "opl-d1-proof-20260511-000001", provesPushedVersion: true, provesComponents: ["portal"] },
      { surface: "opl", url: "https://opl.medopl.cn/healthz", expectedVersionMarker: "opl-d1-proof-20260511-000001", provesPushedVersion: true, provesComponents: ["opl-web-gateway", "opl-runtime-bridge"] },
      { surface: "trace", url: "https://trace.medopl.cn/api/public/health", expectedVersionMarker: "trace-surface-ok", provesPushedVersion: false, provesComponents: [] },
    ],
    ...overrides,
  };
}

function deploymentFixture(labels = {}, containerName = "portal") {
  return {
    kind: "Deployment",
    metadata: { name: "portal-proof", namespace: "platform-namespace-proof", labels },
    spec: { template: { spec: { containers: [{ name: containerName, image: "registry-proof/portal:old" }] } } },
  };
}

const [contract, deployContract, contractsIndex, status, board, matrix, suite] = await Promise.all([
  readFile(contractPath, "utf8"),
  readFile(deployContractPath, "utf8"),
  readFile(contractsIndexPath, "utf8"),
  readFile(statusPath, "utf8"),
  readFile(boardPath, "utf8"),
  readFile(matrixPath, "utf8"),
  readFile(suitePath, "utf8"),
]);

assertIncludesAll(contract, [
  "v22 OPL Deployment Ownership Release Plan Boundary",
  "Level 4",
  "Package D",
  "v22-authorized-tencent-deploy-execution-boundary.md",
  "v22-real-opl-file-run-artifact-canary-boundary.md",
  "platform_service_target",
  "workspace_runtime_target",
  "ownerRef",
  "operationId",
  "workspaceId",
  "resourceBindingId",
  "qcloud-app",
  "fail-closed",
  "Portal/Gateway/Runtime Bridge/trace",
  "OPL lane only provides `resourceBindingId/workspace runtime identity`",
  "does not authorize build/push/kubectl",
], "contract_scope");

assertIncludesAll(deployContract, [
  "v22-opl-deployment-ownership-release-plan-boundary.md",
  "platform_service_target",
  "workspace_runtime_target",
], "deploy_contract_reference");

assertIncludesAll(contractsIndex, [
  "v22-opl-deployment-ownership-release-plan-boundary.md",
  "OPL deployment ownership release plan",
], "contracts_index");

assertIncludesAll(status + board + matrix, [
  "OPL deployment ownership / release plan",
  "platform_service_target",
  "workspace_runtime_target",
  "owner guard",
], "recovery_reference");

assert(suite.includes("future-authorized-test-v22-opl-deployment-ownership-release-plan-contract.mjs"), "mvp_suite_must_include_opl_ownership_release_plan_smoke");
assert.equal(deployContract.includes("scripts/v22-tencent-authorized-deploy-execution-runner.mjs"), false, "deploy_contract_must_not_reference_deleted_runner");

const platformResult = validateReleasePlan(releasePlan());
assert.equal(platformResult.ok, true, "platform_plan_must_pass");
assert.equal(platformResult.summary.releasePlan.targetClasses.platformService, 3, "platform_plan_target_class_count");
assert.equal(platformResult.summary.releasePlan.targetClasses.workspaceRuntime, 0, "platform_plan_workspace_runtime_count");

const workspaceRuntimePlan = releasePlan();
workspaceRuntimePlan.targets[2] = {
  ...workspaceRuntimePlan.targets[2],
  targetClass: "workspace_runtime_target",
  workspaceId: "workspace-runtime-proof",
  resourceBindingId: "binding-runtime-proof",
};
const workspaceRuntimeResult = validateReleasePlan(workspaceRuntimePlan);
assert.equal(workspaceRuntimeResult.ok, true, "workspace_plan_must_pass");
assert.equal(workspaceRuntimeResult.summary.releasePlan.targetClasses.platformService, 2, "workspace_plan_platform_count");
assert.equal(workspaceRuntimeResult.summary.releasePlan.targetClasses.workspaceRuntime, 1, "workspace_plan_runtime_count");

const missingRuntimeBindingPlan = releasePlan();
missingRuntimeBindingPlan.targets[2] = {
  ...missingRuntimeBindingPlan.targets[2],
  targetClass: "workspace_runtime_target",
  workspaceId: "workspace-runtime-proof",
};
assert.equal(validateReleasePlan(missingRuntimeBindingPlan).blockedReason, "deploy_workspace_runtime_owner_guard_required", "workspace_runtime_missing_binding_reason");

const missingPlatformOwnerPlan = releasePlan();
delete missingPlatformOwnerPlan.targets[0].ownerRef;
assert.equal(validateReleasePlan(missingPlatformOwnerPlan).blockedReason, "deploy_platform_owner_guard_required", "platform_missing_owner_reason");

const qcloudOnlyPlan = releasePlan();
qcloudOnlyPlan.targets[0] = { ...qcloudOnlyPlan.targets[0], ownerRef: "", operationId: "", kubernetesLabelEvidence: { "k8s-app": "portal", "qcloud-app": "portal" } };
assert.equal(validateReleasePlan(qcloudOnlyPlan).blockedReason, "deploy_platform_owner_guard_required", "qcloud_only_must_not_prove_owner");

const missingSmokeCoveragePlan = releasePlan();
missingSmokeCoveragePlan.runtimeSmokeTargets[1].provesComponents = ["opl-web-gateway"];
assert.equal(validateReleasePlan(missingSmokeCoveragePlan).blockedReason, "deploy_runtime_smoke_component_coverage_required", "smoke_coverage_reason");

assert.doesNotThrow(() => assertDeploymentOwnership(deploymentFixture({
  targetClass: "platform_service_target",
  ownerRef: "platform-owner-proof",
  operationId: "operation-platform-proof",
}), {
  component: "portal",
  targetClass: "platform_service_target",
  namespace: "platform-namespace-proof",
  workload: "portal-proof",
  container: "portal",
  ownerRef: "platform-owner-proof",
  operationId: "operation-platform-proof",
}), "platform_service_owner_guard_does_not_require_workspace_binding");

assert.throws(() => assertDeploymentOwnership(deploymentFixture({
  targetClass: "workspace_runtime_target",
  ownerRef: "platform-owner-proof",
  operationId: "operation-platform-proof",
}), {
  component: "portal",
  targetClass: "platform_service_target",
  namespace: "platform-namespace-proof",
  workload: "portal-proof",
  container: "portal",
  ownerRef: "platform-owner-proof",
  operationId: "operation-platform-proof",
}), /deploy_ownership_guard_failed/, "target_class_mismatch_must_fail_closed");

assert.doesNotThrow(() => assertDeploymentOwnership(deploymentFixture({
  targetClass: "workspace_runtime_target",
  ownerRef: "workspace-runtime-owner",
  operationId: "operation-runtime-proof",
  workspaceId: "workspace-runtime-proof",
  resourceBindingId: "binding-runtime-proof",
}, "runtime-agent"), {
  component: "opl-runtime-agent",
  targetClass: "workspace_runtime_target",
  namespace: "platform-namespace-proof",
  workload: "portal-proof",
  container: "runtime-agent",
  ownerRef: "workspace-runtime-owner",
  operationId: "operation-runtime-proof",
  workspaceId: "workspace-runtime-proof",
  resourceBindingId: "binding-runtime-proof",
}), "workspace_runtime_owner_guard_accepts_complete_binding");

assert.throws(() => assertDeploymentOwnership(deploymentFixture({
  targetClass: "workspace_runtime_target",
  ownerRef: "workspace-runtime-owner",
  operationId: "operation-runtime-proof",
  workspaceId: "workspace-runtime-proof",
}, "runtime-agent"), {
  component: "opl-runtime-agent",
  targetClass: "workspace_runtime_target",
  namespace: "platform-namespace-proof",
  workload: "portal-proof",
  container: "runtime-agent",
  ownerRef: "workspace-runtime-owner",
  operationId: "operation-runtime-proof",
  workspaceId: "workspace-runtime-proof",
  resourceBindingId: "binding-runtime-proof",
}), /deploy_ownership_guard_failed/, "workspace_runtime_missing_binding_label_must_fail_closed");

console.log(JSON.stringify({
  ok: true,
  contract: "v22_opl_deployment_ownership_release_plan_boundary",
  checked: [
    "contract_level",
    "package_d_subscription",
    "platform_service_target_owner_guard",
    "workspace_runtime_target_owner_guard",
    "qcloud_app_only_rejected",
    "runtime_smoke_component_coverage",
    "runner_executable_surface_deleted",
  ],
}, null, 2));
