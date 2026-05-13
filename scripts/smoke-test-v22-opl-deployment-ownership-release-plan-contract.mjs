import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { assertDeploymentOwnership } from "./v22-tencent-authorized-deploy-execution-runner.mjs";

const contractPath = "docs/contracts/v22-opl-deployment-ownership-release-plan-boundary.md";
const deployContractPath = "docs/contracts/v22-authorized-tencent-deploy-execution-boundary.md";
const contractsIndexPath = "docs/contracts/README.md";
const statusPath = "docs/recovery/cloud-onboarding-status-table.md";
const boardPath = "docs/recovery/cloud-onboarding-execution-board.md";
const matrixPath = "docs/recovery/cloud-onboarding-verification-matrix.md";
const suitePath = "scripts/smoke-test-v22-mvp-contract-suite.mjs";
const runnerPath = "scripts/v22-tencent-authorized-deploy-execution-runner.mjs";

const forbiddenPhrases = [
  "deploy-secret-id-proof",
  "registry-password-proof",
  "kubeconfig-proof",
  "raw-response-proof",
  "object-key-proof",
];

function assertIncludesAll(source, phrases, label) {
  for (const phrase of phrases) {
    assert(source.includes(phrase), `${label}_missing:${phrase}`);
  }
}

function assertNotContainsForbidden(value, label) {
  const serialized = typeof value === "string" ? value : JSON.stringify(value || {});
  for (const phrase of forbiddenPhrases) {
    assert.equal(serialized.includes(phrase), false, `${label}_must_not_contain:${phrase}`);
  }
  assert.equal(
    /SecretId|SecretKey|TCR_SECRET|kubeconfig|objectKey|storageKey|signedUrl|rawResponse|providerRawResponse|dockerConfig|\bAuthorization\b|\bCookie\b/i.test(serialized),
    false,
    `${label}_must_not_contain_forbidden_key`,
  );
}

function parseJson(stdout = "") {
  return JSON.parse(stdout.trim());
}

function runRunner(args, expectedStatus = 0) {
  const result = spawnSync(process.execPath, [runnerPath, ...args], {
    cwd: path.resolve("."),
    encoding: "utf8",
    stdio: "pipe",
  });
  assert.equal(result.status, expectedStatus, `runner_status:${args.join(" ")}:${result.stderr}`);
  assertNotContainsForbidden(result.stdout, `stdout:${args.join(" ")}`);
  assertNotContainsForbidden(result.stderr, `stderr:${args.join(" ")}`);
  return parseJson(result.stdout);
}

function releasePlan(overrides = {}) {
  return {
    runId: "opl-d1-proof",
    versionTag: "opl-d1-proof-20260511-000001",
    namespace: "platform-namespace-proof",
    targets: [
      {
        component: "portal",
        targetClass: "platform_service_target",
        repository: "portal-proof",
        dockerfile: "deploy/local/dockerfiles/portal.Dockerfile",
        buildContext: "services/portal",
        namespace: "platform-namespace-proof",
        workload: "portal-proof",
        container: "portal",
        ownerRef: "platform-owner-proof",
        operationId: "operation-platform-proof",
        expectedVersionMarker: "opl-d1-proof-20260511-000001",
        requiredEnv: {
          PORTAL_ENABLE_CLOUD_OPERATION_PRODUCTION_BRIDGE: "1",
          PORTAL_CLOUD_OPERATION_RUNNER_MODE: "tencent-official-sdk-live",
          PORTAL_CLOUD_OPERATION_PACKAGE_C_SECRET_FILE: "/var/run/secrets/medopl/package-c-mutation.env",
          PORTAL_CLOUD_OPERATION_COMPUTE_NODE_POOL_REF: "np-backend-attribution-proof",
          PORTAL_CLOUD_OPERATION_COMPUTE_POOL_BASELINE_CAPACITY: "2",
        },
      },
      {
        component: "opl-web-gateway",
        targetClass: "platform_service_target",
        repository: "opl-web-gateway-proof",
        dockerfile: "deploy/local/dockerfiles/opl-web-gateway.Dockerfile",
        buildContext: "services/opl-web-gateway",
        namespace: "platform-namespace-proof",
        workload: "opl-web-gateway-proof",
        container: "opl-web-gateway",
        ownerRef: "platform-owner-proof",
        operationId: "operation-platform-proof",
        expectedVersionMarker: "opl-d1-proof-20260511-000001",
      },
      {
        component: "opl-runtime-bridge",
        targetClass: "platform_service_target",
        repository: "opl-runtime-bridge-proof",
        dockerfile: "deploy/local/dockerfiles/opl-runtime-bridge.Dockerfile",
        buildContext: "services/opl-runtime-bridge",
        namespace: "platform-namespace-proof",
        workload: "opl-runtime-bridge-proof",
        container: "opl-runtime-bridge",
        ownerRef: "platform-owner-proof",
        operationId: "operation-platform-proof",
        expectedVersionMarker: "opl-d1-proof-20260511-000001",
      },
    ],
    runtimeSmokeTargets: [
      {
        surface: "portal",
        url: "https://portal.medopl.cn/healthz",
        expectedVersionMarker: "opl-d1-proof-20260511-000001",
        provesPushedVersion: true,
        provesComponents: ["portal"],
      },
      {
        surface: "opl",
        url: "https://opl.medopl.cn/healthz",
        expectedVersionMarker: "opl-d1-proof-20260511-000001",
        provesPushedVersion: true,
        provesComponents: ["opl-web-gateway", "opl-runtime-bridge"],
      },
      {
        surface: "trace",
        url: "https://trace.medopl.cn/api/public/health",
        expectedVersionMarker: "trace-surface-ok",
        provesPushedVersion: false,
        provesComponents: [],
      },
    ],
    ...overrides,
  };
}

function deploymentFixture(labels = {}, containerName = "portal") {
  return {
    kind: "Deployment",
    metadata: {
      name: "portal-proof",
      namespace: "platform-namespace-proof",
      labels,
    },
    spec: {
      template: {
        spec: {
          containers: [{ name: containerName, image: "registry-proof/portal:old" }],
        },
      },
    },
  };
}

async function writePlan(tmpDir, name, plan) {
  const file = path.join(tmpDir, name);
  await writeFile(file, `${JSON.stringify(plan, null, 2)}\n`, "utf8");
  return file;
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
  "Portal/Gateway/Adapter/trace",
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

assert(suite.includes("smoke-test-v22-opl-deployment-ownership-release-plan-contract.mjs"), "mvp_suite_must_include_opl_ownership_release_plan_smoke");

const tmpDir = await mkdtemp(path.join(os.tmpdir(), "v22-opl-d1-release-plan-"));
try {
  const secretFile = path.join(tmpDir, "deploy.env");
  await writeFile(secretFile, [
    "RUN_TENCENT_DEPLOY_EXECUTION=1",
    "TCR_ID=deploy-secret-id-proof",
    "TCR_SECRET=registry-password-proof",
    "TENCENT_TCR_REGISTRY=registry-proof.example.tencentcloudcr.com",
    "TENCENT_TCR_NAMESPACE=namespace-proof",
    "TENCENT_TCR_REGION=na-siliconvalley",
    "TENCENT_DEPLOY_CLUSTER_ID=cluster-proof",
    "TENCENT_DEPLOY_KUBECONFIG_REF=/tmp/kubeconfig-proof",
  ].join("\n"), "utf8");

  const platformPlanFile = await writePlan(tmpDir, "platform-service-plan.json", releasePlan());
  const platformResult = runRunner(["--check-config", "--secret-file", secretFile, "--release-plan", platformPlanFile]);
  assert.equal(platformResult.summary.releasePlan.targetClasses.platformService, 3, "platform_plan_target_class_count");
  assert.equal(platformResult.summary.releasePlan.targetClasses.workspaceRuntime, 0, "platform_plan_workspace_runtime_count");
  for (const target of platformResult.summary.targets) {
    assert.equal(target.ownerGuard.targetClass, "platform_service_target", `${target.component}_target_class`);
    assert.equal(target.ownerGuard.workspaceId, "not-required", `${target.component}_workspace_not_required`);
    assert.equal(target.ownerGuard.resourceBindingId, "not-required", `${target.component}_binding_not_required`);
  }

  const workspaceRuntimePlan = releasePlan();
  workspaceRuntimePlan.targets[2] = {
    ...workspaceRuntimePlan.targets[2],
    targetClass: "workspace_runtime_target",
    workspaceId: "workspace-runtime-proof",
    resourceBindingId: "binding-runtime-proof",
  };
  const workspaceRuntimePlanFile = await writePlan(tmpDir, "workspace-runtime-plan.json", workspaceRuntimePlan);
  const workspaceRuntimeResult = runRunner(["--check-config", "--secret-file", secretFile, "--release-plan", workspaceRuntimePlanFile]);
  assert.equal(workspaceRuntimeResult.summary.releasePlan.targetClasses.platformService, 2, "workspace_plan_platform_count");
  assert.equal(workspaceRuntimeResult.summary.releasePlan.targetClasses.workspaceRuntime, 1, "workspace_plan_runtime_count");

  const missingRuntimeBindingPlan = releasePlan();
  missingRuntimeBindingPlan.targets[2] = {
    ...missingRuntimeBindingPlan.targets[2],
    targetClass: "workspace_runtime_target",
    workspaceId: "workspace-runtime-proof",
  };
  const missingRuntimeBindingFile = await writePlan(tmpDir, "missing-runtime-binding.json", missingRuntimeBindingPlan);
  const missingRuntimeBinding = runRunner(["--check-config", "--secret-file", secretFile, "--release-plan", missingRuntimeBindingFile], 1);
  assert.equal(missingRuntimeBinding.summary.blockedReason, "deploy_workspace_runtime_owner_guard_required", "workspace_runtime_missing_binding_reason");

  const missingPlatformOwnerPlan = releasePlan();
  delete missingPlatformOwnerPlan.targets[0].ownerRef;
  const missingPlatformOwnerFile = await writePlan(tmpDir, "missing-platform-owner.json", missingPlatformOwnerPlan);
  const missingPlatformOwner = runRunner(["--check-config", "--secret-file", secretFile, "--release-plan", missingPlatformOwnerFile], 1);
  assert.equal(missingPlatformOwner.summary.blockedReason, "deploy_platform_owner_guard_required", "platform_missing_owner_reason");

  const qcloudOnlyPlan = releasePlan();
  qcloudOnlyPlan.targets[0] = {
    ...qcloudOnlyPlan.targets[0],
    ownerRef: "",
    operationId: "",
    kubernetesLabelEvidence: {
      "k8s-app": "portal",
      "qcloud-app": "portal",
    },
  };
  const qcloudOnlyFile = await writePlan(tmpDir, "qcloud-only.json", qcloudOnlyPlan);
  const qcloudOnly = runRunner(["--check-config", "--secret-file", secretFile, "--release-plan", qcloudOnlyFile], 1);
  assert.equal(qcloudOnly.summary.blockedReason, "deploy_platform_owner_guard_required", "qcloud_only_must_not_prove_owner");

  const missingSmokeCoveragePlan = releasePlan();
  missingSmokeCoveragePlan.runtimeSmokeTargets[1].provesComponents = ["opl-web-gateway"];
  const missingSmokeCoverageFile = await writePlan(tmpDir, "missing-smoke-coverage.json", missingSmokeCoveragePlan);
  const missingSmokeCoverage = runRunner(["--check-config", "--secret-file", secretFile, "--release-plan", missingSmokeCoverageFile], 1);
  assert.equal(missingSmokeCoverage.summary.blockedReason, "deploy_runtime_smoke_component_coverage_required", "smoke_coverage_reason");

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
} finally {
  await rm(tmpDir, { recursive: true, force: true });
}

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
    "runner_redaction"
  ],
}, null, 2));
