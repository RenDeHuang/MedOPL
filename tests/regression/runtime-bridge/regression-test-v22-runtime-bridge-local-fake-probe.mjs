import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

const repoRoot = process.cwd();

const acpRuntimeFixtureSource = `
const readline = require("node:readline");
const commands = ["initialize", "session_list", "session_ledger", "session_create", "prompt"];
readline.createInterface({ input: process.stdin, crlfDelay: Infinity }).on("line", (line) => {
  const request = JSON.parse(line);
  let result = {};
  if (request.command === "initialize") {
    result = { surface_id: "opl-runtime-bridge-local-fake-probe", version: "v22-probe", commands };
  } else if (request.command === "session_list" || request.command === "session_ledger") {
    result = { items: [] };
  } else if (request.command === "session_create") {
    result = { session_id: "opl-session-local-fake", task_acceptance: { status: "accepted" } };
  } else if (request.command === "prompt") {
    result = {
      response: "local fake OPL reply",
      replyMessageId: "reply-local-fake",
      messageTraceId: "trace-message-local-fake",
      providerInvocationRef: "provider-invocation-local-fake",
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
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(url, { redirect: "manual" });
      if (response.ok) return response;
    } catch {}
    await sleep(100);
  }
  throw new Error(`timeout_waiting_for:${url}`);
}

async function stopChild(child) {
  if (!child || child.killed) return;
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

async function fetchJson(pathname, options = {}) {
  const response = await fetch(`${runtimeBridgeUrl}${pathname}`, {
    ...options,
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      ...(options.headers || {}),
    },
  });
  const payload = await response.json().catch(() => ({}));
  return { response, payload };
}

async function postJson(pathname, body = {}, headers = {}) {
  return fetchJson(pathname, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

function bearer(launchToken) {
  return { authorization: `Bearer ${launchToken}` };
}

const stateRoot = await mkdtemp(path.join(os.tmpdir(), "v22-runtime-bridge-local-fake-probe-"));
const port = await freePort();
const runtimeBridgeUrl = `http://127.0.0.1:${port}`;
let runtimeBridge = null;
const runtimeOutput = { stdout: "", stderr: "" };

try {
  runtimeBridge = spawn(process.execPath, ["services/opl-runtime-bridge/src/server.mjs"], {
    cwd: repoRoot,
    env: {
      ...process.env,
      PORT: String(port),
      PORTAL_RUNTIME_BRIDGE_PUBLIC_URL: runtimeBridgeUrl,
      PORTAL_RUNTIME_BRIDGE_STATE_ROOT: stateRoot,
      NODE_ENV: "development",
      OPL_WEB_URL: "https://opl.example.test",
      OPL_LAUNCH_SECRET: "local-fake-probe-launch-secret",
      OPL_RUNTIME_MODE: "acp",
      OPL_ACP_RUNTIME_COMMAND_JSON: JSON.stringify([process.execPath, "-e", acpRuntimeFixtureSource]),
      OPL_RUNTIME_BRIDGE_LOCAL_FAKE_RUNTIME: "1",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  runtimeBridge.stdout.on("data", (chunk) => {
    runtimeOutput.stdout += chunk.toString("utf8");
  });
  runtimeBridge.stderr.on("data", (chunk) => {
    runtimeOutput.stderr += chunk.toString("utf8");
  });

  await waitFor(`${runtimeBridgeUrl}/healthz`);
  const { payload: health } = await fetchJson("/healthz");
  assert.equal(health.ok, true, "runtime_bridge_healthz_must_be_ok");
  assert.equal(health.runtimeBridgeContractVersion, "v22.portal-opl-context-backflow.v1", "runtime_bridge_contract_version_mismatch");

  const { response: launchResponse, payload: launch } = await postJson("/api/opl-launch/tokens", {
    portalUserId: "portal-local-fake-user",
    portalUserEmail: "local-fake@example.test",
    portalUserName: "Portal Local Fake",
    tenantId: "tenant-local-fake",
    workspaceId: "workspace-local-fake",
    workspaceTitle: "Workspace Local Fake",
    workspacePath: repoRoot,
    workspaceSessionId: "workspace-session-local-fake",
    ownerId: "portal-local-fake-user",
    storageOwnerId: "portal-local-fake-user",
    resourceBindingId: "resource-binding-local-fake",
    computeInstanceId: "compute-local-fake",
    storageBucketId: "bucket-local-fake",
    runtimeAgentId: "runtime-agent-local-fake",
    mode: "full_runtime",
    providerKeyPayload: {
      provider: "gflabtoken",
      source: "user_input",
      apiKey: "dummy-local-provider-key",
    },
  });
  assert.equal(launchResponse.status, 200, "launch_token_status_mismatch");
  assert(launch.launchToken, "launchToken_missing");
  assert(launch.runtimeSessionId, "runtimeSessionId_missing");
  assert.equal(launch.providerConfigured, true, "launch_must_bind_dummy_provider_config");
  assert(launch.providerKeyRef, "launch_must_project_provider_key_ref");
  assert.equal(JSON.stringify(launch).includes("dummy-local-provider-key"), false, "launch_response_must_not_expose_provider_key_payload");

  const { response: bootstrapResponse, payload: bootstrap } = await fetchJson("/api/opl-launch/bootstrap", {
    headers: bearer(launch.launchToken),
  });
  assert.equal(bootstrapResponse.status, 200, "bootstrap_status_mismatch");
  assert.equal(bootstrap.opl?.health?.source, "opl_acp_runtime", "bootstrap_must_use_local_acp_runtime");
  assert.equal(bootstrap.runtimeSession.runtimeSessionId, launch.runtimeSessionId, "bootstrap_runtime_session_mismatch");
  assert.equal(bootstrap.runtimeSession.providerBound, true, "bootstrap_must_show_provider_bound");
  assert.equal(JSON.stringify(bootstrap).includes("dummy-local-provider-key"), false, "bootstrap_must_not_expose_provider_key_payload");

  const { response: bindResponse, payload: bind } = await postJson("/api/opl-launch/sessions/bind", {
    oplSessionId: "opl-session-local-fake-bound",
    source: "runtime-bridge-local-fake-probe",
  }, bearer(launch.launchToken));
  assert.equal(bindResponse.status, 200, "session_bind_status_mismatch");
  assert.equal(bind.runtimeSession.oplSessionId, "opl-session-local-fake-bound", "session_bind_opl_session_mismatch");
  assert.equal(bind.runtimeSession.providerBound, true, "session_bind_must_keep_provider_bound");

  const { response: messageResponse, payload: message } = await postJson("/api/opl-launch/messages", {
    messageId: "message-local-fake",
    message: "Summarize the local fake runtime state.",
    waitForCompletion: true,
    model: "gpt-5.5",
    tokenCount: 20,
  }, bearer(launch.launchToken));
  assert.equal(messageResponse.status, 200, "message_status_mismatch");
  assert.equal(message.ok, true, "message_must_succeed");
  assert.equal(message.message.status, "succeeded", "message_reply_status_mismatch");
  assert.equal(message.message.reply, "local fake OPL reply", "message_reply_mismatch");
  assert.equal(message.artifact.kind, "message_reply", "message_artifact_kind_mismatch");
  assert(message.trace.traceId, "message_trace_missing");
  assert.equal(JSON.stringify(message).includes("dummy-local-provider-key"), false, "message_response_must_not_expose_provider_key_payload");

  const { response: messageStatusResponse, payload: messageStatus } = await fetchJson("/api/opl-launch/messages/message-local-fake/status", {
    headers: bearer(launch.launchToken),
  });
  assert.equal(messageStatusResponse.status, 200, "message_status_lookup_status_mismatch");
  assert.equal(messageStatus.status, "succeeded", "message_status_lookup_mismatch");
  assert.equal(messageStatus.artifact.kind, "message_reply", "message_status_artifact_mismatch");

  const { response: runResponse, payload: runPayload } = await postJson("/api/opl-launch/runs", {
    runId: "run-local-fake",
    traceId: "trace-run-local-fake",
    mode: "full_runtime",
    resourceBindingId: "resource-binding-local-fake",
    computeInstanceId: "compute-local-fake",
    storageBucketId: "bucket-local-fake",
    runtimeAgentId: "runtime-agent-local-fake",
    fileRefs: ["input/local-fake.txt"],
    toolName: "opl-local-fake",
    model: "gpt-5.5",
    tokenCount: 20,
  }, bearer(launch.launchToken));
  assert.equal(runResponse.status, 200, "runtime_run_status_mismatch");
  assert.equal(runPayload.ok, true, "runtime_run_must_succeed");
  assert.equal(runPayload.run.status, "succeeded", "runtime_run_status_payload_mismatch");
  assert.equal(runPayload.run.ledgerEntryCount, 1, "runtime_run_must_project_ledger_entry_count");
  assert.equal(runPayload.artifacts.length, 1, "runtime_run_must_project_artifact");
  assert.equal(runPayload.run.runtimeClaims.runtimeSessionId, launch.runtimeSessionId, "runtime_run_claims_session_mismatch");
  assert.equal(JSON.stringify(runPayload).includes("dummy-local-provider-key"), false, "runtime_run_response_must_not_expose_provider_key_payload");

  const { response: runStatusResponse, payload: runStatus } = await fetchJson("/api/opl-launch/runs/run-local-fake/status", {
    headers: bearer(launch.launchToken),
  });
  assert.equal(runStatusResponse.status, 200, "run_status_status_mismatch");
  assert.equal(runStatus.run.status, "succeeded", "run_status_payload_mismatch");

  const { response: runArtifactsResponse, payload: runArtifacts } = await fetchJson("/api/opl-launch/runs/run-local-fake/artifacts", {
    headers: bearer(launch.launchToken),
  });
  assert.equal(runArtifactsResponse.status, 200, "run_artifacts_status_mismatch");
  assert.equal(runArtifacts.items.length, 1, "run_artifacts_must_return_one_item");
  const artifactRef = runArtifacts.items[0].artifactRef;
  assert(artifactRef, "run_artifacts_must_project_artifact_ref");

  const { response: artifactResponse, payload: artifactDetail } = await fetchJson(`/api/opl/artifacts/${encodeURIComponent(artifactRef)}`, {
    headers: bearer(launch.launchToken),
  });
  assert.equal(artifactResponse.status, 200, "artifact_detail_status_mismatch");
  assert.equal(artifactDetail.artifact.artifactRef, artifactRef, "artifact_detail_ref_mismatch");

  const { response: traceLinksResponse, payload: traceLinks } = await fetchJson("/api/trace-links");
  assert.equal(traceLinksResponse.status, 200, "trace_links_status_mismatch");
  assert(traceLinks.items.some((item) => item.runId === "run-local-fake"), "trace_links_must_include_runtime_run");
  assert(traceLinks.runActions.some((item) => item.runId === "message-local-fake" && item.actionType === "opl_message_reply_persisted"), "trace_links_must_include_message_action");

  const { response: finalBootstrapResponse, payload: finalBootstrap } = await fetchJson("/api/opl-launch/bootstrap", {
    headers: bearer(launch.launchToken),
  });
  assert.equal(finalBootstrapResponse.status, 200, "final_bootstrap_status_mismatch");
  assert(finalBootstrap.resources.messages.some((item) => item.messageId === "message-local-fake" && item.status === "succeeded"), "final_bootstrap_must_project_message");
  assert(finalBootstrap.runs.some((item) => item.runId === "run-local-fake" && item.status === "succeeded"), "final_bootstrap_must_project_run");
  assert(finalBootstrap.resources.artifacts.some((item) => item.runId === "run-local-fake"), "final_bootstrap_must_project_run_artifact");
  assert(finalBootstrap.traces.some((item) => item.runId === "run-local-fake"), "final_bootstrap_must_project_run_trace");
  assert(finalBootstrap.costs.length === 0, "local_fake_probe_must_not_create_production_cost_records");
  assert.equal(JSON.stringify(finalBootstrap).includes("dummy-local-provider-key"), false, "final_bootstrap_must_not_expose_provider_key_payload");

  console.log(JSON.stringify({
    ok: true,
    contract: "v22_runtime_bridge_local_fake_probe",
    evidence: "local_fake_runtime_only",
    cannotClaim: [
      "real_upstream_opl",
      "live_provider",
      "production_runtime",
      "real_cloud",
      "production_billing",
    ],
    verified: [
      "healthz",
      "launch_token",
      "bootstrap",
      "session_bind",
      "message_reply_artifact_trace",
      "runtime_run_artifact_ledger_projection",
      "artifact_detail",
      "trace_links",
    ],
  }, null, 2));
} catch (error) {
  if (runtimeOutput.stdout || runtimeOutput.stderr) {
    process.stderr.write(JSON.stringify({ runtimeOutput }, null, 2));
    process.stderr.write("\n");
  }
  throw error;
} finally {
  await stopChild(runtimeBridge);
  await rm(stateRoot, { recursive: true, force: true });
}
