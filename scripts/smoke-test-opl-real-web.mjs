import { execSync, spawn } from "node:child_process";
import { rmSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";

const shouldRun = String(process.env.RUN_OPL_REAL_SMOKE || "0") === "1";
const shouldRunAdapter = String(process.env.RUN_OPL_REAL_ADAPTER_SMOKE || "0") === "1";
const oplUrl = String(process.env.OPL_PRODUCT_API_URL || "http://127.0.0.1:8787").replace(/\/$/, "");
const adapterPort = Number(process.env.OPL_REAL_ADAPTER_TEST_PORT || 18797);
const adapterUrl = `http://127.0.0.1:${adapterPort}`;
const workspacePath = String(process.env.OPL_REAL_WORKSPACE_PATH || process.env.OPL_DEFAULT_WORKSPACE_PATH || process.env.OPL_WORKSPACE_PATH || "").trim();
const projectId = String(process.env.OPL_REAL_PROJECT_ID || process.env.OPL_DEFAULT_PROJECT_ID || "medautoscience").trim();
const adapterStateRoot = `.runtime/test-opl-real-web-${adapterPort}-${Date.now()}`;

function assert(condition, message) {
  if (!condition) throw new Error(message);
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

function spawnService(label, command, args, options) {
  const child = spawn(command, args, { ...options, stdio: ["ignore", "pipe", "pipe"] });
  child.stdout.on("data", (chunk) => process.stdout.write(`[${label}] ${chunk}`));
  child.stderr.on("data", (chunk) => process.stderr.write(`[${label}] ${chunk}`));
  return child;
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      accept: "application/json",
      ...(options.body ? { "content-type": "application/json" } : {}),
      ...(options.headers || {}),
    },
  });
  const payload = await response.json().catch(() => ({}));
  assert(response.ok, `${url} failed ${response.status}: ${JSON.stringify(payload)}`);
  return payload;
}

async function waitFor(url, label) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {}
    await sleep(250);
  }
  throw new Error(`${label} did not become ready: ${url}`);
}

function itemsFrom(surface, key) {
  const value = surface?.[key] || surface;
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.items)) return value.items;
  if (Array.isArray(value?.projects)) return value.projects;
  if (Array.isArray(value?.bindings)) return value.bindings;
  return [];
}

if (!shouldRun) {
  console.log(JSON.stringify({
    ok: true,
    skipped: true,
    reason: "RUN_OPL_REAL_SMOKE!=1",
    expectedOplProductApiUrl: oplUrl,
  }, null, 2));
  process.exit(0);
}

const root = await fetchJson(`${oplUrl}/`);
assert(root.version === "g2" || root.opl_api, "OPL root did not look like the g2 Product API surface");

const health = await fetchJson(`${oplUrl}/api/health`);
assert(health.health?.status === "ok", "OPL /api/health did not report ok");

const [system, engines, modules, agents, workspaces, sessions, progress, artifacts] = await Promise.all([
  fetchJson(`${oplUrl}/api/opl/system`),
  fetchJson(`${oplUrl}/api/opl/engines`),
  fetchJson(`${oplUrl}/api/opl/modules`),
  fetchJson(`${oplUrl}/api/opl/agents`),
  fetchJson(`${oplUrl}/api/opl/workspaces`),
  fetchJson(`${oplUrl}/api/opl/sessions`),
  fetchJson(`${oplUrl}/api/opl/progress${workspacePath ? `?workspace_path=${encodeURIComponent(workspacePath)}` : ""}`),
  fetchJson(`${oplUrl}/api/opl/artifacts${workspacePath ? `?workspace_path=${encodeURIComponent(workspacePath)}` : ""}`),
]);

assert(system.system?.surface_id === "opl_system" || system.system, "system surface missing");
assert(itemsFrom(engines, "engines").length >= 1, "engines items missing");
assert(itemsFrom(modules, "modules").length >= 1, "modules items missing");
assert(itemsFrom(agents, "agents").length >= 1, "agents items missing");
assert(workspaces.workspaces, "workspaces surface missing");
assert(sessions.sessions, "sessions surface missing");
assert(progress.progress, "progress surface missing");
assert(artifacts.artifacts, "artifacts surface missing");

let adapterLaunch = null;
let adapter = null;

if (shouldRunAdapter) {
  assert(workspacePath, "RUN_OPL_REAL_ADAPTER_SMOKE=1 requires OPL_REAL_WORKSPACE_PATH or OPL_DEFAULT_WORKSPACE_PATH");
  taskkillPort(adapterPort);
  rmSync(adapterStateRoot, { recursive: true, force: true });
  adapter = spawnService("portal-opl-adapter", "node", ["src/server.mjs"], {
    cwd: "services/opl-runtime-bridge",
    env: {
      ...process.env,
      NODE_ENV: "production",
      PORT: String(adapterPort),
      PORTAL_OPL_ADAPTER_PUBLIC_URL: adapterUrl,
      PORTAL_OPL_ADAPTER_STATE_ROOT: adapterStateRoot,
      OPL_PRODUCT_API_URL: oplUrl,
      OPL_DEFAULT_PROJECT_ID: projectId,
      OPL_DEFAULT_WORKSPACE_PATH: workspacePath,
    },
  });

  try {
    await waitFor(`${adapterUrl}/healthz`, "Portal OPL adapter");
    adapterLaunch = await fetchJson(`${adapterUrl}/api/opl-launch/tokens`, {
      method: "POST",
      body: JSON.stringify({
        portalUserId: "portal-user-real-opl-smoke",
        portalUserEmail: "portal-user-real-opl-smoke@example.com",
        portalUserName: "Portal Real OPL Smoke",
        workspaceId: "real-opl",
        workspaceTitle: "Real OPL Workspace",
        workspacePath,
        projectId,
      }),
    });
    assert(adapterLaunch.launchToken, "adapter launch token missing");
    assert(adapterLaunch.bootstrapUrl, "adapter bootstrap url missing");
    const bootstrap = await fetchJson(adapterLaunch.bootstrapUrl);
    assert(bootstrap.opl?.health, "adapter bootstrap did not include OPL health");
    assert(bootstrap.resources?.system, "adapter bootstrap system missing");
  } finally {
    adapter?.kill();
  }
}

console.log(JSON.stringify({
  ok: true,
  oplProductApiUrl: oplUrl,
  healthStatus: health.health.status,
  counts: {
    engines: itemsFrom(engines, "engines").length,
    modules: itemsFrom(modules, "modules").length,
    agents: itemsFrom(agents, "agents").length,
    workspaces: itemsFrom(workspaces, "workspaces").length,
    sessions: itemsFrom(sessions, "sessions").length,
  },
  adapter: shouldRunAdapter ? {
    projectId,
    workspacePath,
    launchId: adapterLaunch?.launchId,
    runtimeSessionId: adapterLaunch?.runtimeSessionId,
  } : {
    skipped: true,
    reason: "RUN_OPL_REAL_ADAPTER_SMOKE!=1",
  },
}, null, 2));
