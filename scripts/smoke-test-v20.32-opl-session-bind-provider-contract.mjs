import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import http from "node:http";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

async function freePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
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

const stateRoot = await mkdtemp(path.join(os.tmpdir(), "opl-v20-32-bind-provider-"));
const providerSecretRoot = path.join(stateRoot, "provider-secrets");
const port = await freePort();
const baseUrl = `http://127.0.0.1:${port}`;
const apiKey = "gflabtoken_contract_bind_provider_secret";

process.env.PORT = String(port);
process.env.NODE_ENV = "development";
process.env.OPL_WEB_URL = "https://opl.example.test";
process.env.PORTAL_OPL_ADAPTER_PUBLIC_URL = baseUrl;
process.env.PORTAL_OPL_ADAPTER_STATE_ROOT = stateRoot;
process.env.PORTAL_OPL_PROVIDER_SECRET_ROOT = providerSecretRoot;
process.env.OPL_RUNTIME_MODE = "acp";
process.env.OPL_ACP_RUNTIME_COMMAND_JSON = JSON.stringify([process.execPath, "-e", "process.exit(0)"]);

let server = null;

try {
  await mkdir(providerSecretRoot, { recursive: true, mode: 0o700 });
  const { createRuntimeBridgeServer } = await import("../services/opl-runtime-bridge/src/runtime-bridge-bootstrap.mjs");
  server = createRuntimeBridgeServer();
  assert(server instanceof http.Server, "createRuntimeBridgeServer must return http.Server");
  await new Promise((resolve) => server.listen(port, "127.0.0.1", resolve));
  await waitFor(`${baseUrl}/healthz`);

  const launch = await postJson(`${baseUrl}/api/opl-launch/tokens`, {
    portalUserId: "bind-provider-user-v20-32",
    portalUserEmail: "bind-provider@example.test",
    workspaceId: "bind-provider-workspace",
    workspaceSessionId: "workspace-session-v20-32-bind-provider",
  });
  assert(launch.launchToken, "launch token missing");

  const before = await fetchJson(launch.bootstrapUrl);
  assert.equal(before.provider?.providerConfigured, false, "provider must start unconfigured");

  const bind = await postJson(`${baseUrl}/api/opl-launch/sessions/bind`, {
    launchToken: launch.launchToken,
    oplSessionId: "opl-web:bind-provider",
    provider: "gflabtoken",
    source: "user_input",
    apiKey,
  });
  assert.equal(bind.ok, true, "session bind must succeed");
  assert.equal(bind.runtimeSession?.providerConfigured, true, "session bind must mark provider configured");
  assert.equal(bind.runtimeSession?.providerConfigStatus, "configured", "session bind must mark provider status configured");
  assert.match(bind.runtimeSession?.providerConfigSecretRef || "", /^gflab-/, "session bind must return secret ref only");
  assert.equal(JSON.stringify(bind).includes(apiKey), false, "session bind response must not expose api key");

  const after = await fetchJson(launch.bootstrapUrl);
  assert.equal(after.provider?.providerConfigured, true, "bootstrap must report provider configured after bind");
  assert.equal(after.provider?.providerConfigStatus, "configured", "bootstrap provider status must be configured");

  const secretRef = bind.runtimeSession.providerConfigSecretRef;
  const secretPath = path.join(providerSecretRoot, `${secretRef}.json`);
  const secretPayload = JSON.parse(await readFile(secretPath, "utf8"));
  assert.equal(secretPayload.provider, "gflabtoken", "provider secret provider mismatch");
  assert.equal(secretPayload.source, "user_input", "provider secret source mismatch");
  assert.equal(secretPayload.apiKey, apiKey, "provider secret must persist api key at secret boundary");

  console.log(JSON.stringify({
    ok: true,
    contract: "v20.32_opl_session_bind_provider",
  }, null, 2));
} finally {
  if (server) await new Promise((resolve) => server.close(resolve));
  await rm(stateRoot, { recursive: true, force: true });
}
