import { spawn } from "node:child_process";

const repoRoot = process.cwd();
const port = Number(process.env.PORT || 18796);
const adapterUrl = `http://127.0.0.1:${port}`;
const oplWebUrl = process.env.OPL_WEB_URL || "http://127.0.0.1:19999/opl-web";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function startAdapter() {
  const child = spawn(process.execPath, ["services/opl-runtime-bridge/src/server.mjs"], {
    cwd: repoRoot,
    env: {
      ...process.env,
      PORT: String(port),
      PORTAL_OPL_ADAPTER_PUBLIC_URL: adapterUrl,
      OPL_WEB_URL: oplWebUrl,
      OPL_PRODUCT_API_URL: "",
      OPL_RUNTIME_MODE: "acp",
      NODE_ENV: "production",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.on("data", (chunk) => process.stdout.write(`[opl-adapter] ${chunk}`));
  child.stderr.on("data", (chunk) => process.stderr.write(`[opl-adapter] ${chunk}`));
  return child;
}

async function waitForHealth() {
  for (let index = 0; index < 80; index += 1) {
    try {
      const response = await fetch(`${adapterUrl}/healthz`);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("adapter did not become healthy");
}

async function fetchJson(pathname, options = {}) {
  const response = await fetch(`${adapterUrl}${pathname}`, {
    ...options,
    headers: {
      "content-type": "application/json",
      ...(options.headers || {}),
    },
  });
  const payload = await response.json().catch(() => ({}));
  assert(response.ok, `${pathname} failed: ${JSON.stringify(payload)}`);
  return payload;
}

const adapter = startAdapter();
try {
  await waitForHealth();
  const launch = await fetchJson("/api/opl-launch/tokens", {
    method: "POST",
    body: JSON.stringify({
      portalUserId: "portal-acp-smoke-user",
      portalUserEmail: "portal-acp-smoke@example.com",
      portalUserName: "Portal ACP Smoke",
      workspaceId: "default",
      workspaceTitle: "Default workspace",
      workspacePath: repoRoot,
      workspaceSessionId: "portal-acp-smoke-workspace-session",
      sourceSurface: "portal-control-plane",
    }),
  });
  assert(launch.launchToken, "launchToken missing");
  assert(launch.runtimeSessionId, "runtimeSessionId missing");
  assert(String(launch.oplWebUrl || "").startsWith(oplWebUrl), "oplWebUrl did not use OPL_WEB_URL");

  const bootstrap = await fetchJson(`/api/opl-launch/bootstrap?launch_token=${encodeURIComponent(launch.launchToken)}`);
  assert(bootstrap.opl?.health?.source === "opl_acp_runtime", "bootstrap did not come from OPL ACP runtime");
  assert(bootstrap.system?.id === "opl-acp-runtime", "system id mismatch");
  assert(Array.isArray(bootstrap.system?.commands) && bootstrap.system.commands.includes("initialize"), "ACP command surface missing");

  console.log(JSON.stringify({
    ok: true,
    runtime: "opl_acp_runtime",
    launchId: launch.launchId,
    runtimeSessionId: launch.runtimeSessionId,
    commandCount: bootstrap.system.commands.length,
    oplWebUrl: launch.oplWebUrl,
  }, null, 2));
} finally {
  adapter.kill();
}
