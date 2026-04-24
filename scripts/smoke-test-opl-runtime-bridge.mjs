import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";

const port = Number(process.env.OPL_TEST_PORT || 18788);
const baseUrl = `http://127.0.0.1:${port}`;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function startBridge() {
  const child = spawn("node", ["src/server.mjs"], {
    cwd: "services/opl-runtime-bridge",
    env: { ...process.env, PORT: String(port), OPL_RUNTIME_BRIDGE_PUBLIC_URL: baseUrl },
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.on("data", (chunk) => process.stdout.write(`[opl-bridge] ${chunk}`));
  child.stderr.on("data", (chunk) => process.stderr.write(`[opl-bridge] ${chunk}`));
  return child;
}

async function waitForHealth() {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/healthz`);
      if (response.ok) return;
    } catch {}
    await sleep(200);
  }
  throw new Error("OPL runtime bridge health check timed out");
}

async function post(path, body) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await response.json();
  assert(response.ok, `${path} failed: ${JSON.stringify(json)}`);
  return json;
}

const child = startBridge();

try {
  await waitForHealth();
  const launch = await post("/api/launch-tokens", {
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
  assert(bootstrap.resources?.workspaces?.length === 1, "bootstrap workspace missing");

  const run = await post(`/api/runtime-sessions/${launch.runtimeSessionId}/runs`, {
    model: "opl-runtime-smoke",
    tokenCount: 12,
  });
  assert(run.run?.status === "completed", "run not completed");

  const artifactsResponse = await fetch(`${baseUrl}/api/artifacts`);
  const artifacts = await artifactsResponse.json();
  assert(artifacts.items?.some((item) => item.runId === run.run.runId), "artifact for run missing");

  console.log(JSON.stringify({
    ok: true,
    launchId: launch.launchId,
    runtimeSessionId: launch.runtimeSessionId,
    runId: run.run.runId,
    artifacts: artifacts.items.length,
  }, null, 2));
} finally {
  child.kill();
}
