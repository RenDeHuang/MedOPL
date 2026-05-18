import { spawn } from "node:child_process";

const repoRoot = process.cwd();
const port = Number(process.env.PORT || 18796);
const runtimeBridgeUrl = `http://127.0.0.1:${port}`;
const oplWebUrl = process.env.OPL_WEB_URL || "http://127.0.0.1:19999/opl-web";
const acpRuntimeFixtureSource = `
const readline = require("node:readline");
const commands = ["initialize", "session_list", "session_ledger", "session_create", "prompt"];
readline.createInterface({ input: process.stdin, crlfDelay: Infinity }).on("line", (line) => {
  const request = JSON.parse(line);
  let result = {};
  if (request.command === "initialize") {
    result = { surface_id: "opl-acp-runtime-smoke", version: "v22-smoke", commands };
  } else if (request.command === "session_list" || request.command === "session_ledger") {
    result = { items: [] };
  }
  process.stdout.write(JSON.stringify({ id: request.id, ok: true, result }) + "\\n");
});
`;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function startRuntimeBridge() {
  const child = spawn(process.execPath, ["services/opl-runtime-bridge/src/server.mjs"], {
    cwd: repoRoot,
    env: {
      ...process.env,
      PORT: String(port),
      PORTAL_RUNTIME_BRIDGE_PUBLIC_URL: runtimeBridgeUrl,
      OPL_WEB_URL: oplWebUrl,
      OPL_PRODUCT_API_URL: "",
      OPL_RUNTIME_MODE: "acp",
      OPL_ACP_RUNTIME_COMMAND_JSON: JSON.stringify([process.execPath, "-e", acpRuntimeFixtureSource]),
      NODE_ENV: "production",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.on("data", (chunk) => process.stdout.write(`[runtime-bridge] ${chunk}`));
  child.stderr.on("data", (chunk) => process.stderr.write(`[runtime-bridge] ${chunk}`));
  return child;
}

async function waitForHealth() {
  for (let index = 0; index < 80; index += 1) {
    try {
      const response = await fetch(`${runtimeBridgeUrl}/healthz`);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("runtime bridge did not become healthy");
}

async function fetchJson(pathname, options = {}) {
  const response = await fetch(`${runtimeBridgeUrl}${pathname}`, {
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

const runtimeBridge = startRuntimeBridge();
try {
  await waitForHealth();
  const launch = await fetchJson("/api/opl-launch/tokens", {
    method: "POST",
    body: JSON.stringify({
      portalUserId: "portal-acp-smoke-user",
      portalUserEmail: "portal-acp-smoke@example.com",
      portalUserName: "Portal ACP Smoke",
      workspaceId: "workspace-acp-smoke",
      workspaceTitle: "ACP smoke workspace",
      workspacePath: repoRoot,
      workspaceSessionId: "portal-acp-smoke-workspace-session",
      sourceSurface: "portal-control-plane",
    }),
  });
  assert(launch.launchToken, "launchToken missing");
  assert(launch.runtimeSessionId, "runtimeSessionId missing");
  assert(String(launch.oplWebUrl || "").startsWith(oplWebUrl), "oplWebUrl did not use OPL_WEB_URL");

  const bootstrap = await fetchJson("/api/opl-launch/bootstrap", {
    headers: {
      authorization: `Bearer ${launch.launchToken}`,
    },
  });
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
  runtimeBridge.kill();
}
