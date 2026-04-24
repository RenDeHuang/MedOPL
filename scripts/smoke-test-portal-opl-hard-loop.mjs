import { spawn } from "node:child_process";
import { rmSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";

const portalPort = Number(process.env.PORTAL_TEST_PORT || 17082);
const bridgePort = Number(process.env.OPL_TEST_PORT || 18789);
const portalUrl = `http://127.0.0.1:${portalPort}`;
const bridgeUrl = `http://127.0.0.1:${bridgePort}`;

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

async function waitFor(url, label) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
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
  const json = await response.json();
  assert(response.ok, `${path} failed: ${JSON.stringify(json)}`);
  return json;
}

rmSync(".runtime/portal", { recursive: true, force: true });
rmSync(".runtime/opl-runtime-bridge", { recursive: true, force: true });

const bridge = spawnService("opl-bridge", "node", ["src/server.mjs"], {
  cwd: "services/opl-runtime-bridge",
  env: {
    ...process.env,
    PORT: String(bridgePort),
    OPL_RUNTIME_BRIDGE_PUBLIC_URL: bridgeUrl,
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
    OPL_RUNTIME_BRIDGE_URL: bridgeUrl,
    OPL_WORKBENCH_URL: `${bridgeUrl}/workbench`,
  },
});

try {
  await waitFor(`${bridgeUrl}/healthz`, "OPL runtime bridge");
  await waitFor(`${portalUrl}/healthz`, "Portal");
  const cookie = await loginPortal();

  const launchPayload = await portalJson("/portal/api/workbench/launch", {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({ task: "default" }),
  });
  assert(launchPayload.ok === true, "portal launch did not return ok");
  assert(launchPayload.launch?.launchToken, "launch token missing");
  assert(launchPayload.launch?.runtimeSessionId, "runtime session missing");

  const runResponse = await fetch(`${bridgeUrl}/api/runtime-sessions/${launchPayload.launch.runtimeSessionId}/runs`, {
    method: "POST",
    headers: { "content-type": "application/json", "user-agent": "portal-opl-hard-loop-smoke" },
    body: JSON.stringify({ model: "opl-runtime-smoke", tokenCount: 42 }),
  });
  const runPayload = await runResponse.json();
  assert(runResponse.ok, `runtime run failed: ${JSON.stringify(runPayload)}`);
  assert(runPayload.run?.status === "completed", "runtime run not completed");

  const bootstrapResponse = await fetch(launchPayload.launch.bootstrapUrl);
  const bootstrap = await bootstrapResponse.json();
  assert(bootstrapResponse.ok, "bootstrap failed");
  assert(bootstrap.runs?.some((item) => item.runId === runPayload.run.runId), "bootstrap cannot see run");
  assert(bootstrap.resources?.artifacts?.some((item) => item.runId === runPayload.run.runId), "bootstrap cannot see artifact");

  const sessions = await portalJson("/portal/api/sessions?page_size=5", {
    headers: { cookie },
  });
  assert(sessions.sessions?.some((item) => item.workspaceSessionId === launchPayload.workspaceSession.id), "Portal sessions cannot see OPL workspace session");

  const workbenchResponse = await fetch(launchPayload.launch.workbenchUrl);
  const workbenchHtml = await workbenchResponse.text();
  assert(workbenchResponse.ok, "workbench url did not open");
  assert(workbenchHtml.includes("OPL Workbench Contract Surface"), "workbench page marker missing");

  console.log(JSON.stringify({
    ok: true,
    portalLaunch: {
      workspaceId: launchPayload.workspace.slug,
      workspaceSessionId: launchPayload.workspaceSession.id,
      runtimeSessionId: launchPayload.launch.runtimeSessionId,
    },
    runtimeRun: {
      runId: runPayload.run.runId,
      status: runPayload.run.status,
    },
    artifactCount: bootstrap.resources.artifacts.length,
    sessionCount: sessions.sessions.length,
  }, null, 2));
} finally {
  portal.kill();
  bridge.kill();
}
