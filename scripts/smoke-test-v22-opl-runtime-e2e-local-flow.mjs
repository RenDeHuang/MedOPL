import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import http from "node:http";
import net from "node:net";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

import { createRuntimeBridgeClient } from "../services/portal/src/integrations/runtime-bridge-client.mjs";
import { buildSessionTracesApiPayload } from "../services/portal/src/domain/session-traces.mjs";

const RAW_PROVIDER_KEY = "gflabtoken_raw_key_v22_local_e2e_backend_only";
const RAW_PROMPT = "analyze the uploaded cell-growth input file for the local v22 e2e smoke";
const USER_ID = "user-v22-local-e2e";
const TENANT_ID = "tenant-v22-local-e2e";
const WORKSPACE_ID = "workspace-v22-local-e2e";
const RESOURCE_BINDING_ID = "binding-v22-local-e2e";
const PROVIDER_KEY_REF = "provider-key-ref-v22-local-e2e";
const INPUT_FILE_REF = "workspace-file-ref-v22-local-e2e-input";

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

async function waitFor(url) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      const response = await fetch(url, { redirect: "manual" });
      if (response.status < 500) return response;
    } catch {}
    await sleep(100);
  }
  throw new Error(`timeout_waiting_for:${url}`);
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

function collectValues(value) {
  if (Array.isArray(value)) return value.flatMap(collectValues);
  if (value && typeof value === "object") return Object.values(value).flatMap(collectValues);
  return [String(value ?? "")];
}

function startFakeUpstreamWeb(calls) {
  return http.createServer(async (req, res) => {
    const body = await readRequestBody(req);
    const url = new URL(req.url || "/", "http://fake-opl-web.local");
    calls.push({
      method: req.method || "GET",
      pathname: url.pathname,
      search: url.search,
      authorization: req.headers.authorization || "",
      body,
    });

    if (url.pathname === "/") {
      res.writeHead(200, {
        "content-type": "text/html; charset=utf-8",
        "x-fake-upstream": "clean-one-person-lab-web",
      });
      res.end([
        "<!doctype html>",
        "<html>",
        "<head><title>Clean fake upstream OPL Web</title></head>",
        "<body>",
        "<main>clean fake upstream OPL Web</main>",
        "<form action=\"/login\" method=\"post\">",
        "<input name=\"email\" type=\"email\">",
        "<input name=\"password\" type=\"password\">",
        "<button type=\"submit\">进入 OPL 工作台</button>",
        "</form>",
        "</body>",
        "</html>",
      ].join(""));
      return;
    }

    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("not found");
  });
}

function startFakeOplProductApi(calls) {
  return http.createServer(async (req, res) => {
    const body = await readRequestBody(req);
    const url = new URL(req.url || "/", "http://fake-opl-product-api.local");
    calls.push({
      method: req.method || "GET",
      pathname: url.pathname,
      search: url.search,
      authorization: req.headers.authorization || "",
      body,
    });

    if (url.pathname === "/api/health" || url.pathname === "/healthz") {
      sendJson(res, 200, { ok: true, service: "fake-opl-product-api" });
      return;
    }
    if (url.pathname === "/api/opl/system") {
      sendJson(res, 200, { system: { id: "fake-clean-opl", status: "ready" } });
      return;
    }
    if (url.pathname === "/api/opl/engines") {
      sendJson(res, 200, { items: [{ id: "fake-engine", name: "Fake Engine" }] });
      return;
    }
    if (url.pathname === "/api/opl/modules") {
      sendJson(res, 200, { items: [{ id: "mas", name: "MAS" }] });
      return;
    }
    if (url.pathname === "/api/opl/agents") {
      sendJson(res, 200, { items: [{ id: "agent-local-e2e", name: "Local E2E Agent" }] });
      return;
    }
    if (req.method === "POST" && (url.pathname === "/api/opl/workspaces/bind" || url.pathname === "/api/opl/workspaces")) {
      const payload = body ? JSON.parse(body) : {};
      sendJson(res, 200, {
        workspace: {
          workspaceId: payload.workspaceId || WORKSPACE_ID,
          portalUserId: payload.portalUserId || USER_ID,
          status: "bound",
        },
      });
      return;
    }
    if (req.method === "POST" && url.pathname === "/api/opl/sessions") {
      sendJson(res, 200, {
        session: {
          id: "fake-upstream-opl-session",
          sessionId: "fake-upstream-opl-session",
          status: "created",
        },
      });
      return;
    }
    if (url.pathname === "/api/opl/workspaces") {
      sendJson(res, 200, { items: [{ workspaceId: WORKSPACE_ID, portalUserId: USER_ID, status: "active" }] });
      return;
    }
    if (url.pathname === "/api/opl/sessions") {
      sendJson(res, 200, { items: [{ sessionId: "fake-upstream-opl-session", workspaceId: WORKSPACE_ID, portalUserId: USER_ID }] });
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
    if (req.method === "POST" && [
      "/api/opl/messages",
      "/api/opl/sessions/messages",
      "/api/opl/chat/messages",
    ].includes(url.pathname)) {
      const payload = body ? JSON.parse(body) : {};
      sendJson(res, 200, {
        message: {
          messageId: payload.messageId || "message-v22-local-e2e",
          sessionId: payload.oplSessionId || payload.runtimeSessionId || "",
          runtimeSessionId: payload.runtimeSessionId || "",
          reply: "fake OPL reply for sanitized local e2e",
          source: "fake_opl_product_api",
        },
      });
      return;
    }

    sendJson(res, 404, { ok: false, error: "not_found", path: url.pathname });
  });
}

function startFakePortalInternal(runtimeBridgeUrl, calls) {
  return http.createServer(async (req, res) => {
    const body = await readRequestBody(req);
    const url = new URL(req.url || "/", "http://fake-portal-internal.local");
    calls.push({ method: req.method || "GET", pathname: url.pathname, body });

    if (req.method !== "POST" || url.pathname !== "/internal/opl/auth/login") {
      sendJson(res, 404, { ok: false, error: "not_found" });
      return;
    }

    const payload = body ? JSON.parse(body) : {};
    if (payload.email !== "researcher@example.test" || payload.password !== "Password1!") {
      sendJson(res, 401, { ok: false, error: "invalid_credentials" });
      return;
    }
    if (payload.apiKey !== RAW_PROVIDER_KEY) {
      sendJson(res, 400, { ok: false, error: "provider_api_key_required" });
      return;
    }

    const launchResponse = await fetch(`${runtimeBridgeUrl}/api/opl-launch/tokens`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        portalUserId: USER_ID,
        portalUserEmail: "researcher@example.test",
        portalUserName: "Local E2E User",
        tenantId: TENANT_ID,
        ownerId: USER_ID,
        sessionOwnerId: USER_ID,
        traceOwnerId: USER_ID,
        artifactOwnerId: USER_ID,
        storageOwnerId: USER_ID,
        workspaceId: WORKSPACE_ID,
        workspaceTitle: "Local E2E Workspace",
        workspacePath: "/workspace/local-e2e",
        workspaceSessionId: "workspace-session-v22-local-e2e",
        sourceSurface: "opl-gateway-entry-preflight",
        mode: "full_runtime",
        resourceBindingId: RESOURCE_BINDING_ID,
        computeInstanceId: "compute-v22-local-e2e",
        storageBucketId: "file-space-v22-local-e2e",
        runtimeAgentId: "fake-runtime-agent-v22-local-e2e",
        providerKeyRef: PROVIDER_KEY_REF,
        providerConfigSecretRef: PROVIDER_KEY_REF,
        providerConfig: {
          providerConfigured: true,
          providerConfigStatus: "configured",
          providerKeyRef: PROVIDER_KEY_REF,
          providerConfigSecretRef: PROVIDER_KEY_REF,
          providerName: "gflab",
        },
        selectedServerPlan: {
          id: "starter_2c4g_10gb",
        },
      }),
    });
    const launch = await launchResponse.json();
    if (!launchResponse.ok) {
      sendJson(res, launchResponse.status, launch);
      return;
    }

    sendJson(res, 200, {
      ok: true,
      user: {
        id: USER_ID,
        email: "researcher@example.test",
        name: "Local E2E User",
      },
      launchToken: launch.launchToken,
      launch: {
        ...launch,
        providerKeyRef: PROVIDER_KEY_REF,
      },
      workspace: {
        id: "workspace-v22-local-e2e",
        slug: WORKSPACE_ID,
        title: "Local E2E Workspace",
      },
      workspaceSession: {
        id: "workspace-session-v22-local-e2e",
        workspaceId: WORKSPACE_ID,
      },
      runtimeSession: {
        runtimeSessionId: launch.runtimeSessionId,
        oplSessionId: launch.oplSessionId || "",
      },
    });
  });
}

function spawnService(label, command, args, { env = {}, cwd = process.cwd() } = {}) {
  const childEnv = { ...process.env };
  for (const key of [
    "OPL_PRODUCT_API_TOKEN",
    "MED_AUTOSCIENCE_RUNNER_TOKEN",
    "LANGFUSE_SECRET_KEY",
    "LANGFUSE_PUBLIC_KEY",
    "TENCENTCLOUD_SECRET_ID",
    "TENCENTCLOUD_SECRET_KEY",
  ]) {
    childEnv[key] = "";
  }
  const child = spawn(command, args, {
    cwd,
    env: { ...childEnv, ...env },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const logs = { stdout: "", stderr: "" };
  child.stdout.on("data", (chunk) => { logs.stdout += chunk.toString("utf8"); });
  child.stderr.on("data", (chunk) => { logs.stderr += chunk.toString("utf8"); });
  child.__label = label;
  child.__logs = logs;
  return child;
}

async function stopChild(child) {
  if (!child || child.killed) return;
  child.kill();
  await Promise.race([
    new Promise((resolve) => child.once("exit", resolve)),
    sleep(1500),
  ]);
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    redirect: "manual",
    headers: {
      accept: "application/json",
      ...(options.body ? { "content-type": "application/json" } : {}),
      ...(options.headers || {}),
    },
    ...options,
  });
  const raw = await response.text();
  const payload = raw ? JSON.parse(raw) : {};
  return { response, payload, raw };
}

function cookieFrom(response) {
  const setCookie = response.headers.get("set-cookie") || "";
  const match = setCookie.match(/opl_portal_launch=([^;]+)/);
  assert(match, "gateway_must_set_http_only_launch_cookie");
  assert(setCookie.includes("HttpOnly"), "gateway_launch_cookie_must_be_http_only");
  return `opl_portal_launch=${match[1]}`;
}

function assertNoForbiddenPublicLeak(value, label) {
  const serialized = typeof value === "string" ? value : JSON.stringify(value);
  assert.equal(serialized.includes(RAW_PROVIDER_KEY), false, `${label}_must_not_leak_raw_provider_key`);
  assert.equal(/launchToken|runtimeToken|bearerToken|providerSecret|rawProviderKey|providerApiKey|apiKey/i.test(serialized), false, `${label}_must_not_expose_secret_fields`);
  assert.equal(/storageKey|objectKey|signedUrl|presignedUrl|localPath|pathOnRuntime/i.test(serialized), false, `${label}_must_not_expose_internal_storage_fields`);
}

function assertNoUpstreamSecretLeak(calls, label) {
  for (const call of calls) {
    assert.equal(String(call.authorization || "").trim(), "", `${label}_must_not_receive_authorization`);
    assert.equal(String(call.search || "").includes("launchToken"), false, `${label}_must_not_receive_launch_token_query`);
    assert.equal(String(call.search || "").includes("launch_token"), false, `${label}_must_not_receive_launch_token_query`);
    assert.equal(String(call.search || "").includes("apiKey"), false, `${label}_must_not_receive_api_key_query`);
    assert.equal(String(call.body || "").includes(RAW_PROVIDER_KEY), false, `${label}_must_not_receive_raw_provider_key`);
    assert.equal(/runtimeEnv|OPL_CODEX_API_KEY|OPENAI_API_KEY|GFLABTOKEN|experimental_bearer_token/i.test(String(call.body || "")), false, `${label}_must_not_receive_runtime_secret_env`);
  }
}

function paginateRows(rows = [], page = 1, pageSize = 10) {
  const normalizedPage = Math.max(1, Number(page || 1));
  const normalizedPageSize = Math.max(1, Number(pageSize || 10));
  const start = (normalizedPage - 1) * normalizedPageSize;
  return {
    rows: rows.slice(start, start + normalizedPageSize),
    page: normalizedPage,
    pageSize: normalizedPageSize,
    total: rows.length,
    totalPages: Math.max(1, Math.ceil(rows.length / normalizedPageSize)),
  };
}

const tempRoot = await mkdtemp(path.join(os.tmpdir(), "v22-opl-runtime-e2e-local-"));
const runtimeStateRoot = path.join(tempRoot, "runtime-state");
const providerSecretRoot = path.join(tempRoot, "provider-secrets");
const fakeUpstreamCalls = [];
const fakeProductApiCalls = [];
const fakePortalCalls = [];
const fakeUpstream = startFakeUpstreamWeb(fakeUpstreamCalls);
const fakeProductApi = startFakeOplProductApi(fakeProductApiCalls);
let fakePortal = null;
let runtimeBridge = null;
let gateway = null;

try {
  const [upstreamPort, productApiPort, runtimePort, gatewayPort] = await Promise.all([
    listen(fakeUpstream),
    listen(fakeProductApi),
    freePort(),
    freePort(),
  ]);
  const runtimeBridgeUrl = `http://127.0.0.1:${runtimePort}`;
  const gatewayUrl = `http://127.0.0.1:${gatewayPort}`;

  runtimeBridge = spawnService("runtime-bridge", process.execPath, ["services/opl-runtime-bridge/src/server.mjs"], {
    env: {
      PORT: String(runtimePort),
      NODE_ENV: "development",
      PORTAL_RUNTIME_BRIDGE_PUBLIC_URL: runtimeBridgeUrl,
      PORTAL_RUNTIME_BRIDGE_STATE_ROOT: runtimeStateRoot,
      PORTAL_OPL_PROVIDER_SECRET_ROOT: providerSecretRoot,
      OPL_PRODUCT_API_URL: `http://127.0.0.1:${productApiPort}`,
      OPL_WEB_URL: gatewayUrl,
      OPL_RUNTIME_BRIDGE_LOCAL_FAKE_RUNTIME: "1",
      PRODUCT_RUNTIME_MODE: "platform_provisioned",
    },
  });
  await waitFor(`${runtimeBridgeUrl}/healthz`);

  fakePortal = startFakePortalInternal(runtimeBridgeUrl, fakePortalCalls);
  const fakePortalPort = await listen(fakePortal);

  gateway = spawnService("opl-web-gateway", process.execPath, ["services/opl-web-gateway/src/server.mjs"], {
    env: {
      PORT: String(gatewayPort),
      OPL_WEB_GATEWAY_PUBLIC_URL: gatewayUrl,
      OPL_UPSTREAM_URL: `http://127.0.0.1:${upstreamPort}`,
      PORTAL_INTERNAL_URL: `http://127.0.0.1:${fakePortalPort}`,
      PORTAL_RUNTIME_BRIDGE_URL: runtimeBridgeUrl,
      PORTAL_PUBLIC_URL: "https://portal.medopl.cn",
    },
  });
  await waitFor(`${gatewayUrl}/healthz`);

  const initialHtml = await fetch(`${gatewayUrl}/`);
  assert.equal(initialHtml.status, 200, "gateway_must_proxy_fake_upstream_html");
  const html = await initialHtml.text();
  assert(html.includes("clean fake upstream OPL Web"), "gateway_html_must_include_fake_upstream_web");
  assert(html.includes("/portal-launch.js"), "gateway_must_inject_launch_client_script");

  const login = await fetchJson(`${gatewayUrl}/login`, {
    method: "POST",
    body: JSON.stringify({
      email: "researcher@example.test",
      password: "Password1!",
      apiKey: RAW_PROVIDER_KEY,
      mode: "full_runtime",
      workspaceId: WORKSPACE_ID,
      resourceBindingId: RESOURCE_BINDING_ID,
      redirectTo: "/",
    }),
  });
  assert.equal(login.response.status, 200, "gateway_native_login_must_succeed");
  assert.equal(login.payload.success, true, "gateway_native_login_success_mismatch");
  assertNoForbiddenPublicLeak(login.payload, "gateway_native_login_response");
  const launchCookie = cookieFrom(login.response);

  const proxiedHtmlResponse = await fetch(`${gatewayUrl}/`, {
    headers: { cookie: launchCookie },
  });
  assert.equal(proxiedHtmlResponse.status, 200, "gateway_cookie_html_proxy_must_succeed");
  assert((await proxiedHtmlResponse.text()).includes("clean fake upstream OPL Web"), "gateway_cookie_proxy_must_still_reach_fake_upstream");

  const bootstrap = await fetchJson(`${gatewayUrl}/runtime-bridge/api/opl-launch/bootstrap`, {
    headers: { cookie: launchCookie },
  });
  assert.equal(bootstrap.response.status, 200, "gateway_runtime_bridge_bootstrap_must_succeed");
  assert.equal(bootstrap.payload.identity.workspaceId, WORKSPACE_ID, "bootstrap_workspace_mismatch");
  assert.equal(bootstrap.payload.identity.portalUserId, USER_ID, "bootstrap_user_mismatch");
  assertNoForbiddenPublicLeak(bootstrap.payload, "gateway_runtime_bridge_bootstrap_response");

  const bound = await fetchJson(`${gatewayUrl}/runtime-bridge/api/opl-launch/sessions/bind`, {
    method: "POST",
    headers: { cookie: launchCookie },
    body: JSON.stringify({
      oplSessionId: "opl-session-v22-local-e2e",
      provider: "gflabtoken",
      source: "user_input",
      apiKey: RAW_PROVIDER_KEY,
      status: "ready",
    }),
  });
  assert.equal(bound.response.status, 200, "runtime_session_bind_must_succeed");
  assert.equal(bound.payload.ok, true, "runtime_session_bind_ok_mismatch");
  assert.equal(bound.payload.runtimeSession.providerConfigured, true, "runtime_session_provider_must_be_configured");
  assertNoForbiddenPublicLeak(bound.payload, "runtime_session_bind_response");

  const message = await fetchJson(`${gatewayUrl}/runtime-bridge/api/opl-launch/messages`, {
    method: "POST",
    headers: { cookie: launchCookie },
    body: JSON.stringify({
      messageId: "message-v22-local-e2e",
      message: RAW_PROMPT,
      waitForCompletion: true,
      tokenCount: 23,
    }),
  });
  assert.equal(message.response.status, 200, "runtime_message_must_succeed");
  assert.equal(message.payload.ok, true, "runtime_message_ok_mismatch");
  assert.equal(message.payload.message.messageId, "message-v22-local-e2e", "runtime_message_id_mismatch");
  assert.equal(message.payload.artifact.kind, "message_reply", "runtime_message_artifact_kind_mismatch");
  assertNoForbiddenPublicLeak(message.payload, "runtime_message_response");

  const run = await fetchJson(`${gatewayUrl}/runtime-bridge/api/opl-launch/runs`, {
    method: "POST",
    headers: { cookie: launchCookie },
    body: JSON.stringify({
      mode: "full_runtime",
      runId: "run-v22-local-e2e",
      traceId: "trace-run-v22-local-e2e",
      runtimeSessionId: bound.payload.runtimeSession.runtimeSessionId,
      workspaceId: WORKSPACE_ID,
      resourceBindingId: RESOURCE_BINDING_ID,
      computeInstanceId: "compute-v22-local-e2e",
      storageBucketId: "file-space-v22-local-e2e",
      runtimeAgentId: "fake-runtime-agent-v22-local-e2e",
      providerKeyRef: PROVIDER_KEY_REF,
      message: "run with uploaded workspace file reference",
      fileRefs: [INPUT_FILE_REF],
      toolName: "opl-local-e2e",
    }),
  });
  assert.equal(run.response.status, 200, "runtime_run_must_succeed");
  assert.equal(run.payload.ok, true, "runtime_run_ok_mismatch");
  assert.equal(run.payload.run.runId, "run-v22-local-e2e", "runtime_run_id_mismatch");
  assert.equal(run.payload.run.providerKeyRef, PROVIDER_KEY_REF, "runtime_run_provider_ref_mismatch");
  assert.equal(run.payload.run.artifacts.length, 1, "runtime_run_must_return_public_artifact");
  assert.equal(run.payload.run.artifacts[0].artifactRef, run.payload.run.artifacts[0].artifactId, "runtime_run_artifact_ref_mismatch");
  assertNoForbiddenPublicLeak(run.payload, "runtime_run_response");

  const runtimeBridgeClient = createRuntimeBridgeClient({
    runtimeBridgeUrl: runtimeBridgeUrl,
    oplWebUrl: gatewayUrl,
    timeoutMs: 5000,
    formatDateTime: (value) => String(value || ""),
  });
  const runtimeBridgeTraceRows = await runtimeBridgeClient.fetchTraceRows({ userId: USER_ID, workspaceId: WORKSPACE_ID, limit: 20 });
  assert.equal(runtimeBridgeTraceRows.source, "runtime_bridge", "runtime_bridge_trace_source_mismatch");
  assert(runtimeBridgeTraceRows.rows.length >= 2, "runtime_bridge_trace_rows_must_include_message_and_run_traces");
  assert(runtimeBridgeTraceRows.rows.some((item) => item.runId === "message-v22-local-e2e"), "runtime_bridge_trace_must_include_message_trace");
  assert(runtimeBridgeTraceRows.rows.some((item) => item.runId === "run-v22-local-e2e"), "runtime_bridge_trace_must_include_run_trace");
  assertNoForbiddenPublicLeak(runtimeBridgeTraceRows, "runtime_bridge_trace_rows");

  const portalTracePayload = await buildSessionTracesApiPayload({
    fetchTraceRows: async () => ({ source: "langfuse_sanitized_projection", type: "status_only", rows: [] }),
    fetchRuntimeBridgeTraceRows: runtimeBridgeClient.fetchTraceRows,
    parsePositiveInt: (value, fallback) => Number(value || fallback),
    paginateRows,
    normalizePageSize: (value) => Number(value || 10),
    findTaskSpace: () => ({ slug: WORKSPACE_ID, userId: USER_ID }),
    fetchWorkspaceStorageSnapshot: async () => ({
      inputsCount: 1,
      outputsCount: 2,
      outputs: [{ name: "result.md", sizeBytes: 128 }],
    }),
    fetchBillingSummary: async () => ({ source: "local_e2e", items: [] }),
  }, {
    users: [{ id: USER_ID, email: "researcher@example.test", name: "Local E2E User" }],
    taskSpaces: [{ slug: WORKSPACE_ID, userId: USER_ID }],
  }, {
    id: USER_ID,
    email: "researcher@example.test",
    name: "Local E2E User",
    role: "user",
  }, {
    workspaceId: WORKSPACE_ID,
    limit: 20,
    pageSize: 20,
  });
  assert.equal(portalTracePayload.dataSource, "portal_session_traces", "portal_trace_payload_source_mismatch");
  assert(portalTracePayload.items.length >= 2, "portal_trace_must_include_message_and_run_traces");
  assert(portalTracePayload.items.every((item) => item.taskRef), "portal_trace_items_must_include_public_task_ref");
  assert.equal(JSON.stringify(portalTracePayload).includes('"runId"'), false, "portal_trace_payload_must_not_expose_run_id_field");
  assert.equal(collectValues(portalTracePayload).includes("message-v22-local-e2e"), false, "portal_trace_payload_must_not_expose_message_run_id_value");
  assert.equal(collectValues(portalTracePayload).includes("run-v22-local-e2e"), false, "portal_trace_payload_must_not_expose_run_id_value");
  assertNoForbiddenPublicLeak(portalTracePayload, "portal_trace_payload");

  assertNoUpstreamSecretLeak(fakeUpstreamCalls, "fake_upstream_web");
  assertNoUpstreamSecretLeak(fakeProductApiCalls, "fake_opl_product_api");
  assertNoForbiddenPublicLeak(runtimeBridge.__logs.stdout, "runtime_bridge_stdout");
  assertNoForbiddenPublicLeak(runtimeBridge.__logs.stderr, "runtime_bridge_stderr");
  assertNoForbiddenPublicLeak(gateway.__logs.stdout, "gateway_stdout");
  assertNoForbiddenPublicLeak(gateway.__logs.stderr, "gateway_stderr");

  console.log(JSON.stringify({
    ok: true,
    contract: "v22_opl_runtime_e2e_local_flow",
    covered: [
      "portal_opl_entry_preflight",
      "opl_gateway_proxy_clean_fake_upstream",
      "gateway_runtime_bridge_bootstrap",
      "message_file_run_runtime_bridge",
      "portal_session_trace_metadata",
      "secret_token_upstream_pollution_guard",
    ],
    messageId: message.payload.message.messageId,
    runId: run.payload.run.runId,
    traceRows: portalTracePayload.items.length,
  }, null, 2));
} finally {
  await stopChild(gateway);
  await stopChild(runtimeBridge);
  if (fakePortal) await close(fakePortal);
  await close(fakeUpstream);
  await close(fakeProductApi);
  await rm(tempRoot, { recursive: true, force: true });
}
