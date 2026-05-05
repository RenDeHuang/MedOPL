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
    const request = JSON.parse(trimmed);
    const handler = fixtureHandlers[request.command];
    if (handler) {
      writeFixtureResponse(request, handler(request));
      continue;
    }
    writeFixtureError(request, "unknown_command", `Unsupported fixture command: ${request.command}`);
  }
}

const fixtureHandlers = {
  initialize: () => ({
    surface_id: "opl_acp_stdio_bridge",
    version: "opl_acp_stdio_bridge.v2",
    commands: ["initialize", "session_list", "session_ledger", "prompt"],
  }),
  session_list: () => ({
    surface_id: "opl_acp_session_list",
    mode: "opl_acp_runtime_sessions",
    limit: 20,
    items: [],
  }),
  session_ledger: () => ({
    surface_id: "opl_acp_session_ledger",
    ledger_scope: "fixture",
    summary: { entry_count: 0 },
    sessions: [],
  }),
  prompt: (request) => {
    const prompt = String(request.payload?.prompt || "").trim();
    const codexConfigPath = path.join(String(process.env.CODEX_HOME || ""), "config.toml");
    if (!process.env.CODEX_HOME || !existsSync(codexConfigPath)) {
      throw new Error("codex_provider_config_missing");
    }
    const codexConfig = readFileSync(codexConfigPath, "utf8");
    if (!codexConfig.includes('model_provider = "gflab"')) {
      throw new Error("codex_provider_model_provider_missing");
    }
    if (!codexConfig.includes('base_url = "https://gflabtoken.cn/v1"')) {
      throw new Error("codex_provider_base_url_missing");
    }
    if (!codexConfig.includes('experimental_bearer_token = "gflabtoken_contract_callback_secret"')) {
      throw new Error("codex_provider_token_missing");
    }
    return {
      surface_id: "opl_acp_prompt",
      session_id: request.payload?.session_id || "fixture-session",
      runtime_session_id: `fixture-thread-${Date.now()}`,
      stop_reason: "end_turn",
      response: `v20.2 OPL 回复：${prompt}`,
      command_preview: ["fixture-opl-acp", "prompt"],
    };
  },
};

if (process.argv.includes("--acp-fixture")) {
  await runAcpFixture();
  process.exit(0);
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

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const payload = await response.json().catch(() => ({}));
  assert(response.ok, `${url} failed: ${JSON.stringify(payload)}`);
  return payload;
}

function postJson(url, body) {
  return fetchJson(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const stateRoot = await mkdtemp(path.join(os.tmpdir(), "opl-v20-2-message-callback-"));
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
  await mkdir(providerSecretRoot, { recursive: true, mode: 0o700 });
  await writeFile(
    path.join(providerSecretRoot, "gflab-message-secret-ref.json"),
    `${JSON.stringify({
      version: "v1",
      provider: "gflabtoken",
      source: "user_input",
      apiKey: "gflabtoken_contract_callback_secret",
      createdAt: new Date().toISOString(),
    })}\n`,
    { mode: 0o600 },
  );

  const launch = await postJson(`${baseUrl}/api/opl-launch/tokens`, {
    portalUserId: "message-user-v20-2",
    portalUserEmail: "message-user@example.test",
    workspaceId: "message-workspace",
    workspaceSessionId: "workspace-session-v20-2-message",
    providerConfigSecretRef: "gflab-message-secret-ref",
    providerConfig: {
      providerName: "gflab",
      providerConfigSecretRef: "gflab-message-secret-ref",
      providerConfigStatus: "configured",
      secretFingerprint: "fingerprint-only",
      modelProvider: "gflab",
      model: "gpt-5.5",
      modelReasoningEffort: "xhigh",
      serviceTier: "fast",
      sandboxMode: "danger-full-access",
    },
  });
  assert(launch.launchToken, "launch token missing");

  const bootstrap = await fetchJson(launch.bootstrapUrl);
  assert(bootstrap.callbacks?.message, "message callback must be exposed in bootstrap");
  assert.equal(bootstrap.provider?.providerConfigured, true, "provider must be configured before message callback");

  const message = await postJson(bootstrap.callbacks.message, {
    launchToken: launch.launchToken,
    messageId: "message-v20-2-contract",
    message: "请回复 v20.2 callback ok",
    waitForCompletion: true,
  });
  assert.equal(message.ok, true, "message callback must succeed");
  assert.equal(message.message?.messageId, "message-v20-2-contract", "message id mismatch");
  assert.match(message.message?.reply || "", /v20\.2 callback ok/, "reply text must come from ACP prompt");
  assert.equal(message.artifact?.kind, "message_reply", "reply must be persisted as message_reply artifact");
  assert.ok(Number(message.artifact?.sizeBytes || 0) > 0, "reply artifact must be non-empty");

  const refreshed = await fetchJson(launch.bootstrapUrl);
  assert(
    refreshed.resources?.artifacts?.some((item) =>
      item.kind === "message_reply" &&
      item.name === "message-v20-2-contract-reply.md" &&
      Number(item.sizeBytes || 0) > 0
    ),
    "bootstrap artifacts must include persisted message reply",
  );

  const traces = await fetchJson(`${baseUrl}/api/trace-links`);
  assert(
    traces.items?.some((item) =>
      item.runId === "message-v20-2-contract" &&
      item.traceName === "OPL message reply" &&
      item.status === "succeeded"
    ),
    "message reply trace must be recorded",
  );

  const serialized = JSON.stringify({
    message: {
      ok: message.ok,
      messageId: message.message?.messageId,
      reply: message.message?.reply,
      artifact: {
        kind: message.artifact?.kind,
        name: message.artifact?.name,
        sizeBytes: message.artifact?.sizeBytes,
      },
    },
    refreshed: {
      artifactCount: refreshed.resources?.artifacts?.length || 0,
    },
    traces: {
      count: traces.items?.length || 0,
    },
  });
  assert.doesNotMatch(serialized, /sk-|gflabtoken_[A-Za-z0-9]|AKID|SECRET/i, "message evidence must not expose secrets");

  console.log(JSON.stringify({
    ok: true,
    baseUrl,
    checked: [
      "message_callback_exposed",
      "provider_config_required",
      "acp_prompt_reply_non_empty",
      "message_reply_artifact_persisted",
      "message_reply_trace_recorded",
      "secret_redaction",
    ],
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
