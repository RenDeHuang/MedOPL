import { execSync, spawn } from "node:child_process";
import { rmSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";

const oplPort = Number(process.env.OPL_PRODUCT_API_FIXTURE_TEST_PORT || 18915);
const runnerPort = Number(process.env.MED_RUNNER_FIXTURE_TEST_PORT || 18925);
const adapterPort = Number(process.env.PORTAL_OPL_ADAPTER_TEST_PORT || 18793);
const oplUrl = `http://127.0.0.1:${oplPort}`;
const runnerUrl = `http://127.0.0.1:${runnerPort}`;
const adapterUrl = `http://127.0.0.1:${adapterPort}`;
const oplWebUrl = process.env.OPL_WEB_TEST_URL || process.env.OPL_WEB_URL || "http://127.0.0.1:19999/opl-web";
const adapterStateRoot = `.runtime/test-opl-launch-adapter-${adapterPort}-${Date.now()}`;

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
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      const response = await fetch(url, { redirect: "manual" });
      if (response.status < 500) return;
    } catch {}
    await sleep(250);
  }
  throw new Error(`${label} did not become ready`);
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const payload = await response.json().catch(() => ({}));
  assert(response.ok, `${url} failed: ${JSON.stringify(payload)}`);
  return payload;
}

async function post(url, body, headers = {}) {
  return fetchJson(url, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
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
const adapter = spawnService("opl-adapter", "node", ["src/server.mjs"], {
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
    portalUserName: "Portal Smoke",
    workspaceId: "default",
    workspaceTitle: "Default workspace",
  });
  assert(launch.launchToken, "launch token missing");
  assert(launch.runtimeSessionId, "runtime session id missing");
  assert(String(launch.oplWebUrl || "").startsWith(oplWebUrl), "oplWebUrl did not point to configured OPL Web");
  assert(String(launch.bootstrapUrl || "").includes("/api/opl-launch/bootstrap"), "bootstrapUrl must use opl-launch contract");

  const bootstrap = await fetchJson(launch.bootstrapUrl);
  assert(bootstrap.version === "v1", "bootstrap version missing");
  assert(bootstrap.portal?.userId === "portal-user-smoke", "bootstrap portal user missing");
  assert(bootstrap.portal?.workspaceId === "default", "bootstrap workspace missing");
  assert(bootstrap.portal?.workspaceSessionId, "bootstrap workspace session missing");
  assert(bootstrap.portal?.runtimeSessionId === launch.runtimeSessionId, "bootstrap runtime session mismatch");
  assert(bootstrap.entitlements?.canStartRun === true, "bootstrap cannot start run");
  assert(Array.isArray(bootstrap.entitlements?.agents) && bootstrap.entitlements.agents.includes("mas"), "bootstrap agents missing mas");
  assert(bootstrap.callbacks?.startRun, "bootstrap startRun callback missing");
  assert(bootstrap.callbacks?.runStatus, "bootstrap runStatus callback missing");
  assert(bootstrap.callbacks?.artifacts, "bootstrap artifacts callback missing");
  assert(bootstrap.callbacks?.sessionBind, "bootstrap sessionBind callback missing");
  assert(bootstrap.resources?.system?.id === "opl-product-api-fixture", "bootstrap system did not come from OPL Product API");

  const sessionBind = await post(bootstrap.callbacks.sessionBind, {
    launchToken: launch.launchToken,
    oplSessionId: "opl-web-session-smoke",
    status: "active",
  });
  assert(sessionBind.runtimeSession?.oplSessionId === "opl-web-session-smoke", "OPL session bind failed");

  const run = await post(bootstrap.callbacks.startRun, {
    launchToken: launch.launchToken,
    agentId: "mas",
    toolName: "med-autoscience",
    goal: "Run adapter smoke",
    runId: "opl-launch-adapter-smoke-run",
  }, { "user-agent": "opl-launch-adapter-smoke" });
  assert(run.run?.runId === "opl-launch-adapter-smoke-run", "run id mismatch");
  assert(["submitted", "running", "queued"].includes(run.run?.status), "run should start with a non-terminal submitted state");

  const statusUrl = bootstrap.callbacks.runStatus.replace("{runId}", encodeURIComponent(run.run.runId));
  const status = await fetchJson(statusUrl);
  assert(status.run?.status === "succeeded", "fixture run should sync to succeeded");

  const artifactsUrl = bootstrap.callbacks.artifacts.replace("{runId}", encodeURIComponent(run.run.runId));
  const artifacts = await fetchJson(artifactsUrl);
  assert(Array.isArray(artifacts.items) && artifacts.items.length >= 1, "artifacts should contain runner output");
  assert(artifacts.items.some((item) => item.runId === run.run.runId), "artifact runId mismatch");

  console.log(JSON.stringify({
    ok: true,
    launchToken: launch.launchToken,
    runtimeSessionId: launch.runtimeSessionId,
    systemId: bootstrap.resources.system.id,
    callbacksPresent: Boolean(bootstrap.callbacks.startRun && bootstrap.callbacks.runStatus && bootstrap.callbacks.artifacts),
    oplSessionId: sessionBind.runtimeSession.oplSessionId,
    runId: run.run.runId,
    status: status.run.status,
    artifactCount: artifacts.items.length,
  }, null, 2));
} finally {
  adapter.kill();
  runner.kill();
  opl.kill();
}
