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
const WORKSPACE_ID = "real-opl-file-run-artifact-api-loop";
const RESOURCE_BINDING_ID = "rb-real-opl-file-run-artifact-api-loop";
const RUNTIME_AGENT_ID = "runtime-agent-api-loop";
const PROVIDER_SECRET_SENTINEL = "provider-secret-sentinel-real-file-run-artifact-api-loop";
const PROVIDER_KEY_REF_PREFIX = "gflab-";
const FORBIDDEN_PACKAGE_D_PATTERN = /ownerRef|operationId|k8sLabels|kubernetesLabels|deployOwnerLabels/i;
const FORBIDDEN_PUBLIC_PATTERN = /provider-secret-sentinel|gflabtoken_raw_key|rawProviderKey|providerApiKey|apiKey|launchToken|runtimeToken|bearerToken|objectKey|storageKey|localPath|signedUrl|presignedUrl/i;

function assertNoPublicLeak(value, label) {
  const serialized = typeof value === "string" ? value : JSON.stringify(value || {});
  assert.equal(FORBIDDEN_PUBLIC_PATTERN.test(serialized), false, `${label}_must_not_expose_secret_or_storage_fields`);
}

function assertNoPackageDFields(value, label) {
  const serialized = typeof value === "string" ? value : JSON.stringify(value || {});
  assert.equal(FORBIDDEN_PACKAGE_D_PATTERN.test(serialized), false, `${label}_must_not_include_package_d_owner_fields`);
}

function assertWorkspaceScopedFile(file = {}, scope = {}) {
  assert(file.fileRef || file.artifactRef, "workspace_scoped_file_ref_required");
  assert.equal(file.workspaceId, scope.workspaceId, "file_workspace_scope_mismatch");
  assert.equal(file.workspaceSessionId, scope.workspaceSessionId, "file_workspace_session_scope_mismatch");
  assert.equal(file.runtimeSessionId, scope.runtimeSessionId, "file_runtime_session_scope_mismatch");
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

function startRuntimeAgentCanary(calls) {
  return http.createServer(async (req, res) => {
    const body = await readRequestBody(req);
    const url = new URL(req.url || "/", "http://runtime-agent-canary.local");
    const payload = body ? JSON.parse(body) : {};
    calls.push({
      method: req.method || "GET",
      pathname: url.pathname,
      body: payload,
      headers: {
        authorization: req.headers.authorization || "",
        "x-launch-token": req.headers["x-launch-token"] || "",
      },
    });

    if (url.pathname === "/healthz") {
      sendJson(res, 200, { ok: true, service: "runtime-agent-http-canary" });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/runtime/files") {
      assertNoPublicLeak(payload, "runtime_agent_file_intake_request");
      assert.equal(payload.workspaceId, WORKSPACE_ID, "runtime_agent_file_workspace_mismatch");
      assert(payload.workspaceSessionId, "runtime_agent_file_workspace_session_required");
      assert(payload.runtimeSessionId, "runtime_agent_file_runtime_session_required");
      const fileRef = `file-${payload.workspaceId}-${payload.runtimeSessionId}-input`;
      sendJson(res, 201, {
        file: {
          fileRef,
          workspaceId: payload.workspaceId,
          workspaceSessionId: payload.workspaceSessionId,
          runtimeSessionId: payload.runtimeSessionId,
          status: "ready",
          source: "runtime_agent_http_canary",
          name: payload.fileName || payload.name || "input.csv",
          relativePath: "inputs/input.csv",
          sizeBytes: Number(payload.sizeBytes || 0),
          contentType: payload.contentType || "text/csv",
        },
      });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/runtime/runs") {
      assertNoPublicLeak(payload, "runtime_agent_run_dispatch_request");
      assert.equal(payload.workspaceId, WORKSPACE_ID, "runtime_agent_run_workspace_mismatch");
      assert.equal(payload.resourceBindingId, RESOURCE_BINDING_ID, "runtime_agent_run_resource_binding_mismatch");
      assert.equal(payload.runtimeAgentId, RUNTIME_AGENT_ID, "runtime_agent_run_agent_id_mismatch");
      assert.equal(String(payload.providerKeyRef || "").startsWith(PROVIDER_KEY_REF_PREFIX), true, "runtime_agent_run_provider_key_ref_required");
      assert(Array.isArray(payload.fileRefs) && payload.fileRefs.length === 1, "runtime_agent_run_file_ref_required");
      const runId = payload.runId || `run-${payload.runtimeSessionId}`;
      const artifactRef = `artifact-${runId}`;
      const outputFileRef = `output-${runId}`;
      sendJson(res, 201, {
        run: {
          runId,
          traceId: payload.traceId || `trace-${runId}`,
          kind: "opl-runtime-agent-api-canary",
          toolName: payload.toolName || "real-opl-file-run-artifact-api-loop",
          status: "succeeded",
        },
        artifacts: [{
          artifactRef,
          outputFileRef,
          kind: "outputs",
          name: `${runId}-result.md`,
          relativePath: `outputs/${runId}/${runId}-result.md`,
          sizeBytes: 256,
          contentType: "text/markdown",
        }],
        ledgerEntries: [{
          eventType: "runtime_run_succeeded",
          status: "succeeded",
          usage: {
            inputTokens: 21,
            outputTokens: 13,
            totalTokens: 34,
          },
          costSummary: {
            billingMetadataRef: `billing-meta-${runId}`,
            usageMetadataRef: `usage-meta-${runId}`,
          },
          metadata: {
            publicStatus: "succeeded",
          },
        }],
        runtimeClaims: {
          runtimeSessionId: payload.runtimeSessionId,
          workspaceId: payload.workspaceId,
          providerKeyRef: payload.providerKeyRef,
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
    res.end("<!doctype html><html><body><main>clean fake OPL Web for Runtime Agent API loop</main></body></html>");
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
      ...(stateRoot ? { PORTAL_OPL_ADAPTER_STATE_ROOT: stateRoot } : {}),
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
    error.message = `${error.message}:${label}:stdout=${child?.stdoutTail || ""}:stderr=${child?.stderrTail || ""}`;
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

const tempRoot = await mkdtemp(path.join(os.tmpdir(), "v22-real-opl-file-run-artifact-api-loop-"));
const runtimeRoot = path.join(tempRoot, "portal-runtime");
const adapterStateRoot = path.join(tempRoot, "adapter-state");
await mkdir(runtimeRoot, { recursive: true });

const runtimeAgentCalls = [];
const runtimeAgent = startRuntimeAgentCanary(runtimeAgentCalls);
const upstreamWeb = startFakeUpstreamWeb();
let adapter;
let gateway;
let portal;

try {
  const runtimeAgentPort = await listen(runtimeAgent);
  const upstreamPort = await listen(upstreamWeb);
  const adapterPort = await freePort();
  const gatewayPort = await freePort();
  const portalPort = await freePort();
  const runtimeAgentUrl = `http://127.0.0.1:${runtimeAgentPort}`;
  const adapterUrl = `http://127.0.0.1:${adapterPort}`;
  const gatewayUrl = `http://127.0.0.1:${gatewayPort}`;
  const portalUrl = `http://127.0.0.1:${portalPort}`;

  adapter = spawnNode("services/opl-runtime-bridge/src/server.mjs", {
    port: adapterPort,
    stateRoot: adapterStateRoot,
    env: {
      PORTAL_OPL_ADAPTER_PUBLIC_URL: adapterUrl,
      OPL_WEB_URL: gatewayUrl,
      PRODUCT_RUNTIME_MODE: "platform_provisioned",
      OPL_RUNTIME_AGENT_RELAY_MODE: "http",
    },
  });
  await waitForChildUrl(adapter, `${adapterUrl}/healthz`, "adapter");

  gateway = spawnNode("services/opl-web-gateway/src/server.mjs", {
    port: gatewayPort,
    env: {
      OPL_WEB_GATEWAY_PUBLIC_URL: gatewayUrl,
      OPL_UPSTREAM_URL: `http://127.0.0.1:${upstreamPort}`,
      PORTAL_OPL_ADAPTER_URL: adapterUrl,
      PORTAL_PUBLIC_URL: portalUrl,
    },
  });
  await waitForChildUrl(gateway, `${gatewayUrl}/healthz`, "gateway");

  portal = spawnNode("services/portal/src/server.mjs", {
    port: portalPort,
    env: {
      PORTAL_OIDC_ENABLED: "0",
      PORTAL_ALLOW_REGISTRATION: "1",
      PORTAL_ADMIN_EMAIL: USER_EMAIL,
      PORTAL_ADMIN_PASSWORD: USER_PASSWORD,
      PORTAL_PUBLIC_URL: portalUrl,
      PORTAL_OPL_ADAPTER_URL: adapterUrl,
      OPL_WEB_URL: gatewayUrl,
      PORTAL_STORAGE_MODE: "json",
      PRODUCT_RUNTIME_MODE: "platform_provisioned",
      PORTAL_OPL_PROVIDER_SECRET_ROOT: path.join(tempRoot, "provider-secrets"),
      PORTAL_OPL_RESOURCE_BINDING_ID: RESOURCE_BINDING_ID,
      PORTAL_OPL_COMPUTE_INSTANCE_ID: "compute-real-opl-file-run-artifact-api-loop",
      PORTAL_OPL_STORAGE_BUCKET_ID: "storage-real-opl-file-run-artifact-api-loop",
      PORTAL_OPL_RUNTIME_AGENT_ID: RUNTIME_AGENT_ID,
      PORTAL_OPL_RUNTIME_AGENT_ENDPOINT: runtimeAgentUrl,
    },
  });
  await waitForChildUrl(portal, `${portalUrl}/healthz`, "portal");
  await waitFor(`${runtimeAgentUrl}/healthz`);

  const login = await postForm(`${portalUrl}/login`, { email: USER_EMAIL, password: USER_PASSWORD });
  assert.equal(login.status, 302, "portal_login_must_redirect_after_success");
  const portalCookie = cookieHeaderFrom(login, "portal_session");

  const launch = await postJson(`${portalUrl}/portal/api/opl/launch`, {
    workspaceId: WORKSPACE_ID,
    providerKeyPayload: {
      provider: "gflabtoken",
      source: "user_input",
      apiKey: PROVIDER_SECRET_SENTINEL,
    },
  }, { cookie: portalCookie });
  assert.equal(launch.response.status, 200, "portal_opl_launch_must_return_200");
  assert.equal(launch.json.ok, true, "portal_opl_launch_must_succeed");
  assert.equal(new URL(launch.json.openUrl).searchParams.has("launch_token"), false, "portal_opl_open_url_must_not_include_launch_token");
  assertNoPublicLeak(launch.json, "portal_opl_launch");

  const launchId = launch.json.launchId;
  const bootstrap = await getJson(`${portalUrl}/portal/api/opl/bootstrap?launchId=${encodeURIComponent(launchId)}`, { cookie: portalCookie });
  assert.equal(bootstrap.response.status, 200, "portal_opl_bootstrap_must_return_200");
  assert.equal(bootstrap.json.identity.workspaceId, WORKSPACE_ID, "portal_opl_bootstrap_workspace_mismatch");
  assertNoPublicLeak(bootstrap.json, "portal_opl_bootstrap");

  const bind = await postJson(`${portalUrl}/portal/api/opl/sessions/bind?launchId=${encodeURIComponent(launchId)}`, {
    oplSessionId: bootstrap.json.identity.oplSessionId || "real-file-run-artifact-session",
    clientSessionState: { source: "runtime-agent-api-loop" },
  }, { cookie: portalCookie });
  assert.equal(bind.response.status, 200, "portal_opl_session_bind_must_return_200");
  assert.equal(bind.json.runtimeSession.workspaceId, WORKSPACE_ID, "portal_opl_session_bind_workspace_mismatch");
  assertNoPublicLeak(bind.json, "portal_opl_session_bind");

  const scope = {
    workspaceId: WORKSPACE_ID,
    workspaceSessionId: bind.json.runtimeSession.workspaceSessionId,
    runtimeSessionId: bind.json.runtimeSession.runtimeSessionId,
  };

  const file = await postJson(`${portalUrl}/portal/api/opl/files?launchId=${encodeURIComponent(launchId)}`, {
    fileName: "inputs/runtime-agent-api-loop.csv",
    contentType: "text/csv",
    sizeBytes: 64,
  }, { cookie: portalCookie });
  assert.equal(file.response.status, 201, "portal_opl_file_must_return_201");
  assertWorkspaceScopedFile(file.json.file, scope);
  assert.equal(file.json.file.source, "runtime_agent_http_canary", "portal_opl_file_source_must_be_runtime_agent_http_canary");
  assertNoPublicLeak(file.json, "portal_opl_file");
  assertNoPackageDFields(file.json, "portal_opl_file");

  const run = await postJson(`${portalUrl}/portal/api/opl/runs?launchId=${encodeURIComponent(launchId)}`, {
    message: "run Portal OPL file run artifact Runtime Agent API loop",
    fileRefs: [file.json.fileRef],
    toolName: "real-opl-file-run-artifact-api-loop",
  }, { cookie: portalCookie });
  assert.equal(run.response.status, 201, "portal_opl_run_must_return_201");
  assert.equal(run.json.run.status, "succeeded", "portal_opl_run_status_mismatch");
  assert(run.json.run.runId, "portal_opl_run_id_required");
  assert(run.json.run.traceId, "portal_opl_run_trace_id_required");
  assert.equal(run.json.run.resourceBindingId, RESOURCE_BINDING_ID, "portal_opl_run_resource_binding_mismatch");
  assert.equal(String(run.json.run.providerKeyRef || "").startsWith(PROVIDER_KEY_REF_PREFIX), true, "portal_opl_run_provider_key_ref_required");
  assert.equal(run.json.run.workspaceId, WORKSPACE_ID, "portal_opl_run_workspace_mismatch");
  assert.equal(run.json.run.workspaceSessionId, scope.workspaceSessionId, "portal_opl_run_workspace_session_mismatch");
  assert.equal(run.json.run.runtimeSessionId, scope.runtimeSessionId, "portal_opl_run_runtime_session_mismatch");
  assert.equal(run.json.run.billingMetadataRef, `billing-meta-${run.json.run.runId}`, "portal_opl_run_billing_metadata_ref_mismatch");
  assert.equal(run.json.run.usageMetadataRef, `usage-meta-${run.json.run.runId}`, "portal_opl_run_usage_metadata_ref_mismatch");
  assert(run.json.artifacts?.[0]?.artifactRef, "portal_opl_run_artifact_ref_required");
  assert.equal(run.json.artifacts[0].resourceBindingId, RESOURCE_BINDING_ID, "portal_opl_run_artifact_resource_binding_mismatch");
  assert.equal(String(run.json.artifacts[0].providerKeyRef || "").startsWith(PROVIDER_KEY_REF_PREFIX), true, "portal_opl_run_artifact_provider_key_ref_required");
  assertNoPublicLeak(run.json, "portal_opl_run");
  assertNoPackageDFields(run.json, "portal_opl_run");

  const artifacts = await getJson(`${portalUrl}/portal/api/opl/runs/${encodeURIComponent(run.json.run.runId)}/artifacts?launchId=${encodeURIComponent(launchId)}`, { cookie: portalCookie });
  assert.equal(artifacts.response.status, 200, "portal_opl_run_artifacts_must_return_200");
  assert.equal(artifacts.json.items.some((item) => item.artifactRef === run.json.artifacts[0].artifactRef), true, "portal_opl_run_artifacts_must_include_runtime_artifact");
  assert.equal(artifacts.json.items[0].resourceBindingId, RESOURCE_BINDING_ID, "portal_opl_run_artifacts_resource_binding_mismatch");
  assertNoPublicLeak(artifacts.json, "portal_opl_run_artifacts");
  assertNoPackageDFields(artifacts.json, "portal_opl_run_artifacts");

  const artifact = await getJson(`${portalUrl}/portal/api/opl/artifacts/${encodeURIComponent(run.json.artifacts[0].artifactRef)}?launchId=${encodeURIComponent(launchId)}`, { cookie: portalCookie });
  assert.equal(artifact.response.status, 200, "portal_opl_artifact_must_return_200");
  assert.equal(artifact.json.artifact.artifactRef, run.json.artifacts[0].artifactRef, "portal_opl_artifact_ref_mismatch");
  assert.equal(artifact.json.artifact.workspaceId, WORKSPACE_ID, "portal_opl_artifact_workspace_mismatch");
  assert.equal(artifact.json.artifact.resourceBindingId, RESOURCE_BINDING_ID, "portal_opl_artifact_resource_binding_mismatch");
  assertNoPublicLeak(artifact.json, "portal_opl_artifact");
  assertNoPackageDFields(artifact.json, "portal_opl_artifact");

  const sessionTraces = await getJson(`${portalUrl}/portal/api/session-traces?workspaceId=${encodeURIComponent(WORKSPACE_ID)}&runId=${encodeURIComponent(run.json.run.runId)}&pageSize=20`, { cookie: portalCookie });
  assert.equal(sessionTraces.response.status, 200, "portal_session_traces_must_return_200");
  assert.equal(sessionTraces.json.summary?.businessFactSource, "runtime_bridge_canonical_metadata", "portal_session_traces_must_use_runtime_bridge_canonical_source");
  assert.equal(sessionTraces.json.summary?.billingTruth, false, "portal_session_traces_must_not_claim_billing_truth");
  const traceItem = sessionTraces.json.items.find((item) => item.runId === run.json.run.runId);
  assert(traceItem, "portal_session_traces_must_find_run_trace");
  assert.equal(traceItem.workspaceId, WORKSPACE_ID, "portal_session_trace_workspace_mismatch");
  assert.equal(traceItem.runtimeSessionId, scope.runtimeSessionId, "portal_session_trace_runtime_session_mismatch");
  assert.equal(traceItem.source, "runtime_bridge_canonical_metadata", "portal_session_trace_source_mismatch");
  assert.equal(traceItem.billingMetadataRef, `billing-meta-${run.json.run.runId}`, "portal_session_trace_billing_metadata_ref_mismatch");
  assert.equal(traceItem.usageMetadataRef, `usage-meta-${run.json.run.runId}`, "portal_session_trace_usage_metadata_ref_mismatch");
  assert.equal(traceItem.runtimeMetadataRefs?.billingMetadataRef, `billing-meta-${run.json.run.runId}`, "portal_session_trace_runtime_billing_metadata_ref_mismatch");
  assert.equal(traceItem.runtimeMetadataRefs?.usageMetadataRef, `usage-meta-${run.json.run.runId}`, "portal_session_trace_runtime_usage_metadata_ref_mismatch");
  assert.equal(traceItem.runtimeMetadataRefs?.billingTruth, false, "portal_session_trace_runtime_metadata_must_not_claim_billing_truth");
  assert.equal(traceItem.outputFiles.some((item) => item.artifactRef === run.json.artifacts[0].artifactRef), true, "portal_session_trace_must_link_runtime_artifact");
  assertNoPublicLeak(sessionTraces.json, "portal_session_traces");
  assertNoPackageDFields(sessionTraces.json, "portal_session_traces");

  const fileCalls = runtimeAgentCalls.filter((call) => call.pathname === "/api/runtime/files");
  const runCalls = runtimeAgentCalls.filter((call) => call.pathname === "/api/runtime/runs");
  assert.equal(fileCalls.length, 1, "runtime_agent_file_intake_must_be_called_once");
  assert.equal(runCalls.length, 1, "runtime_agent_run_dispatch_must_be_called_once");
  assert.equal(fileCalls.some((call) => call.headers.authorization || call.headers["x-launch-token"]), false, "runtime_agent_file_request_must_not_forward_tokens");
  assert.equal(runCalls.some((call) => call.headers.authorization || call.headers["x-launch-token"]), false, "runtime_agent_run_request_must_not_forward_tokens");
  assert.equal(runCalls[0].body.workspaceSessionId, scope.workspaceSessionId, "runtime_agent_run_workspace_session_mismatch");
  assert.equal(runCalls[0].body.runtimeSessionId, scope.runtimeSessionId, "runtime_agent_run_runtime_session_mismatch");
  assert.equal(runCalls[0].body.resourceBindingId, RESOURCE_BINDING_ID, "runtime_agent_run_resource_binding_identity_mismatch");
  assertNoPublicLeak(runtimeAgentCalls, "runtime_agent_calls");
  assertNoPackageDFields(runtimeAgentCalls, "runtime_agent_calls");

  console.log(JSON.stringify({
    ok: true,
    contract: "v22_real_opl_file_run_artifact_runtime_agent_api_loop",
    covered: [
      "portal_http_launch_bootstrap_session_bind",
      "runtime_agent_http_file_intake",
      "workspace_scoped_file_ref",
      "runtime_agent_http_run_dispatch",
      "run_status_trace_projection",
      "artifact_output_backflow",
      "portal_session_trace_projection",
      "secret_storage_hygiene",
    ],
    runId: run.json.run.runId,
    fileRef: file.json.fileRef,
    artifactRef: run.json.artifacts[0].artifactRef,
  }, null, 2));
} finally {
  await stopChild(portal);
  await stopChild(gateway);
  await stopChild(adapter);
  await close(runtimeAgent);
  await close(upstreamWeb);
  await rm(tempRoot, { recursive: true, force: true });
}
