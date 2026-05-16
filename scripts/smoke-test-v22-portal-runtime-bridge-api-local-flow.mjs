import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import http from "node:http";
import net from "node:net";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

import { createRuntimeBridgeClient } from "../services/portal/src/integrations/runtime-bridge-client.mjs";
import { createOplRoutes } from "../services/portal/src/routes/opl.routes.mjs";

const RAW_PROVIDER_KEY = "gflabtoken_raw_key_backend_only_v22_runtime_bridge_api";
const USER_ID = "user-v22-runtime-bridge-api";
const TENANT_ID = "tenant-v22-runtime-bridge-api";
const WORKSPACE_ID = "workspace-v22-runtime-bridge-api";
const WORKSPACE_SESSION_ID = "workspace-session-v22-runtime-bridge-api";
const RESOURCE_BINDING_ID = "binding-v22-runtime-bridge-api";
const PROVIDER_KEY_REF = "provider-key-ref-v22-runtime-bridge-api";
const RUNTIME_AGENT_ID = "runtime-agent-v22-runtime-bridge-api";
const STABLE_MESSAGE_STATUS_PATH_PREFIX = "/runtime-bridge/api/opl/messages/";
const PORTAL_LAUNCH_ID = "portal-proxy-launch-v22-runtime-bridge-api";
const REQUIRED_BOOTSTRAP_PRODUCT_API_CALLS = [
  "GET /api/health",
  "GET /api/opl/system",
  "GET /api/opl/engines",
  "GET /api/opl/modules",
  "GET /api/opl/agents",
  "GET /api/opl/workspaces",
  "GET /api/opl/sessions",
  "GET /api/opl/progress",
  "GET /api/opl/artifacts",
];

function assertNoSecretLeak(value, label) {
  const serialized = JSON.stringify(value || {});
  assert.equal(
    /gflabtoken_raw_key|rawProviderKey|providerApiKey|apiKey|launchToken|runtimeToken|bearerToken|objectKey|storageKey|localPath|signedUrl/i.test(serialized),
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

async function readRequestBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return chunks.length ? Buffer.concat(chunks).toString("utf8") : "";
}

function sendJson(res, status, payload) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload, null, 2));
}

function childOutputPush(child, streamName, chunk) {
  const key = `${streamName}Tail`;
  child[key] = `${child[key] || ""}${chunk}`;
  if (child[key].length > 8000) child[key] = child[key].slice(-8000);
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
      sendJson(res, 200, { ok: true, service: "fake-clean-opl-product-api" });
      return;
    }
    if (url.pathname === "/api/opl/system") {
      sendJson(res, 200, { system: { id: "fake-clean-opl", status: "ready" } });
      return;
    }
    if (url.pathname === "/api/opl/engines") {
      sendJson(res, 200, { items: [{ id: "engine-local", name: "Local Engine" }] });
      return;
    }
    if (url.pathname === "/api/opl/modules") {
      sendJson(res, 200, { items: [{ id: "mas", name: "MAS" }] });
      return;
    }
    if (url.pathname === "/api/opl/agents") {
      sendJson(res, 200, { items: [{ id: "agent-local", name: "Local Agent" }] });
      return;
    }
    if (req.method === "POST" && (url.pathname === "/api/opl/workspaces/bind" || url.pathname === "/api/opl/workspaces")) {
      const payload = body ? JSON.parse(body) : {};
      assertNoSecretLeak(payload, "upstream_workspace_bind");
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
      const payload = body ? JSON.parse(body) : {};
      assertNoSecretLeak(payload, "upstream_session_create");
      sendJson(res, 200, {
        session: {
          sessionId: "fake-upstream-opl-session",
          workspaceId: payload.workspaceId || WORKSPACE_ID,
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
      assertNoSecretLeak(payload, "upstream_message");
      sendJson(res, 200, {
        message: {
          messageId: payload.messageId || "message-v22-runtime-bridge-api",
          sessionId: payload.oplSessionId || payload.runtimeSessionId || "",
          runtimeSessionId: payload.runtimeSessionId || "",
          reply: "fake OPL reply for stable Runtime Bridge API",
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
    res.end("<!doctype html><html><body><main>clean fake OPL Web</main></body></html>");
  });
}

function spawnNode(script, { port, env, stateRoot }) {
  const child = spawn(process.execPath, [script], {
    cwd: path.resolve("."),
    env: {
      ...process.env,
      PORT: String(port),
      PORTAL_RUNTIME_BRIDGE_STATE_ROOT: stateRoot,
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

async function stopChild(child) {
  if (!child || child.killed) return;
  child.kill();
  await Promise.race([
    new Promise((resolve) => child.once("exit", resolve)),
    sleep(1500),
  ]);
}

async function waitFor(url, { allowStatus = (status) => status < 500 } = {}) {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    try {
      const response = await fetch(url, { redirect: "manual" });
      if (allowStatus(response.status)) return response;
    } catch {}
    await sleep(100);
  }
  throw new Error(`timeout_waiting_for:${url}`);
}

function cookieHeaderFrom(response) {
  const setCookie = response.headers.get("set-cookie") || "";
  assert(setCookie.includes("opl_portal_launch="), "launch_response_must_set_http_only_launch_cookie");
  assert(setCookie.includes("HttpOnly"), "launch_cookie_must_be_http_only");
  return setCookie.split(";")[0];
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

async function waitForJson(url, {
  cookie = "",
  expectedStatus = 200,
  acceptJson = () => true,
  label = "wait_for_json",
} = {}) {
  let last = null;
  for (let attempt = 0; attempt < 80; attempt += 1) {
    last = await getJson(url, { cookie });
    if (last.response.status === expectedStatus && acceptJson(last.json)) return last;
    await sleep(100);
  }
  assert.fail(`${label}: expected status ${expectedStatus}; last status=${last?.response?.status}; payload=${JSON.stringify(last?.json || {})}`);
}

function assertStatus(result, expectedStatus, label, diagnostics = {}) {
  if (result.response.status === expectedStatus) return;
  assert.fail(`${label}: expected ${expectedStatus}, got ${result.response.status}; payload=${JSON.stringify(result.json || {})}; diagnostics=${JSON.stringify(diagnostics)}`);
}

async function readRuntimeBridgeState(stateRoot) {
  return JSON.parse(await readFile(path.join(stateRoot, "state.json"), "utf8"));
}

function assertProductApiObserved(calls, required, label) {
  const observed = new Set(calls.map((call) => `${call.method} ${call.pathname}`));
  for (const item of required) {
    assert(observed.has(item), `${label}_missing_product_api_call:${item}`);
  }
}

function productCallsFor(calls, method, pathname) {
  return calls.filter((call) => call.method === method && call.pathname === pathname);
}

function parsedCallBody(call) {
  return call?.body ? JSON.parse(call.body) : {};
}

function assertEvent(state, type, predicate, label) {
  assert((state.events || []).some((event) => event.type === type && predicate(event)), `${label}_missing_event:${type}`);
}

function assertRuntimeSessionBackflow(state, label) {
  const runtimeSession = (state.runtimeSessions || []).find((item) => item.runtimeSessionId && item.workspaceId === WORKSPACE_ID);
  assert(runtimeSession, `${label}_runtime_session_missing`);
  assert.equal(runtimeSession.portalUserId, USER_ID, `${label}_runtime_session_user_mismatch`);
  assert.equal(runtimeSession.tenantId, TENANT_ID, `${label}_runtime_session_tenant_mismatch`);
  assert.equal(runtimeSession.workspaceId, WORKSPACE_ID, `${label}_runtime_session_workspace_mismatch`);
  assert.equal(runtimeSession.workspaceSessionId, WORKSPACE_SESSION_ID, `${label}_runtime_session_workspace_session_mismatch`);
  assert.equal(runtimeSession.resourceBindingId, RESOURCE_BINDING_ID, `${label}_runtime_session_resource_binding_mismatch`);
  assert.equal(runtimeSession.providerKeyRef, PROVIDER_KEY_REF, `${label}_runtime_session_provider_key_ref_mismatch`);
  return runtimeSession;
}

function assertMessageBackflow(state, messageId, label) {
  const request = (state.messageRequests || []).find((item) => item.messageId === messageId);
  const reply = (state.messageReplies || []).find((item) => item.messageId === messageId);
  const artifact = (state.artifacts || []).find((item) => item.runId === messageId && item.kind === "message_reply");
  const trace = (state.traceLinks || []).find((item) => item.runId === messageId && item.traceName === "OPL message reply");
  assert(request, `${label}_message_request_missing`);
  assert.equal(request.status, "succeeded", `${label}_message_request_status_mismatch`);
  assert.equal(request.workspaceId, WORKSPACE_ID, `${label}_message_request_workspace_mismatch`);
  assert.equal(request.providerKeyRef, PROVIDER_KEY_REF, `${label}_message_request_provider_key_ref_mismatch`);
  assert(reply, `${label}_message_reply_missing`);
  assert.equal(reply.source, "fake_opl_product_api", `${label}_message_reply_source_mismatch`);
  assert(artifact?.artifactId, `${label}_message_reply_artifact_missing`);
  assert(trace?.traceId, `${label}_message_trace_missing`);
  return { request, reply, artifact, trace };
}

function assertInputFileBackflow(state, fileRef, label) {
  const artifact = (state.artifacts || []).find((item) => item.artifactId === fileRef);
  assert(artifact, `${label}_input_file_artifact_missing`);
  assert.equal(artifact.kind, "inputs", `${label}_input_file_kind_mismatch`);
  assert.equal(artifact.workspaceId, WORKSPACE_ID, `${label}_input_file_workspace_mismatch`);
  assert.equal(artifact.resourceBindingId, RESOURCE_BINDING_ID, `${label}_input_file_resource_binding_mismatch`);
  assert.equal(artifact.providerKeyRef, PROVIDER_KEY_REF, `${label}_input_file_provider_key_ref_mismatch`);
  assert.equal(artifact.relativePath, "inputs/runtime-bridge-api-input.csv", `${label}_input_file_relative_path_mismatch`);
  return artifact;
}

function assertRunBackflow(state, runPayload, label) {
  const run = (state.runs || []).find((item) => item.runId === runPayload.run.runId);
  const artifact = (state.artifacts || []).find((item) => item.artifactId === runPayload.artifacts[0].artifactRef);
  const ledger = (state.sessionLedgerEntries || []).find((item) => item.runId === runPayload.run.runId);
  const trace = (state.traceLinks || []).find((item) => item.runId === runPayload.run.runId && item.traceName === "OPL runtime run");
  assert(run, `${label}_run_record_missing`);
  assert.equal(run.status, "succeeded", `${label}_run_status_mismatch`);
  assert.equal(run.workspaceId, WORKSPACE_ID, `${label}_run_workspace_mismatch`);
  assert.equal(run.resourceBindingId, RESOURCE_BINDING_ID, `${label}_run_resource_binding_mismatch`);
  assert.equal(run.providerKeyRef, PROVIDER_KEY_REF, `${label}_run_provider_key_ref_mismatch`);
  assert(artifact, `${label}_run_artifact_missing`);
  assert.equal(artifact.runId, run.runId, `${label}_run_artifact_run_mismatch`);
  assert.equal(artifact.relativePath, `outputs/${run.runId}/${run.runId}-result.md`, `${label}_run_artifact_must_come_from_runtime_relay`);
  assert(ledger, `${label}_run_ledger_missing`);
  assert.equal(ledger.eventType, "runtime_run_succeeded", `${label}_run_ledger_event_mismatch`);
  assert(trace?.traceId, `${label}_run_trace_missing`);
  return { run, artifact, ledger, trace };
}

async function assertPortalProxyRejectsCrossUserLaunch() {
  const calls = [];
  const handler = createOplRoutes({
    appendCookie: () => {},
    layoutV2: (_title, body) => body,
    logPortalEvent: async () => {},
    runtimeBridgeClient: {
      async requestRuntimeBridgeApi(input) {
        calls.push(input);
        return { ok: true, leaked: true };
      },
    },
    oplLaunchService: {
      getLaunchStatus: () => ({
        ok: true,
        userId: "launch-owner-user",
        launch: {
          launchToken: "owner-only-launch-token",
          launchId: "launch-owned-by-someone-else",
        },
      }),
    },
    readBody: async () => Buffer.from(""),
    sendHtml: () => {},
    sendJson: (res, payload, status = 200) => {
      res.statusCode = status;
      res.payload = payload;
    },
    slugify: (value) => String(value || "default"),
    workspaceSessionCookie: () => "workspace_session",
  });
  const res = {};
  const handled = await handler({
    req: { method: "GET" },
    res,
    url: new URL("http://portal.local/portal/api/opl/bootstrap?launchId=launch-owned-by-someone-else"),
    db: {},
    user: { id: "different-portal-user" },
  });
  assert.equal(handled, true, "portal_opl_proxy_must_handle_bootstrap_request");
  assert.equal(res.statusCode, 404, "portal_opl_proxy_must_reject_cross_user_launch_id");
  assert.equal(res.payload?.error, "opl_launch_status_not_found", "portal_opl_proxy_cross_user_error_mismatch");
  assert.equal(calls.length, 0, "portal_opl_proxy_must_not_call_runtime_bridge_for_cross_user_launch_id");
}

await assertPortalProxyRejectsCrossUserLaunch();

async function assertPortalLaunchResponseIsPublicOnly() {
  const handler = createOplRoutes({
    appendCookie: () => {},
    layoutV2: (_title, body) => body,
    logPortalEvent: async () => {},
    runtimeBridgeClient: {},
    oplLaunchService: {
      async prepareLaunchForIntent() {
        return {
          ok: true,
          launchId: "portal-public-launch-id",
          taskSpace: { slug: WORKSPACE_ID, title: "Runtime Bridge API Workspace" },
          workspaceSession: { id: WORKSPACE_SESSION_ID, workspaceId: WORKSPACE_ID },
          launch: {
            launchId: "runtime-bridge-launch-id-must-not-be-public-primary",
            launchToken: "portal-launch-token-must-stay-cookie-only",
            oplWebUrl: "http://opl.local/workspace",
            runtimeUrl: "https://github.com/gaofeng21cn/one-person-lab",
            workspaceId: WORKSPACE_ID,
            workspaceSessionId: WORKSPACE_SESSION_ID,
            runtimeSessionId: "runtime-session-public-only",
            oplSessionId: "opl-session-public-only",
            providerKeyRef: PROVIDER_KEY_REF,
            providerConfigSecretRef: "backend-secret-ref-must-not-be-public",
            nodePoolId: "internal-node-pool-must-not-be-public",
            tkeClusterId: "internal-cluster-must-not-be-public",
          },
        };
      },
    },
    readBody: async () => Buffer.from(JSON.stringify({ workspaceId: WORKSPACE_ID })),
    sendHtml: () => {},
    sendJson: (res, payload, status = 200) => {
      res.statusCode = status;
      res.payload = payload;
    },
    slugify: (value) => String(value || "default"),
    workspaceSessionCookie: () => "workspace_session",
  });
  const res = {};
  const handled = await handler({
    req: { method: "POST" },
    res,
    url: new URL("http://portal.local/portal/api/opl/launch"),
    db: {},
    user: { id: USER_ID, currentTaskSlug: WORKSPACE_ID },
  });
  assert.equal(handled, true, "portal_launch_api_must_handle_request");
  assert.equal(res.statusCode, 200, "portal_launch_api_must_return_200");
  assert.equal(res.payload?.launchId, "portal-public-launch-id", "portal_launch_response_must_use_portal_launch_id");
  assert.equal(res.payload?.launch?.launchId, "portal-public-launch-id", "portal_launch_nested_response_must_use_portal_launch_id");
  assertNoSecretLeak(res.payload, "portal_launch_public_response");
  const serialized = JSON.stringify(res.payload || {});
  assert.equal(serialized.includes("runtime-bridge-launch-id-must-not-be-public-primary"), false, "portal_launch_response_must_not_use_runtime_bridge_launch_id_as_primary");
  assert.equal(serialized.includes("providerConfigSecretRef"), false, "portal_launch_response_must_not_expose_secret_ref_field");
  assert.equal(serialized.includes("nodePoolId"), false, "portal_launch_response_must_not_expose_internal_node_pool");
  assert.equal(serialized.includes("tkeClusterId"), false, "portal_launch_response_must_not_expose_internal_cluster");
}

async function assertRuntimeBridgeClientRestrictsStableOplApiPaths() {
  const runtimeBridgeClient = createRuntimeBridgeClient({
    runtimeBridgeUrl: "http://127.0.0.1:1",
    oplWebUrl: "http://opl.local",
    timeoutMs: 50,
    formatDateTime: (value) => value,
  });
  await assert.rejects(
    () => runtimeBridgeClient.requestRuntimeBridgeApi({ path: "/api/runs", launchToken: "internal-launch-token" }),
    /runtime_bridge_api_path_not_allowed/,
    "runtime_bridge_client_must_reject_non_stable_opl_api_path",
  );
}

await assertPortalLaunchResponseIsPublicOnly();
await assertRuntimeBridgeClientRestrictsStableOplApiPaths();

function createPortalProxyHandler({ runtimeBridgeUrl, launchToken }) {
  return createOplRoutes({
    appendCookie: () => {},
    layoutV2: (_title, body) => body,
    logPortalEvent: async () => {},
    runtimeBridgeClient: createRuntimeBridgeClient({
      runtimeBridgeUrl,
      oplWebUrl: "http://gateway.local",
      timeoutMs: 3000,
      formatDateTime: (value) => value,
    }),
    oplLaunchService: {
      getLaunchStatus: (launchId) => launchId === PORTAL_LAUNCH_ID
        ? {
            ok: true,
            userId: USER_ID,
            launch: {
              launchId: PORTAL_LAUNCH_ID,
              launchToken,
            },
          }
        : null,
    },
    readBody: async (req) => {
      const text = req?.bodyText || "";
      return Buffer.from(text, "utf8");
    },
    sendHtml: () => {},
    sendJson: (res, payload, status = 200) => {
      res.statusCode = status;
      res.payload = payload;
    },
    slugify: (value) => String(value || "default"),
    workspaceSessionCookie: () => "workspace_session",
  });
}

async function callPortalProxy(handler, { method, path: requestPath, body = null, userId = USER_ID }) {
  const res = {};
  const handled = await handler({
    req: { method, bodyText: body ? JSON.stringify(body) : "" },
    res,
    url: new URL(`http://portal.local${requestPath}`),
    db: {},
    user: { id: userId, currentTaskSlug: WORKSPACE_ID },
  });
  assert.equal(handled, true, `portal_proxy_must_handle:${method}:${requestPath}`);
  return { status: res.statusCode, payload: res.payload };
}

const tempRoot = await mkdtemp(path.join(os.tmpdir(), "v22-runtime-bridge-api-"));
const productCalls = [];
const productApi = startFakeOplProductApi(productCalls);
const upstreamWeb = startFakeUpstreamWeb();
let runtimeBridge;
let gateway;

try {
  const productApiPort = await listen(productApi);
  const upstreamWebPort = await listen(upstreamWeb);
  const runtimeBridgePort = await freePort();
  const gatewayPort = await freePort();
  const stateRoot = path.join(tempRoot, "runtime-bridge-state");
  const runtimeBridgeUrl = `http://127.0.0.1:${runtimeBridgePort}`;
  const gatewayUrl = `http://127.0.0.1:${gatewayPort}`;

  runtimeBridge = spawnNode("services/opl-runtime-bridge/src/server.mjs", {
    port: runtimeBridgePort,
    stateRoot,
    env: {
      PORTAL_RUNTIME_BRIDGE_PUBLIC_URL: runtimeBridgeUrl,
      OPL_WEB_URL: gatewayUrl,
      OPL_PRODUCT_API_URL: `http://127.0.0.1:${productApiPort}`,
      OPL_RUNTIME_BRIDGE_LOCAL_FAKE_RUNTIME: "1",
      PRODUCT_RUNTIME_MODE: "platform_provisioned",
    },
  });

  gateway = spawnNode("services/opl-web-gateway/src/server.mjs", {
    port: gatewayPort,
    stateRoot,
    env: {
      OPL_WEB_GATEWAY_PUBLIC_URL: gatewayUrl,
      OPL_UPSTREAM_URL: `http://127.0.0.1:${upstreamWebPort}`,
      PORTAL_RUNTIME_BRIDGE_URL: runtimeBridgeUrl,
      PORTAL_PUBLIC_URL: "http://portal.local",
    },
  });

  await waitFor(`${runtimeBridgeUrl}/healthz`);
  await waitFor(`${gatewayUrl}/healthz`);

  const { response: launchResponse, json: launch } = await postJson(`${runtimeBridgeUrl}/api/opl-launch/tokens`, {
    portalUserId: USER_ID,
    portalUserEmail: "researcher@example.test",
    portalUserName: "Runtime Bridge API User",
    tenantId: TENANT_ID,
    ownerId: USER_ID,
    sessionOwnerId: USER_ID,
    traceOwnerId: USER_ID,
    artifactOwnerId: USER_ID,
    storageOwnerId: USER_ID,
    workspaceId: WORKSPACE_ID,
    workspaceTitle: "Runtime Bridge API Workspace",
    workspacePath: "/workspace/runtime-bridge-api",
    workspaceSessionId: WORKSPACE_SESSION_ID,
    sourceSurface: "portal-control-plane",
    mode: "full_runtime",
    resourceBindingId: RESOURCE_BINDING_ID,
    computeInstanceId: "compute-v22-runtime-bridge-api",
    storageBucketId: "storage-v22-runtime-bridge-api",
    runtimeAgentId: RUNTIME_AGENT_ID,
    providerConfig: {
      providerConfigured: true,
      providerConfigStatus: "configured",
      providerKeyRef: PROVIDER_KEY_REF,
      providerConfigSecretRef: PROVIDER_KEY_REF,
      providerName: "gflab",
    },
    providerConfigSecretRef: PROVIDER_KEY_REF,
    providerKeyPayload: {
      provider: "gflabtoken",
      source: "user_input",
      apiKey: RAW_PROVIDER_KEY,
    },
  });
  assert.equal(launchResponse.status, 200, "launch_must_return_200");
  assert.equal(launch.ok, true, "launch_must_succeed");
  assert(launch.launchToken, "internal_runtime_bridge_launch_token_required");
  assertNoSecretLeak({
    openUrl: launch.openUrl,
    oplWebUrl: launch.oplWebUrl,
    bootstrapUrl: launch.bootstrapUrl,
  }, "launch_public_urls");
  assert.equal(new URL(launch.oplWebUrl).searchParams.has("launch_token"), false, "opl_web_url_must_not_include_launch_token_query");
  assert.equal(String(launch.bootstrapUrl || "").includes("launch_token"), false, "bootstrap_url_must_not_include_launch_token_query");

  const cookie = cookieHeaderFrom(launchResponse);
  const portalProxy = createPortalProxyHandler({ runtimeBridgeUrl, launchToken: launch.launchToken });

  const unauthorizedBootstrap = await getJson(`${gatewayUrl}/runtime-bridge/api/opl/bootstrap`);
  assert.equal(unauthorizedBootstrap.response.status, 401, "stable_bootstrap_without_cookie_must_return_401");
  const queryTokenBootstrap = await getJson(`${runtimeBridgeUrl}/api/opl/bootstrap?launch_token=${encodeURIComponent(launch.launchToken)}`);
  assert.equal(queryTokenBootstrap.response.status, 401, "runtime_bridge_must_reject_launch_token_query");
  const bodyTokenBind = await postJson(`${runtimeBridgeUrl}/api/opl/sessions/bind`, {
    launchToken: launch.launchToken,
    oplSessionId: "body-token-must-not-bind",
  });
  assert.equal(bodyTokenBind.response.status, 401, "runtime_bridge_must_reject_launch_token_body");

  const status = await getJson(`${gatewayUrl}/runtime-bridge/api/opl/status`, { cookie });
  assert.equal(status.response.status, 200, "stable_runtime_bridge_status_must_return_200");
  assert.equal(status.json.runtimeBridgeContractVersion, "v22.portal-opl-context-backflow.v1", "runtime_bridge_contract_version_mismatch");
  assert.equal(status.json.capabilities?.contextBootstrap?.status, "supported", "runtime_bridge_status_must_include_context_bootstrap_capability");
  assert.equal(status.json.capabilities?.runIntent?.status, "requires_runtime_agent", "runtime_bridge_status_must_gate_run_intent_to_downstream_runtime");
  assert.equal(status.json.capabilities?.langfuseSessionTrace?.source, "trace.medopl.cn", "runtime_bridge_status_must_expose_downstream_langfuse_boundary");
  assert(status.json.supportedEvents.includes("context_bootstrapped"), "runtime_bridge_status_must_include_context_bootstrapped_event");
  assert(status.json.supportedEvents.includes("downstream_runtime_gate_evaluated"), "runtime_bridge_status_must_include_runtime_gate_event");

  const bootstrap = await getJson(`${gatewayUrl}/runtime-bridge/api/opl/bootstrap`, { cookie });
  assert.equal(bootstrap.response.status, 200, "stable_bootstrap_must_return_200");
  assert.equal(bootstrap.json.identity.workspaceId, WORKSPACE_ID, "bootstrap_workspace_mismatch");
  assert.equal(bootstrap.json.runtimeBridgeContractVersion, "v22.portal-opl-context-backflow.v1", "bootstrap_contract_version_mismatch");
  assert.equal(bootstrap.json.capabilities?.messageBackflow?.source, "opl_product_api", "bootstrap_must_classify_message_backflow_source");
  assert.equal(bootstrap.json.capabilities?.runIntent?.status, "requires_runtime_agent", "bootstrap_must_classify_run_as_downstream_runtime");
  assert.equal(bootstrap.json.capabilities?.langfuseSessionTrace?.status, "deferred_authorization", "bootstrap_must_gate_langfuse_deployment");
  assert.equal(bootstrap.json.callbacks.runArtifacts, "/runtime-bridge/api/opl/runs/{runId}/artifacts", "bootstrap_must_expose_run_artifacts_callback");
  assert.equal(bootstrap.json.opl.health?.service, "fake-clean-opl-product-api", "bootstrap_health_must_come_from_product_api");
  assert.equal(bootstrap.json.system?.id, "fake-clean-opl", "bootstrap_system_must_come_from_product_api");
  assert.equal(bootstrap.json.engines?.[0]?.id, "engine-local", "bootstrap_engines_must_come_from_product_api");
  assert.equal(bootstrap.json.modules?.[0]?.id, "mas", "bootstrap_modules_must_come_from_product_api");
  assert.equal(bootstrap.json.agents?.[0]?.id, "agent-local", "bootstrap_agents_must_come_from_product_api");
  assertNoSecretLeak(bootstrap.json, "stable_bootstrap");
  assertProductApiObserved(productCalls, [
    "POST /api/opl/workspaces/bind",
    "POST /api/opl/sessions",
    ...REQUIRED_BOOTSTRAP_PRODUCT_API_CALLS,
  ], "bootstrap_and_launch");

  const bind = await postJson(`${gatewayUrl}/runtime-bridge/api/opl/sessions/bind`, {
    oplSessionId: "stable-opl-session-v22",
    clientSessionState: { source: "fake-clean-upstream-web" },
  }, { cookie });
  assert.equal(bind.response.status, 200, "stable_session_bind_must_return_200");
  assert.equal(bind.json.runtimeSession.workspaceId, WORKSPACE_ID, "bind_workspace_mismatch");
  assertNoSecretLeak(bind.json, "stable_session_bind");
  let state = await readRuntimeBridgeState(stateRoot);
  const boundRuntimeSession = assertRuntimeSessionBackflow(state, "session_bind_backflow");
  assert.equal(boundRuntimeSession.oplSessionId, "stable-opl-session-v22", "session_bind_must_update_opl_session_id");
  assertEvent(state, "opl_session_bound", (event) => event.oplSessionId === "stable-opl-session-v22" && event.workspaceId === WORKSPACE_ID, "session_bind_backflow");

  const message = await postJson(`${gatewayUrl}/runtime-bridge/api/opl/messages`, {
    message: "summarize the current local Runtime Bridge API state",
    waitForCompletion: true,
  }, { cookie });
  assert.equal(message.response.status, 200, "stable_message_must_complete");
  assert.equal(message.json.message.status, "succeeded", "stable_message_status_mismatch");
  assert.equal(message.json.message.source, "fake_opl_product_api", "stable_message_must_return_product_api_reply");
  assertNoSecretLeak(message.json, "stable_message");
  const productMessageCalls = productCallsFor(productCalls, "POST", "/api/opl/messages");
  assert.equal(productMessageCalls.length >= 1, true, "stable_message_must_call_product_api");
  assert.equal(parsedCallBody(productMessageCalls.at(-1)).message, "summarize the current local Runtime Bridge API state", "stable_message_product_api_body_mismatch");
  state = await readRuntimeBridgeState(stateRoot);
  assertMessageBackflow(state, message.json.message.messageId, "message_backflow");

  const acceptedMessage = await postJson(`${gatewayUrl}/runtime-bridge/api/opl/messages`, {
    message: "summarize the current local Runtime Bridge API state asynchronously",
    waitForCompletion: false,
  }, { cookie });
  assert.equal(acceptedMessage.response.status, 202, "stable_async_message_must_return_202");
  assert(String(acceptedMessage.json.statusUrl || "").startsWith(STABLE_MESSAGE_STATUS_PATH_PREFIX), "stable_async_message_status_url_must_use_runtime_bridge_api");
  assert.match(acceptedMessage.json.statusUrl || "", /^\/runtime-bridge\/api\/opl\/messages\/[^/]+\/status$/, "stable_async_message_status_url_must_include_message_id");
  assert.equal(String(acceptedMessage.json.statusUrl || "").includes("/api/opl-launch/"), false, "stable_async_message_status_url_must_not_use_legacy_api");
  assertNoSecretLeak(acceptedMessage.json, "stable_async_message");
  const acceptedStatus = await waitForJson(`${gatewayUrl}${acceptedMessage.json.statusUrl}`, {
    cookie,
    acceptJson: (json) => json.status === "succeeded" && json.message?.source === "fake_opl_product_api",
    label: "stable_async_message_status",
  });
  assertNoSecretLeak(acceptedStatus.json, "stable_async_message_status");
  state = await readRuntimeBridgeState(stateRoot);
  assertMessageBackflow(state, acceptedMessage.json.message.messageId, "async_message_backflow");

  const file = await postJson(`${gatewayUrl}/runtime-bridge/api/opl/files`, {
    fileName: "inputs/runtime-bridge-api-input.csv",
    contentType: "text/csv",
    sizeBytes: 42,
  }, { cookie });
  assertStatus(file, 201, "stable_file_must_return_201", {
    runtimeBridgeStdout: runtimeBridge.stdoutTail,
    runtimeBridgeStderr: runtimeBridge.stderrTail,
    gatewayStdout: gateway.stdoutTail,
    gatewayStderr: gateway.stderrTail,
  });
  assert(file.json.fileRef, "stable_file_ref_required");
  assertNoSecretLeak(file.json, "stable_file");
  state = await readRuntimeBridgeState(stateRoot);
  const inputArtifact = assertInputFileBackflow(state, file.json.fileRef, "file_backflow");
  assertEvent(state, "opl_file_referenced", (event) => event.artifactId === file.json.fileRef && event.workspaceId === WORKSPACE_ID, "file_backflow");

  const run = await postJson(`${gatewayUrl}/runtime-bridge/api/opl/runs`, {
    message: "run local Runtime Bridge API analysis",
    fileRefs: [file.json.fileRef],
    toolName: "opl-runtime-bridge-api-local",
  }, { cookie });
  assert.equal(run.response.status, 201, "stable_run_must_return_201");
  assert.equal(run.json.run.status, "succeeded", "stable_run_status_mismatch");
  assert.equal(run.json.run.workspaceId, WORKSPACE_ID, "stable_run_workspace_mismatch");
  assert.equal(run.json.run.providerKeyRef, PROVIDER_KEY_REF, "stable_run_provider_key_ref_mismatch");
  assert(run.json.artifacts.length >= 1, "stable_run_artifact_required");
  assert.equal(run.json.run.runtimeClaims?.workspaceId, WORKSPACE_ID, "stable_run_runtime_claims_workspace_mismatch");
  assert.equal(run.json.run.runtimeClaims?.providerKeyRef, PROVIDER_KEY_REF, "stable_run_runtime_claims_provider_key_ref_mismatch");
  assert.equal(run.json.run.ledgerEntryCount >= 1, true, "stable_run_must_return_ledger_count");
  assertNoSecretLeak(run.json, "stable_run");
  state = await readRuntimeBridgeState(stateRoot);
  const runBackflow = assertRunBackflow(state, run.json, "run_backflow");
  assert.equal(inputArtifact.artifactId, file.json.fileRef, "run_backflow_must_preserve_prior_input_file_state");

  const unauthorizedRunStatus = await getJson(`${gatewayUrl}/runtime-bridge/api/opl/runs/${encodeURIComponent(run.json.run.runId)}/status`);
  assert.equal(unauthorizedRunStatus.response.status, 401, "stable_run_status_without_cookie_must_return_401");
  const unauthorizedRunArtifacts = await getJson(`${gatewayUrl}/runtime-bridge/api/opl/runs/${encodeURIComponent(run.json.run.runId)}/artifacts`);
  assert.equal(unauthorizedRunArtifacts.response.status, 401, "stable_run_artifacts_without_cookie_must_return_401");
  const unauthorizedArtifact = await getJson(`${gatewayUrl}/runtime-bridge/api/opl/artifacts/${encodeURIComponent(run.json.artifacts[0].artifactRef)}`);
  assert.equal(unauthorizedArtifact.response.status, 401, "stable_artifact_without_cookie_must_return_401");

  const runStatus = await getJson(`${gatewayUrl}/runtime-bridge/api/opl/runs/${encodeURIComponent(run.json.run.runId)}/status`, { cookie });
  assert.equal(runStatus.response.status, 200, "stable_run_status_must_return_200");
  assert.equal(runStatus.json.run.runId, run.json.run.runId, "stable_run_status_id_mismatch");
  assert.equal(runStatus.json.run.status, runBackflow.run.status, "stable_run_status_must_read_persisted_run_state");
  assertNoSecretLeak(runStatus.json, "stable_run_status");

  const runArtifacts = await getJson(`${gatewayUrl}/runtime-bridge/api/opl/runs/${encodeURIComponent(run.json.run.runId)}/artifacts`, { cookie });
  assert.equal(runArtifacts.response.status, 200, "stable_run_artifacts_must_return_200");
  assert.equal(runArtifacts.json.items.length >= 1, true, "stable_run_artifacts_must_include_items");
  assert.equal(runArtifacts.json.items.some((item) => item.artifactRef === runBackflow.artifact.artifactId), true, "stable_run_artifacts_must_read_persisted_run_artifact");
  assertNoSecretLeak(runArtifacts.json, "stable_run_artifacts");

  const artifact = await getJson(`${gatewayUrl}/runtime-bridge/api/opl/artifacts/${encodeURIComponent(run.json.artifacts[0].artifactRef)}`, { cookie });
  assert.equal(artifact.response.status, 200, "stable_artifact_must_return_200");
  assert.equal(artifact.json.artifact.artifactRef, run.json.artifacts[0].artifactRef, "stable_artifact_ref_mismatch");
  assert.equal(artifact.json.artifact.relativePath, runBackflow.artifact.relativePath, "stable_artifact_must_read_persisted_artifact_state");
  assertNoSecretLeak(artifact.json, "stable_artifact");

  const portalBootstrap = await callPortalProxy(portalProxy, {
    method: "GET",
    path: `/portal/api/opl/bootstrap?launchId=${encodeURIComponent(PORTAL_LAUNCH_ID)}`,
  });
  assert.equal(portalBootstrap.status, 200, "portal_bootstrap_proxy_must_return_200");
  assert.equal(portalBootstrap.payload.identity.workspaceId, WORKSPACE_ID, "portal_bootstrap_proxy_workspace_mismatch");
  assert.equal(portalBootstrap.payload.runtimeBridgeContractVersion, "v22.portal-opl-context-backflow.v1", "portal_bootstrap_proxy_contract_version_mismatch");
  assert.equal(portalBootstrap.payload.capabilities?.contextBootstrap?.status, "supported", "portal_bootstrap_proxy_context_capability_mismatch");
  assert.equal(portalBootstrap.payload.capabilities?.runIntent?.status, "requires_runtime_agent", "portal_bootstrap_proxy_runtime_gate_mismatch");
  assertNoSecretLeak(portalBootstrap.payload, "portal_bootstrap_proxy");

  const portalRunArtifacts = await callPortalProxy(portalProxy, {
    method: "GET",
    path: `/portal/api/opl/runs/${encodeURIComponent(run.json.run.runId)}/artifacts?launchId=${encodeURIComponent(PORTAL_LAUNCH_ID)}`,
  });
  assert.equal(portalRunArtifacts.status, 200, "portal_run_artifacts_proxy_must_return_200");
  assert.equal(portalRunArtifacts.payload.items?.some((item) => item.artifactRef === run.json.artifacts[0].artifactRef), true, "portal_run_artifacts_proxy_must_return_runtime_bridge_backflow");
  assertNoSecretLeak(portalRunArtifacts.payload, "portal_run_artifacts_proxy");

  const portalArtifact = await callPortalProxy(portalProxy, {
    method: "GET",
    path: `/portal/api/opl/artifacts/${encodeURIComponent(run.json.artifacts[0].artifactRef)}?launchId=${encodeURIComponent(PORTAL_LAUNCH_ID)}`,
  });
  assert.equal(portalArtifact.status, 200, "portal_artifact_proxy_must_return_200");
  assert.equal(portalArtifact.payload.artifact?.artifactRef, run.json.artifacts[0].artifactRef, "portal_artifact_proxy_must_return_runtime_bridge_artifact");
  assertNoSecretLeak(portalArtifact.payload, "portal_artifact_proxy");

  assert.equal(productCalls.some((call) => /launch_token|apiKey|providerApiKey|runtimeToken/i.test(call.search)), false, "upstream_must_not_receive_secret_query");
  assert.equal(productCalls.some((call) => /gflabtoken_raw_key|rawProviderKey|providerApiKey|apiKey|launchToken|runtimeToken|bearerToken/i.test(call.body)), false, "upstream_product_api_must_not_receive_secret_body");

  console.log(JSON.stringify({
    ok: true,
    contract: "v22_runtime_bridge_api_local_flow",
    covered: [
      "stable_portal_runtime_bridge_api",
      "gateway_cookie_to_runtime_bridge_authorization",
      "token_not_in_public_url",
      "bootstrap_product_api_access_observed",
      "session_message_file_run_state_backflow",
      "portal_proxy_backflow",
      "fake_clean_opl_product_api_no_secret_pollution",
    ],
    runId: run.json.run.runId,
    artifactRef: run.json.artifacts[0].artifactRef,
  }, null, 2));
} finally {
  await stopChild(gateway);
  await stopChild(runtimeBridge);
  await close(productApi);
  await close(upstreamWeb);
  await rm(tempRoot, { recursive: true, force: true });
}
