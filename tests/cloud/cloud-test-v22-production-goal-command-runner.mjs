import assert from "node:assert/strict";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
const runner = "tests/support/cloud-prework/production-goal-command-runner.mjs";
const runnerSource = readFileSync(path.join(repoRoot, runner), "utf8");

assert.equal(
  runnerSource.includes("DescribeClusterNodePools({ ClusterId: clusterId, NodePoolIds"),
  false,
  "runtime_tke_node_pool_probe_must_not_pass_unsupported_node_pool_ids",
);
assert.equal(
  runnerSource.includes("DescribeClusterNodePools({ ClusterId: clusterId })"),
  true,
  "runtime_tke_node_pool_probe_must_use_cluster_only_request_shape",
);
assert.equal(
  runnerSource.includes("normalizeDeploymentTarget(plan.deployment)")
    && runnerSource.includes("return \"deployment/medopl-control-plane\""),
  true,
  "deploy_runner_must_default_to_medopl_control_plane_deployment",
);
assert.equal(
  runnerSource.includes("rollout status deploy --timeout=180s"),
  false,
  "deploy_runner_must_not_use_invalid_rollout_status_deploy_target",
);

function run(args = [], env = {}) {
  return spawnSync(process.execPath, [runner, ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: "pipe",
    env: {
      ...process.env,
      ...env,
    },
  });
}

function parseJson(result, label) {
  assert.equal(result.status, 0, `${label}_must_exit_zero:${result.stderr || result.stdout}`);
  return JSON.parse(result.stdout);
}

function assertNoSensitiveText(text = "", label = "output") {
  for (const forbidden of [
    "mutation-secret-key",
    "tcr-secret-test",
    "postgres://ledger.example.invalid",
    "rawResponse",
    "SecretId",
    "SecretKey",
  ]) {
    assert.equal(text.includes(forbidden), false, `${label}_must_not_include:${forbidden}`);
  }
}

async function startCanaryServer(mode = "full") {
  const child = spawn(process.execPath, ["-e", `
const { createServer } = require("node:http");
const mode = process.argv[1];
async function readRequestJson(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  const text = Buffer.concat(chunks).toString("utf8");
  return text ? JSON.parse(text) : {};
}
const server = createServer(async (request, response) => {
  const url = new URL(request.url || "/", "http://127.0.0.1");
  const sendJson = (status, payload) => {
    response.writeHead(status, { "content-type": "application/json", connection: "close" });
    response.end(JSON.stringify(payload));
  };
  if (mode === "html-medopl" && (url.pathname === "/healthz" || url.pathname === "/readyz")) {
    response.writeHead(200, { "content-type": "text/html", connection: "close" });
    response.end("<!doctype html><title>wrong upstream</title>");
    return;
  }
  if (url.pathname === "/") {
    response.writeHead(200, { "content-type": "text/html", connection: "close" });
    response.end("<!doctype html><title>MedOPL Portal</title><div id=\\"root\\">MedOPL Portal</div><script type=\\"module\\" src=\\"/assets/app.js\\"></script>");
    return;
  }
  if (url.pathname === "/healthz" || url.pathname === "/readyz") {
    sendJson(200, { service: "medopl-go-backend", status: "ok", mode: "production" });
    return;
  }
  if (url.pathname === "/api/v22/provider-key" && request.method === "POST") {
    const body = await readRequestJson(request);
    sendJson(200, { ok: true, workspaceId: body.workspaceId, providerKeyRef: "pkref_canary", boundStatus: "bound" });
    return;
  }
  if (url.pathname === "/api/v22/managed-environment/open" && request.method === "POST") {
    const body = await readRequestJson(request);
    sendJson(200, { launchId: "launch_canary", resourceBindingId: "rb_canary", workspaceId: body.workspaceId });
    return;
  }
  if (url.pathname === "/api/opl/runtime-gate" && request.method === "POST") {
    const body = await readRequestJson(request);
    sendJson(200, {
      ok: true,
      productOwner: "medopl",
      primaryConsumer: "opl-webui",
      workspaceId: body.workspaceId,
      medoplRuntimeRequired: true,
      providerKeyStatus: "bound",
      providerKeyRef: "pkref_canary",
      runtimeState: "ready",
      storageState: "ready",
      runtimeBindingId: "rb_canary",
      storageBindingId: "storage_canary",
      nodePoolProjection: { nodePoolRef: "nodepool_canary", state: "ready", customerVisible: false },
      consumerProjection: { uploadEnabled: true, runEnabled: true, artifactEnabled: true },
    });
    return;
  }
  if (url.pathname === "/api/opl/files" && request.method === "POST") {
    sendJson(200, { ok: true, fileRef: "file_canary", storageBindingId: "storage_canary" });
    return;
  }
  if (url.pathname === "/api/opl/runs" && request.method === "POST") {
    sendJson(200, { ok: true, runRef: "run_canary", artifactRef: "artifact_canary" });
    return;
  }
  if (url.pathname === "/api/opl/artifacts/artifact_canary" && request.method === "GET") {
    sendJson(200, { ok: true, artifactRef: "artifact_canary", fileRef: "artifact_file_canary" });
    return;
  }
  if (url.pathname === "/api/billing/summary" && request.method === "GET") {
    sendJson(200, { ok: true, runCount: 1, ledgerCount: 1 });
    return;
  }
  if (url.pathname === "/api/v22/managed-environment/release" && request.method === "POST") {
    sendJson(200, { ok: true, billingStopped: true, auditEventId: "audit_release_canary", runtimeState: "released" });
    return;
  }
  if (url.pathname === "/api/v22/storage/destroy" && request.method === "POST") {
    sendJson(200, { ok: true, storageDestroyed: true, storageState: "destroyed", auditEventId: "audit_destroy_canary" });
    return;
  }
  sendJson(404, { ok: false, error: "not_found", path: url.pathname });
});
server.listen(0, "127.0.0.1", () => {
  const address = server.address();
  process.stdout.write("READY " + address.port + "\\n");
});
process.on("SIGTERM", () => server.close(() => process.exit(0)));
`, mode], {
    stdio: ["ignore", "pipe", "pipe"],
  });
  const port = await new Promise((resolve, reject) => {
    let buffer = "";
    const timer = setTimeout(() => reject(new Error("canary_server_start_timeout")), 5000);
    child.stdout.on("data", (chunk) => {
      buffer += chunk.toString("utf8");
      const match = buffer.match(/READY (\d+)/u);
      if (match) {
        clearTimeout(timer);
        resolve(Number(match[1]));
      }
    });
    child.on("exit", (code) => {
      clearTimeout(timer);
      reject(new Error(`canary_server_exited:${code}`));
    });
  });
  return {
    baseUrl: `http://127.0.0.1:${port}`,
    close: () => new Promise((resolve) => {
      child.once("exit", resolve);
      child.kill("SIGTERM");
    }),
  };
}

const canaryServers = [];
const tempDir = mkdtempSync(path.join(tmpdir(), "v22-production-command-runner-"));
try {
  const mutationSecretFile = path.join(tempDir, "mutation.env");
  const runtimePlan = path.join(tempDir, "runtime-plan.json");
  const storagePlan = path.join(tempDir, "storage-plan.json");
  const receiptFile = path.join(tempDir, "receipt.json");
  const deployPlan = path.join(tempDir, "deploy-plan.json");
  const shortDeployPlan = path.join(tempDir, "deploy-plan-short-name.json");
  const manifestDir = path.join(tempDir, "manifests");
  const buildContext = path.join(tempDir, "build-context");
  const binDir = path.join(tempDir, "bin");
  const kubectlLog = path.join(tempDir, "kubectl.log");
  mkdirSync(manifestDir);
  mkdirSync(buildContext);
  mkdirSync(binDir);
  writeFileSync(path.join(manifestDir, "deployment.yaml"), "apiVersion: v1\nkind: ConfigMap\nmetadata:\n  name: medopl-test\n");
  writeFileSync(path.join(buildContext, "Dockerfile"), "FROM scratch\n");
  writeFileSync(path.join(binDir, "kubectl"), [
    "#!/usr/bin/env bash",
    "printf '%s\\n' \"$*\" >> \"$TEST_KUBECTL_LOG\"",
    "exit 0",
    "",
  ].join("\n"));
  chmodSync(path.join(binDir, "kubectl"), 0o755);
  writeFileSync(mutationSecretFile, [
    "RUN_TENCENT_CREATE_RELEASE_EXECUTION=1",
    "TENCENT_MUTATION_SECRET_ID=mutation-secret-id",
    "TENCENT_MUTATION_SECRET_KEY=mutation-secret-key",
    "TENCENT_MUTATION_ACCOUNT_ID=123456789012",
    "TENCENT_MUTATION_REGIONS=na-siliconvalley",
    "TENCENT_MUTATION_TKE_CLUSTER_ID=cls-test",
    "TENCENT_MUTATION_TKE_PLATFORM_SERVICE_NODE_POOL_ID=np-test",
    "TENCENT_MUTATION_COS_BUCKET=cos-bucket-test",
    "TENCENT_MUTATION_COS_REGION=na-siliconvalley",
    "TENCENT_MUTATION_WORKSPACE_PREFIX_ROOT=medopl-v22/workspaces/",
    "",
  ].join("\n"));
  writeFileSync(runtimePlan, JSON.stringify({ runtime_plan: "starter", workspace_id: "workspace-test" }));
  writeFileSync(storagePlan, JSON.stringify({ storage_plan: "workspace", workspace_id: "workspace-test" }));
  writeFileSync(receiptFile, JSON.stringify({ events: ["runtime_owner_receipt_accepted"] }));
  writeFileSync(deployPlan, JSON.stringify({ namespace: "np-6l4nkdto-2cdtm", deployments: ["medopl"] }));
  writeFileSync(shortDeployPlan, JSON.stringify({ namespace: "medopl", deployment: "medopl-control-plane" }));

  const baseEnv = {
    V22_TENCENT_MUTATION_SECRET_FILE: mutationSecretFile,
    V22_TENCENT_RUNTIME_PLAN_FILE: runtimePlan,
    V22_TENCENT_STORAGE_PLAN_FILE: storagePlan,
    V22_MEDOPL_BILLING_AUDIT_RECEIPT_FILE: receiptFile,
    V22_MEDOPL_DEPLOY_PLAN_FILE: deployPlan,
    V22_KUBERNETES_MANIFEST_DIR: manifestDir,
    V22_CONTAINER_BUILD_CONTEXT: buildContext,
    V22_CONTAINER_DOCKERFILE: path.join(buildContext, "Dockerfile"),
    V22_CONTAINER_IMAGE_REF: "registry.example.test/medopl/app:test",
    TCR_ID: "tcr-id-test",
    TCR_SECRET: "tcr-secret-test",
    DATABASE_URL: "postgres://ledger.example.invalid/db",
    TENCENT_DEPLOY_KUBECONFIG_REF: "kubeconfig-ref-test",
    TEST_KUBECTL_LOG: kubectlLog,
    V22_OPL_WEBUI_CONSUMER_CANARY_URL: "https://opl.medopl.cn",
    V22_MEDOPL_PUBLIC_BASE_URL: "https://portal.medopl.cn",
    PATH: `${binDir}${path.delimiter}${process.env.PATH || ""}`,
  };

  const missingExecute = run(["--operation", "storage_lifecycle"], baseEnv);
  assert.notEqual(missingExecute.status, 0, "command_runner_must_require_execute");
  assert(missingExecute.stderr.includes("production_goal_command_execute_required"), "missing_execute_reason");
  assertNoSensitiveText(missingExecute.stdout + missingExecute.stderr, "missing_execute");

  const missingAuthorization = run(["--operation", "storage_lifecycle", "--execute"], baseEnv);
  assert.notEqual(missingAuthorization.status, 0, "command_runner_must_require_authorization_confirmation");
  assert(missingAuthorization.stderr.includes("production_goal_command_authorization_required"), "missing_authorization_reason");
  assertNoSensitiveText(missingAuthorization.stdout + missingAuthorization.stderr, "missing_authorization");

  const unsupported = run(["--operation", "unknown", "--check-config"], baseEnv);
  assert.notEqual(unsupported.status, 0, "command_runner_must_reject_unknown_operation");
  assert(unsupported.stderr.includes("production_goal_command_operation_unsupported"), "unsupported_reason");

  const checkConfig = parseJson(run(["--operation", "storage_lifecycle", "--check-config"], baseEnv), "storage_check_config");
  assert.equal(checkConfig.ok, true, "check_config_ok");
  assert.equal(checkConfig.summary.operationClass, "storage_lifecycle", "check_config_operation");
  assert.equal(checkConfig.summary.executesCloudCommands, false, "check_config_must_not_execute_cloud");
  assert.deepEqual(checkConfig.summary.requiredEnvMissing, [], "check_config_required_env");
  assertNoSensitiveText(JSON.stringify(checkConfig), "check_config");

  const billingCheck = parseJson(run(["--operation", "billing_audit_writeback", "--check-config"], baseEnv), "billing_check_config");
  assert.equal(billingCheck.summary.requiredEnvMissing.length, 0, "billing_required_env");
  assert.equal(billingCheck.summary.requiredPathMissing.length, 0, "billing_required_paths");

  const buildCheck = parseJson(run(["--operation", "build_push", "--check-config"], baseEnv), "build_check_config");
  assert.equal(buildCheck.summary.requiredEnvMissing.length, 0, "build_required_env");
  assert.equal(buildCheck.summary.requiredPathMissing.length, 0, "build_required_paths");

  const liveCheck = parseJson(run(["--operation", "live_test", "--check-config"], baseEnv), "live_check_config");
  assert.deepEqual(liveCheck.summary.urls, ["https://opl.medopl.cn", "https://portal.medopl.cn"], "live_urls");

  const badCanary = await startCanaryServer("html-medopl");
  canaryServers.push(badCanary);
  const htmlMedopl = run(["--operation", "live_test", "--execute", "--confirm-current-session-authorization"], {
    ...baseEnv,
    V22_OPL_WEBUI_CONSUMER_CANARY_URL: badCanary.baseUrl,
    V22_MEDOPL_PUBLIC_BASE_URL: badCanary.baseUrl,
  });
  assert.notEqual(htmlMedopl.status, 0, "live_test_must_fail_when_medopl_health_is_static_html");
  assert(
    (htmlMedopl.stdout + htmlMedopl.stderr).includes("production_goal_live_test_medopl_healthz_failed"),
    "live_test_html_health_blocker",
  );
  assertNoSensitiveText(htmlMedopl.stdout + htmlMedopl.stderr, "live_test_html_health");

  const goodCanary = await startCanaryServer("full");
  canaryServers.push(goodCanary);
  const liveExecute = parseJson(run(["--operation", "live_test", "--execute", "--confirm-current-session-authorization"], {
    ...baseEnv,
    V22_OPL_WEBUI_CONSUMER_CANARY_URL: goodCanary.baseUrl,
    V22_MEDOPL_PUBLIC_BASE_URL: goodCanary.baseUrl,
  }), "live_test_execute_full_product_api_canary");
  assert.equal(liveExecute.summary.flowCompleteness, "medopl_public_api_product_e2e", "live_test_must_execute_product_api_canary");
  assert.deepEqual(liveExecute.summary.steps, [
    "opl_webui_public_entry",
    "medopl_portal_public_entry",
    "medopl_healthz",
    "medopl_readyz",
    "bind_provider_key",
    "open_runtime",
    "runtime_gate",
    "upload_file",
    "run_task",
    "fetch_artifact",
    "billing_summary",
    "release_runtime",
    "destroy_storage",
  ], "live_test_product_api_steps");
  assert.equal(liveExecute.summary.productionComplete, false, "live_test_must_not_claim_production_complete");
  assertNoSensitiveText(JSON.stringify(liveExecute), "live_test_execute");

  const emptyBuildDir = path.join(tempDir, "empty-build");
  const emptyManifestDir = path.join(tempDir, "empty-manifest");
  mkdirSync(emptyBuildDir);
  mkdirSync(emptyManifestDir);
  const emptyBuild = run(["--operation", "build_push", "--check-config"], {
    ...baseEnv,
    V22_CONTAINER_DOCKERFILE: path.join(emptyBuildDir, "Dockerfile"),
  });
  assert.notEqual(emptyBuild.status, 0, "build_check_config_must_reject_empty_context");
  const emptyBuildPayload = JSON.parse(emptyBuild.stdout);
  assert.equal(emptyBuildPayload.ok, false, "empty_build_payload");
  assert.deepEqual(emptyBuildPayload.summary.requiredPathMissing, ["V22_CONTAINER_DOCKERFILE"], "empty_build_reason");

  const emptyManifest = run(["--operation", "kubectl", "--check-config"], {
    ...baseEnv,
    V22_KUBERNETES_MANIFEST_DIR: emptyManifestDir,
  });
  assert.notEqual(emptyManifest.status, 0, "kubectl_check_config_must_reject_empty_manifest_dir");
  const emptyManifestPayload = JSON.parse(emptyManifest.stdout);
  assert.equal(emptyManifestPayload.ok, false, "empty_manifest_payload");
  assert.deepEqual(emptyManifestPayload.summary.requiredContentMissing, ["V22_KUBERNETES_MANIFEST_DIR:manifest"], "empty_manifest_reason");

  const deployShortName = parseJson(run(["--operation", "deploy", "--execute", "--confirm-current-session-authorization"], {
    ...baseEnv,
    V22_MEDOPL_DEPLOY_PLAN_FILE: shortDeployPlan,
  }), "deploy_short_name");
  assert.equal(deployShortName.summary.deployment, "deployment/medopl-control-plane", "deploy_runner_must_normalize_short_deployment_name");
  const kubectlArgs = readFileSync(kubectlLog, "utf8");
  assert(
    kubectlArgs.includes("rollout status deployment/medopl-control-plane --timeout=180s"),
    `deploy_runner_must_call_rollout_status_with_resource_kind:${kubectlArgs}`,
  );
} finally {
  for (const server of canaryServers.reverse()) {
    await server.close();
  }
  rmSync(tempDir, { recursive: true, force: true });
}

console.log(JSON.stringify({
  ok: true,
  contract: "v22_production_goal_command_runner",
}, null, 2));
