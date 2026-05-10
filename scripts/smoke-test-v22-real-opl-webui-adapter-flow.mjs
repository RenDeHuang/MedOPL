import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import net from "node:net";
import { mkdir, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

const repoRoot = process.cwd();
const runtimeRoot = path.join(repoRoot, ".runtime", "real-opl-webui-adapter-flow");
const providedWebuiUrl = String(process.env.OPL_REAL_WEBUI_URL || "").replace(/\/$/, "");
const configuredWebuiDir = String(process.env.OPL_REAL_WEBUI_DIR || "").trim();
const repoRuntimeWebuiDir = path.join(repoRoot, ".runtime", "opl-aion-shell");
const USERNAME = "portal-adapter-canary";
const USER_ID = "portal-real-webui-adapter-user";
const TENANT_ID = "tenant-real-webui-adapter";
const WORKSPACE_ID = "workspace-real-webui-adapter";
const WORKSPACE_SESSION_ID = "workspace-session-real-webui-adapter";
const RESOURCE_BINDING_ID = "resource-binding-real-webui-adapter";
const PROVIDER_KEY_REF = "provider-key-ref-real-webui-adapter";
const RUNTIME_AGENT_ID = "runtime-agent-real-webui-adapter";

function assertNoSecretLeak(value, label) {
  const serialized = typeof value === "string" ? value : JSON.stringify(value || {});
  assert.equal(
    /sk-[a-z0-9]|gflabtoken_raw_key|rawProviderKey|providerApiKey|apiKey|launchToken|runtimeToken|bearerToken|objectKey|storageKey|localPath|signedUrl|password|qr-login\?token/i.test(serialized),
    false,
    `${label}_must_not_expose_secret_or_storage_fields`,
  );
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

function childOutputPush(child, streamName, chunk) {
  const key = `${streamName}Tail`;
  child[key] = `${child[key] || ""}${chunk}`;
  if (child[key].length > 12000) child[key] = child[key].slice(-12000);
}

function spawnNode(script, { port, env = {}, stateRoot = runtimeRoot, cwd = repoRoot } = {}) {
  const child = spawn(process.execPath, [script], {
    cwd,
    env: {
      ...process.env,
      PORT: String(port),
      PORTAL_OPL_ADAPTER_STATE_ROOT: stateRoot,
      NODE_ENV: "test",
      ...env,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk) => childOutputPush(child, "stdout", chunk));
  child.stderr.on("data", (chunk) => childOutputPush(child, "stderr", chunk));
  return child;
}

function spawnWebui({ port, webuiDir }) {
  const dataDir = path.join(runtimeRoot, "webui-data");
  return spawn("bun", ["dist-server/server.mjs"], {
    cwd: webuiDir,
    env: {
      ...process.env,
      PORT: String(port),
      ALLOW_REMOTE: "true",
      OPL_WEBUI_AUTH_MODE: "none",
      OPL_WEBUI_USERNAME: USERNAME,
      DATA_DIR: dataDir,
      HOME: path.join(runtimeRoot, "home"),
      XDG_CACHE_HOME: path.join(runtimeRoot, "xdg-cache"),
      XDG_CONFIG_HOME: path.join(runtimeRoot, "xdg-config"),
      AIONUI_E2E_TEST: "1",
      AIONUI_EXTENSION_DEBUG: "0",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
}

async function stopChild(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  child.kill();
  const exited = await Promise.race([
    new Promise((resolve) => child.once("exit", () => resolve(true))),
    sleep(1500).then(() => false),
  ]);
  if (!exited) {
    child.kill("SIGKILL");
    await Promise.race([
      new Promise((resolve) => child.once("exit", resolve)),
      sleep(500),
    ]);
  }
}

async function waitFor(url, { allowStatus = (status) => status < 500, timeoutMs = 60000 } = {}) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url, { redirect: "manual" });
      if (allowStatus(response.status)) return response;
    } catch {}
    await sleep(100);
  }
  throw new Error(`timeout_waiting_for:${url}`);
}

async function postJson(url, payload, { cookie = "" } = {}) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify(payload),
    redirect: "manual",
  });
  const json = await response.json().catch(() => ({}));
  return { response, json };
}

async function getJson(url, { cookie = "" } = {}) {
  const response = await fetch(url, {
    headers: {
      accept: "application/json",
      ...(cookie ? { cookie } : {}),
    },
    redirect: "manual",
  });
  const json = await response.json().catch(() => ({}));
  return { response, json };
}

function cookieHeaderFrom(response) {
  const setCookie = response.headers.get("set-cookie") || "";
  assert(setCookie.includes("opl_portal_launch="), "launch_response_must_set_http_only_launch_cookie");
  assert(setCookie.includes("HttpOnly"), "launch_cookie_must_be_http_only");
  return setCookie.split(";")[0];
}

function canonicalUrl(value = "") {
  const url = new URL(value);
  return url.toString().replace(/\/$/, "");
}

async function startOrUseWebui() {
  if (providedWebuiUrl) {
    await waitFor(`${providedWebuiUrl}/api/auth/status`);
    return { webuiUrl: providedWebuiUrl, child: null, source: "provided_url" };
  }

  const webuiDir = configuredWebuiDir
    ? path.resolve(configuredWebuiDir)
    : repoRuntimeWebuiDir;
  await readFile(path.join(webuiDir, "dist-server", "server.mjs"), "utf8");
  await readFile(path.join(webuiDir, "out", "renderer", "index.html"), "utf8");
  const port = await freePort();
  const child = spawnWebui({ port, webuiDir });
  const webuiUrl = `http://127.0.0.1:${port}`;
  await waitFor(`${webuiUrl}/api/auth/status`);
  return { webuiUrl, child, source: "local_dist_server" };
}

async function readAdapterState(stateRoot) {
  return JSON.parse(await readFile(path.join(stateRoot, "state.json"), "utf8"));
}

await rm(runtimeRoot, { recursive: true, force: true });
await mkdir(runtimeRoot, { recursive: true });

const webui = await startOrUseWebui();
const adapterPort = await freePort();
const gatewayPort = await freePort();
const adapterUrl = `http://127.0.0.1:${adapterPort}`;
const gatewayUrl = `http://127.0.0.1:${gatewayPort}`;
const stateRoot = path.join(runtimeRoot, "adapter-state");
let adapter;
let gateway;

try {
  adapter = spawnNode("services/opl-runtime-bridge/src/server.mjs", {
    port: adapterPort,
    stateRoot,
    env: {
      PORTAL_OPL_ADAPTER_PUBLIC_URL: adapterUrl,
      OPL_WEB_URL: webui.webuiUrl,
      OPL_RUNTIME_MODE: "webui",
      OPL_WEBUI_BRIDGE_URL: webui.webuiUrl,
      PRODUCT_RUNTIME_MODE: "platform_provisioned",
    },
  });
  await waitFor(`${adapterUrl}/healthz`);

  gateway = spawnNode("services/opl-web-gateway/src/server.mjs", {
    port: gatewayPort,
    stateRoot,
    env: {
      OPL_WEB_GATEWAY_PUBLIC_URL: gatewayUrl,
      OPL_UPSTREAM_URL: webui.webuiUrl,
      PORTAL_OPL_ADAPTER_URL: adapterUrl,
      PORTAL_PUBLIC_URL: "http://portal.local",
      OPL_WEBUI_AUTH_MODE: "none",
    },
  });
  await waitFor(`${gatewayUrl}/healthz`);

  const launch = await postJson(`${adapterUrl}/api/opl-launch/tokens`, {
    portalUserId: USER_ID,
    portalUserEmail: "real-webui-adapter@example.test",
    portalUserName: "Real WebUI Adapter Canary",
    tenantId: TENANT_ID,
    ownerId: USER_ID,
    sessionOwnerId: USER_ID,
    traceOwnerId: USER_ID,
    artifactOwnerId: USER_ID,
    storageOwnerId: USER_ID,
    workspaceId: WORKSPACE_ID,
    workspaceTitle: "Real WebUI Adapter Workspace",
    workspacePath: path.join(runtimeRoot, "workspace"),
    workspaceSessionId: WORKSPACE_SESSION_ID,
    sourceSurface: "portal-control-plane",
    mode: "full_runtime",
    resourceBindingId: RESOURCE_BINDING_ID,
    computeInstanceId: "compute-real-webui-adapter",
    storageBucketId: "storage-real-webui-adapter",
    runtimeAgentId: RUNTIME_AGENT_ID,
    providerConfig: {
      providerConfigured: true,
      providerConfigStatus: "configured",
      providerKeyRef: PROVIDER_KEY_REF,
      providerConfigSecretRef: PROVIDER_KEY_REF,
      providerName: "gflab",
    },
    providerConfigSecretRef: PROVIDER_KEY_REF,
  });
  assert.equal(launch.response.status, 200, "webui_adapter_launch_must_return_200");
  assert.equal(launch.json.ok, true, "webui_adapter_launch_must_succeed");
  assert.equal(canonicalUrl(launch.json.oplWebUrl), canonicalUrl(webui.webuiUrl), "webui_adapter_launch_must_target_real_webui");
  assertNoSecretLeak({
    openUrl: launch.json.openUrl,
    oplWebUrl: launch.json.oplWebUrl,
    bootstrapUrl: launch.json.bootstrapUrl,
  }, "webui_adapter_launch_public_urls");

  const cookie = cookieHeaderFrom(launch.response);
  const bootstrap = await getJson(`${gatewayUrl}/portal-adapter/api/opl/bootstrap`, { cookie });
  assert.equal(bootstrap.response.status, 200, "webui_adapter_bootstrap_must_return_200");
  assert.equal(bootstrap.json.identity.workspaceId, WORKSPACE_ID, "webui_adapter_bootstrap_workspace_mismatch");
  assert.equal(bootstrap.json.opl.health.source, "opl_webui_bridge", "webui_adapter_bootstrap_must_use_bridge_health");
  assert.equal(bootstrap.json.system.id, "opl-webui-bridge", "webui_adapter_bootstrap_system_mismatch");
  assert.equal(bootstrap.json.capabilities?.messageBackflow?.status, "capability_not_supported", "webui_adapter_message_backflow_capability_must_not_claim_supported");
  assert.equal(bootstrap.json.capabilities?.messageBackflow?.reason, "reply_not_verified", "webui_adapter_message_backflow_reason_mismatch");
  assert.equal(bootstrap.json.capabilityClassification.httpProductApi, "capability_not_supported", "webui_adapter_http_product_api_must_be_not_supported");
  assert.equal(bootstrap.json.capabilityClassification.websocketBridgeSession, "real_webui_bridge_roundtrip", "webui_adapter_bridge_session_classification_mismatch");
  assert(bootstrap.json.resources.sessions.some((session) => session.oplSessionId === bootstrap.json.identity.oplSessionId), "webui_adapter_bootstrap_must_read_created_session_from_webui_database");
  assertNoSecretLeak(bootstrap.json, "webui_adapter_bootstrap");

  const bind = await postJson(`${gatewayUrl}/portal-adapter/api/opl/sessions/bind`, {
    clientSessionState: { source: "real-webui-adapter-smoke" },
  }, { cookie });
  assert.equal(bind.response.status, 200, "webui_adapter_session_bind_must_return_200");
  assert.equal(bind.json.runtimeSession.oplSessionId, bootstrap.json.identity.oplSessionId, "webui_adapter_session_bind_must_keep_real_webui_session");
  assertNoSecretLeak(bind.json, "webui_adapter_session_bind");

  const unboundRun = await postJson(`${gatewayUrl}/portal-adapter/api/opl/runs`, {
    message: "run should be gated before managed resource binding",
    toolName: "real-webui-adapter",
  }, { cookie });
  assert.equal(unboundRun.response.status, 502, "webui_adapter_run_without_runtime_agent_must_fail");
  assert.equal(unboundRun.json.error.code, "RUNTIME_AGENT_RELAY_NOT_IMPLEMENTED", "webui_adapter_run_gate_code_mismatch");
  assertNoSecretLeak(unboundRun.json, "webui_adapter_unbound_run_gate");

  const message = await postJson(`${gatewayUrl}/portal-adapter/api/opl/messages`, {
    message: "Portal real WebUI adapter canary: respond OK only.",
    waitForCompletion: true,
  }, { cookie });
  assert.equal(message.response.status, 409, "webui_adapter_message_must_not_fake_success_without_reply");
  assert.equal(message.json.error, "provider_authorization_required", "webui_adapter_message_error_mismatch");
  assert.equal(message.json.status, "gated", "webui_adapter_message_gate_status_mismatch");
  assert.equal(message.json.capability, "webui_provider_message", "webui_adapter_message_capability_mismatch");
  assertNoSecretLeak(message.json, "webui_adapter_message_not_supported");

  const state = await readAdapterState(stateRoot);
  assert(state.events.some((event) => event.type === "opl_webui_bridge_session_created"), "webui_adapter_state_must_record_bridge_session_created");
  assert(state.events.some((event) => event.type === "opl_session_bound" && event.oplSessionId === bootstrap.json.identity.oplSessionId), "webui_adapter_state_must_record_session_bound");
  assert.equal(state.messageReplies?.length || 0, 0, "webui_adapter_must_not_persist_fake_message_reply");

  console.log(JSON.stringify({
    ok: true,
    contract: "v22_real_opl_webui_adapter_flow",
    webui: {
      source: webui.source,
      url: webui.webuiUrl,
    },
    covered: [
      "real_webui_adapter_launch",
      "real_webui_websocket_session_create",
      "real_webui_database_session_roundtrip",
      "http_product_api_classified_not_supported",
      "message_reply_not_faked",
    ],
    oplSessionId: bootstrap.json.identity.oplSessionId,
  }, null, 2));
} finally {
  await stopChild(gateway);
  await stopChild(adapter);
  await stopChild(webui.child);
}
