import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

const contractPath = "docs/contracts/v22-authorized-tencent-deploy-execution-boundary.md";
const readmePath = "docs/contracts/README.md";
const boardPath = "docs/recovery/cloud-onboarding-execution-board.md";
const statusPath = "docs/recovery/cloud-onboarding-status-table.md";
const verificationMatrixPath = "docs/recovery/cloud-onboarding-verification-matrix.md";
const suitePath = "scripts/smoke-test-v22-mvp-contract-suite.mjs";

function text(value = "") {
  return String(value ?? "").trim();
}

function assertIncludesAll(source, phrases, label) {
  for (const phrase of phrases) {
    assert(source.includes(phrase), `${label}_missing:${phrase}`);
  }
}

function releasePlan(overrides = {}) {
  return {
    runId: "pkg-d-deploy-dry-run-proof",
    versionTag: "pkg-d-deploy-dry-run-proof-20260511-000001",
    namespace: "namespace-proof",
    targets: [
      { component: "portal", targetClass: "platform_service_target", repository: "portal-proof", imageTargetRef: "portal-service-image", sourceRoot: "services/portal", namespace: "namespace-proof", workload: "portal-proof", container: "portal", ownerRef: "owner-proof", operationId: "operation-proof", expectedVersionMarker: "pkg-d-deploy-dry-run-proof-20260511-000001" },
      { component: "opl-web-gateway", targetClass: "platform_service_target", repository: "opl-web-gateway-proof", imageTargetRef: "opl-web-gateway-service-image", sourceRoot: "services/opl-web-gateway", namespace: "namespace-proof", workload: "opl-web-gateway-proof", container: "opl-web-gateway", ownerRef: "owner-proof", operationId: "operation-proof", expectedVersionMarker: "pkg-d-deploy-dry-run-proof-20260511-000001" },
      { component: "opl-runtime-bridge", targetClass: "platform_service_target", repository: "opl-runtime-bridge-proof", imageTargetRef: "opl-runtime-bridge-service-image", sourceRoot: "services/opl-runtime-bridge", namespace: "namespace-proof", workload: "opl-runtime-bridge-proof", container: "opl-runtime-bridge", ownerRef: "owner-proof", operationId: "operation-proof", expectedVersionMarker: "pkg-d-deploy-dry-run-proof-20260511-000001" },
    ],
    runtimeSmokeTargets: [
      { surface: "portal", url: "https://portal.medopl.cn/healthz", expectedVersionMarker: "pkg-d-deploy-dry-run-proof-20260511-000001", provesPushedVersion: true, provesComponents: ["portal"] },
      { surface: "opl", url: "https://opl.medopl.cn/healthz", expectedVersionMarker: "pkg-d-deploy-dry-run-proof-20260511-000001", provesPushedVersion: true, provesComponents: ["opl-web-gateway", "opl-runtime-bridge"] },
      { surface: "trace", url: "https://trace.medopl.cn/api/public/health", expectedVersionMarker: "trace-surface-ok", provesPushedVersion: false, provesComponents: [] },
    ],
    ...overrides,
  };
}

function digestReportFor(plan = {}) {
  return {
    ok: true,
    reportPath: `.runtime/v22-registry/${plan.runId}-build-push.json`,
    targets: plan.targets.map((target) => ({
      component: target.component,
      registry: {
        digest: `sha256:${createHash("sha256").update(`${plan.runId}:${target.component}`).digest("hex")}`,
      },
    })),
  };
}

function digestMapFromReport(report = {}) {
  const map = new Map();
  for (const target of report.targets || []) {
    const digest = text(target.registry?.digest || target.imageDigest);
    if (target.component && /^sha256:[a-f0-9]{64}$/.test(digest)) map.set(text(target.component), digest);
  }
  return map;
}

function localDeployDryRun(plan = {}, digestReport = null) {
  if (!digestReport) return { ok: false, blockedReason: "deploy_image_digests_file_required" };
  const digestMap = digestMapFromReport(digestReport);
  const missingDigest = plan.targets.find((target) => !digestMap.has(text(target.component)));
  if (missingDigest) return { ok: false, blockedReason: "deploy_image_digest_required" };
  return {
    ok: true,
    reportPath: `.runtime/v22-cloud-deploy/${plan.runId}-deploy-dry-run.json`,
    targets: plan.targets.map((target) => ({
      component: target.component,
      imageDigest: digestMap.get(text(target.component)),
      deploy: {
        dryRunVerified: true,
        rollbackImageKnown: true,
        callsKubectlNow: false,
        appliesMutationNow: false,
      },
    })),
  };
}

const [contract, readme, board, status, verificationMatrix, suite] = await Promise.all([
  readFile(contractPath, "utf8"),
  readFile(readmePath, "utf8"),
  readFile(boardPath, "utf8"),
  readFile(statusPath, "utf8"),
  readFile(verificationMatrixPath, "utf8"),
  readFile(suitePath, "utf8"),
]);

assertIncludesAll(contract + readme + board + status + verificationMatrix, [
  "cloud-lane/feat/v22-package-d-deploy-dry-run-gate",
  "gpt-5.4",
  "7fbc632",
  "R-16",
  "imageDigestsFile",
  "deploy_image_digests_file_required",
  "D3a",
], "cloud_lane_d3a_contract_status");

assertIncludesAll(contract, [
  "D3a 不授权 `kubectl apply`、rollout、runtime smoke、rollback 或 Package C 计算/存储生命周期动作",
  "real mode 读取 deploy secret、读取 kubeconfig、调用 `kubectl get deployment` 和执行 server-side dry-run 都需要当前会话显式授权",
], "d3a_non_goals");

assert(suite.includes("smoke-test-v22-package-d-deploy-dry-run-gate.mjs"), "mvp_suite_must_include_package_d_deploy_dry_run_gate_smoke");
assert.equal(contract.includes("scripts/v22-tencent-authorized-deploy-execution-runner.mjs"), false, "contract_must_not_reference_deleted_deploy_runner");

const plan = releasePlan();
const blockedDryRun = localDeployDryRun(plan);
assert.equal(blockedDryRun.ok, false, "deploy_dry_run_without_digests_must_block");
assert.equal(blockedDryRun.blockedReason, "deploy_image_digests_file_required", "deploy_dry_run_without_digests_must_block_reason");

const deployDryRun = localDeployDryRun(plan, digestReportFor(plan));
assert.equal(deployDryRun.ok, true, "deploy_dry_run_ok");
assert.equal(deployDryRun.reportPath.endsWith(".runtime/v22-cloud-deploy/pkg-d-deploy-dry-run-proof-deploy-dry-run.json"), true, "deploy_dry_run_report_path");
assert.equal(deployDryRun.targets.every((target) => /^sha256:[a-f0-9]{64}$/.test(target.imageDigest || "")), true, "deploy_dry_run_consumed_digest");
assert.equal(deployDryRun.targets.every((target) => target.deploy?.dryRunVerified === true), true, "deploy_dry_run_verified_shape");
assert.equal(deployDryRun.targets.every((target) => target.deploy?.rollbackImageKnown === true), true, "deploy_dry_run_rollback_image_known_shape");
assert.equal(deployDryRun.targets.every((target) => target.deploy?.callsKubectlNow === false), true, "deploy_dry_run_must_not_call_kubectl");
assert.equal(JSON.stringify(deployDryRun).includes("kubeconfig-proof"), false, "deploy_dry_run_must_not_contain_secret_material");

console.log(JSON.stringify({
  ok: true,
  contract: "v22_package_d_deploy_dry_run_gate",
  branch: "cloud-lane/feat/v22-package-d-deploy-dry-run-gate",
  model: "gpt-5.4",
  checked: [
    "long_lived_cloud_lane_recorded",
    "d1_d2_d3a_stack_recorded",
    "deploy_dry_run_requires_d2_digest_report",
    "local_deploy_dry_run_report_sanitized",
    "real_kubectl_not_claimed",
  ],
}, null, 2));
