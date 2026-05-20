import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import net from "node:net";
import { setTimeout as sleep } from "node:timers/promises";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function close(server) {
  return new Promise((resolve) => server.close(resolve));
}

async function freePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const port = server.address().port;
  await close(server);
  return port;
}

async function waitFor(url) {
  for (let index = 0; index < 80; index += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {}
    await sleep(100);
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function postJson(url, payload, headers = {}) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json", ...headers },
    body: JSON.stringify(payload),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`POST ${url} failed ${response.status}: ${JSON.stringify(body)}`);
  }
  return body;
}

const stateRoot = await mkdtemp(path.join(os.tmpdir(), "opl-runtime-bridge-smoke-"));
let server = null;

try {
  const port = await freePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  server = spawn("node", ["services/opl-runtime-bridge/src/server.mjs"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: String(port),
      NODE_ENV: "development",
      OPL_WEB_URL: "https://opl.example.test",
      PORTAL_RUNTIME_BRIDGE_PUBLIC_URL: baseUrl,
      PORTAL_RUNTIME_BRIDGE_STATE_ROOT: stateRoot,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  server.stdout.on("data", (chunk) => process.stdout.write(`[runtime-bridge] ${chunk}`));
  server.stderr.on("data", (chunk) => process.stderr.write(`[runtime-bridge] ${chunk}`));

  await waitFor(`${baseUrl}/healthz`);

  const launchA = await postJson(`${baseUrl}/api/opl-launch/tokens`, {
    portalUserId: "portal-user-a",
    portalUserEmail: "a@example.test",
    portalUserName: "Portal A",
    tenantId: "tenant-a",
    workspaceId: "workspace-a",
    workspaceTitle: "Workspace A",
    workspacePath: "C:\\workspace-a",
    workspaceSessionId: "workspace-session-a",
    ownerId: "portal-user-a",
    sessionOwnerId: "portal-user-a",
    traceOwnerId: "portal-user-a",
    artifactOwnerId: "portal-user-a",
    storageOwnerId: "portal-user-a",
  });
  const launchB = await postJson(`${baseUrl}/api/opl-launch/tokens`, {
    portalUserId: "portal-user-b",
    portalUserEmail: "b@example.test",
    portalUserName: "Portal B",
    tenantId: "tenant-b",
    workspaceId: "workspace-b",
    workspaceTitle: "Workspace B",
    workspacePath: "C:\\workspace-b",
    workspaceSessionId: "workspace-session-b",
    ownerId: "portal-user-b",
    sessionOwnerId: "portal-user-b",
    traceOwnerId: "portal-user-b",
    artifactOwnerId: "portal-user-b",
    storageOwnerId: "portal-user-b",
  });

  await postJson(`${baseUrl}/api/opl-launch/sessions/bind`, {
    oplSessionId: "opl-session-a",
    source: "smoke-test",
  }, {
    authorization: `Bearer ${launchA.launchToken}`,
  });

  process.env.PORTAL_RUNTIME_BRIDGE_STATE_ROOT = stateRoot;
  const stateStore = await import("../../../services/opl-runtime-bridge/src/state-store.mjs");
  const state = await stateStore.readState();
  stateStore.addTraceRecord(state, {
    traceId: "trace-a",
    portalUserId: "portal-user-a",
    tenantId: "tenant-a",
    ownerId: "portal-user-a",
    traceOwnerId: "portal-user-a",
    workspaceId: "workspace-a",
    workspaceSessionId: "workspace-session-a",
    runtimeSessionId: launchA.runtimeSessionId,
    runId: "run-a",
    traceName: "Trace A",
  });
  stateStore.addTraceRecord(state, {
    traceId: "trace-b",
    portalUserId: "portal-user-b",
    tenantId: "tenant-b",
    ownerId: "portal-user-b",
    traceOwnerId: "portal-user-b",
    workspaceId: "workspace-b",
    workspaceSessionId: "workspace-session-b",
    runtimeSessionId: launchB.runtimeSessionId,
    runId: "run-b",
    traceName: "Trace B",
  });
  stateStore.addArtifactRecord(state, {
    artifactId: "artifact-a",
    portalUserId: "portal-user-a",
    tenantId: "tenant-a",
    ownerId: "portal-user-a",
    artifactOwnerId: "portal-user-a",
    storageOwnerId: "portal-user-a",
    workspaceId: "workspace-a",
    workspaceSessionId: "workspace-session-a",
    runtimeSessionId: launchA.runtimeSessionId,
    runId: "run-a",
    name: "result-a.json",
    objectKey: "workspace-a/result-a.json",
  });
  stateStore.addArtifactRecord(state, {
    artifactId: "artifact-b",
    portalUserId: "portal-user-b",
    tenantId: "tenant-b",
    ownerId: "portal-user-b",
    artifactOwnerId: "portal-user-b",
    storageOwnerId: "portal-user-b",
    workspaceId: "workspace-b",
    workspaceSessionId: "workspace-session-b",
    runtimeSessionId: launchB.runtimeSessionId,
    runId: "run-b",
    name: "result-b.json",
    objectKey: "workspace-b/result-b.json",
  });
  await stateStore.writeState(state);

  const bootstrapResponse = await fetch(`${baseUrl}/api/opl-launch/bootstrap`, {
    headers: { authorization: `Bearer ${launchA.launchToken}` },
  });
  const bootstrap = await bootstrapResponse.json();
  assert(bootstrapResponse.ok, "bootstrap request must succeed");
  const bootstrapSerialized = JSON.stringify(bootstrap);
  assert(!bootstrapSerialized.includes('"tenantId"'), "bootstrap public payload must not expose tenantId field");
  assert(!bootstrapSerialized.includes("tenant-a"), "bootstrap public payload must not expose tenant-a value");
  assert(!bootstrapSerialized.includes("tenant-b"), "bootstrap public payload must not expose tenant-b value");
  assert(bootstrap.portal.portalUserId === "portal-user-a", "bootstrap portal user mismatch");
  assert(bootstrap.identity.portalUserId === "portal-user-a", "bootstrap identity portal user mismatch");
  assert(bootstrap.identity.workspaceId === "workspace-a", "bootstrap identity workspace mismatch");
  assert(bootstrap.identity.workspaceSessionId === "workspace-session-a", "bootstrap identity workspace session mismatch");
  assert(bootstrap.identity.runtimeSessionId === launchA.runtimeSessionId, "bootstrap identity runtime session mismatch");
  assert(bootstrap.identity.oplSessionId === "opl-session-a", "bootstrap identity opl session mismatch");
  assert(bootstrap.ownership.traceOwnerId === "portal-user-a", "bootstrap trace owner mismatch");
  assert(bootstrap.ownership.storageOwnerId === "portal-user-a", "bootstrap storage owner mismatch");
  assert(bootstrap.workspace.inputOwner === "portal-user-a", "bootstrap workspace input owner mismatch");
  assert(bootstrap.workspace.outputOwner === "portal-user-a", "bootstrap workspace output owner mismatch");
  assert(bootstrap.workspace.storageOwnerId === "portal-user-a", "bootstrap workspace storage owner mismatch");
  assert(bootstrap.session.ownerId === "portal-user-a", "bootstrap session owner mismatch");
  assert(bootstrap.storage.ownerId === "portal-user-a", "bootstrap storage owner view mismatch");
  assert(bootstrap.runtimeSession.portalUserId === "portal-user-a", "bootstrap runtime session portal user mismatch");
  assert(bootstrap.resources.workspaces.length === 1, "bootstrap workspaces must be filtered to current workspace scope");
  assert(bootstrap.resources.workspaces[0].workspaceId === "workspace-a", "bootstrap workspace filter mismatch");
  assert(bootstrap.resources.sessions.length === 1, "bootstrap sessions must be filtered to current workspace scope");
  assert(bootstrap.resources.sessions[0].workspaceSessionId === "workspace-session-a", "bootstrap session filter mismatch");
  assert(bootstrap.resources.sessions[0].portalUserId === "portal-user-a", "bootstrap session portal user field mismatch");
  assert(bootstrap.traces.length === 1, "bootstrap traces must be filtered by Portal scope");
  assert(bootstrap.traces[0].traceId === "trace-a", "bootstrap trace filter mismatch");
  assert(bootstrap.traces[0].runtimeSessionId === launchA.runtimeSessionId, "bootstrap trace runtime session mismatch");
  assert(bootstrap.resources.artifacts.length === 1, "bootstrap artifacts must be filtered by Portal scope");
  assert(bootstrap.resources.artifacts[0].artifactId === "artifact-a", "bootstrap artifact filter mismatch");
  assert(bootstrap.resources.artifacts[0].runtimeSessionId === launchA.runtimeSessionId, "bootstrap artifact runtime session mismatch");

  console.log(JSON.stringify({
    ok: true,
    baseUrl,
    verified: [
      "bootstrap_identity_scope",
      "workspace_owner_scope",
      "session_owner_scope",
      "trace_owner_scope",
      "artifact_storage_scope",
      "cross_workspace_filtering",
    ],
  }, null, 2));
} finally {
  if (server) server.kill();
  delete process.env.PORTAL_RUNTIME_BRIDGE_STATE_ROOT;
  await rm(stateRoot, { recursive: true, force: true });
}
