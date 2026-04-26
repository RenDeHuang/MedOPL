import { execSync, spawn } from "node:child_process";
import { rmSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";

const portalPort = Number(process.env.PORTAL_TEST_PORT || 17083);
const adapterPort = Number(process.env.OPL_TEST_PORT || 18792);
const oplPort = Number(process.env.OPL_PRODUCT_API_FIXTURE_TEST_PORT || 18914);
const portalUrl = `http://127.0.0.1:${portalPort}`;
const adapterUrl = `http://127.0.0.1:${adapterPort}`;
const oplUrl = `http://127.0.0.1:${oplPort}`;
const oplWebUrl = process.env.OPL_WEB_TEST_URL || process.env.OPL_WEB_URL || "http://127.0.0.1:19999/opl-web";
const adapterStateRoot = `.runtime/test-portal-opl-web-launch-${adapterPort}-${Date.now()}`;

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

async function portalJson(path, options = {}) {
  const response = await fetch(`${portalUrl}${path}`, options);
  const contentType = response.headers.get("content-type") || "";
  const raw = await response.text();
  const json = contentType.includes("application/json") && raw ? JSON.parse(raw) : {};
  assert(response.ok, `${path} failed: ${JSON.stringify(json)}`);
  assert(contentType.includes("application/json"), `${path} expected JSON, got ${response.status} ${contentType}: ${raw.slice(0, 200)}`);
  return json;
}

taskkillPort(portalPort);
taskkillPort(adapterPort);
taskkillPort(oplPort);
await sleep(250);
rmSync(".runtime/portal", { recursive: true, force: true });
rmSync(adapterStateRoot, { recursive: true, force: true });

const opl = spawnService("opl-fixture", "node", ["scripts/fixtures/opl-product-api-fixture.mjs"], {
  env: { ...process.env, PORT: String(oplPort) },
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
  await waitFor(`${adapterUrl}/healthz`, "Portal OPL adapter");
  await waitFor(`${portalUrl}/healthz`, "Portal");
  const cookie = await loginPortal();

  const launch = await portalJson("/portal/api/opl/launch", {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({ task: "default" }),
  });

  assert(launch.ok === true, "portal launch did not return ok");
  assert(launch.launchToken, "top-level launchToken missing");
  assert(launch.launch?.launchToken === launch.launchToken, "nested launch token mismatch");
  assert(launch.workspaceSession?.id || launch.workspaceSession?.workspaceSessionId, "workspace session missing");
  assert(launch.runtimeSession?.runtimeSessionId || launch.launch?.runtimeSessionId, "runtime session missing");
  assert(String(launch.oplWebUrl || "").startsWith(oplWebUrl), "oplWebUrl did not point to configured OPL Web");
  assert(!String(launch.oplWebUrl || "").startsWith(`${adapterUrl}/workbench`), "oplWebUrl must not point to adapter dev projection");

  const opened = new URL(launch.oplWebUrl);
  assert(opened.searchParams.get("launch_token"), "oplWebUrl missing launch_token");
  assert(opened.searchParams.get("portal_adapter_url") === adapterUrl, "oplWebUrl missing portal_adapter_url");
  assert(!opened.searchParams.has("bridge_url"), "oplWebUrl must not carry legacy bridge_url");

  const legacyResponse = await fetch(`${portalUrl}/portal/api/workbench/launch`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({ task: "default" }),
  });
  assert(legacyResponse.status === 404, `legacy workbench launch expected removal/404, got ${legacyResponse.status}`);

  console.log(JSON.stringify({
    ok: true,
    launchToken: launch.launchToken,
    workspaceId: launch.workspace?.slug || launch.workspace?.workspaceId || "",
    workspaceSessionId: launch.workspaceSession?.id || launch.workspaceSession?.workspaceSessionId || "",
    runtimeSessionId: launch.runtimeSession?.runtimeSessionId || launch.launch?.runtimeSessionId || "",
    oplWebUrl: launch.oplWebUrl,
    portalAdapterUrl: opened.searchParams.get("portal_adapter_url"),
  }, null, 2));
} finally {
  portal.kill();
  adapter.kill();
  opl.kill();
}
