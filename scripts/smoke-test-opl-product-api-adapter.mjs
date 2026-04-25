import { spawn } from "node:child_process";
import { rmSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";
import { execSync } from "node:child_process";

const fixturePort = Number(process.env.OPL_PRODUCT_API_FIXTURE_TEST_PORT || 18911);
const adapterPort = Number(process.env.PORTAL_OPL_ADAPTER_TEST_PORT || 18788);
const fixtureUrl = `http://127.0.0.1:${fixturePort}`;
const adapterUrl = `http://127.0.0.1:${adapterPort}`;
const adapterStateRoot = `.runtime/test-opl-product-api-adapter-${adapterPort}-${Date.now()}`;

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

taskkillPort(fixturePort);
taskkillPort(adapterPort);
await sleep(250);
rmSync(adapterStateRoot, { recursive: true, force: true });

const opl = spawnService("opl-fixture", "node", ["scripts/fixtures/opl-product-api-fixture.mjs"], {
  env: { ...process.env, PORT: String(fixturePort) },
});

const adapter = spawnService("portal-opl-adapter", "node", ["src/server.mjs"], {
  cwd: "services/opl-runtime-bridge",
  env: {
    ...process.env,
    PORT: String(adapterPort),
    PORTAL_OPL_ADAPTER_PUBLIC_URL: adapterUrl,
    PORTAL_OPL_ADAPTER_STATE_ROOT: adapterStateRoot,
    OPL_PRODUCT_API_URL: fixtureUrl,
    OPL_WEB_URL: "http://127.0.0.1:19999/opl-web",
  },
});

try {
  await waitFor(`${fixtureUrl}/healthz`, "OPL Product API fixture");
  await waitFor(`${adapterUrl}/healthz`, "Portal OPL adapter");

  const launch = await post(`${adapterUrl}/api/opl-launch/tokens`, {
    portalUserId: "portal-user-smoke",
    portalUserEmail: "portal-user-smoke@example.com",
    portalUserName: "Portal Smoke",
    workspaceId: "default",
    workspaceTitle: "默认任务空间",
  });
  assert(launch.launchToken, "launch token missing");
  assert(launch.runtimeSessionId, "runtime session id missing");
  assert(launch.oplWebUrl.startsWith("http://127.0.0.1:19999/opl-web"), "oplWebUrl did not point to OPL Web");
  assert(launch.oplWebUrl.includes("launch_token="), "oplWebUrl missing launch_token");
  assert(launch.oplWebUrl.includes("portal_adapter_url="), "oplWebUrl missing portal_adapter_url");
  assert(!launch.oplWebUrl.includes("bridge_url="), "oplWebUrl must not carry legacy bridge_url");

  const bootstrapResponse = await fetch(launch.bootstrapUrl);
  const bootstrap = await bootstrapResponse.json();
  assert(bootstrapResponse.ok, "bootstrap failed");
  assert(bootstrap.resources?.system?.id === "opl-product-api-fixture", "bootstrap system did not come from OPL Product API");
  assert(bootstrap.resources?.engines?.some((item) => item.id === "opl-codex-default"), "bootstrap engines missing");
  assert(bootstrap.resources?.modules?.some((item) => item.id === "medautoscience"), "bootstrap modules missing");
  assert(bootstrap.resources?.agents?.some((item) => item.id === "mas"), "bootstrap agents missing");
  assert(bootstrap.resources?.workspaces?.some((item) => item.workspaceId === "default"), "bootstrap workspaces missing");
  assert(bootstrap.resources?.sessions?.some((item) => item.runtimeSessionId === launch.runtimeSessionId), "bootstrap sessions missing");

  console.log(JSON.stringify({
    ok: true,
    launchId: launch.launchId,
    workspaceSessionId: launch.workspaceSessionId,
    runtimeSessionId: launch.runtimeSessionId,
    systemId: bootstrap.resources.system.id,
    oplWebUrl: launch.oplWebUrl,
  }, null, 2));
} finally {
  adapter.kill();
  opl.kill();
}
