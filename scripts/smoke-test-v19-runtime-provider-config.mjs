import { spawn } from "node:child_process";
import { readFileSync, rmSync } from "node:fs";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

const oplPort = Number(process.env.OPL_PRODUCT_API_FIXTURE_TEST_PORT || 19320);
const runnerPort = Number(process.env.MED_RUNNER_FIXTURE_TEST_PORT || 19321);
const adapterPort = Number(process.env.PORTAL_OPL_ADAPTER_TEST_PORT || 19322);
const oplUrl = `http://127.0.0.1:${oplPort}`;
const runnerUrl = `http://127.0.0.1:${runnerPort}`;
const adapterUrl = `http://127.0.0.1:${adapterPort}`;
const stateRoot = path.resolve(`.runtime/test-v19-runtime-provider-config-${adapterPort}-${Date.now()}`);
const providerToken = "runtime-provider-config-smoke-token";

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

function postJson(url, body) {
  return fetchJson(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

rmSync(stateRoot, { recursive: true, force: true });
const opl = spawnService("opl-fixture", "node", ["scripts/fixtures/opl-product-api-fixture.mjs"], {
  env: { ...process.env, PORT: String(oplPort) },
});
const runner = spawnService("runner-fixture", "node", ["scripts/fixtures/med-autoscience-runner-fixture.mjs"], {
  env: { ...process.env, PORT: String(runnerPort) },
});
const adapter = spawnService("opl-adapter", "node", ["src/server.mjs"], {
  cwd: "services/opl-runtime-bridge",
  env: {
    ...process.env,
    PORT: String(adapterPort),
    PORTAL_OPL_ADAPTER_PUBLIC_URL: adapterUrl,
    PORTAL_OPL_ADAPTER_STATE_ROOT: stateRoot,
    OPL_PRODUCT_API_URL: oplUrl,
    OPL_WEB_URL: "http://127.0.0.1:19329",
    MED_AUTOSCIENCE_RUNNER_URL: runnerUrl,
  },
});

try {
  await waitFor(`${oplUrl}/healthz`, "OPL Product API fixture");
  await waitFor(`${runnerUrl}/healthz`, "runner fixture");
  await waitFor(`${adapterUrl}/healthz`, "adapter");

  const launch = await postJson(`${adapterUrl}/api/opl-launch/tokens`, {
    portalUserId: "provider-config-user",
    portalUserEmail: "provider-config-user@example.com",
    workspaceId: "default",
    providerConfigSecretRef: "gflab-provider-config-smoke",
    providerConfig: {
      providerName: "gflab",
      providerBaseUrl: "https://gflabtoken.cn/",
      modelProvider: "gflab",
      model: "gpt-5.5",
      modelReasoningEffort: "xhigh",
      serviceTier: "fast",
      sandboxMode: "danger-full-access",
      secretFingerprint: "fingerprint-smoke",
      experimentalBearerToken: providerToken,
    },
  });
  const bootstrap = await fetchJson(launch.bootstrapUrl);
  const stateText = readFileSync(`${stateRoot}/state.json`, "utf8");
  const bootstrapText = JSON.stringify(bootstrap);

  assert(bootstrap.provider?.providerConfigured === true, "provider must be configured in bootstrap");
  assert(bootstrap.provider?.providerName === "gflab", "provider name mismatch");
  assert(bootstrap.provider?.model === "gpt-5.5", "provider model mismatch");
  assert(!bootstrapText.includes(providerToken), "bootstrap must not expose provider key");
  assert(!stateText.includes(providerToken), "adapter state must not persist provider key");

  console.log(JSON.stringify({
    ok: true,
    providerConfigured: bootstrap.provider.providerConfigured,
    providerName: bootstrap.provider.providerName,
    keyRedacted: true,
  }, null, 2));
} finally {
  adapter.kill();
  runner.kill();
  opl.kill();
}
