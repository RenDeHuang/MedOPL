import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const repoRoot = path.resolve(".");
const runnerPath = "scripts/v22-tencent-authorized-deploy-execution-runner.mjs";

const forbiddenOutputPattern = /SecretId|SecretKey|TCR_SECRET|token|kubeconfig|objectKey|storageKey|signedUrl|rawResponse|providerRawResponse|dockerConfig|\bAuthorization\b|\bCookie\b/i;

function runRunner(args) {
  const result = spawnSync(process.execPath, [runnerPath, ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: "pipe",
  });
  assert.equal(forbiddenOutputPattern.test(result.stdout), false, `stdout_must_be_redacted:${args.join(" ")}`);
  assert.equal(forbiddenOutputPattern.test(result.stderr), false, `stderr_must_be_redacted:${args.join(" ")}`);
  let parsed = null;
  try {
    parsed = JSON.parse((result.stdout || result.stderr || "{}").trim());
  } catch {
    parsed = null;
  }
  return { result, parsed };
}

function writeReleasePlan() {
  const tmpDir = mkdtempSync(path.join(os.tmpdir(), "v22-package-d-live-gate-"));
  const file = path.join(tmpDir, "release-plan.json");
  const plan = {
    runId: "pkg-d-live-gate",
    versionTag: "pkg-d-live-gate-20260510-000001",
    namespace: "namespace-live-gate",
    targets: [
      {
        component: "portal",
        repository: "portal-live-gate",
        dockerfile: "deploy/local/dockerfiles/portal.Dockerfile",
        buildContext: "services/portal",
        namespace: "namespace-live-gate",
        workload: "portal-live-gate",
        container: "portal",
        ownerRef: "owner-live-gate",
        workspaceId: "workspace-live-gate",
        resourceBindingId: "binding-live-gate",
        operationId: "operation-live-gate",
        expectedVersionMarker: "pkg-d-live-gate-20260510-000001",
      },
      {
        component: "opl-web-gateway",
        repository: "opl-web-gateway-live-gate",
        dockerfile: "deploy/local/dockerfiles/opl-web-gateway.Dockerfile",
        buildContext: "services/opl-web-gateway",
        namespace: "namespace-live-gate",
        workload: "opl-web-gateway-live-gate",
        container: "opl-web-gateway",
        ownerRef: "owner-live-gate",
        workspaceId: "workspace-live-gate",
        resourceBindingId: "binding-live-gate",
        operationId: "operation-live-gate",
        expectedVersionMarker: "pkg-d-live-gate-20260510-000001",
      },
      {
        component: "opl-runtime-bridge",
        repository: "opl-runtime-bridge-live-gate",
        dockerfile: "deploy/local/dockerfiles/opl-runtime-bridge.Dockerfile",
        buildContext: "services/opl-runtime-bridge",
        namespace: "namespace-live-gate",
        workload: "opl-runtime-bridge-live-gate",
        container: "opl-runtime-bridge",
        ownerRef: "owner-live-gate",
        workspaceId: "workspace-live-gate",
        resourceBindingId: "binding-live-gate",
        operationId: "operation-live-gate",
        expectedVersionMarker: "pkg-d-live-gate-20260510-000001",
      },
    ],
    runtimeSmokeTargets: [
      {
        surface: "portal",
        url: "https://portal.medopl.cn/healthz",
        expectedVersionMarker: "pkg-d-live-gate-20260510-000001",
        provesPushedVersion: true,
        provesComponents: ["portal"],
      },
      {
        surface: "opl",
        url: "https://opl.medopl.cn/healthz",
        expectedVersionMarker: "pkg-d-live-gate-20260510-000001",
        provesPushedVersion: true,
        provesComponents: ["opl-web-gateway", "opl-runtime-bridge"],
      },
      {
        surface: "trace",
        url: "https://trace.medopl.cn/api/public/health",
        expectedVersionMarker: "langfuse-health-ok",
        provesPushedVersion: false,
        provesComponents: [],
      },
    ],
  };
  writeFileSync(file, `${JSON.stringify(plan, null, 2)}\n`, "utf8");
  return { tmpDir, file };
}

const checked = [];
let acceptedSecretFile = "";
const releasePlan = writeReleasePlan();
const fixtureDir = mkdtempSync(path.join(os.tmpdir(), "v22-package-d-secret-gate-"));
const fixtures = [
  {
    name: "package-d-deploy.env",
    text: [
      "RUN_TENCENT_DEPLOY_EXECUTION=1",
      "TCR_ID=deploy-id-proof",
      "TCR_SECRET=registry-password-proof",
      "TENCENT_TCR_REGISTRY=registry-proof.example.tencentcloudcr.com",
      "TENCENT_TCR_NAMESPACE=namespace-proof",
      "TENCENT_TCR_REGION=na-siliconvalley",
      "TENCENT_DEPLOY_CLUSTER_ID=cluster-proof",
      "TENCENT_DEPLOY_KUBECONFIG_REF=kubeconfig-ref-proof",
    ].join("\n"),
  },
  {
    name: "package-c-mutation.env",
    text: [
      "RUN_TENCENT_CREATE_RELEASE_EXECUTION=1",
      "TENCENT_MUTATION_SECRET_ID=mutation-secret-proof",
    ].join("\n"),
  },
  {
    name: "readonly.env",
    text: [
      "RUN_TENCENT_READONLY_INVENTORY=1",
      "TENCENT_READONLY_SECRET_ID=readonly-secret-proof",
    ].join("\n"),
  },
];
try {
  for (const fixture of fixtures) {
    writeFileSync(path.join(fixtureDir, fixture.name), fixture.text, "utf8");
  }

  for (const fixture of fixtures) {
    const file = path.join(fixtureDir, fixture.name);
    const { result, parsed } = runRunner([
      "--check-config",
      "--secret-file",
      file,
      "--release-plan",
      releasePlan.file,
    ]);
    const ok = result.status === 0 && parsed?.ok === true;
    checked.push({
      file: path.basename(file),
      ok,
      blockedReason: ok ? "" : (parsed?.summary?.blockedReason || parsed?.error || "check_config_failed"),
    });
    if (ok && !acceptedSecretFile) {
      acceptedSecretFile = fixture.name;
    }
  }
} finally {
  rmSync(releasePlan.tmpDir, { recursive: true, force: true });
  rmSync(fixtureDir, { recursive: true, force: true });
}

console.log(JSON.stringify({
  ok: true,
  contract: "v22_tencent_authorized_deploy_execution_live_gate",
  checked,
  configGateReady: Boolean(acceptedSecretFile),
  liveReady: false,
  releasePlanReady: true,
  realExecutionReady: false,
  requiresKubeApiserverConnectivity: true,
  acceptedSecretFile,
  blockedReason: acceptedSecretFile ? "needs_reviewed_real_release_plan_kube_apiserver_connectivity_dry_run_acceptance_and_explicit_authorization" : "deploy_config_gate_not_ready",
}, null, 2));
