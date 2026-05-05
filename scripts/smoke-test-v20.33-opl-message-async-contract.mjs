import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import http from "node:http";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import { setTimeout as sleep } from "node:timers/promises";

const currentFile = fileURLToPath(import.meta.url);

async function runAcpFixture() {
  const lines = createInterface({ input: process.stdin, crlfDelay: Infinity });
  for await (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    await handleFixtureRequest(JSON.parse(trimmed));
  }
}

async function handleFixtureRequest(request) {
  if (request.command === "initialize") {
    writeFixtureResponse(request, fixtureInitializeResult());
    return;
  }
  if (request.command === "prompt") {
    await writePromptFixtureResponse(request);
    return;
  }
  writeFixtureError(request, "unknown_command", `Unsupported fixture command: ${request.command}`);
}

function fixtureInitializeResult() {
  return {
    surface_id: "opl_acp_stdio_bridge",
    version: "opl_acp_stdio_bridge.v20.33.async",
    commands: ["initialize", "prompt"],
  };
}

function assertFixtureProviderConfig() {
  const codexConfigPath = path.join(String(process.env.CODEX_HOME || ""), "config.toml");
  if (!process.env.CODEX_HOME || !existsSync(codexConfigPath)) {
    throw new Error("codex_provider_config_missing");
  }
  const codexConfig = readFileSync(codexConfigPath, "utf8");
  if (!codexConfig.includes('model_provider = "gflab"')) {
    throw new Error("codex_provider_model_provider_missing");
  }
}

async function writePromptFixtureResponse(request) {
  const prompt = String(request.payload?.prompt || "").trim();
  assertFixtureProviderConfig();
  await sleep(900);
  writeFixtureResponse(request, {
    surface_id: "opl_acp_prompt",
    session_id: request.payload?.session_id || "async-fixture-session",
    runtime_session_id: `async-fixture-thread-${Date.now()}`,
    stop_reason: "end_turn",
    response: `v20.33 async reply: ${prompt}`,
  });
}

function writeFixtureResponse(request, result) {
  process.stdout.write(`${JSON.stringify({
    id: typeof request.id === "string" ? request.id : null,
    command: typeof request.command === "string" ? request.command : null,
    ok: true,
    result,
  })}\n`);
}

function writeFixtureError(request, code, message) {
  process.stdout.write(`${JSON.stringify({
    id: typeof request.id === "string" ? request.id : null,
    command: typeof request.command === "string" ? request.command : null,
    ok: false,
    error: { code, message },
  })}\n`);
}

if (process.argv.includes("--acp-fixture")) {
  await runAcpFixture();
  process.exit(0);
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

async function fetchJsonRaw(url, options = {}) {
  const started = Date.now();
  const response = await fetch(url, options);
  const bodyText = await response.text();
  const payload = bodyText ? JSON.parse(bodyText) : {};
  return {
    status: response.status,
    ok: response.ok,
    latencyMs: Date.now() - started,
    payload,
  };
}

async function fetchJson(url, options = {}) {
  const result = await fetchJsonRaw(url, options);
  assert(result.ok, `${url} failed: ${JSON.stringify(result.payload)}`);
  return result.payload;
}

function postJsonRaw(url, body) {
  return fetchJsonRaw(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function assertAcceptedMessage(accepted) {
  assert.equal(accepted.status, 202, "message callback must return 202 before ACP prompt completes");
  assert(accepted.latencyMs < 500, `message callback must not hold the gateway connection: ${accepted.latencyMs}ms`);
  assert.equal(accepted.payload.ok, true, "accepted payload must be ok");
  assert.equal(accepted.payload.status, "accepted", "accepted payload status mismatch");
  assert.equal(accepted.payload.message?.messageId, "message-v20-33-async-contract", "accepted message id mismatch");
  assert.equal(accepted.payload.message?.status, "running", "accepted message must be marked running");
  assert.match(accepted.payload.statusUrl || "", /\/api\/opl-launch\/messages\/message-v20-33-async-contract\/status/, "statusUrl must target message status endpoint");
  assert(!accepted.payload.message?.reply, "accepted response must not claim a reply before completion");
}

async function pollMessageStatus(statusUrl) {
  let last = null;
  for (let index = 0; index < 30; index += 1) {
    last = await fetchJson(statusUrl);
    if (last.status === "succeeded") return last;
    assert.notEqual(last.status, "failed", `async message failed: ${JSON.stringify(last)}`);
    await sleep(100);
  }
  throw new Error(`async_message_status_timeout:${JSON.stringify(last)}`);
}

function assertFinalMessageStatus(finalStatus) {
  assert.equal(finalStatus.ok, true, "final status payload must be ok");
  assert.equal(finalStatus.status, "succeeded", "message must eventually succeed");
  assert.match(finalStatus.message?.reply || "", /v20\.33 async contract ok/, "reply text must come from ACP prompt");
  assert.equal(finalStatus.artifact?.kind, "message_reply", "reply must be persisted as message_reply artifact");
}

function assertMessageTrace(traces) {
  assert(
    traces.items?.some((item) =>
      item.runId === "message-v20-33-async-contract" &&
      item.traceName === "OPL message reply" &&
      item.status === "succeeded"
    ),
    "async message reply trace must be recorded",
  );
}

async function createLaunch(baseUrl) {
  return fetchJson(`${baseUrl}/api/opl-launch/tokens`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      portalUserId: "message-user-v20-33",
      portalUserEmail: "message-user@example.test",
      workspaceId: "message-workspace",
      workspaceSessionId: "workspace-session-v20-33-message",
      providerConfigSecretRef: "gflab-message-async-secret-ref",
      providerConfig: {
        providerName: "gflab",
        providerConfigSecretRef: "gflab-message-async-secret-ref",
        providerConfigStatus: "configured",
        secretFingerprint: "fingerprint-only",
        modelProvider: "gflab",
        model: "gpt-5.5",
        modelReasoningEffort: "xhigh",
      },
    }),
  });
}

async function writeProviderSecret(providerSecretRoot) {
  await mkdir(providerSecretRoot, { recursive: true, mode: 0o700 });
  await writeFile(
    path.join(providerSecretRoot, "gflab-message-async-secret-ref.json"),
    `${JSON.stringify({
      version: "v1",
      provider: "gflabtoken",
      source: "user_input",
      apiKey: "gflabtoken_contract_async_secret",
      createdAt: new Date().toISOString(),
    })}\n`,
    { mode: 0o600 },
  );
}

const stateRoot = await mkdtemp(path.join(os.tmpdir(), "opl-v20-33-message-async-"));
const providerSecretRoot = path.join(stateRoot, "provider-secrets");
const port = await freePort();
const baseUrl = `http://127.0.0.1:${port}`;

process.env.PORT = String(port);
process.env.NODE_ENV = "development";
process.env.OPL_WEB_URL = "https://opl.example.test";
process.env.PORTAL_OPL_ADAPTER_PUBLIC_URL = baseUrl;
process.env.PORTAL_OPL_ADAPTER_STATE_ROOT = stateRoot;
process.env.PORTAL_OPL_PROVIDER_SECRET_ROOT = providerSecretRoot;
process.env.OPL_RUNTIME_MODE = "acp";
process.env.OPL_ACP_RUNTIME_COMMAND_JSON = JSON.stringify([process.execPath, currentFile, "--acp-fixture"]);

let server = null;

try {
  const { createRuntimeBridgeServer } = await import("../services/opl-runtime-bridge/src/runtime-bridge-bootstrap.mjs");
  server = createRuntimeBridgeServer();
  assert(server instanceof http.Server, "createRuntimeBridgeServer must return http.Server");

  await new Promise((resolve) => server.listen(port, "127.0.0.1", resolve));
  await waitFor(`${baseUrl}/healthz`);
  await writeProviderSecret(providerSecretRoot);

  const launch = await createLaunch(baseUrl);
  assert(launch.launchToken, "launch token missing");

  const bootstrap = await fetchJson(launch.bootstrapUrl);
  assert(bootstrap.callbacks?.message, "message callback must be exposed");
  assert(bootstrap.callbacks?.messageStatus, "message status callback must be exposed");

  const accepted = await postJsonRaw(bootstrap.callbacks.message, {
    launchToken: launch.launchToken,
    messageId: "message-v20-33-async-contract",
    message: "请回复 v20.33 async contract ok",
  });
  assertAcceptedMessage(accepted);

  const finalStatus = await pollMessageStatus(accepted.payload.statusUrl);
  assertFinalMessageStatus(finalStatus);

  const traces = await fetchJson(`${baseUrl}/api/trace-links`);
  assertMessageTrace(traces);

  console.log(JSON.stringify({
    ok: true,
    contract: "v20.33_opl_message_async",
    acceptedLatencyMs: accepted.latencyMs,
    finalStatus: finalStatus.status,
  }, null, 2));
} finally {
  if (server) await close(server);
  delete process.env.PORT;
  delete process.env.NODE_ENV;
  delete process.env.OPL_WEB_URL;
  delete process.env.PORTAL_OPL_ADAPTER_PUBLIC_URL;
  delete process.env.PORTAL_OPL_ADAPTER_STATE_ROOT;
  delete process.env.PORTAL_OPL_PROVIDER_SECRET_ROOT;
  delete process.env.OPL_RUNTIME_MODE;
  delete process.env.OPL_ACP_RUNTIME_COMMAND_JSON;
  await rm(stateRoot, { recursive: true, force: true });
}
