import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import net from "node:net";
import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

const USER_EMAIL = "zitadel-admin@zitadel.localhost";
const USER_PASSWORD = "Password1!";
const WORKSPACE_ID = "workspace-local-rc-golden-path";
const PLAN_ID = "starter_2c4g_10gb";
const FILE_SPACE_GB = 10;
const RELEASED_AT = "2026-05-23T10:00:00.000Z";
const OPL_UPSTREAM_URL = String(process.env.OPL_RC_UPSTREAM_URL || "http://127.0.0.1:18130").replace(/\/$/, "");
const providerKey = String(process.env.GFLABTOKEN || "").trim();

assert(providerKey, "GFLABTOKEN_REQUIRED");

const providerKeyHash = createHash("sha256").update(providerKey).digest("hex");
const acpRuntimeFixtureSource = `
const crypto = require("node:crypto");
const readline = require("node:readline");
const commands = ["initialize", "session_list", "session_ledger", "session_create", "prompt"];
function write(response) {
  process.stdout.write(JSON.stringify(response) + "\\n");
}
function secretHash(value) {
  return crypto.createHash("sha256").update(String(value || "")).digest("hex");
}
readline.createInterface({ input: process.stdin, crlfDelay: Infinity }).on("line", (line) => {
  const request = JSON.parse(line);
  const payload = request.payload || {};
  if (request.command === "initialize") {
    write({ id: request.id, ok: true, result: { surface_id: "local-rc-acp-runtime", version: "local-rc", commands } });
    return;
  }
  if (request.command === "session_list" || request.command === "session_ledger") {
    write({ id: request.id, ok: true, result: { items: [] } });
    return;
  }
  if (request.command === "session_create") {
    write({ id: request.id, ok: true, result: { session_id: payload?.session_create?.payload?.product_entry?.seed?.session_id || "local-rc-acp-session" } });
    return;
  }
  if (request.command === "prompt") {
    const providerCredential = process.env.GFLABTOKEN || "";
    const expected = process.env.OPL_RC_EXPECTED_PROVIDER_KEY_HASH || "";
    const injected = providerCredential && expected && secretHash(providerCredential) === expected && process.env.OPENAI_API_KEY === providerCredential && process.env.OPL_CODEX_API_KEY === providerCredential;
    if (!injected) {
      write({ id: request.id, ok: false, error: { code: "provider_secret_runtime_env_missing", message: "provider_secret_runtime_env_missing" } });
      return;
    }
    write({
      id: request.id,
      ok: true,
      result: {
        response: "local RC ACP reply observed; provider secret was injected through the backend runtime boundary.",
        session_id: payload.session_id || "local-rc-acp-session",
        runtime_session_id: "local-rc-acp-runtime-session",
        stop_reason: "end_turn"
      }
    });
    return;
  }
  write({ id: request.id, ok: false, error: { code: "unknown_command", message: request.command || "unknown" } });
});
`;

const PUBLIC_SECRET_FIELD_PATTERN = /rawProviderKey|providerApiKey|apiKey|launchToken|runtimeToken|bearerToken|experimental_bearer_token|signedUrl|presignedUrl|objectKey|storageKey|localPath/i;
const SECRET_ENV_NAME_PATTERN = /OPL_CODEX_API_KEY|OPENAI_API_KEY|GFLABTOKEN/;

function redact(value = "") {
  return String(value || "").replaceAll(providerKey, "[redacted-provider-key]");
}

function assertNoSecretLeak(value, label) {
  const serialized = typeof value === "string" ? value : JSON.stringify(value || {});
  assert.equal(serialized.includes(providerKey), false, `${label}_must_not_leak_raw_provider_key`);
  assert.equal(PUBLIC_SECRET_FIELD_PATTERN.test(serialized), false, `${label}_must_not_expose_secret_fields`);
  assert.equal(SECRET_ENV_NAME_PATTERN.test(serialized), false, `${label}_must_not_expose_secret_env_names`);
}

function assertNoRawProviderKey(value, label) {
  const serialized = typeof value === "string" ? value : JSON.stringify(value || {});
  assert.equal(serialized.includes(providerKey), false, `${label}_must_not_leak_raw_provider_key`);
}

function assertNoCredentialLeak(value, label) {
  const serialized = typeof value === "string" ? value : JSON.stringify(value || {});
  assert.equal(serialized.includes(providerKey), false, `${label}_must_not_leak_raw_provider_key`);
  assert.equal(/rawProviderKey|providerApiKey|apiKey|runtimeEnv/i.test(serialized), false, `${label}_must_not_expose_credential_fields`);
  assert.equal(SECRET_ENV_NAME_PATTERN.test(serialized), false, `${label}_must_not_expose_secret_env_names`);
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

function childEnv(overrides = {}) {
  const env = { ...process.env, ...overrides };
  delete env.GFLABTOKEN;
  delete env.OPENAI_API_KEY;
  delete env.OPL_CODEX_API_KEY;
  return env;
}

function spawnNode(script, { port, env = {}, stateRoot = "", cwd = process.cwd() } = {}) {
  const child = spawn(process.execPath, [script], {
    cwd,
    env: childEnv({
      PORT: String(port),
      NODE_ENV: "test",
      ...(stateRoot ? { PORTAL_RUNTIME_BRIDGE_STATE_ROOT: stateRoot } : {}),
      ...env,
    }),
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk) => childOutputPush(child, "stdout", chunk));
  child.stderr.on("data", (chunk) => childOutputPush(child, "stderr", chunk));
  return child;
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

async function waitForChildUrl(child, url, label, options = {}) {
  try {
    return await waitFor(url, options);
  } catch (error) {
    error.message = redact(`${error.message}:${label}:exitCode=${child?.exitCode ?? ""}:signal=${child?.signalCode ?? ""}:stdout=${child?.stdoutTail || ""}:stderr=${child?.stderrTail || ""}`);
    throw error;
  }
}

function cookieHeaderFrom(response, name) {
  const setCookie = response.headers.get("set-cookie") || "";
  const match = setCookie.match(new RegExp(`${name}=([^;]+)`));
  assert(match, `${name}_cookie_required`);
  assert(setCookie.includes("HttpOnly"), `${name}_cookie_must_be_http_only`);
  return `${name}=${match[1]}`;
}

function appendCookie(cookie = "", addition = "") {
  return [cookie, addition].filter(Boolean).join("; ");
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

async function readRuntimeBridgeState(stateRoot) {
  return JSON.parse(await readFile(path.join(stateRoot, "state.json"), "utf8"));
}

const tempRoot = await mkdtemp(path.join(os.tmpdir(), "v22-local-rc-provider-bound-backflow-"));
const runtimeRoot = path.join(tempRoot, "portal-runtime");
const runtimeBridgeStateRoot = path.join(tempRoot, "runtime-bridge-state");
const providerSecretRoot = path.join(tempRoot, "provider-secrets");
await mkdir(runtimeRoot, { recursive: true });

let runtimeBridge;
let gateway;
let portal;

try {
  const upstream = await waitFor(OPL_UPSTREAM_URL, { allowStatus: (status) => status === 200, timeoutMs: 5000 });
  const upstreamHtml = await upstream.text();
  assert(upstreamHtml.includes("<html") || upstreamHtml.includes("<!doctype"), "local_opl_webui_must_return_html");
  assertNoRawProviderKey(upstreamHtml, "local_opl_webui_html");

  const runtimeBridgePort = await freePort();
  const gatewayPort = await freePort();
  const portalPort = await freePort();
  const runtimeBridgeUrl = `http://127.0.0.1:${runtimeBridgePort}`;
  const gatewayUrl = `http://127.0.0.1:${gatewayPort}`;
  const portalUrl = `http://127.0.0.1:${portalPort}`;

  runtimeBridge = spawnNode("services/opl-runtime-bridge/src/server.mjs", {
    port: runtimeBridgePort,
    stateRoot: runtimeBridgeStateRoot,
    env: {
      PORTAL_RUNTIME_BRIDGE_PUBLIC_URL: runtimeBridgeUrl,
      PORTAL_OPL_PROVIDER_SECRET_ROOT: providerSecretRoot,
      OPL_WEB_URL: gatewayUrl,
      OPL_PRODUCT_API_URL: "",
      OPL_RUNTIME_MODE: "acp",
      OPL_ACP_RUNTIME_COMMAND_JSON: JSON.stringify([process.execPath, "-e", acpRuntimeFixtureSource]),
      OPL_RC_EXPECTED_PROVIDER_KEY_HASH: providerKeyHash,
      OPL_RUNTIME_BRIDGE_LOCAL_FAKE_RUNTIME: "1",
      PRODUCT_RUNTIME_MODE: "platform_provisioned",
    },
  });
  await waitForChildUrl(runtimeBridge, `${runtimeBridgeUrl}/healthz`, "runtime_bridge_healthz");

  gateway = spawnNode("services/opl-web-gateway/src/server.mjs", {
    port: gatewayPort,
    env: {
      OPL_WEB_GATEWAY_PUBLIC_URL: gatewayUrl,
      OPL_UPSTREAM_URL,
      PORTAL_RUNTIME_BRIDGE_URL: runtimeBridgeUrl,
      PORTAL_PUBLIC_URL: portalUrl,
      OPL_WEBUI_AUTH_MODE: "none",
    },
  });
  await waitForChildUrl(gateway, `${gatewayUrl}/healthz`, "gateway_healthz");

  portal = spawnNode("services/portal/src/server.mjs", {
    port: portalPort,
    env: {
      PORTAL_OIDC_ENABLED: "0",
      PORTAL_ALLOW_REGISTRATION: "1",
      PORTAL_ADMIN_EMAIL: USER_EMAIL,
      PORTAL_ADMIN_PASSWORD: USER_PASSWORD,
      PORTAL_PUBLIC_URL: portalUrl,
      PORTAL_RUNTIME_BRIDGE_URL: runtimeBridgeUrl,
      OPL_WEB_URL: gatewayUrl,
      PORTAL_STORAGE_MODE: "json",
      PRODUCT_RUNTIME_MODE: "platform_provisioned",
      PORTAL_RUNTIME_ROOT: runtimeRoot,
      PORTAL_OPL_PROVIDER_SECRET_ROOT: providerSecretRoot,
    },
  });
  await waitForChildUrl(portal, `${portalUrl}/healthz`, "portal_healthz");

  const directGateway = await fetch(gatewayUrl, { redirect: "manual" });
  assert.equal(directGateway.status, 200, "gateway_must_proxy_local_opl_webui");
  const directGatewayHtml = await directGateway.text();
  assert(directGatewayHtml.includes("/portal-launch.js"), "gateway_must_inject_portal_launch_script");
  assert(directGatewayHtml.includes('meta name="opl-portal-direct-entry" content="1"'), "gateway_direct_entry_meta_required_without_launch_cookie");
  assertNoRawProviderKey(directGatewayHtml, "gateway_direct_entry_html");

  const login = await postForm(`${portalUrl}/login`, { email: USER_EMAIL, password: USER_PASSWORD });
  assert.equal(login.status, 302, "portal_login_must_redirect_after_success");
  const portalCookie = cookieHeaderFrom(login, "portal_session");

  const me = await getJson(`${portalUrl}/portal/api/me`, { cookie: portalCookie });
  assert.equal(me.response.status, 200, "portal_me_must_return_200");
  assert.equal(me.json.email, USER_EMAIL, "portal_me_email_mismatch");
  assertNoSecretLeak(me.json, "portal_me");

  const prepared = await postJson(`${portalUrl}/portal/api/v22/users/prepare`, {
    tenantId: "tenant-local-rc-golden-path",
    userId: me.json.id,
    email: me.json.email,
    name: me.json.name || "Local RC User",
    workspaceId: WORKSPACE_ID,
  }, { cookie: portalCookie });
  assert([200, 201].includes(prepared.response.status), "prepare_user_must_return_200_or_201");
  assert.equal(prepared.json.ok, true, "prepare_user_must_return_ok");
  assertNoSecretLeak(prepared.json, "prepare_user");

  const credit = await postJson(`${portalUrl}/portal/api/v22/users/credit`, {
    userId: me.json.id,
    amount: 500,
    idempotencyKey: "local-rc-credit-once",
  }, { cookie: portalCookie });
  assert.equal(credit.response.status, 200, "credit_must_return_200");
  assert.equal(credit.json.ok, true, "credit_must_return_ok");
  assert.equal(credit.json.balance.balanceCents >= 50000, true, "credit_balance_must_cover_local_rc");
  assertNoSecretLeak(credit.json, "credit");

  const bound = await postJson(`${portalUrl}/portal/api/v22/provider-key`, {
    workspaceId: WORKSPACE_ID,
    provider: "gflabtoken",
    apiKey: providerKey,
  }, { cookie: portalCookie });
  assert.equal(bound.response.status, 200, "provider_key_binding_must_return_200");
  assert.equal(bound.json.ok, true, "provider_key_binding_must_return_ok");
  assert.equal(bound.json.providerBound, true, "provider_key_must_mark_bound");
  assert(bound.json.providerKeyRef, "provider_key_ref_required");
  assertNoSecretLeak(bound.json, "provider_key_binding");

  const readiness = await postJson(`${portalUrl}/portal/api/v22/managed-environment/readiness`, {
    workspaceId: WORKSPACE_ID,
  }, { cookie: portalCookie });
  assert.equal(readiness.response.status, 200, "readiness_after_provider_must_return_200");
  assert.equal(readiness.json.readyForManagedEnvironment, true, "readiness_after_provider_must_be_ready");
  assertNoSecretLeak(readiness.json, "readiness_after_provider");

  const opened = await postJson(`${portalUrl}/portal/api/v22/managed-environment/open`, {
    workspaceId: WORKSPACE_ID,
    planId: PLAN_ID,
    fileSpaceGb: FILE_SPACE_GB,
    idempotencyKey: "local-rc-open-managed-environment",
  }, { cookie: portalCookie });
  assert.equal(opened.response.status, 201, "managed_environment_open_must_create");
  assert.equal(opened.json.ok, true, "managed_environment_open_must_return_ok");
  assert.equal(opened.json.managedEnvironmentEnabled, true, "managed_environment_must_be_enabled");
  assert.equal(Object.hasOwn(opened.json, "resourceBinding"), false, "managed_environment_open_must_not_expose_resource_binding");
  assertNoSecretLeak(opened.json, "managed_environment_open");

  const unboundLaunch = await postJson(`${portalUrl}/portal/api/opl/launch`, {
    workspaceId: WORKSPACE_ID,
  }, { cookie: portalCookie });
  assert.equal(unboundLaunch.response.status, 200, "launch_without_inline_provider_key_still_returns_launch");
  assert.equal(unboundLaunch.json.providerBound, false, "launch_without_inline_provider_key_does_not_reuse_existing_binding_yet");
  assertNoSecretLeak(unboundLaunch.json, "unbound_launch");

  const unboundMessage = await postJson(`${portalUrl}/portal/api/opl/messages?launchId=${encodeURIComponent(unboundLaunch.json.launchId)}`, {
    message: "this must fail without provider config",
    waitForCompletion: true,
  }, { cookie: portalCookie });
  assert.equal(unboundMessage.response.status, 502, "message_without_launch_provider_config_must_fail_closed");
  assert.equal(unboundMessage.json.error, "provider_config_required", "message_without_launch_provider_config_error_mismatch");
  assertNoSecretLeak(unboundMessage.json, "unbound_message");

  const launch = await postJson(`${portalUrl}/portal/api/opl/launch`, {
    workspaceId: WORKSPACE_ID,
    providerKeyPayload: {
      provider: "gflabtoken",
      source: "user_input",
      apiKey: providerKey,
    },
  }, { cookie: portalCookie });
  assert.equal(launch.response.status, 200, "provider_bound_launch_must_return_200");
  assert.equal(launch.json.ok, true, "provider_bound_launch_must_return_ok");
  assert.equal(launch.json.providerBound, true, "provider_bound_launch_must_mark_provider_bound");
  assert(launch.json.providerKeyRef, "provider_bound_launch_provider_key_ref_required");
  assert.equal(new URL(launch.json.openUrl).origin, gatewayUrl, "launch_open_url_must_target_gateway");
  assert.equal(new URL(launch.json.openUrl).searchParams.has("launch_token"), false, "launch_open_url_must_not_include_launch_token");
  assertNoSecretLeak(launch.json, "provider_bound_launch");

  const launchId = launch.json.launchId;
  const launchCookie = cookieHeaderFrom(launch.response, "opl_portal_launch");
  const combinedCookie = appendCookie(portalCookie, launchCookie);

  const gatewayAuth = await getJson(`${gatewayUrl}/api/v1/auths/`, { cookie: launchCookie });
  assert.equal(gatewayAuth.response.status, 200, "gateway_auth_user_must_accept_launch_cookie");
  assert.equal(gatewayAuth.json.success, true, "gateway_auth_user_must_return_success");
  assert.equal(gatewayAuth.json.workspace.workspaceId, WORKSPACE_ID, "gateway_auth_workspace_mismatch");
  assertNoSecretLeak(gatewayAuth.json, "gateway_auth_user");

  const launchedGateway = await fetch(gatewayUrl, { headers: { cookie: launchCookie }, redirect: "manual" });
  assert.equal(launchedGateway.status, 200, "gateway_with_launch_cookie_must_proxy_local_opl_webui");
  const launchedGatewayHtml = await launchedGateway.text();
  assert(launchedGatewayHtml.includes("/portal-launch.js"), "gateway_with_launch_cookie_must_inject_launch_script");
  assert(launchedGatewayHtml.includes('meta name="opl-portal-direct-entry" content="0"'), "gateway_launch_cookie_must_disable_direct_entry_meta");
  assertNoRawProviderKey(launchedGatewayHtml, "gateway_launched_html");

  const bootstrapViaGateway = await getJson(`${gatewayUrl}/runtime-bridge/api/opl/bootstrap`, { cookie: launchCookie });
  assert.equal(bootstrapViaGateway.response.status, 200, "gateway_runtime_bootstrap_must_return_200");
  assert.equal(bootstrapViaGateway.json.identity.workspaceId, WORKSPACE_ID, "gateway_runtime_bootstrap_workspace_mismatch");
  assert.equal(bootstrapViaGateway.json.provider.providerConfigured, true, "gateway_runtime_bootstrap_provider_configured_mismatch");
  assert.equal(bootstrapViaGateway.json.provider.providerKeyRef, launch.json.providerKeyRef, "gateway_runtime_bootstrap_provider_ref_mismatch");
  assert.equal(bootstrapViaGateway.json.opl.health.source, "opl_acp_runtime", "gateway_runtime_bootstrap_must_use_acp_runtime");
  assertNoSecretLeak(bootstrapViaGateway.json, "gateway_runtime_bootstrap");

  const bootstrap = await getJson(`${portalUrl}/portal/api/opl/bootstrap?launchId=${encodeURIComponent(launchId)}`, { cookie: portalCookie });
  assert.equal(bootstrap.response.status, 200, "portal_opl_bootstrap_must_return_200");
  assert.equal(bootstrap.json.identity.workspaceId, WORKSPACE_ID, "portal_opl_bootstrap_workspace_mismatch");
  assert.equal(bootstrap.json.provider.providerKeyRef, launch.json.providerKeyRef, "portal_opl_bootstrap_provider_ref_mismatch");
  assertNoSecretLeak(bootstrap.json, "portal_opl_bootstrap");

  const bind = await postJson(`${portalUrl}/portal/api/opl/sessions/bind?launchId=${encodeURIComponent(launchId)}`, {
    oplSessionId: bootstrap.json.identity.oplSessionId || "local-rc-opl-session",
    clientSessionState: { source: "local-rc-provider-bound-message-backflow" },
  }, { cookie: portalCookie });
  assert.equal(bind.response.status, 200, "portal_opl_session_bind_must_return_200");
  assert.equal(bind.json.runtimeSession.providerBound, true, "portal_opl_session_bind_provider_bound_mismatch");
  assertNoSecretLeak(bind.json, "portal_opl_session_bind");

  const file = await postJson(`${portalUrl}/portal/api/opl/files?launchId=${encodeURIComponent(launchId)}`, {
    fileName: "inputs/local-rc.csv",
    contentType: "text/csv",
    sizeBytes: 32,
  }, { cookie: portalCookie });
  assert.equal(file.response.status, 201, "portal_opl_file_must_return_201");
  assert(file.json.fileRef, "portal_opl_file_ref_required");
  assert.equal(file.json.file.providerKeyRef, launch.json.providerKeyRef, "portal_opl_file_provider_ref_mismatch");
  assertNoSecretLeak(file.json, "portal_opl_file");

  const message = await postJson(`${portalUrl}/portal/api/opl/messages?launchId=${encodeURIComponent(launchId)}`, {
    message: "local RC provider-bound message backflow",
    waitForCompletion: true,
  }, { cookie: portalCookie });
  assert.equal(message.response.status, 200, "portal_opl_message_must_return_200");
  assert.equal(message.json.ok, true, "portal_opl_message_must_return_ok");
  assert.equal(message.json.message.status, "succeeded", "portal_opl_message_status_mismatch");
  assert.equal(message.json.message.source, "opl_acp_runtime", "portal_opl_message_source_mismatch");
  assert(message.json.artifact?.artifactRef, "portal_opl_message_artifact_ref_required");
  assert(message.json.trace?.traceId, "portal_opl_message_trace_required");
  assertNoSecretLeak(message.json, "portal_opl_message");

  const run = await postJson(`${portalUrl}/portal/api/opl/runs?launchId=${encodeURIComponent(launchId)}`, {
    mode: "full_runtime",
    resourceBindingId: "rb-local-rc-golden-path",
    computeInstanceId: "compute-local-rc-golden-path",
    storageBucketId: "storage-local-rc-golden-path",
    runtimeAgentId: "runtime-agent-local-rc-golden-path",
    message: "run local RC artifact projection",
    fileRefs: [file.json.fileRef],
    toolName: "local-rc-golden-path",
  }, { cookie: portalCookie });
  assert.equal(run.response.status, 201, "portal_opl_run_must_return_201");
  assert.equal(run.json.ok, true, "portal_opl_run_must_return_ok");
  assert.equal(run.json.run.status, "succeeded", "portal_opl_run_status_mismatch");
  assert(run.json.artifacts?.[0]?.artifactRef, "portal_opl_run_artifact_required");
  assertNoSecretLeak(run.json, "portal_opl_run");

  const artifacts = await getJson(`${portalUrl}/portal/api/opl/runs/${encodeURIComponent(run.json.run.runId)}/artifacts?launchId=${encodeURIComponent(launchId)}`, { cookie: portalCookie });
  assert.equal(artifacts.response.status, 200, "portal_opl_run_artifacts_must_return_200");
  assert.equal(artifacts.json.items.some((item) => item.artifactRef === run.json.artifacts[0].artifactRef), true, "portal_opl_run_artifacts_must_include_runtime_artifact");
  assertNoSecretLeak(artifacts.json, "portal_opl_run_artifacts");

  const sessionTraces = await getJson(`${portalUrl}/portal/api/session-traces?workspaceId=${encodeURIComponent(WORKSPACE_ID)}&pageSize=20`, { cookie: combinedCookie });
  assert.equal(sessionTraces.response.status, 200, "portal_session_traces_must_return_200");
  assert.equal(sessionTraces.json.summary?.canonicalSource, "runtime_bridge_canonical_metadata", "portal_session_traces_canonical_source_mismatch");
  assert.equal(sessionTraces.json.items?.length >= 1, true, "portal_session_traces_must_include_runtime_projection");
  assertNoSecretLeak(sessionTraces.json, "portal_session_traces");

  const release = await postJson(`${portalUrl}/portal/api/v22/managed-environment/release`, {
    workspaceId: WORKSPACE_ID,
    releasedAt: RELEASED_AT,
    reason: "local_rc_close",
  }, { cookie: portalCookie });
  assert.equal(release.response.status, 200, "managed_environment_release_must_return_200");
  assert.equal(release.json.ok, true, "managed_environment_release_must_return_ok");
  assert.equal(release.json.stopBilling.status, "billing_stopped", "managed_environment_release_must_stop_billing");
  assert.equal(release.json.audit.status, "audit_pending", "managed_environment_release_must_create_audit_pending");
  assertNoSecretLeak(release.json, "managed_environment_release");

  const releasedState = await getJson(`${portalUrl}/portal/api/canonical-state?workspaceId=${encodeURIComponent(WORKSPACE_ID)}`, { cookie: portalCookie });
  assert.equal(releasedState.response.status, 200, "released_canonical_state_must_return_200");
  assert.equal(releasedState.json.managedEnvironment.enabled, false, "released_canonical_state_must_disable_managed_environment");
  assert.equal(releasedState.json.stopBilling.status, "billing_stopped", "released_canonical_state_stop_billing_mismatch");
  assertNoSecretLeak(releasedState.json, "released_canonical_state");

  const state = await readRuntimeBridgeState(runtimeBridgeStateRoot);
  assert(state.messageReplies.some((item) => item.messageId === message.json.message.messageId && item.providerKeyRef === launch.json.providerKeyRef), "runtime_state_must_persist_provider_bound_message_reply");
  assert(state.artifacts.some((item) => item.artifactId === message.json.artifact.artifactRef), "runtime_state_must_persist_message_artifact");
  assert(state.traceLinks.some((item) => item.traceId === message.json.trace.traceId && item.status === "succeeded"), "runtime_state_must_persist_message_trace");
  assert(state.runs.some((item) => item.runId === run.json.run.runId && item.status === "succeeded"), "runtime_state_must_persist_succeeded_run");
  assertNoCredentialLeak(state, "runtime_bridge_state");
  for (const child of [runtimeBridge, gateway, portal]) {
    assertNoRawProviderKey(child.stdoutTail || "", "child_stdout");
    assertNoRawProviderKey(child.stderrTail || "", "child_stderr");
  }

  console.log(JSON.stringify({
    ok: true,
    contract: "v22_local_rc_provider_bound_message_backflow",
    urls: {
      portalUrl,
      gatewayUrl,
      runtimeBridgeUrl,
      oplUpstreamUrl: OPL_UPSTREAM_URL,
    },
    covered: [
      "login",
      "credit",
      "provider_key_backend_secret_boundary",
      "managed_environment_open",
      "gateway_launch_bootstrap_against_local_opl_webui",
      "provider_bound_message_backflow",
      "file_run_artifact_projection",
      "portal_trace_projection",
      "release_stop_billing_audit_pending",
      "secret_hygiene",
    ],
    gaps: [
      "portal_launch_api_does_not_reuse_existing_provider_key_binding_without_inline_providerKeyPayload",
      "real_webui_provider_message_reply_is_not_claimed_by_this_local_rc_eval",
      "production_cloud_deploy_and_live_provider_evidence_not_claimed",
    ],
    launchId,
    runId: run.json.run.runId,
    messageId: message.json.message.messageId,
  }, null, 2));
} finally {
  await stopChild(portal);
  await stopChild(gateway);
  await stopChild(runtimeBridge);
  await rm(tempRoot, { recursive: true, force: true });
}
