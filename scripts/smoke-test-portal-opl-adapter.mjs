import { execSync, spawn } from "node:child_process";
import { rmSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";

const oplPort = Number(process.env.OPL_PRODUCT_API_FIXTURE_TEST_PORT || 18912);
const runnerPort = Number(process.env.MED_RUNNER_FIXTURE_TEST_PORT || 18922);
const adapterPort = Number(process.env.PORTAL_OPL_ADAPTER_TEST_PORT || 18790);
const oplUrl = `http://127.0.0.1:${oplPort}`;
const runnerUrl = `http://127.0.0.1:${runnerPort}`;
const adapterUrl = `http://127.0.0.1:${adapterPort}`;
const oplWebUrl = process.env.OPL_WEB_TEST_URL || "http://127.0.0.1:19999/opl-web";
const adapterStateRoot = `.runtime/test-portal-opl-adapter-${adapterPort}-${Date.now()}`;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function spawnService(label, command, args, options) {
  const child = spawn(command, args, {
    ...options,
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.on("data", (chunk) => process.stdout.write(`[${label}] ${chunk}`));
  child.stderr.on("data", (chunk) => process.stderr.write(`[${label}] ${chunk}`));
  return child;
}

function taskkillPort(port) {
  try {
    const output = execSync(`powershell -Command "Get-NetTCPConnection -LocalPort ${port} -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique"`, { encoding: "utf8" });
    const pids = output.split(/\s+/).filter(Boolean).map((value) => Number(value)).filter((value) => Number.isFinite(value) && value > 0);
    for (const pid of pids) {
      try {
        execSync(`taskkill /PID ${pid} /F`, { stdio: "ignore" });
      } catch {}
    }
  } catch {}
}

async function waitFor(url, label) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {}
    await sleep(250);
  }
  throw new Error(`${label} did not become ready`);
}

async function post(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await response.json();
  assert(response.ok, `${url} failed: ${JSON.stringify(payload)}`);
  return payload;
}

taskkillPort(oplPort);
taskkillPort(runnerPort);
taskkillPort(adapterPort);
await sleep(250);
rmSync(adapterStateRoot, { recursive: true, force: true });
rmSync(".runtime/med-autoscience-runner-fixture", { recursive: true, force: true });

const opl = spawnService("opl-fixture", "node", ["scripts/fixtures/opl-product-api-fixture.mjs"], {
  env: { ...process.env, PORT: String(oplPort) },
});
const runner = spawnService("runner-fixture", "node", ["scripts/fixtures/med-autoscience-runner-fixture.mjs"], {
  env: { ...process.env, PORT: String(runnerPort) },
});
const adapter = spawnService("portal-opl-adapter", "node", ["src/server.mjs"], {
  cwd: "services/opl-runtime-bridge",
  env: {
    ...process.env,
    PORT: String(adapterPort),
    PORTAL_OPL_ADAPTER_PUBLIC_URL: adapterUrl,
    PORTAL_OPL_ADAPTER_STATE_ROOT: adapterStateRoot,
    OPL_PRODUCT_API_URL: oplUrl,
    OPL_WEB_URL: oplWebUrl,
    MED_AUTOSCIENCE_RUNNER_URL: runnerUrl,
  },
});

try {
  await waitFor(`${oplUrl}/healthz`, "OPL Product API fixture");
  await waitFor(`${runnerUrl}/healthz`, "med-autoscience runner fixture");
  await waitFor(`${adapterUrl}/healthz`, "Portal OPL adapter");

  const launch = await post(`${adapterUrl}/api/opl-launch/tokens`, {
    portalUserId: "portal-user-smoke",
    portalUserEmail: "portal-user-smoke@example.com",
    workspaceId: "default",
    workspaceTitle: "默认任务空间",
  });
  assert(launch.launchToken, "launch token missing");
  assert(launch.runtimeSessionId, "runtime session id missing");

  const bootstrapResponse = await fetch(launch.bootstrapUrl);
  const bootstrap = await bootstrapResponse.json();
  assert(bootstrapResponse.ok, "bootstrap failed");
  assert(bootstrap.resources?.system?.id === "opl-product-api-fixture", "bootstrap system did not come from OPL fixture");

  assert(bootstrap.callbacks?.startRun, "startRun callback missing");

  const run = await post(bootstrap.callbacks.startRun, {
    launchToken: launch.launchToken,
    model: "opl-runtime-smoke",
    tokenCount: 12,
    runId: "adapter-smoke-run",
  });
  assert(run.run?.runId === "adapter-smoke-run", "run id mismatch");
  assert(run.run?.status === "submitted", "run should start as submitted");

  const statusResponse = await fetch(`${adapterUrl}/api/runs/${run.run.runId}/status`);
  const status = await statusResponse.json();
  assert(statusResponse.ok, "status sync failed");
  assert(status.run?.status === "succeeded", "fixture status should sync to succeeded");

  const artifactsResponse = await fetch(`${adapterUrl}/api/artifacts`);
  const artifacts = await artifactsResponse.json();
  assert(artifacts.items?.some((item) => item.runId === run.run.runId), "artifact for run missing");

  const costResponse = await fetch(`${adapterUrl}/api/cost-records`);
  const costs = await costResponse.json();
  assert(costs.items?.some((item) => item.runId === run.run.runId && item.status === "pending"), "pending cost missing");
  assert(!costs.items?.some((item) => item.pricingSource === "contract-zero-cost"), "contract-zero-cost must not appear");

  console.log(JSON.stringify({
    ok: true,
    launchId: launch.launchId,
    runtimeSessionId: launch.runtimeSessionId,
    runId: run.run.runId,
    runStatus: status.run.status,
    artifactCount: artifacts.items.length,
    costCount: costs.items.length,
  }, null, 2));
} finally {
  adapter.kill();
  runner.kill();
  opl.kill();
}
