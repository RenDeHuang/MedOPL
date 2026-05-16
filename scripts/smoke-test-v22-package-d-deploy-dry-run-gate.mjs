import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const runnerPath = "scripts/v22-tencent-authorized-deploy-execution-runner.mjs";
const contractPath = "docs/contracts/v22-authorized-tencent-deploy-execution-boundary.md";
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

function assertNotContainsForbidden(value, label) {
  const serialized = typeof value === "string" ? value : JSON.stringify(value || {});
  assert.equal(
    /SecretId|SecretKey|TCR_SECRET|registry-password-proof|kubeconfig-proof|dockerConfig|\bAuthorization\b|\bCookie\b/i.test(serialized),
    false,
    `${label}_must_not_contain_secret_material`,
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

function releasePlan() {
  return {
    runId: "pkg-d-deploy-dry-run-proof",
    versionTag: "pkg-d-deploy-dry-run-proof-20260511-000001",
    namespace: "namespace-proof",
    targets: [
      {
        component: "portal",
        targetClass: "platform_service_target",
        repository: "portal-proof",
        imageTargetRef: "portal-service-image",
        sourceRoot: "services/portal",
        namespace: "namespace-proof",
        workload: "portal-proof",
        container: "portal",
        ownerRef: "owner-proof",
        operationId: "operation-proof",
        expectedVersionMarker: "pkg-d-deploy-dry-run-proof-20260511-000001",
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
        imageTargetRef: "opl-web-gateway-service-image",
        sourceRoot: "services/opl-web-gateway",
        namespace: "namespace-proof",
        workload: "opl-web-gateway-proof",
        container: "opl-web-gateway",
        ownerRef: "owner-proof",
        operationId: "operation-proof",
        expectedVersionMarker: "pkg-d-deploy-dry-run-proof-20260511-000001",
      },
      {
        component: "opl-runtime-bridge",
        targetClass: "platform_service_target",
        repository: "opl-runtime-bridge-proof",
        imageTargetRef: "opl-runtime-bridge-service-image",
        sourceRoot: "services/opl-runtime-bridge",
        namespace: "namespace-proof",
        workload: "opl-runtime-bridge-proof",
        container: "opl-runtime-bridge",
        ownerRef: "owner-proof",
        operationId: "operation-proof",
        expectedVersionMarker: "pkg-d-deploy-dry-run-proof-20260511-000001",
      },
    ],
    runtimeSmokeTargets: [
      {
        surface: "portal",
        url: "https://portal.medopl.cn/healthz",
        expectedVersionMarker: "pkg-d-deploy-dry-run-proof-20260511-000001",
        provesPushedVersion: true,
        provesComponents: ["portal"],
      },
      {
        surface: "opl",
        url: "https://opl.medopl.cn/healthz",
        expectedVersionMarker: "pkg-d-deploy-dry-run-proof-20260511-000001",
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

const tmpDir = await mkdtemp(path.join(os.tmpdir(), "v22-package-d-deploy-dry-run-gate-"));
const reportPathsToCleanup = [];
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
  const releasePlanFile = path.join(tmpDir, "release-plan.json");
  await writeFile(releasePlanFile, `${JSON.stringify(releasePlan(), null, 2)}\n`, "utf8");
  const baseArgs = ["--provider-mode", "fake-live", "--secret-file", secretFile, "--release-plan", releasePlanFile];

  const buildPush = runRunner(["--build-push", ...baseArgs, "--accepted-preflight-id", "pkg-d-deploy-dry-run-proof-tcr-preflight"]);
  reportPathsToCleanup.push(buildPush.reportPath);
  assert.equal(buildPush.ok, true, "build_push_ok");
  assert.equal(buildPush.summary.targets.every((target) => /^sha256:[a-f0-9]{64}$/.test(target.registry?.digest || "")), true, "build_push_digest_shape");

  const blockedDryRun = runRunner(["--deploy-dry-run", ...baseArgs], 1);
  assert.equal(blockedDryRun.summary.blockedReason, "deploy_image_digests_file_required", "deploy_dry_run_without_digests_must_block");

  const deployDryRun = runRunner(["--deploy-dry-run", ...baseArgs, "--image-digests-file", buildPush.reportPath]);
  reportPathsToCleanup.push(deployDryRun.reportPath);
  assert.equal(deployDryRun.ok, true, "deploy_dry_run_ok");
  assert.equal(deployDryRun.reportPath.endsWith(".runtime/v22-cloud-deploy/pkg-d-deploy-dry-run-proof-deploy-dry-run.json"), true, "deploy_dry_run_report_path");
  assert.equal(deployDryRun.summary.targets.every((target) => /^sha256:[a-f0-9]{64}$/.test(target.imageDigest || "")), true, "deploy_dry_run_consumed_digest");
  assert.equal(deployDryRun.summary.targets.every((target) => target.deploy?.dryRunVerified === true), true, "deploy_dry_run_verified_shape");
  assert.equal(deployDryRun.summary.targets.every((target) => target.deploy?.rollbackImageKnown === true), true, "deploy_dry_run_rollback_image_known_shape");
  assertNotContainsForbidden(deployDryRun, "deploy_dry_run_summary");
} finally {
  await rm(tmpDir, { recursive: true, force: true });
  await Promise.all(reportPathsToCleanup.map((reportPath) => rm(reportPath, { force: true })));
}

console.log(JSON.stringify({
  ok: true,
  contract: "v22_package_d_deploy_dry_run_gate",
  branch: "cloud-lane/feat/v22-package-d-deploy-dry-run-gate",
  model: "gpt-5.4",
  checked: [
    "long_lived_cloud_lane_recorded",
    "d1_d2_d3a_stack_recorded",
    "deploy_dry_run_requires_d2_digest_report",
    "fake_live_deploy_dry_run_report_sanitized",
    "real_kubectl_not_claimed",
  ],
}, null, 2));
