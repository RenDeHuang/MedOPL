import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import net from "node:net";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

const repoRoot = process.cwd();
const runtimeRoot = path.join(repoRoot, ".runtime", "real-opl-provider-message-live-canary");
const evidencePath = path.join(runtimeRoot, "evidence.json");
const evidencePublicPath = ".runtime/real-opl-provider-message-live-canary/evidence.json";
const providedWebuiUrl = String(process.env.OPL_REAL_WEBUI_URL || "").replace(/\/$/, "");
const configuredWebuiDir = String(process.env.OPL_REAL_WEBUI_DIR || "").trim();
const defaultWebuiDir = "/home/dev/projects/platform-v19/.runtime/opl-aion-shell-full";
const providerSecretFile = String(process.env.OPL_PROVIDER_SECRET_FILE || "").trim();
const USER_EMAIL = `real-opl-provider-canary-${Date.now()}@example.test`;
const USER_PASSWORD = "Password1!";
const WORKSPACE_ID = "real-opl-provider-message-canary";
const PROMPT_INTENT = "Reply with exactly: MEDOPL_PROVIDER_CANARY_OK";
const FORBIDDEN_VALUE_PATTERN = /sk-[a-z0-9]|launch_token=|runtime_token=|bearer\s+[a-z0-9._-]+|signedUrl=|presignedUrl=/i;
const FORBIDDEN_FIELD_NAMES = new Set([
  "rawproviderkey",
  "providerapikey",
  "apikey",
  "providersecret",
  "providerconfigsecretref",
  "secretfingerprint",
  "launchtoken",
  "launchtokenhash",
  "runtimetoken",
  "bearertoken",
  "authorization",
  "objectkey",
  "storagekey",
  "localpath",
  "signedurl",
  "presignedurl",
  "password",
  "secretfile",
  "oplprovidersecretfile",
]);

function failGate(error, message, status = "gated") {
  console.log(JSON.stringify({
    ok: false,
    contract: "v22_real_opl_provider_message_live_canary",
    status,
    error,
    message,
  }, null, 2));
  process.exitCode = 1;
}

if (String(process.env.REAL_OPL_PROVIDER_MESSAGE_CANARY || "").trim() !== "1") {
  failGate(
    "provider_authorization_required",
    "Set REAL_OPL_PROVIDER_MESSAGE_CANARY=1 before reading provider secret or calling the real provider.",
  );
  process.exit();
}

if (!providerSecretFile) {
  failGate("provider_key_required", "OPL_PROVIDER_SECRET_FILE is required for this authorized live canary.");
  process.exit();
}

function hashPrefix(value = "", length = 16) {
  return createHash("sha256").update(String(value || "")).digest("hex").slice(0, length);
}

function assertNoSecretLeak(value, label) {
  const violations = [];
  const visit = (node, pathParts = []) => {
    if (node == null) return;
    if (typeof node === "string") {
      if (FORBIDDEN_VALUE_PATTERN.test(node)) violations.push(pathParts.join(".") || "$");
      return;
    }
    if (Array.isArray(node)) {
      node.forEach((item, index) => visit(item, [...pathParts, String(index)]));
      return;
    }
    if (typeof node !== "object") return;
    for (const [key, child] of Object.entries(node)) {
      const normalizedKey = key.replace(/[^a-z0-9]/gi, "").toLowerCase();
      const childPath = [...pathParts, key];
      if (FORBIDDEN_FIELD_NAMES.has(normalizedKey)) violations.push(childPath.join("."));
      visit(child, childPath);
    }
  };
  visit(value);
  assert.deepEqual(violations, [], `${label}_must_not_expose_secret_or_sensitive_fields`);
}

function parseEnvStyleSecret(raw = "") {
  const values = {};
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;
    const key = match[1];
    const value = match[2].trim().replace(/^['"]|['"]$/g, "");
    values[key] = value;
  }
  return values;
}

async function readProviderKeyFromSecretFile(filePath) {
  const raw = await readFile(filePath, "utf8");
  const values = parseEnvStyleSecret(raw);
  const apiKey = String(
    values.providerKeyRef ||
    values.OPL_PROVIDER_API_KEY ||
    values.OPENAI_API_KEY ||
    values.CODEX_API_KEY ||
    values.GFLABTOKEN ||
    "",
  ).trim();
  if (!apiKey) throw new Error("provider_key_required");
  if (!apiKey.startsWith("sk-")) throw new Error("provider_key_shape_invalid");
  return apiKey;
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
  if (child[key].length > 16000) child[key] = child[key].slice(-16000);
}

function redactProcessOutput(text = "") {
  return String(text || "")
    .replace(/sk-[a-z0-9]+/gi, "[REDACTED_API_KEY]")
    .replace(/(authorization|bearer|token|password|apiKey|secret)[^,\n\r]*/gi, "$1=[REDACTED]");
}

function quoteTomlString(value = "") {
  return JSON.stringify(String(value || ""));
}

async function writeCodexProviderConfig(codexHome, providerApiKey) {
  await mkdir(codexHome, { recursive: true, mode: 0o700 });
  const config = [
    'model_provider = "gflab"',
    `model = ${quoteTomlString(String(process.env.OPL_CODEX_MODEL || "gpt-5.5"))}`,
    `model_reasoning_effort = ${quoteTomlString(String(process.env.OPL_CODEX_REASONING_EFFORT || "xhigh"))}`,
    'approval_policy = "never"',
    'sandbox_mode = "danger-full-access"',
    "",
    "[model_providers.gflab]",
    'name = "gflab"',
    `base_url = ${quoteTomlString(String(process.env.OPL_CODEX_BASE_URL || "https://gflabtoken.cn/v1"))}`,
    'wire_api = "responses"',
    `experimental_bearer_token = ${quoteTomlString(providerApiKey)}`,
    "",
  ].join("\n");
  await writeFile(path.join(codexHome, "config.toml"), config, { mode: 0o600 });
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
  child.stdout.on("data", (chunk) => childOutputPush(child, "stdout", redactProcessOutput(chunk)));
  child.stderr.on("data", (chunk) => childOutputPush(child, "stderr", redactProcessOutput(chunk)));
  return child;
}

function spawnWebui({ port, webuiDir, providerApiKey }) {
  const dataDir = path.join(runtimeRoot, "webui-data");
  const codexHome = path.join(runtimeRoot, "webui-codex-home");
  return spawn("bun", ["dist-server/server.mjs"], {
    cwd: webuiDir,
    env: {
      ...process.env,
      PORT: String(port),
      ALLOW_REMOTE: "true",
      OPL_WEBUI_AUTH_MODE: "none",
      OPL_WEBUI_USERNAME: "portal-provider-canary",
      DATA_DIR: dataDir,
      HOME: path.join(runtimeRoot, "webui-home"),
      XDG_CACHE_HOME: path.join(runtimeRoot, "webui-xdg-cache"),
      XDG_CONFIG_HOME: path.join(runtimeRoot, "webui-xdg-config"),
      CODEX_HOME: codexHome,
      AIONUI_E2E_TEST: "1",
      AIONUI_EXTENSION_DEBUG: "0",
      OPL_CODEX_MODEL_PROVIDER: "gflab",
      OPL_CODEX_PROVIDER_NAME: "gflab",
      OPL_CODEX_BASE_URL: String(process.env.OPL_CODEX_BASE_URL || "https://gflabtoken.cn/v1"),
      OPL_CODEX_MODEL: String(process.env.OPL_CODEX_MODEL || "gpt-5.5"),
      OPL_CODEX_REASONING_EFFORT: String(process.env.OPL_CODEX_REASONING_EFFORT || "xhigh"),
      OPL_CODEX_API_KEY: providerApiKey,
      CODEX_API_KEY: providerApiKey,
      OPENAI_API_KEY: providerApiKey,
      GFLABTOKEN: providerApiKey,
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
    await Promise.race([new Promise((resolve) => child.once("exit", resolve)), sleep(500)]);
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

async function postForm(url, form, { cookie = "" } = {}) {
  return fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      ...(cookie ? { cookie } : {}),
    },
    body: new URLSearchParams(form).toString(),
    redirect: "manual",
  });
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

function cookieHeaderFrom(response, name) {
  const setCookie = response.headers.get("set-cookie") || "";
  const match = setCookie.match(new RegExp(`${name}=([^;]+)`));
  assert(match, `${name}_cookie_required`);
  assert(setCookie.includes("HttpOnly"), `${name}_cookie_must_be_http_only`);
  return `${name}=${match[1]}`;
}

function stableUrl(value = "") {
  return String(value || "").replace(/\/$/, "");
}

function sanitizedMessageStatus(payload = {}) {
  const message = payload.message || {};
  return {
    ok: payload.ok === true,
    status: payload.status || message.status || "",
    messageId: message.messageId || "",
    replyMessageId: message.replyMessageId || "",
    messageTraceId: message.messageTraceId || payload.trace?.traceId || payload.traceId || "",
    providerInvocationRef: message.providerInvocationRef || payload.trace?.providerInvocationRef || "",
    capabilitySource: message.capabilitySource || payload.trace?.capabilitySource || "",
    source: message.source || "",
    replyMetadata: message.replyMetadata
      ? {
          role: message.replyMetadata.role || "",
          replyLength: Number(message.replyMetadata.replyLength || 0),
          replyHashPrefix: message.replyMetadata.replyHashPrefix || "",
          finishStatus: message.replyMetadata.finishStatus || "",
          latencyMs: Number(message.replyMetadata.latencyMs || 0),
          streamEventCount: Number(message.replyMetadata.streamEventCount || 0),
        }
      : null,
  };
}

async function startOrUseWebui(providerApiKey) {
  if (providedWebuiUrl) {
    await waitFor(`${providedWebuiUrl}/api/auth/status`);
    return { webuiUrl: providedWebuiUrl, child: null, source: "provided_url", webuiDir: "" };
  }
  const webuiDir = configuredWebuiDir ? path.resolve(configuredWebuiDir) : defaultWebuiDir;
  await readFile(path.join(webuiDir, "dist-server", "server.mjs"), "utf8");
  await readFile(path.join(webuiDir, "out", "renderer", "index.html"), "utf8");
  const port = await freePort();
  await writeCodexProviderConfig(path.join(runtimeRoot, "webui-codex-home"), providerApiKey);
  const child = spawnWebui({ port, webuiDir, providerApiKey });
  const webuiUrl = `http://127.0.0.1:${port}`;
  await waitFor(`${webuiUrl}/api/auth/status`, { timeoutMs: 60000 });
  return { webuiUrl, child, source: "local_dist_server", webuiDir };
}

await rm(runtimeRoot, { recursive: true, force: true });
await mkdir(runtimeRoot, { recursive: true });

const providerApiKey = await readProviderKeyFromSecretFile(providerSecretFile);
const providerKeyFingerprint = `sha256:${hashPrefix(providerApiKey)}`;
const promptHashPrefix = hashPrefix(PROMPT_INTENT);
let webui;
let adapter;
let gateway;
let portal;

try {
  webui = await startOrUseWebui(providerApiKey);
  const adapterPort = await freePort();
  const gatewayPort = await freePort();
  const portalPort = await freePort();
  const adapterUrl = `http://127.0.0.1:${adapterPort}`;
  const gatewayUrl = `http://127.0.0.1:${gatewayPort}`;
  const portalUrl = `http://127.0.0.1:${portalPort}`;
  const stateRoot = path.join(runtimeRoot, "adapter-state");
  const providerSecretRoot = path.join(stateRoot, "provider-secrets");

  adapter = spawnNode("services/opl-runtime-bridge/src/server.mjs", {
    port: adapterPort,
    stateRoot,
    env: {
      PORTAL_OPL_ADAPTER_PUBLIC_URL: adapterUrl,
      PORTAL_OPL_PROVIDER_SECRET_ROOT: providerSecretRoot,
      OPL_WEB_URL: gatewayUrl,
      OPL_RUNTIME_MODE: "webui",
      OPL_WEBUI_BRIDGE_URL: webui.webuiUrl,
      OPL_WEBUI_PROVIDER_MESSAGE_ENABLED: "1",
      OPL_WEBUI_BRIDGE_TIMEOUT_MS: String(process.env.OPL_WEBUI_BRIDGE_TIMEOUT_MS || "30000"),
      OPL_WEBUI_BRIDGE_REPLY_TIMEOUT_MS: String(process.env.OPL_WEBUI_BRIDGE_REPLY_TIMEOUT_MS || "180000"),
      OPL_CODEX_BASE_URL: String(process.env.OPL_CODEX_BASE_URL || "https://gflabtoken.cn/v1"),
      OPL_CODEX_MODEL: String(process.env.OPL_CODEX_MODEL || "gpt-5.5"),
      OPL_CODEX_REASONING_EFFORT: String(process.env.OPL_CODEX_REASONING_EFFORT || "xhigh"),
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
      PORTAL_PUBLIC_URL: portalUrl,
      OPL_WEBUI_AUTH_MODE: "none",
    },
  });
  await waitFor(`${gatewayUrl}/healthz`);

  portal = spawnNode("services/portal/src/server.mjs", {
    port: portalPort,
    env: {
      PORTAL_OIDC_ENABLED: "0",
      PORTAL_ALLOW_REGISTRATION: "1",
      PORTAL_PUBLIC_URL: portalUrl,
      PORTAL_OPL_ADAPTER_URL: adapterUrl,
      OPL_WEB_URL: gatewayUrl,
      OPL_RUNTIME_TIMEOUT_MS: String(process.env.OPL_RUNTIME_TIMEOUT_MS || "240000"),
      PORTAL_STORAGE_MODE: "json",
      PRODUCT_RUNTIME_MODE: "platform_provisioned",
      PORTAL_OPL_PROVIDER_SECRET_ROOT: providerSecretRoot,
    },
  });
  await waitFor(`${portalUrl}/healthz`);

  const register = await postForm(`${portalUrl}/register`, {
    name: "Real OPL Provider Canary",
    email: USER_EMAIL,
    password: USER_PASSWORD,
  });
  assert.equal(register.status, 302, "portal_register_must_redirect_after_success");
  const portalCookie = cookieHeaderFrom(register, "portal_session");

  const launch = await postJson(`${portalUrl}/portal/api/opl/launch`, {
    workspaceId: WORKSPACE_ID,
    providerKeyPayload: {
      provider: "gflabtoken",
      source: "user_input",
      apiKey: providerApiKey,
    },
  }, { cookie: portalCookie });
  assert.equal(launch.response.status, 200, "portal_opl_launch_must_return_200");
  assert.equal(launch.json.ok, true, "portal_opl_launch_must_succeed");
  assert(launch.json.launchId, "portal_opl_launch_id_required");
  assert(launch.json.providerKeyRef, "portal_opl_provider_key_ref_required");
  assert.equal(stableUrl(launch.json.oplWebUrl), stableUrl(gatewayUrl), "portal_launch_must_target_gateway");
  assertNoSecretLeak(launch.json, "portal_launch_public_payload");

  const launchId = launch.json.launchId;
  const bootstrap = await getJson(`${portalUrl}/portal/api/opl/bootstrap?launchId=${encodeURIComponent(launchId)}`, { cookie: portalCookie });
  assert.equal(bootstrap.response.status, 200, "portal_opl_bootstrap_must_return_200");
  assert.equal(bootstrap.json.identity.workspaceId, WORKSPACE_ID, "portal_opl_bootstrap_workspace_mismatch");
  assert.equal(bootstrap.json.capabilities?.messageBackflow?.status, "mapped_to_webui_bridge", "portal_bootstrap_message_backflow_must_be_webui_provider_canary_enabled");
  assertNoSecretLeak(bootstrap.json, "portal_bootstrap_public_payload");

  const bind = await postJson(`${portalUrl}/portal/api/opl/sessions/bind?launchId=${encodeURIComponent(launchId)}`, {
    oplSessionId: bootstrap.json.identity.oplSessionId,
    clientSessionState: { source: "real-opl-provider-message-live-canary" },
  }, { cookie: portalCookie });
  assert.equal(bind.response.status, 200, "portal_opl_session_bind_must_return_200");
  assert.equal(bind.json.runtimeSession.oplSessionId, bootstrap.json.identity.oplSessionId, "portal_opl_session_bind_opl_session_mismatch");
  assertNoSecretLeak(bind.json, "portal_session_bind_public_payload");

  const message = await postJson(`${portalUrl}/portal/api/opl/messages?launchId=${encodeURIComponent(launchId)}`, {
    message: PROMPT_INTENT,
    waitForCompletion: true,
    model: String(process.env.OPL_CODEX_MODEL || "gpt-5.5"),
    tokenCount: 0,
  }, { cookie: portalCookie });
  assert.equal(message.response.status, 200, `portal_opl_message_must_return_200:${JSON.stringify(message.json)}`);
  assert.equal(message.json.ok, true, "portal_opl_message_must_succeed");
  const messageStatus = sanitizedMessageStatus(message.json);
  assert.equal(messageStatus.status, "succeeded", "portal_opl_message_status_must_succeed");
  assert(messageStatus.messageId, "portal_opl_message_id_required");
  assert(messageStatus.replyMessageId, "portal_opl_reply_message_id_required");
  assert(messageStatus.messageTraceId, "portal_opl_message_trace_id_required");
  assert(messageStatus.providerInvocationRef, "portal_opl_provider_invocation_ref_required");
  assert.equal(messageStatus.capabilitySource, "mapped_to_webui_bridge", "portal_opl_capability_source_mismatch");
  assertNoSecretLeak(message.json, "portal_message_public_payload");

  const status = await getJson(`${portalUrl}/portal/api/opl/messages/${encodeURIComponent(messageStatus.messageId)}/status?launchId=${encodeURIComponent(launchId)}`, { cookie: portalCookie });
  assert.equal(status.response.status, 200, "portal_opl_message_status_must_return_200");
  const projectedStatus = sanitizedMessageStatus(status.json);
  assert.equal(projectedStatus.status, "succeeded", "projected_message_status_must_succeed");
  assert.equal(projectedStatus.replyMessageId, messageStatus.replyMessageId, "projected_reply_message_id_mismatch");
  assert.equal(projectedStatus.providerInvocationRef, messageStatus.providerInvocationRef, "projected_provider_invocation_ref_mismatch");
  assert.equal(projectedStatus.messageTraceId, messageStatus.messageTraceId, "projected_message_trace_id_mismatch");
  assertNoSecretLeak(status.json, "portal_message_status_public_payload");

  const traces = await getJson(`${portalUrl}/portal/api/session-traces?workspaceId=${encodeURIComponent(WORKSPACE_ID)}&messageId=${encodeURIComponent(messageStatus.messageId)}&pageSize=20`, { cookie: portalCookie });
  assert.equal(traces.response.status, 200, "portal_session_traces_must_return_200");
  const traceItem = (traces.json.items || []).find((item) =>
    item.messageId === messageStatus.messageId ||
    item.runId === messageStatus.messageId ||
    item.traceId === messageStatus.messageTraceId
  );
  assert(traceItem, "portal_session_trace_must_include_message_trace");
  assert.equal(traceItem.replyMessageId, messageStatus.replyMessageId, "portal_trace_reply_message_id_mismatch");
  assert.equal(traceItem.providerInvocationRef, messageStatus.providerInvocationRef, "portal_trace_provider_invocation_ref_mismatch");
  assert.equal(traceItem.capabilitySource, "mapped_to_webui_bridge", "portal_trace_capability_source_mismatch");
  assertNoSecretLeak(traces.json, "portal_session_traces_public_payload");

  const traceDetail = await getJson(`${portalUrl}/portal/api/session-traces/${encodeURIComponent(traceItem.traceId)}?workspaceId=${encodeURIComponent(WORKSPACE_ID)}`, { cookie: portalCookie });
  assert.equal(traceDetail.response.status, 200, "portal_session_trace_detail_must_return_200");
  assert.equal(traceDetail.json.replyMessageId, messageStatus.replyMessageId, "portal_trace_detail_reply_message_id_mismatch");
  assert.equal(traceDetail.json.providerInvocationRef, messageStatus.providerInvocationRef, "portal_trace_detail_provider_invocation_ref_mismatch");
  assertNoSecretLeak(traceDetail.json || traceDetail, "portal_session_trace_detail_public_payload");

  const evidence = {
    ok: true,
    contract: "v22_real_opl_provider_message_live_canary",
    checkedAt: new Date().toISOString(),
    webui: {
      source: webui.source,
      url: webui.webuiUrl,
      localDist: webui.source === "local_dist_server",
    },
    portal: {
      launchStatus: "ready",
      workspaceId: WORKSPACE_ID,
      providerKeyRef: launch.json.providerKeyRef,
    },
    provider: {
      providerKeyFingerprint,
      modelRef: String(process.env.OPL_CODEX_MODEL || "gpt-5.5"),
      baseUrlHost: new URL(String(process.env.OPL_CODEX_BASE_URL || "https://gflabtoken.cn/v1")).host,
    },
    message: {
      promptLength: PROMPT_INTENT.length,
      promptHashPrefix,
      ...messageStatus,
    },
    projection: {
      status: projectedStatus.status,
      messageId: projectedStatus.messageId,
      replyMessageId: projectedStatus.replyMessageId,
      providerInvocationRef: projectedStatus.providerInvocationRef,
      messageTraceId: projectedStatus.messageTraceId,
    },
    trace: {
      traceId: traceItem.traceId,
      messageId: traceItem.messageId || traceItem.runId,
      replyMessageId: traceItem.replyMessageId,
      providerInvocationRef: traceItem.providerInvocationRef,
      capabilitySource: traceItem.capabilitySource,
      source: traceItem.source,
    },
  };

  assertNoSecretLeak(evidence, "real_opl_provider_message_live_canary_evidence");
  await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");

  console.log(JSON.stringify({
    ok: true,
    contract: evidence.contract,
    evidencePath: evidencePublicPath,
    message: evidence.message,
    projection: evidence.projection,
    trace: evidence.trace,
  }, null, 2));
} finally {
  await stopChild(portal);
  await stopChild(gateway);
  await stopChild(adapter);
  await stopChild(webui?.child);
}
