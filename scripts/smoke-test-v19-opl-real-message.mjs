import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

const oplPort = Number(process.env.OPL_PRODUCT_API_FIXTURE_TEST_PORT || 19330);
const runnerPort = Number(process.env.MED_RUNNER_FIXTURE_TEST_PORT || 19331);
const adapterPort = Number(process.env.PORTAL_OPL_ADAPTER_TEST_PORT || 19332);
const portalPort = Number(process.env.PORTAL_INTERNAL_FIXTURE_TEST_PORT || 19333);
const oplUrl = `http://127.0.0.1:${oplPort}`;
const runnerUrl = `http://127.0.0.1:${runnerPort}`;
const adapterUrl = `http://127.0.0.1:${adapterPort}`;
const portalUrl = `http://127.0.0.1:${portalPort}`;
const testRoot = mkdtempSync(path.join(tmpdir(), "opl-v19-real-message-"));
const stateRoot = path.join(testRoot, "adapter-state");
const runnerRoot = path.join(testRoot, "runner-fixture");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function spawnService(label, command, args, options) {
  const child = spawn(command, args, { ...options, stdio: ["ignore", "pipe", "pipe"] });
  child.stdout.on("data", (chunk) => process.stdout.write(`[${label}] ${chunk}`));
  child.stderr.on("data", (chunk) => process.stderr.write(`[${label}] ${chunk}`));
  return child;
}

async function waitFor(url, label) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.status < 500) return;
    } catch {}
    await sleep(100);
  }
  throw new Error(`${label} did not become ready`);
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const payload = await response.json().catch(() => ({}));
  assert(response.ok, `${url} failed: ${JSON.stringify(payload)}`);
  return payload;
}

function postJson(url, body, headers = {}) {
  return fetchJson(url, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

let portal = null;
let opl = null;
let runner = null;
let adapter = null;

try {
  portal = spawnService("portal-fixture", "node", ["scripts/fixtures/portal-internal-resource-order-fixture.mjs"], {
    env: { ...process.env, PORT: String(portalPort) },
  });
  opl = spawnService("opl-fixture", "node", ["scripts/fixtures/opl-product-api-fixture.mjs"], {
    env: { ...process.env, PORT: String(oplPort) },
  });
  runner = spawnService("runner-fixture", "node", ["scripts/fixtures/med-autoscience-runner-fixture.mjs"], {
    env: { ...process.env, PORT: String(runnerPort), MED_AUTOSCIENCE_RUNNER_FIXTURE_ROOT: runnerRoot },
  });
  adapter = spawnService("opl-adapter", "node", ["src/server.mjs"], {
    cwd: "services/opl-runtime-bridge",
    env: {
      ...process.env,
      PORT: String(adapterPort),
      PORTAL_OPL_ADAPTER_PUBLIC_URL: adapterUrl,
      PORTAL_OPL_ADAPTER_STATE_ROOT: stateRoot,
      PORTAL_INTERNAL_BASE_URL: portalUrl,
      OPL_PRODUCT_API_URL: oplUrl,
      OPL_WEB_URL: "http://127.0.0.1:19339",
      MED_AUTOSCIENCE_RUNNER_URL: runnerUrl,
    },
  });

  await waitFor(`${portalUrl}/healthz`, "portal internal fixture");
  await waitFor(`${oplUrl}/healthz`, "OPL Product API fixture");
  await waitFor(`${runnerUrl}/healthz`, "runner fixture");
  await waitFor(`${adapterUrl}/healthz`, "adapter");

  const launch = await postJson(`${adapterUrl}/api/opl-launch/tokens`, {
    portalUserId: "real-message-user",
    portalUserEmail: "real-message-user@example.com",
    workspaceId: "default",
    providerConfigSecretRef: "gflab-real-message-smoke",
    providerConfig: {
      providerName: "gflab",
      modelProvider: "gflab",
      model: "gpt-5.5",
      modelReasoningEffort: "xhigh",
      serviceTier: "fast",
      sandboxMode: "danger-full-access",
    },
  });
  const bootstrap = await fetchJson(launch.bootstrapUrl);
  await postJson(bootstrap.callbacks.sessionBind, {
    launchToken: launch.launchToken,
    oplSessionId: "opl-web-real-message-smoke",
    status: "active",
  });
  const run = await postJson(bootstrap.callbacks.startRun, {
    launchToken: launch.launchToken,
    runId: "v19-real-message-run",
    agentId: "mas",
    toolName: "opl-real-message",
    source: "opl-web-native-message",
    input: { message: "请生成一个测试输出文件。" },
    model: "gpt-5.5",
    tokenCount: 42,
  }, { "user-agent": "v19-opl-real-message-smoke" });
  assert(run.run?.runId === "v19-real-message-run", "run id mismatch");
  assert(run.run?.resourceOrderId === "ro-v19-real-message-run", "resourceOrderId must be prepared before runner submission");

  const status = await fetchJson(bootstrap.callbacks.runStatus.replace("{runId}", encodeURIComponent(run.run.runId)));
  assert(status.run?.status === "succeeded", "runner status should sync to succeeded");

  const artifacts = await fetchJson(bootstrap.callbacks.artifacts.replace("{runId}", encodeURIComponent(run.run.runId)));
  assert(Array.isArray(artifacts.items) && artifacts.items.length > 0, "runner output artifact missing");

  const traces = await fetchJson(`${adapterUrl}/api/trace-links`);
  assert(traces.items.some((item) => item.runId === run.run.runId && item.resourceOrderId === "ro-v19-real-message-run"), "trace must include run/resource order");
  const costs = await fetchJson(`${adapterUrl}/api/cost-records`);
  assert(costs.items.some((item) => item.runId === run.run.runId && item.status === "pending"), "pending cost record missing");

  console.log(JSON.stringify({
    ok: true,
    runId: run.run.runId,
    resourceOrderId: run.run.resourceOrderId,
    status: status.run.status,
    artifactCount: artifacts.items.length,
    traceCount: traces.items.length,
  }, null, 2));
} finally {
  if (adapter) adapter.kill();
  if (runner) runner.kill();
  if (opl) opl.kill();
  if (portal) portal.kill();
  rmSync(testRoot, { recursive: true, force: true });
}
