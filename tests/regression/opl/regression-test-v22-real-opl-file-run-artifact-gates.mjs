import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import net from "node:net";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

const USER_ID = "user-real-opl-file-run-artifact";
const TENANT_ID = "tenant-real-opl-file-run-artifact";
const WORKSPACE_ID = "workspace-real-opl-file-run-artifact";
const WORKSPACE_SESSION_ID = "workspace-session-real-opl-file-run-artifact";
const RESOURCE_BINDING_ID = "resource-binding-real-opl-file-run-artifact";
const PROVIDER_KEY_REF = "provider-key-ref-real-opl-file-run-artifact";
const RUNTIME_AGENT_ID = "runtime-agent-real-opl-file-run-artifact";

function assertNoSecretLeak(value, label) {
  const serialized = typeof value === "string" ? value : JSON.stringify(value || {});
  assert.equal(
    /sk-[a-z0-9]|gflabtoken_raw_key|rawProviderKey|providerApiKey|apiKey|launchToken|runtimeToken|bearerToken|objectKey|storageKey|localPath|signedUrl|presignedUrl|password|qr-login\?token/i.test(serialized),
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

function spawnNode(script, { port, env = {}, stateRoot = "", cwd = process.cwd() } = {}) {
  const child = spawn(process.execPath, [script], {
    cwd,
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

async function postJson(url, payload, { token = "" } = {}) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
    redirect: "manual",
  });
  const json = await response.json().catch(() => ({}));
  return { response, json };
}

async function getJson(url, { token = "" } = {}) {
  const response = await fetch(url, {
    headers: {
      accept: "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    redirect: "manual",
  });
  const json = await response.json().catch(() => ({}));
  return { response, json };
}

async function readRuntimeBridgeState(stateRoot) {
  return JSON.parse(await readFile(path.join(stateRoot, "state.json"), "utf8"));
}

const tempRoot = await mkdtemp(path.join(os.tmpdir(), "v22-real-opl-file-run-artifact-gates-"));
const stateRoot = path.join(tempRoot, "runtime-bridge-state");
const runtimeBridgePort = await freePort();
const runtimeBridgeUrl = `http://127.0.0.1:${runtimeBridgePort}`;
let runtimeBridge;

try {
  runtimeBridge = spawnNode("services/opl-runtime-bridge/src/server.mjs", {
    port: runtimeBridgePort,
    stateRoot,
    env: {
      PORTAL_RUNTIME_BRIDGE_PUBLIC_URL: runtimeBridgeUrl,
      OPL_WEB_URL: "http://127.0.0.1:1",
      OPL_RUNTIME_MODE: "webui",
      OPL_WEBUI_BRIDGE_URL: "http://127.0.0.1:1",
      PRODUCT_RUNTIME_MODE: "platform_provisioned",
    },
  });
  await waitFor(`${runtimeBridgeUrl}/healthz`);

  const launch = await postJson(`${runtimeBridgeUrl}/api/opl-launch/tokens`, {
    portalUserId: USER_ID,
    portalUserEmail: "real-file-run-artifact@example.test",
    portalUserName: "Real File Run Artifact Canary",
    tenantId: TENANT_ID,
    ownerId: USER_ID,
    sessionOwnerId: USER_ID,
    traceOwnerId: USER_ID,
    artifactOwnerId: USER_ID,
    storageOwnerId: USER_ID,
    workspaceId: WORKSPACE_ID,
    workspaceTitle: "Real File Run Artifact Workspace",
    workspacePath: path.join(tempRoot, "workspace"),
    workspaceSessionId: WORKSPACE_SESSION_ID,
    sourceSurface: "portal-control-plane",
    mode: "full_runtime",
    resourceBindingId: RESOURCE_BINDING_ID,
    computeInstanceId: "compute-real-file-run-artifact",
    storageBucketId: "storage-real-file-run-artifact",
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
  assert.equal(launch.response.status, 200, "launch_must_return_200_even_when_webui_unavailable_in_test_mode");
  assert.equal(launch.json.ok, true, "launch_must_succeed_with_local_gate_testing");
  assert(launch.json.launchToken, "internal_launch_token_required");
  assertNoSecretLeak({
    openUrl: launch.json.openUrl,
    oplWebUrl: launch.json.oplWebUrl,
    bootstrapUrl: launch.json.bootstrapUrl,
  }, "launch_public_urls");

  const status = await getJson(`${runtimeBridgeUrl}/api/opl/status`, { token: launch.json.launchToken });
  assert.equal(status.response.status, 200, "runtime_bridge_status_must_return_200");
  assert.equal(status.json.capabilities?.fileIntent?.status, "capability_not_supported", "webui_file_intent_must_not_claim_supported");
  assert.equal(status.json.capabilities?.runIntent?.status, "requires_runtime_agent", "webui_run_intent_must_require_runtime_agent");

  const file = await postJson(`${runtimeBridgeUrl}/api/opl/files`, {
    fileName: "inputs/not-really-uploaded.csv",
    contentType: "text/csv",
    sizeBytes: 42,
  }, { token: launch.json.launchToken });
  assert.equal(file.response.status, 409, "webui_file_without_real_upload_must_gate");
  assert.equal(file.json.ok, false, "webui_file_gate_must_not_be_ok");
  assert.equal(file.json.error, "file_upload_capability_not_supported", "webui_file_gate_error_mismatch");
  assert.equal(file.json.gate, "file_ref_not_observed", "webui_file_gate_must_explain_file_ref_not_observed");
  assert.equal(Boolean(file.json.fileRef), false, "webui_file_gate_must_not_return_file_ref");
  assertNoSecretLeak(file.json, "webui_file_gate");

  const run = await postJson(`${runtimeBridgeUrl}/api/opl/runs`, {
    message: "run must be gated without a real Runtime Agent",
    fileRefs: ["file-ref-not-observed"],
    toolName: "real-opl-file-run-artifact-canary",
  }, { token: launch.json.launchToken });
  assert.equal(run.response.status, 409, "webui_run_without_runtime_agent_must_gate");
  assert.equal(run.json.ok, false, "webui_run_gate_must_not_be_ok");
  assert.equal(run.json.error, "requires_runtime_agent", "webui_run_gate_error_mismatch");
  assert.equal(run.json.run.status, "gated", "webui_run_gate_must_persist_gated_status");
  assert(run.json.run.runId, "webui_run_gate_must_return_queryable_run_id");
  assert(run.json.statusUrl, "webui_run_gate_must_return_status_url");
  assertNoSecretLeak(run.json, "webui_run_gate");

  const runStatus = await getJson(`${runtimeBridgeUrl}${run.json.statusUrl}`, { token: launch.json.launchToken });
  assert.equal(runStatus.response.status, 200, "webui_gated_run_status_must_be_queryable");
  assert.equal(runStatus.json.run.runId, run.json.run.runId, "webui_gated_run_status_id_mismatch");
  assert.equal(runStatus.json.run.status, "gated", "webui_gated_run_status_must_remain_gated");
  assert.equal(runStatus.json.run.error, "requires_runtime_agent", "webui_gated_run_status_error_mismatch");
  assertNoSecretLeak(runStatus.json, "webui_gated_run_status");

  const runArtifacts = await getJson(`${runtimeBridgeUrl}/api/opl/runs/${encodeURIComponent(run.json.run.runId)}/artifacts`, { token: launch.json.launchToken });
  assert.equal(runArtifacts.response.status, 409, "webui_run_artifacts_without_output_must_gate");
  assert.equal(runArtifacts.json.error, "artifact_not_observed", "webui_run_artifacts_gate_error_mismatch");
  assert.equal(runArtifacts.json.gate, "output_file_ref_not_observed", "webui_run_artifacts_gate_mismatch");
  assertNoSecretLeak(runArtifacts.json, "webui_run_artifacts_gate");

  const missingArtifact = await getJson(`${runtimeBridgeUrl}/api/opl/artifacts/${encodeURIComponent(`output-${run.json.run.runId}`)}`, { token: launch.json.launchToken });
  assert.equal(missingArtifact.response.status, 404, "webui_missing_artifact_must_return_404");
  assert.equal(missingArtifact.json.error, "artifact_not_observed", "webui_missing_artifact_error_mismatch");
  assert.equal(missingArtifact.json.gate, "output_file_ref_not_observed", "webui_missing_artifact_gate_mismatch");
  assertNoSecretLeak(missingArtifact.json, "webui_missing_artifact_gate");

  const state = await readRuntimeBridgeState(stateRoot);
  assert.equal(state.artifacts?.length || 0, 0, "webui_gates_must_not_persist_fake_file_or_artifact");
  assert(state.runs.some((item) => item.runId === run.json.run.runId && item.status === "gated"), "webui_gated_run_must_be_persisted");
  assert(state.events.some((event) => event.type === "opl_file_gate_evaluated" && event.error === "file_upload_capability_not_supported"), "webui_file_gate_event_required");
  assert(state.events.some((event) => event.type === "downstream_runtime_gate_evaluated" && event.error === "requires_runtime_agent"), "webui_run_gate_event_required");
  assert(state.events.some((event) => event.type === "artifact_output_gate_evaluated" && event.error === "artifact_not_observed"), "webui_artifact_gate_event_required");

  console.log(JSON.stringify({
    ok: true,
    contract: "v22_real_opl_file_run_artifact_gates",
    covered: [
      "webui_file_upload_not_faked",
      "webui_run_requires_runtime_agent_gate",
      "gated_run_status_queryable",
      "artifact_output_not_faked",
      "no_secret_or_storage_leak",
    ],
    runId: run.json.run.runId,
  }, null, 2));
} finally {
  await stopChild(runtimeBridge);
  await rm(tempRoot, { recursive: true, force: true });
}
