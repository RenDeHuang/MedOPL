import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import http from "node:http";
import net from "node:net";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

const USER_EMAIL = "zitadel-admin@zitadel.localhost";
const USER_PASSWORD = "Password1!";
const WORKSPACE_ID = "portal-opl-runtime-loop";
const RESOURCE_BINDING_ID = "rb-portal-opl-runtime-loop";
const RUNTIME_AGENT_ID = "fake-runtime-agent-portal-opl-runtime-loop";
const RAW_PROVIDER_KEY = "gflabtoken_raw_key_portal_opl_runtime_loop";
const FORBIDDEN_PUBLIC_PATTERN = /gflabtoken_raw_key|rawProviderKey|providerApiKey|apiKey|launchToken|runtimeToken|bearerToken|objectKey|storageKey|localPath|signedUrl/i;

function assertNoPublicLeak(value, label) {
  const serialized = typeof value === "string" ? value : JSON.stringify(value || {});
  assert.equal(FORBIDDEN_PUBLIC_PATTERN.test(serialized), false, `${label}_must_not_expose_secret_or_storage_fields`);
}

function collectValues(value) {
  if (Array.isArray(value)) return value.flatMap(collectValues);
  if (value && typeof value === "object") return Object.values(value).flatMap(collectValues);
  return [String(value ?? "")];
}

function assertNoPortalRunIdLeak(value, runId, label) {
  const serialized = JSON.stringify(value || {});
  assert.equal(serialized.includes('"runId"'), false, `${label}_must_not_expose_run_id_field`);
  assert.equal(collectValues(value).includes(runId), false, `${label}_must_not_expose_run_id_value`);
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

async function readRequestBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return chunks.length ? Buffer.concat(chunks).toString("utf8") : "";
}

function sendJson(res, status, payload) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload, null, 2));
}

function startFakeOplProductApi(calls) {
  return http.createServer(async (req, res) => {
    const body = await readRequestBody(req);
    const url = new URL(req.url || "/", "http://fake-opl-product-api.local");
    calls.push({ method: req.method || "GET", pathname: url.pathname, search: url.search, body });

    if (url.pathname === "/api/health" || url.pathname === "/healthz") {
      sendJson(res, 200, { ok: true, service: "fake-opl-product-api-runtime-loop" });
      return;
    }
    if (url.pathname === "/api/opl/system") {
      sendJson(res, 200, { system: { id: "fake-clean-opl-runtime-loop", status: "ready" } });
      return;
    }
    if (url.pathname === "/api/opl/engines") {
      sendJson(res, 200, { items: [{ id: "engine-runtime-loop", name: "Runtime Loop Engine" }] });
      return;
    }
    if (url.pathname === "/api/opl/modules") {
      sendJson(res, 200, { items: [{ id: "mas", name: "MAS" }] });
      return;
    }
    if (url.pathname === "/api/opl/agents") {
      sendJson(res, 200, { items: [{ id: "agent-runtime-loop", name: "Runtime Loop Agent" }] });
      return;
    }
    if (req.method === "POST" && (url.pathname === "/api/opl/workspaces/bind" || url.pathname === "/api/opl/workspaces")) {
      const payload = body ? JSON.parse(body) : {};
      assertNoPublicLeak(payload, "upstream_workspace_bind");
      sendJson(res, 200, { workspace: { workspaceId: payload.workspaceId || WORKSPACE_ID, portalUserId: payload.portalUserId || "", status: "bound" } });
      return;
    }
    if (req.method === "POST" && url.pathname === "/api/opl/sessions") {
      const payload = body ? JSON.parse(body) : {};
      assertNoPublicLeak(payload, "upstream_session_create");
      sendJson(res, 200, { session: { id: "runtime-loop-upstream-session", sessionId: "runtime-loop-upstream-session", workspaceId: payload.workspaceId || WORKSPACE_ID, status: "created" } });
      return;
    }
    if (url.pathname === "/api/opl/workspaces") {
      sendJson(res, 200, { items: [{ workspaceId: WORKSPACE_ID, status: "active" }] });
      return;
    }
    if (url.pathname === "/api/opl/sessions") {
      sendJson(res, 200, { items: [{ sessionId: "runtime-loop-upstream-session", workspaceId: WORKSPACE_ID }] });
      return;
    }
    if (url.pathname === "/api/opl/progress") {
      sendJson(res, 200, { items: [{ type: "message", status: "succeeded", workspaceId: WORKSPACE_ID }] });
      return;
    }
    if (url.pathname === "/api/opl/artifacts") {
      sendJson(res, 200, { items: [] });
      return;
    }
    if (req.method === "POST" && ["/api/opl/messages", "/api/opl/sessions/messages", "/api/opl/chat/messages"].includes(url.pathname)) {
      const payload = body ? JSON.parse(body) : {};
      assertNoPublicLeak(payload, "upstream_message");
      sendJson(res, 200, {
        message: {
          messageId: payload.messageId || "message-runtime-loop",
          runtimeSessionId: payload.runtimeSessionId || "",
          reply: "fake OPL reply for Portal runtime API loop",
          source: "fake_opl_product_api",
        },
      });
      return;
    }
    sendJson(res, 404, { ok: false, error: "not_found", path: url.pathname });
  });
}

function startFakeUpstreamWeb() {
  return http.createServer((_req, res) => {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end("<!doctype html><html><body><main>clean fake OPL Web runtime loop</main></body></html>");
  });
}

function childOutputPush(child, streamName, chunk) {
  const key = `${streamName}Tail`;
  child[key] = `${child[key] || ""}${chunk}`;
  if (child[key].length > 12000) child[key] = child[key].slice(-12000);
}

function spawnNode(script, { port, env = {}, stateRoot = "", cwd = process.cwd() } = {}) {
  const child = spawn(process.execPath, [script], {
    cwd,
    env: {
      ...process.env,
      PORT: String(port),
      NODE_ENV: "test",
      ...(stateRoot ? { PORTAL_RUNTIME_BRIDGE_STATE_ROOT: stateRoot } : {}),
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

function spawnVite({ port, backendUrl }) {
  const child = spawn(process.execPath, ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--port", String(port), "--strictPort"], {
    cwd: path.resolve("services/portal/frontend"),
    env: {
      ...process.env,
      NODE_ENV: "test",
      PORTAL_PUBLIC_URL: `http://127.0.0.1:${port}`,
      VITE_PORTAL_BACKEND_URL: backendUrl,
    },
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
    error.message = `${error.message}:${label}:exitCode=${child?.exitCode ?? ""}:signal=${child?.signalCode ?? ""}:stdout=${child?.stdoutTail || ""}:stderr=${child?.stderrTail || ""}`;
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

async function postForm(url, form, { cookie = "" } = {}) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      ...(cookie ? { cookie } : {}),
    },
    body: new URLSearchParams(form).toString(),
    redirect: "manual",
  });
  return response;
}

async function postJson(url, payload, { cookie = "", expectedJson = true } = {}) {
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
  const json = expectedJson ? await response.json().catch(() => ({})) : {};
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

const tempRoot = await mkdtemp(path.join(os.tmpdir(), "v22-portal-opl-runtime-loop-"));
const runtimeRoot = path.join(tempRoot, "portal-runtime");
const runtimeBridgeStateRoot = path.join(tempRoot, "runtime-bridge-state");
await mkdir(runtimeRoot, { recursive: true });

const productCalls = [];
const productApi = startFakeOplProductApi(productCalls);
const upstreamWeb = startFakeUpstreamWeb();
let runtimeBridge;
let gateway;
let portal;
let vite;

try {
  const productPort = await listen(productApi);
  const upstreamPort = await listen(upstreamWeb);
  const runtimeBridgePort = await freePort();
  const gatewayPort = await freePort();
  const portalPort = await freePort();
  const vitePort = await freePort();
  const runtimeBridgeUrl = `http://127.0.0.1:${runtimeBridgePort}`;
  const gatewayUrl = `http://127.0.0.1:${gatewayPort}`;
  const portalUrl = `http://127.0.0.1:${portalPort}`;
  const frontendUrl = `http://127.0.0.1:${vitePort}/opl-launch`;

  runtimeBridge = spawnNode("services/opl-runtime-bridge/src/server.mjs", {
    port: runtimeBridgePort,
    stateRoot: runtimeBridgeStateRoot,
    env: {
      PORTAL_RUNTIME_BRIDGE_PUBLIC_URL: runtimeBridgeUrl,
      OPL_WEB_URL: gatewayUrl,
      OPL_PRODUCT_API_URL: `http://127.0.0.1:${productPort}`,
      OPL_RUNTIME_BRIDGE_LOCAL_FAKE_RUNTIME: "1",
      PRODUCT_RUNTIME_MODE: "platform_provisioned",
    },
  });
  await waitFor(`${runtimeBridgeUrl}/healthz`);

  gateway = spawnNode("services/opl-web-gateway/src/server.mjs", {
    port: gatewayPort,
    env: {
      OPL_WEB_GATEWAY_PUBLIC_URL: gatewayUrl,
      OPL_UPSTREAM_URL: `http://127.0.0.1:${upstreamPort}`,
      PORTAL_RUNTIME_BRIDGE_URL: runtimeBridgeUrl,
      PORTAL_PUBLIC_URL: portalUrl,
    },
  });
  await waitFor(`${gatewayUrl}/healthz`);

  portal = spawnNode("services/portal/src/server.mjs", {
    port: portalPort,
    env: {
      PORTAL_OIDC_ENABLED: "0",
      PORTAL_ALLOW_REGISTRATION: "1",
      PORTAL_ADMIN_EMAIL: USER_EMAIL,
      PORTAL_ADMIN_PASSWORD: USER_PASSWORD,
      PORTAL_PUBLIC_URL: `http://127.0.0.1:${vitePort}`,
      PORTAL_RUNTIME_BRIDGE_URL: runtimeBridgeUrl,
      OPL_WEB_URL: gatewayUrl,
      PORTAL_STORAGE_MODE: "json",
      PRODUCT_RUNTIME_MODE: "platform_provisioned",
      PORTAL_OPL_PROVIDER_SECRET_ROOT: path.join(tempRoot, "provider-secrets"),
    },
  });
  await waitFor(`${portalUrl}/healthz`);

  vite = spawnVite({ port: vitePort, backendUrl: portalUrl });
  await waitForChildUrl(vite, `http://127.0.0.1:${vitePort}/overview`, "vite_overview", { allowStatus: (status) => status === 200 });

  const login = await postForm(`${portalUrl}/login`, { email: USER_EMAIL, password: USER_PASSWORD });
  assert.equal(login.status, 302, "portal_login_must_redirect_after_success");
  assert.equal(login.headers.get("location"), "/overview", "portal_login_success_location_mismatch");
  const portalCookie = cookieHeaderFrom(login, "portal_session");

  const me = await getJson(`${portalUrl}/portal/api/me`, { cookie: portalCookie });
  assert.equal(me.response.status, 200, "portal_me_must_return_200");
  assert.equal(me.json.email, USER_EMAIL, "portal_me_email_mismatch");
  assertNoPublicLeak(me.json, "portal_me");

  const launch = await postJson(`${portalUrl}/portal/api/opl/launch`, {
    workspaceId: WORKSPACE_ID,
    providerKeyPayload: {
      provider: "gflabtoken",
      source: "user_input",
      apiKey: RAW_PROVIDER_KEY,
    },
  }, { cookie: portalCookie });
  assert.equal(launch.response.status, 200, "portal_opl_launch_must_return_200");
  assert.equal(launch.json.ok, true, "portal_opl_launch_must_succeed");
  assert(launch.json.launchId, "portal_opl_launch_id_required");
  assert.equal(new URL(launch.json.openUrl).searchParams.has("launch_token"), false, "portal_opl_open_url_must_not_include_launch_token");
  assertNoPublicLeak(launch.json, "portal_opl_launch");

  const launchId = launch.json.launchId;
  const bootstrap = await getJson(`${portalUrl}/portal/api/opl/bootstrap?launchId=${encodeURIComponent(launchId)}`, { cookie: portalCookie });
  assert.equal(bootstrap.response.status, 200, "portal_opl_bootstrap_must_return_200");
  assert.equal(bootstrap.json.identity.workspaceId, WORKSPACE_ID, "portal_opl_bootstrap_workspace_mismatch");
  assert.equal(bootstrap.json.capabilities?.contextBootstrap?.status, "supported", "portal_opl_bootstrap_capability_mismatch");
  assertNoPublicLeak(bootstrap.json, "portal_opl_bootstrap");

  const bind = await postJson(`${portalUrl}/portal/api/opl/sessions/bind?launchId=${encodeURIComponent(launchId)}`, {
    oplSessionId: bootstrap.json.identity.oplSessionId || "portal-runtime-loop-session",
    clientSessionState: { source: "portal-http-runtime-loop" },
  }, { cookie: portalCookie });
  assert.equal(bind.response.status, 200, "portal_opl_session_bind_must_return_200");
  assert.equal(bind.json.runtimeSession.workspaceId, WORKSPACE_ID, "portal_opl_session_bind_workspace_mismatch");
  assertNoPublicLeak(bind.json, "portal_opl_session_bind");

  const message = await postJson(`${portalUrl}/portal/api/opl/messages?launchId=${encodeURIComponent(launchId)}`, {
    message: "summarize Portal OPL runtime loop",
    waitForCompletion: true,
  }, { cookie: portalCookie });
  assert.equal(message.response.status, 200, "portal_opl_message_must_return_200");
  assert.equal(message.json.message.status, "succeeded", "portal_opl_message_status_mismatch");
  assert.equal(message.json.message.source, "fake_opl_product_api", "portal_opl_message_source_mismatch");
  assertNoPublicLeak(message.json, "portal_opl_message");

  const file = await postJson(`${portalUrl}/portal/api/opl/files?launchId=${encodeURIComponent(launchId)}`, {
    fileName: "inputs/runtime-loop.csv",
    contentType: "text/csv",
    sizeBytes: 32,
  }, { cookie: portalCookie });
  assert.equal(file.response.status, 201, "portal_opl_file_must_return_201");
  assert(file.json.fileRef, "portal_opl_file_ref_required");
  assertNoPublicLeak(file.json, "portal_opl_file");

  const run = await postJson(`${portalUrl}/portal/api/opl/runs?launchId=${encodeURIComponent(launchId)}`, {
    mode: "full_runtime",
    resourceBindingId: RESOURCE_BINDING_ID,
    computeInstanceId: "compute-portal-opl-runtime-loop",
    storageBucketId: "storage-portal-opl-runtime-loop",
    runtimeAgentId: RUNTIME_AGENT_ID,
    message: "run Portal OPL runtime loop",
    fileRefs: [file.json.fileRef],
    toolName: "portal-opl-runtime-loop",
  }, { cookie: portalCookie });
  assert.equal(run.response.status, 201, "portal_opl_run_must_return_201");
  assert.equal(run.json.run.status, "succeeded", "portal_opl_run_status_mismatch");
  assert(run.json.artifacts?.[0]?.artifactRef, "portal_opl_run_artifact_required");
  assertNoPublicLeak(run.json, "portal_opl_run");

  const artifacts = await getJson(`${portalUrl}/portal/api/opl/runs/${encodeURIComponent(run.json.run.runId)}/artifacts?launchId=${encodeURIComponent(launchId)}`, { cookie: portalCookie });
  assert.equal(artifacts.response.status, 200, "portal_opl_run_artifacts_must_return_200");
  assert.equal(artifacts.json.items.some((item) => item.artifactRef === run.json.artifacts[0].artifactRef), true, "portal_opl_run_artifacts_must_include_runtime_artifact");
  assertNoPublicLeak(artifacts.json, "portal_opl_run_artifacts");

  const artifact = await getJson(`${portalUrl}/portal/api/opl/artifacts/${encodeURIComponent(run.json.artifacts[0].artifactRef)}?launchId=${encodeURIComponent(launchId)}`, { cookie: portalCookie });
  assert.equal(artifact.response.status, 200, "portal_opl_artifact_must_return_200");
  assert.equal(artifact.json.artifact.artifactRef, run.json.artifacts[0].artifactRef, "portal_opl_artifact_ref_mismatch");
  assertNoPublicLeak(artifact.json, "portal_opl_artifact");

  const sessionTraces = await getJson(`${portalUrl}/portal/api/session-traces?workspaceId=${encodeURIComponent(WORKSPACE_ID)}&pageSize=20`, { cookie: portalCookie });
  assert.equal(sessionTraces.response.status, 200, "portal_session_traces_must_return_200");
  assert.equal(sessionTraces.json.summary?.businessFactSource, "runtime_bridge_canonical_metadata", "portal_session_traces_must_use_runtime_bridge_canonical_source");
  assert.equal(sessionTraces.json.summary?.canonicalSource, "runtime_bridge_canonical_metadata", "portal_session_traces_canonical_source_mismatch");
  assert.equal(sessionTraces.json.summary?.billingTruth, false, "portal_session_traces_must_not_use_langfuse_as_billing_truth");
  assert.equal(sessionTraces.json.customerDefaultLangfuseUi, false, "portal_session_traces_must_default_to_portal_trace_surface");
  assert.equal(sessionTraces.json.items?.length >= 1, true, "portal_session_traces_must_include_runtime_run");
  const traceItem = sessionTraces.json.items.find((item) =>
    item.outputFiles?.some((file) => file.artifactRef === run.json.artifacts[0].artifactRef)
  );
  assert(traceItem, "portal_session_traces_must_find_run_trace");
  assert(traceItem.taskRef, "portal_session_trace_must_expose_public_task_ref");
  assert.equal(traceItem.workspaceId, WORKSPACE_ID, "portal_session_trace_workspace_mismatch");
  assert.equal(traceItem.runtimeSessionId, bind.json.runtimeSession.runtimeSessionId, "portal_session_trace_runtime_session_mismatch");
  assert.equal(traceItem.source, "runtime_bridge_canonical_metadata", "portal_session_trace_source_mismatch");
  assert.equal(traceItem.customerDefaultLangfuseUi, false, "portal_session_trace_item_must_not_default_to_langfuse");
  assert.equal(traceItem.outputFiles.some((item) => item.artifactRef === run.json.artifacts[0].artifactRef), true, "portal_session_trace_must_link_runtime_artifact");
  assertNoPortalRunIdLeak(sessionTraces.json, run.json.run.runId, "portal_session_traces");
  assertNoPublicLeak(sessionTraces.json, "portal_session_traces");

  const traceDetail = await getJson(`${portalUrl}/portal/api/session-traces/${encodeURIComponent(traceItem.traceId)}`, { cookie: portalCookie });
  assert.equal(traceDetail.response.status, 200, "portal_session_trace_detail_must_return_200");
  assert.equal(traceDetail.json.taskRef, traceItem.taskRef, "portal_session_trace_detail_task_ref_mismatch");
  assert.equal(traceDetail.json.timeline.some((event) => event.type === "runner_run_succeeded" || event.type === "runtime_artifact_recorded"), true, "portal_session_trace_detail_must_include_runtime_timeline");
  assertNoPortalRunIdLeak(traceDetail.json, run.json.run.runId, "portal_session_trace_detail");
  assertNoPublicLeak(traceDetail.json, "portal_session_trace_detail");

  const crossUser = await getJson(`${portalUrl}/portal/api/opl/bootstrap?launchId=${encodeURIComponent(launchId)}`);
  assert.equal(crossUser.response.status, 401, "portal_opl_bootstrap_without_portal_session_must_return_401");

  const frontendShell = await fetch(`http://127.0.0.1:${vitePort}/opl-launch?launchId=${encodeURIComponent(launchId)}`, {
    headers: { cookie: portalCookie },
    redirect: "manual",
  });
  assert.equal(frontendShell.status, 200, "vite_opl_launch_shell_must_return_200");
  const html = await frontendShell.text();
  assert(html.includes("id=\"root\""), "vite_opl_launch_shell_must_include_app_root");
  assertNoPublicLeak(html, "vite_opl_launch_shell");

  assert.equal(productCalls.some((call) => /launch_token|apiKey|providerApiKey|runtimeToken/i.test(call.search)), false, "upstream_must_not_receive_secret_query");
  assert.equal(productCalls.some((call) => FORBIDDEN_PUBLIC_PATTERN.test(call.body)), false, "upstream_must_not_receive_secret_body");

  console.log(JSON.stringify({
    ok: true,
    contract: "v22_portal_opl_api_runtime_loop",
    portalUrl,
    frontendUrl: `${frontendUrl}?launchId=${launchId}`,
    covered: [
      "portal_login",
      "portal_http_opl_launch",
      "portal_http_opl_proxy_to_runtime_bridge",
      "session_message_file_run_artifact_backflow",
      "portal_session_trace_projection",
      "vite_opl_launch_shell",
      "secret_hygiene",
    ],
    launchId,
    runId: run.json.run.runId,
    artifactRef: run.json.artifacts[0].artifactRef,
  }, null, 2));
} finally {
  await stopChild(vite);
  await stopChild(portal);
  await stopChild(gateway);
  await stopChild(runtimeBridge);
  await close(productApi);
  await close(upstreamWeb);
  await rm(tempRoot, { recursive: true, force: true });
}
