import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";

const repoRoot = path.resolve(".");
const runnerPath = "scripts/v22-tencent-authorized-resource-lifecycle-runner.mjs";
const forbiddenOutputPattern = /SecretId|SecretKey|token|kubeconfig|objectKey|storageKey|cosPrefix|signedUrl|raw response|rawResponse|providerRawResponse|authorization|header|bucket-proof|workspace-prefix-proof|node-pool-proof|mutation-secret/i;

function assertNoForbidden(value, label) {
  const serialized = typeof value === "string" ? value : JSON.stringify(value);
  assert.equal(forbiddenOutputPattern.test(serialized), false, `${label}_must_not_leak_secret_or_raw_cloud_shape`);
}

async function freePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const { port } = server.address();
  await new Promise((resolve) => server.close(resolve));
  return port;
}

function runRunner(args) {
  const result = spawnSync(process.execPath, [runnerPath, ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: "pipe",
  });
  assert.equal(result.status, 0, `runner_failed:${args.join(" ")}:${result.stderr}`);
  assertNoForbidden(result.stdout, `runner_stdout:${args.join(" ")}`);
  assertNoForbidden(result.stderr, `runner_stderr:${args.join(" ")}`);
  return JSON.parse(result.stdout.trim());
}

async function waitForPortal(port, child) {
  const url = `http://127.0.0.1:${port}/healthz`;
  const started = Date.now();
  while (Date.now() - started < 10000) {
    assert.equal(child.exitCode, null, "portal_exited_before_healthz");
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  throw new Error("portal_healthz_timeout");
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  assertNoForbidden(text, `http_response:${url}`);
  let payload = null;
  try {
    payload = JSON.parse(text);
  } catch {
    payload = { raw: text };
  }
  return { response, payload, text };
}

function cookieFrom(response) {
  const cookie = response.headers.get("set-cookie") || "";
  return cookie.split(";")[0];
}

function assertPortalBridgePayload(payload, operationType) {
  assert.equal(payload.ok, true, `${operationType}_portal_payload_ok`);
  assert.equal(payload.testOnly, true, `${operationType}_portal_payload_test_only`);
  assert.equal(payload.productionPortalConnected, false, `${operationType}_must_not_claim_production`);
  assert.equal(payload.runnerMode, "fake-live", `${operationType}_runner_mode`);
  assert.equal(payload.realCloudCalls, false, `${operationType}_must_not_call_cloud`);
  assert.equal(payload.operation?.operationType, operationType, `${operationType}_operation_type`);
  assert.equal(payload.operation?.status, "succeeded", `${operationType}_operation_status`);
  assert.match(payload.operation?.evidenceRef || "", /^\.runtime\/v22-cloud-lifecycle\/op-[a-z0-9-]+-fake-live\.json$/, `${operationType}_evidence_ref_sanitized`);
  assertNoForbidden(payload, `${operationType}_portal_payload`);
}

const tempDir = await mkdtemp(path.join(os.tmpdir(), "v22-portal-cloud-runner-loop-"));
let portal = null;
try {
  const secretFile = path.join(tempDir, "package-c-mutation.env");
  await writeFile(secretFile, [
    "RUN_TENCENT_CREATE_RELEASE_EXECUTION=1",
    "TENCENT_MUTATION_SECRET_ID=mutation-secret-id-proof",
    "TENCENT_MUTATION_SECRET_KEY=mutation-secret-key-proof",
    "TENCENT_MUTATION_ALLOWED_APIS=putObject,deleteObject,DescribeNodePools,ScaleNodePool",
    "TENCENT_MUTATION_REGIONS=na-siliconvalley",
    "TENCENT_MUTATION_ACCOUNT_ID=account-proof-123456",
    "TENCENT_MUTATION_DAILY_BUDGET_CNY=20",
    "TENCENT_MUTATION_MAX_OPERATION_COUNT=6",
    "TENCENT_MUTATION_TKE_CLUSTER_ID=cls-proof",
    "TENCENT_MUTATION_TKE_NODE_POOL_ID=node-pool-proof",
    "TENCENT_MUTATION_COS_BUCKET=bucket-proof",
    "TENCENT_MUTATION_COS_REGION=na-siliconvalley",
    "TENCENT_MUTATION_WORKSPACE_PREFIX_ROOT=workspace-prefix-proof",
  ].join("\n"), "utf8");

  const workspaceId = "workspace-runner-loop";
  const dryRun = runRunner([
    "--dry-run",
    "--secret-file",
    secretFile,
    "--operation",
    "storage-create",
    "--run-id",
    "portal-loop-storage",
  ]);
  assert.equal(dryRun.ok, true, "runner_dry_run_ok");
  assert.equal(dryRun.summary?.gateId, "R-06", "runner_dry_run_gate");
  assert.equal(dryRun.summary?.operationType, "create_storage", "runner_dry_run_operation_type");
  assert.equal(dryRun.summary?.risk?.callsRealCloudNow, false, "runner_dry_run_no_cloud");
  assert.equal(dryRun.summary?.risk?.executesMutationNow, false, "runner_dry_run_no_mutation");

  const fakeLive = runRunner([
    "--execute",
    "--sdk-mode",
    "fake-live",
    "--secret-file",
    secretFile,
    "--operation",
    "storage-create",
    "--run-id",
    "portal-loop-storage",
    "--accepted-dry-run-id",
    "portal-loop-storage-storage-create",
    "--workspace-id",
    workspaceId,
  ]);
  assert.equal(fakeLive.ok, true, "runner_fake_live_ok");
  assert.equal(fakeLive.summary?.execution?.providerMode, "fake-live", "runner_fake_live_mode");
  assert.equal(fakeLive.summary?.execution?.acceptedDryRunVerified, true, "runner_fake_live_accepted_dry_run");
  assert.equal(fakeLive.summary?.risk?.callsRealCloudNow, false, "runner_fake_live_no_cloud");
  assert.equal(fakeLive.summary?.risk?.executesMutationNow, true, "runner_fake_live_executes_fake_path");

  const port = await freePort();
  portal = spawn(process.execPath, ["src/server.mjs"], {
    cwd: path.join(repoRoot, "services", "portal"),
    env: {
      ...process.env,
      PORT: String(port),
      NODE_ENV: "test",
      PORTAL_OIDC_ENABLED: "0",
      PORTAL_ENABLE_CLOUD_OPERATION_TEST_BRIDGE: "1",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let portalStdout = "";
  let portalStderr = "";
  portal.stdout.on("data", (chunk) => { portalStdout += String(chunk); });
  portal.stderr.on("data", (chunk) => { portalStderr += String(chunk); });
  await waitForPortal(port, portal);
  assertNoForbidden(portalStdout, "portal_stdout");
  assertNoForbidden(portalStderr, "portal_stderr");

  const base = `http://127.0.0.1:${port}`;
  const email = `runner-loop-${Date.now()}@example.test`;
  const register = await fetch(`${base}/register`, {
    method: "POST",
    redirect: "manual",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      name: "Runner Loop User",
      email,
      password: "Password1!",
    }),
  });
  assert.equal(register.status, 302, "local_register_redirect");
  const cookie = cookieFrom(register);
  assert.match(cookie, /^portal_session=/, "portal_session_cookie");

  const portalExecution = await requestJson(`${base}/portal/api/v22/cloud-operations/test/fake-live`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie,
    },
    body: JSON.stringify({
      workspaceId,
      operationType: dryRun.summary.operationType,
      acceptedDryRunId: dryRun.summary.operationId,
      fileSpaceGb: 10,
      planId: "starter_2c4g_10gb",
    }),
  });
  assert.equal(portalExecution.response.status, 200, "portal_fake_live_status");
  assertPortalBridgePayload(portalExecution.payload, "create_storage");

  const projection = await requestJson(`${base}/portal/api/v22/cloud-operations/test/projection?workspaceId=${encodeURIComponent(workspaceId)}`, {
    headers: { cookie },
  });
  assert.equal(projection.response.status, 200, "portal_projection_status");
  assert.equal(projection.payload.ok, true, "portal_projection_ok");
  assert.equal(projection.payload.testOnly, true, "portal_projection_test_only");
  assert.equal(projection.payload.productionPortalConnected, false, "portal_projection_not_production");
  assert.equal(projection.payload.realCloudCalls, false, "portal_projection_no_cloud");
  assert.equal(projection.payload.resources?.fileSpace?.statusLabel, "可用", "portal_file_space_status");
  assert.equal(projection.payload.resources?.fileSpace?.capacityGb, 10, "portal_file_space_capacity");
  assert.deepEqual(projection.payload.visibleConcepts, ["工作台资源", "计算资源", "文件空间", "套餐", "余额", "冻结金额"], "portal_visible_concepts");
  assertNoForbidden(projection.payload, "portal_projection_payload");

  console.log(JSON.stringify({
    ok: true,
    contract: "v22_portal_cloud_operation_runner_loop",
    checked: [
      "package_c_runner_dry_run_gate",
      "package_c_runner_fake_live_gate",
      "portal_local_login",
      "portal_test_bridge_uses_runner_accepted_dry_run_id",
      "portal_projection_public_language",
      "no_secret_or_raw_cloud_output",
      "no_real_cloud_call",
      "not_production_portal_connection",
    ],
    portal: {
      status: projection.response.status,
      testOnly: projection.payload.testOnly,
      productionPortalConnected: projection.payload.productionPortalConnected,
      realCloudCalls: projection.payload.realCloudCalls,
    },
    runner: {
      dryRunGate: dryRun.summary.gateId,
      operationType: dryRun.summary.operationType,
      fakeLiveProviderMode: fakeLive.summary.execution.providerMode,
    },
  }, null, 2));
} finally {
  if (portal) {
    if (portal.exitCode === null && !portal.killed) {
      portal.kill("SIGTERM");
    }
    await new Promise((resolve) => portal.once("close", resolve));
  }
  await rm(tempDir, { recursive: true, force: true });
}
