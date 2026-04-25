import { execSync, spawn } from "node:child_process";
import { rmSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";

const adapterPort = Number(process.env.OPL_TEST_PORT || 18795);
const adapterUrl = `http://127.0.0.1:${adapterPort}`;
const adapterStateRoot = `.runtime/test-opl-legacy-paths-retired-${adapterPort}-${Date.now()}`;

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
      const response = await fetch(url, { redirect: "manual" });
      if (response.status < 500) return;
    } catch {}
    await sleep(250);
  }
  throw new Error(`${label} did not become ready`);
}

async function expectRetired(path, options = {}) {
  const response = await fetch(`${adapterUrl}${path}`, options);
  const payload = await response.json().catch(() => ({}));
  assert(response.status === 410, `${path} expected 410, got ${response.status}: ${JSON.stringify(payload)}`);
  assert(payload.error === "legacy_endpoint_retired", `${path} did not return legacy_endpoint_retired`);
  return payload;
}

taskkillPort(adapterPort);
await sleep(250);
rmSync(adapterStateRoot, { recursive: true, force: true });

const adapter = spawnService("opl-adapter", "node", ["src/server.mjs"], {
  cwd: "services/opl-runtime-bridge",
  env: {
    ...process.env,
    PORT: String(adapterPort),
    PORTAL_OPL_ADAPTER_PUBLIC_URL: adapterUrl,
    PORTAL_OPL_ADAPTER_STATE_ROOT: adapterStateRoot,
    OPL_WEB_URL: "http://127.0.0.1:19999/opl-web",
  },
});

try {
  await waitFor(`${adapterUrl}/healthz`, "Portal OPL adapter");
  const checks = [];
  checks.push(await expectRetired("/workbench?launch_token=dev"));
  checks.push(await expectRetired("/api/launch-tokens", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({}),
  }));
  checks.push(await expectRetired("/api/workbench/bootstrap?launch_token=dev"));
  checks.push(await expectRetired("/api/runtime-sessions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({}),
  }));
  checks.push(await expectRetired("/api/runtime-sessions/dev/runs", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({}),
  }));

  console.log(JSON.stringify({
    ok: true,
    retiredCount: checks.length,
    replacements: checks.map((item) => item.replacement),
  }, null, 2));
} finally {
  adapter.kill();
}
