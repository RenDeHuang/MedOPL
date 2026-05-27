import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import http from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

const RAW_PROVIDER_KEY = "local-portal-gateway-runtime-rc-provider-key";
const FORBIDDEN_PUBLIC = /rawProviderKey|providerApiKey|apiKey|launchToken|runtimeToken|bearerToken|SecretId|SecretKey|signedUrl|localPath/i;

const acpRuntimeFixtureSource = `
const readline = require("node:readline");
readline.createInterface({ input: process.stdin, crlfDelay: Infinity }).on("line", (line) => {
  const request = JSON.parse(line);
  let result = {};
  if (request.command === "initialize") {
    result = { surface_id: "local-portal-gateway-runtime-rc", version: "v22-local-rc", commands: ["initialize", "session_list", "session_ledger", "session_create", "prompt"] };
  } else if (request.command === "session_list" || request.command === "session_ledger") {
    result = { items: [] };
  } else if (request.command === "session_create") {
    result = { session_id: "opl-session-local-rc", task_acceptance: { status: "accepted" } };
  } else if (request.command === "prompt") {
    result = {
      response: "local rc OPL reply",
      replyMessageId: "reply-local-rc",
      messageTraceId: "trace-message-local-rc",
      providerInvocationRef: "provider-invocation-local-rc",
      capabilitySource: "local_acp_fixture",
      providerMetadata: {
        providerModelRef: "gflab:gpt-5.5",
        providerAuthorizationStatus: "configured"
      }
    };
  }
  process.stdout.write(JSON.stringify({ id: request.id, ok: true, result }) + "\\n");
});
`;

function scrubbedEnv(overrides = {}) {
  const env = { ...process.env, ...overrides };
  for (const key of [
    "GFLABTOKEN",
    "OPENAI_API_KEY",
    "OPL_CODEX_API_KEY",
    "TENCENTCLOUD_SECRET_ID",
    "TENCENTCLOUD_SECRET_KEY",
    "COS_SECRET_ID",
    "COS_SECRET_KEY",
  ]) {
    delete env[key];
  }
  return env;
}

function listen(server, port = 0) {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => {
      server.off("error", reject);
      resolve(server.address().port);
    });
  });
}

function close(server) {
  return new Promise((resolve) => server.close(resolve));
}

async function freePort() {
  const server = net.createServer();
  const port = await listen(server);
  await close(server);
  return port;
}

async function stopChild(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  child.kill("SIGTERM");
  const exited = await Promise.race([
    new Promise((resolve) => child.once("exit", resolve)),
    sleep(1500).then(() => false),
  ]);
  if (exited !== false || child.killed) return;
  child.kill("SIGKILL");
  await Promise.race([
    new Promise((resolve) => child.once("exit", resolve)),
    sleep(1000),
  ]);
}

async function waitFor(url, { okOnly = false } = {}) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(url, { redirect: "manual" });
      if (okOnly ? response.ok : response.status < 500) return response;
    } catch {}
    await sleep(100);
  }
  throw new Error(`timeout_waiting_for:${url}`);
}

function startCleanUpstreamFixture() {
  return http.createServer((req, res) => {
    const url = new URL(req.url || "/", "http://clean-opl.local");
    if (url.pathname === "/") {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end("<!doctype html><main>clean one-person-lab upstream local rc</main>");
      return;
    }
    res.writeHead(404, { "content-type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ ok: false, error: "not_found" }));
  });
}

function buildGoBackendBinary(outputPath) {
  const result = spawnSync("go", ["build", "-o", outputPath, "./cmd/server"], {
    cwd: "services/medopl-go-backend",
    env: scrubbedEnv({
      GOPROXY: process.env.GOPROXY || "https://goproxy.cn,direct",
      GOSUMDB: process.env.GOSUMDB || "sum.golang.google.cn",
    }),
    encoding: "utf8",
    stdio: "pipe",
  });
  assert.equal(result.status, 0, `go_backend_build_failed:${result.stderr || result.stdout}`);
}

function spawnGoBackend({ binaryPath, port, providerSecretRoot, portalStateRoot, gatewayUrl, runtimeBridgeUrl }) {
  return spawn(binaryPath, [], {
    env: scrubbedEnv({
      MEDOPL_BACKEND_MODE: "local",
      MEDOPL_BACKEND_PORT: String(port),
      PORTAL_OPL_PROVIDER_SECRET_ROOT: providerSecretRoot,
      MEDOPL_PORTAL_STATE_ROOT: portalStateRoot,
      OPL_WEB_GATEWAY_PUBLIC_URL: gatewayUrl,
      PORTAL_RUNTIME_BRIDGE_PUBLIC_URL: runtimeBridgeUrl,
    }),
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function spawnRuntimeBridge({ port, stateRoot, providerSecretRoot, gatewayUrl }) {
  return spawn(process.execPath, ["services/opl-runtime-bridge/src/server.mjs"], {
    env: scrubbedEnv({
      PORT: String(port),
      PORTAL_RUNTIME_BRIDGE_PUBLIC_URL: `http://127.0.0.1:${port}`,
      PORTAL_RUNTIME_BRIDGE_STATE_ROOT: stateRoot,
      PORTAL_OPL_PROVIDER_SECRET_ROOT: providerSecretRoot,
      OPL_WEB_URL: gatewayUrl,
      OPL_LAUNCH_SECRET: "local-portal-gateway-runtime-rc-launch-secret",
      OPL_RUNTIME_MODE: "acp",
      OPL_ACP_RUNTIME_COMMAND_JSON: JSON.stringify([process.execPath, "-e", acpRuntimeFixtureSource]),
      OPL_RUNTIME_BRIDGE_LOCAL_FAKE_RUNTIME: "1",
    }),
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function spawnGateway({ gatewayPort, upstreamPort, runtimePort }) {
  return spawn(process.execPath, ["services/opl-web-gateway/src/server.mjs"], {
    env: scrubbedEnv({
      PORT: String(gatewayPort),
      OPL_WEB_GATEWAY_PUBLIC_URL: `http://127.0.0.1:${gatewayPort}`,
      OPL_UPSTREAM_URL: `http://127.0.0.1:${upstreamPort}`,
      PORTAL_RUNTIME_BRIDGE_URL: `http://127.0.0.1:${runtimePort}`,
      PORTAL_PUBLIC_URL: "http://127.0.0.1:17180",
    }),
    stdio: ["ignore", "pipe", "pipe"],
  });
}

async function postJson(url, body, headers = {}) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
  return { response, json: await response.json() };
}

async function getJson(url, headers = {}) {
  const response = await fetch(url, { headers });
  return { response, json: await response.json() };
}

function bearer(token) {
  return { authorization: `Bearer ${token}` };
}

function assertNoSecretLeak(value, label) {
  const serialized = JSON.stringify(value);
  assert.equal(serialized.includes(RAW_PROVIDER_KEY), false, `${label}_must_not_leak_raw_provider_key`);
  assert.equal(FORBIDDEN_PUBLIC.test(serialized), false, `${label}_must_not_expose_secret_like_fields`);
}

const tempRoot = await mkdtemp(path.join(os.tmpdir(), "v22-local-portal-gateway-runtime-rc-"));
const upstreamServer = startCleanUpstreamFixture();
let goBackend = null;
let gateway = null;
let runtimeBridge = null;

try {
  const upstreamPort = await listen(upstreamServer);
  const gatewayPort = await freePort();
  const runtimePort = await freePort();
  const backendPort = await freePort();
  const gatewayUrl = `http://127.0.0.1:${gatewayPort}`;
  const runtimeBridgeUrl = `http://127.0.0.1:${runtimePort}`;
  const backendUrl = `http://127.0.0.1:${backendPort}`;
  const binaryPath = path.join(tempRoot, "medopl-go-backend-local-rc");
  const providerSecretRoot = path.join(tempRoot, "provider-secrets");

  buildGoBackendBinary(binaryPath);
  runtimeBridge = spawnRuntimeBridge({
    port: runtimePort,
    stateRoot: path.join(tempRoot, "runtime-state"),
    providerSecretRoot,
    gatewayUrl,
  });
  gateway = spawnGateway({ gatewayPort, upstreamPort, runtimePort });
  goBackend = spawnGoBackend({
    binaryPath,
    port: backendPort,
    providerSecretRoot,
    portalStateRoot: path.join(tempRoot, "portal-state"),
    gatewayUrl,
    runtimeBridgeUrl,
  });

  await Promise.all([
    waitFor(`${runtimeBridgeUrl}/healthz`, { okOnly: true }),
    waitFor(`${gatewayUrl}/healthz`, { okOnly: true }),
    waitFor(`${backendUrl}/healthz`, { okOnly: true }),
  ]);

  const workspaceId = "workspace-local-portal-gateway-runtime-rc";
  const bound = await postJson(`${backendUrl}/api/v22/provider-key`, {
    tenantId: "tenant-local-rc",
    portalUserId: "user-local-rc",
    workspaceId,
    apiKey: RAW_PROVIDER_KEY,
    idempotencyKey: "local-portal-gateway-runtime-provider",
  });
  assert.equal(bound.response.status, 200, "provider_key_bind_status_mismatch");
  assert.equal(bound.json.providerBound, true, "provider_key_must_be_bound");
  assertNoSecretLeak(bound.json, "provider_binding");

  const launch = await postJson(`${backendUrl}/api/opl/launch`, {
    tenantId: "tenant-local-rc",
    portalUserId: "user-local-rc",
    workspaceId,
    idempotencyKey: "local-portal-gateway-runtime-launch",
  });
  assert.equal(launch.response.status, 200, "go_launch_status_mismatch");
  assert.equal(launch.json.providerKeyRef, bound.json.providerKeyRef, "go_launch_provider_key_ref_mismatch");
  assert(launch.json.oplWebUrl.startsWith(gatewayUrl), `go_launch_must_point_to_gateway:${launch.json.oplWebUrl}`);
  assert(launch.json.runtimeUrl.startsWith(runtimeBridgeUrl), `go_launch_must_point_to_runtime_bridge:${launch.json.runtimeUrl}`);
  assertNoSecretLeak(launch.json, "go_launch");

  const gatewayHtml = await fetch(launch.json.oplWebUrl);
  const gatewayHtmlText = await gatewayHtml.text();
  assert.equal(gatewayHtml.status, 200, "gateway_html_status_mismatch");
  assert(gatewayHtmlText.includes("clean one-person-lab upstream local rc"), "gateway_must_proxy_clean_upstream");
  assert(gatewayHtmlText.includes("/portal-launch.js"), "gateway_must_inject_portal_launch_script");

  const token = await postJson(`${runtimeBridgeUrl}/api/opl-launch/tokens`, {
    portalUserId: "user-local-rc",
    portalUserEmail: "local@medopl.test",
    portalUserName: "MedOPL Local User",
    tenantId: "tenant-local-rc",
    workspaceId,
    workspaceTitle: "Local RC Workspace",
    workspacePath: tempRoot,
    workspaceSessionId: launch.json.workspaceSessionId,
    runtimeSessionId: launch.json.runtimeSessionId,
    ownerId: "user-local-rc",
    storageOwnerId: "user-local-rc",
    resourceBindingId: launch.json.resourceBindingId,
    computeInstanceId: launch.json.computeInstanceId,
    storageBucketId: launch.json.storageBucketId,
    runtimeAgentId: launch.json.runtimeAgentId,
    mode: "full_runtime",
    providerKeyRef: launch.json.providerKeyRef,
    providerConfigSecretRef: launch.json.providerKeyRef,
    providerConfig: {
      providerConfigured: true,
      providerConfigStatus: "configured",
      providerKeyRef: launch.json.providerKeyRef,
      providerConfigSecretRef: launch.json.providerKeyRef,
      providerName: "gflab",
    },
  });
  assert.equal(token.response.status, 200, "runtime_launch_token_status_mismatch");
  assert(token.json.launchToken, "runtime_launch_token_required");
  assert.equal(token.json.providerKeyRef, launch.json.providerKeyRef, "runtime_launch_provider_key_ref_mismatch");
  const { launchToken: _launchToken, ...runtimeLaunchPublicFields } = token.json;
  assertNoSecretLeak(runtimeLaunchPublicFields, "runtime_launch_token");

  const proxiedBootstrap = await getJson(`${gatewayUrl}/runtime-bridge/api/opl-launch/bootstrap`, {
    cookie: `opl_portal_launch=${encodeURIComponent(token.json.launchToken)}`,
  });
  assert.equal(proxiedBootstrap.response.status, 200, "gateway_runtime_bootstrap_status_mismatch");
  assert.equal(proxiedBootstrap.json.runtimeSession.runtimeSessionId, launch.json.runtimeSessionId, "gateway_runtime_bootstrap_session_mismatch");
  assertNoSecretLeak(proxiedBootstrap.json, "gateway_runtime_bootstrap");

  const bind = await postJson(`${runtimeBridgeUrl}/api/opl-launch/sessions/bind`, {
    oplSessionId: launch.json.oplSessionId,
    source: "local_portal_gateway_runtime_rc",
  }, bearer(token.json.launchToken));
  assert.equal(bind.response.status, 200, "runtime_session_bind_status_mismatch");
  assert.equal(bind.json.runtimeSession.oplSessionId, launch.json.oplSessionId, "runtime_session_bind_opl_session_mismatch");

  const message = await postJson(`${runtimeBridgeUrl}/api/opl-launch/messages`, {
    messageId: "message-local-portal-gateway-runtime-rc",
    message: "Summarize the local RC state.",
    waitForCompletion: true,
    model: "gpt-5.5",
    tokenCount: 16,
  }, bearer(token.json.launchToken));
  assert.equal(message.response.status, 200, "runtime_message_status_mismatch");
  assert.equal(message.json.message.reply, "local rc OPL reply", "runtime_message_reply_mismatch");
  assertNoSecretLeak(message.json, "runtime_message");

  const run = await postJson(`${runtimeBridgeUrl}/api/opl-launch/runs`, {
    runId: "run-local-portal-gateway-runtime-rc",
    traceId: "trace-local-portal-gateway-runtime-rc",
    mode: "full_runtime",
    resourceBindingId: launch.json.resourceBindingId,
    computeInstanceId: launch.json.computeInstanceId,
    storageBucketId: launch.json.storageBucketId,
    runtimeAgentId: launch.json.runtimeAgentId,
    fileRefs: ["file-local-portal-gateway-runtime-rc"],
    toolName: "opl-local-rc",
    model: "gpt-5.5",
    tokenCount: 16,
  }, bearer(token.json.launchToken));
  assert.equal(run.response.status, 200, "runtime_run_status_mismatch");
  assert.equal(run.json.run.status, "succeeded", "runtime_run_payload_status_mismatch");
  assert.equal(run.json.artifacts.length, 1, "runtime_run_must_return_artifact");
  assertNoSecretLeak(run.json, "runtime_run");

  const artifact = await getJson(`${runtimeBridgeUrl}/api/opl/artifacts/${encodeURIComponent(run.json.artifacts[0].artifactRef)}`, bearer(token.json.launchToken));
  assert.equal(artifact.response.status, 200, "runtime_artifact_status_mismatch");
  assert.equal(artifact.json.artifact.artifactRef, run.json.artifacts[0].artifactRef, "runtime_artifact_ref_mismatch");
  assertNoSecretLeak(artifact.json, "runtime_artifact");

  console.log(JSON.stringify({
    ok: true,
    contract: "v22_local_portal_gateway_runtime_rc",
    evidence: "local_rc_integration_only",
    canClaim: [
      "Go Portal launch projection points to local Gateway and Runtime Bridge",
      "Gateway proxies clean upstream and same-origin Runtime Bridge API",
      "Runtime Bridge returns local fake OPL message/run/artifact projection",
    ],
    cannotClaim: [
      "real_upstream_opl",
      "live_provider",
      "real_cloud",
      "production_runtime",
      "production_billing",
    ],
  }, null, 2));
} finally {
  await stopChild(goBackend);
  await stopChild(gateway);
  await stopChild(runtimeBridge);
  await close(upstreamServer);
  await rm(tempRoot, { recursive: true, force: true });
}
