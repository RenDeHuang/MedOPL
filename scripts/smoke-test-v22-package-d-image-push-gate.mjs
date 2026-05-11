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
    runId: "pkg-d-image-push-proof",
    versionTag: "pkg-d-image-push-proof-20260511-000001",
    namespace: "namespace-proof",
    targets: [
      {
        component: "portal",
        targetClass: "platform_service_target",
        repository: "portal-proof",
        dockerfile: "deploy/local/dockerfiles/portal.Dockerfile",
        buildContext: "services/portal",
        namespace: "namespace-proof",
        workload: "portal-proof",
        container: "portal",
        ownerRef: "owner-proof",
        operationId: "operation-proof",
        expectedVersionMarker: "pkg-d-image-push-proof-20260511-000001",
      },
      {
        component: "opl-web-gateway",
        targetClass: "platform_service_target",
        repository: "opl-web-gateway-proof",
        dockerfile: "deploy/local/dockerfiles/opl-web-gateway.Dockerfile",
        buildContext: "services/opl-web-gateway",
        namespace: "namespace-proof",
        workload: "opl-web-gateway-proof",
        container: "opl-web-gateway",
        ownerRef: "owner-proof",
        operationId: "operation-proof",
        expectedVersionMarker: "pkg-d-image-push-proof-20260511-000001",
      },
      {
        component: "opl-runtime-bridge",
        targetClass: "platform_service_target",
        repository: "opl-runtime-bridge-proof",
        dockerfile: "deploy/local/dockerfiles/opl-runtime-bridge.Dockerfile",
        buildContext: "services/opl-runtime-bridge",
        namespace: "namespace-proof",
        workload: "opl-runtime-bridge-proof",
        container: "opl-runtime-bridge",
        ownerRef: "owner-proof",
        operationId: "operation-proof",
        expectedVersionMarker: "pkg-d-image-push-proof-20260511-000001",
      },
    ],
    runtimeSmokeTargets: [
      {
        surface: "portal",
        url: "https://portal.medopl.cn/healthz",
        expectedVersionMarker: "pkg-d-image-push-proof-20260511-000001",
        provesPushedVersion: true,
        provesComponents: ["portal"],
      },
      {
        surface: "opl",
        url: "https://opl.medopl.cn/healthz",
        expectedVersionMarker: "pkg-d-image-push-proof-20260511-000001",
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
  "cloud-lane/feat/v22-package-d-image-push-gate",
  "gpt-5.4",
  "eb23e02",
  "R-14",
  "R-15",
  "acceptedPreflightId",
  "deploy_accepted_preflight_required",
  "D2",
], "cloud_lane_d2_contract_status");

assertIncludesAll(contract, [
  "D2 不授权 kubectl dry-run、rollout、runtime smoke、rollback 或 Package C 计算/存储生命周期动作",
  "real mode 读取 deploy secret、docker login、docker build、docker push 和真实 TCR digest readback 都需要当前会话显式授权",
], "d2_non_goals");

assert(suite.includes("smoke-test-v22-package-d-image-push-gate.mjs"), "mvp_suite_must_include_package_d_image_push_gate_smoke");

const tmpDir = await mkdtemp(path.join(os.tmpdir(), "v22-package-d-image-push-gate-"));
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

  const preflight = runRunner(["--tcr-preflight", ...baseArgs]);
  reportPathsToCleanup.push(preflight.reportPath);
  assert.equal(preflight.ok, true, "preflight_ok");
  assert.equal(preflight.reportPath.endsWith(".runtime/v22-registry/pkg-d-image-push-proof-tcr-preflight.json"), true, "preflight_report_path");

  const blockedBuildPush = runRunner(["--build-push", ...baseArgs], 1);
  assert.equal(blockedBuildPush.summary.blockedReason, "deploy_accepted_preflight_required", "build_push_without_preflight_must_block");

  const buildPush = runRunner(["--build-push", ...baseArgs, "--accepted-preflight-id", "pkg-d-image-push-proof-tcr-preflight"]);
  reportPathsToCleanup.push(buildPush.reportPath);
  assert.equal(buildPush.ok, true, "build_push_ok");
  assert.equal(buildPush.reportPath.endsWith(".runtime/v22-registry/pkg-d-image-push-proof-build-push.json"), true, "build_push_report_path");
  assert.equal(buildPush.summary.targets.every((target) => /^sha256:[a-f0-9]{64}$/.test(target.registry?.digest || "")), true, "build_push_digest_shape");
  assert.equal(buildPush.summary.targets.every((target) => String(target.registry?.acceptedPreflightId || "").includes("****")), true, "build_push_preflight_id_masked");
  assertNotContainsForbidden(buildPush, "build_push_summary");
} finally {
  await rm(tmpDir, { recursive: true, force: true });
  await Promise.all(reportPathsToCleanup.map((reportPath) => rm(reportPath, { force: true })));
}

console.log(JSON.stringify({
  ok: true,
  contract: "v22_package_d_image_push_gate",
  branch: "cloud-lane/feat/v22-package-d-image-push-gate",
  model: "gpt-5.4",
  checked: [
    "long_lived_cloud_lane_recorded",
    "d1_d2_stack_recorded",
    "build_push_requires_accepted_preflight",
    "fake_live_preflight_build_push_reports_sanitized",
    "real_push_not_claimed",
  ],
}, null, 2));
