import { execSync, spawn } from "node:child_process";
import { rmSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";

const portalPort = Number(process.env.PORTAL_TEST_PORT || 17084);
const adapterPort = Number(process.env.OPL_TEST_PORT || 18794);
const oplPort = Number(process.env.OPL_PRODUCT_API_FIXTURE_TEST_PORT || 18916);
const runnerPort = Number(process.env.MED_RUNNER_FIXTURE_TEST_PORT || 18926);
const portalUrl = `http://127.0.0.1:${portalPort}`;
const adapterUrl = `http://127.0.0.1:${adapterPort}`;
const oplUrl = `http://127.0.0.1:${oplPort}`;
const runnerUrl = `http://127.0.0.1:${runnerPort}`;
const oplWebUrl = process.env.OPL_WEB_TEST_URL || process.env.OPL_WEB_URL || "http://127.0.0.1:19999/opl-web";
const adapterStateRoot = `.runtime/test-portal-opl-web-hard-loop-${adapterPort}-${Date.now()}`;

const adminEmail = process.env.PORTAL_ADMIN_EMAIL || "zitadel-admin@zitadel.localhost";
const adminPassword = process.env.PORTAL_ADMIN_PASSWORD || "Password1!";

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

async function loginPortal() {
  const body = new URLSearchParams({ email: adminEmail, password: adminPassword });
  const response = await fetch(`${portalUrl}/login`, {
    method: "POST",
    redirect: "manual",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  assert(response.status === 302, `login expected 302, got ${response.status}`);
  const setCookie = response.headers.get("set-cookie") || "";
  const match = setCookie.match(/portal_session=([^;]+)/);
  assert(match, "portal_session cookie missing");
  return `portal_session=${match[1]}`;
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const payload = await response.json().catch(() => ({}));
  assert(response.ok, `${url} failed: ${JSON.stringify(payload)}`);
  return payload;
}

async function portalJson(path, options = {}) {
  return fetchJson(`${portalUrl}${path}`, options);
}

async function postJson(url, body, headers = {}) {
  return fetchJson(url, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

taskkillPort(portalPort);
taskkillPort(adapterPort);
taskkillPort(oplPort);
taskkillPort(runnerPort);
await sleep(250);
rmSync(".runtime/portal", { recursive: true, force: true });
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
const portal = spawnService("portal", "node", ["src/server.mjs"], {
  cwd: "services/portal",
  env: {
    ...process.env,
    PORT: String(portalPort),
    PORTAL_OIDC_ENABLED: "0",
    PORTAL_STORAGE_MODE: "json",
    PORTAL_ADMIN_SEED_BALANCE: "100",
    PORTAL_OPL_ADAPTER_URL: adapterUrl,
    OPL_WEB_URL: oplWebUrl,
  },
});

try {
  await waitFor(`${oplUrl}/healthz`, "OPL Product API fixture");
  await waitFor(`${runnerUrl}/healthz`, "med-autoscience runner fixture");
  await waitFor(`${adapterUrl}/healthz`, "Portal OPL adapter");
  await waitFor(`${portalUrl}/healthz`, "Portal");
  const cookie = await loginPortal();

  const launch = await portalJson("/portal/api/opl/launch", {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({ task: "default" }),
  });
  assert(launch.ok === true, "portal launch did not return ok");
  assert(launch.launchToken, "launch token missing");
  assert(String(launch.oplWebUrl || "").startsWith(oplWebUrl), "launch did not target OPL Web");

  const bootstrap = await fetchJson(launch.launch.bootstrapUrl);
  assert(bootstrap.portal?.runtimeSessionId === launch.runtimeSession.runtimeSessionId, "bootstrap runtime identity mismatch");
  assert(bootstrap.callbacks?.startRun, "bootstrap startRun callback missing");
  assert(bootstrap.callbacks?.sessionBind, "bootstrap sessionBind callback missing");

  const sessionBind = await postJson(bootstrap.callbacks.sessionBind, {
    launchToken: launch.launchToken,
    oplSessionId: "portal-opl-web-hard-loop-session",
    status: "active",
  });
  assert(sessionBind.runtimeSession?.oplSessionId === "portal-opl-web-hard-loop-session", "OPL session bind failed");

  const run = await postJson(bootstrap.callbacks.startRun, {
    launchToken: launch.launchToken,
    agentId: "mas",
    toolName: "med-autoscience",
    goal: "Run Portal OPL hard-loop smoke",
    runId: "portal-opl-web-hard-loop-smoke-run",
    model: "opl-runtime-smoke",
    tokenCount: 42,
  }, { "user-agent": "portal-opl-web-hard-loop-smoke" });
  assert(run.run?.status === "submitted", "runtime run should be submitted first");

  const status = await fetchJson(bootstrap.callbacks.runStatus.replace("{runId}", encodeURIComponent(run.run.runId)));
  assert(status.run?.status === "succeeded", "fixture run should sync to succeeded");

  const artifacts = await fetchJson(bootstrap.callbacks.artifacts.replace("{runId}", encodeURIComponent(run.run.runId)));
  assert(artifacts.items?.some((item) => item.runId === run.run.runId), "adapter artifacts cannot see runner output");

  const sessions = await portalJson("/portal/api/sessions?page_size=5", { headers: { cookie } });
  assert(
    sessions.sessions?.some((item) => item.workspaceSessionId === launch.workspaceSession.id),
    `Portal sessions cannot see workspace session: ${JSON.stringify(sessions)}`,
  );
  assert(
    sessions.sessions?.some((item) => item.runtimeSessionId === launch.runtimeSession.runtimeSessionId),
    `Portal sessions cannot see runtime session: ${JSON.stringify(sessions)}`,
  );

  const portalRuns = await portalJson(`/portal/api/runs?runId=${encodeURIComponent(run.run.runId)}`, { headers: { cookie } });
  assert(portalRuns.runs?.some((item) => item.runId === run.run.runId && item.source === "portal_opl_adapter"), "Portal runs cannot see adapter run");

  const portalTraces = await portalJson(`/portal/api/traces?runId=${encodeURIComponent(run.run.runId)}`, { headers: { cookie } });
  assert(
    portalTraces.items?.some((item) => item.runId === run.run.runId && item.source === "portal_opl_adapter"),
    `Portal traces cannot see adapter trace: ${JSON.stringify(portalTraces)}`,
  );

  const portalCost = await portalJson(`/portal/api/costs/run?runId=${encodeURIComponent(run.run.runId)}`, { headers: { cookie } });
  assert(portalCost.cost?.status === "pending", "Portal run cost should expose pending adapter cost");
  assert(portalCost.cost?.pricingSource !== "contract-zero-cost", "Portal must not expose fake exact contract-zero-cost");

  console.log(JSON.stringify({
    ok: true,
    workspaceSessionId: launch.workspaceSession.id,
    runtimeSessionId: launch.runtimeSession.runtimeSessionId,
    oplSessionId: sessionBind.runtimeSession.oplSessionId,
    runId: run.run.runId,
    runStatus: status.run.status,
    artifactCount: artifacts.items.length,
    portalRunCount: portalRuns.runs.length,
    portalTraceCount: portalTraces.items.length,
    portalCostStatus: portalCost.cost.status,
    oplWebUrl: launch.oplWebUrl,
  }, null, 2));
} finally {
  portal.kill();
  adapter.kill();
  runner.kill();
  opl.kill();
}
