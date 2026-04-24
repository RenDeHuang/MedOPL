import { spawn } from "node:child_process";
import { rmSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";

const runnerPort = Number(process.env.MED_RUNNER_TEST_PORT || 18890);
const runnerUrl = `http://127.0.0.1:${runnerPort}`;

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
      const response = await fetch(url);
      if (response.ok) return;
    } catch {}
    await sleep(250);
  }
  throw new Error(`${label} did not become ready`);
}

async function json(path, options = {}) {
  const response = await fetch(`${runnerUrl}${path}`, options);
  const payload = await response.json();
  assert(response.ok, `${path} failed: ${JSON.stringify(payload)}`);
  return payload;
}

rmSync(".runtime/med-autoscience", { recursive: true, force: true });

const runner = spawnService("med-runner", "node", ["src/server.mjs"], {
  cwd: "adapters/med-autoscience-runner",
  env: {
    ...process.env,
    MED_AUTOSCIENCE_RUNNER_PORT: String(runnerPort),
  },
});

try {
  await waitFor(`${runnerUrl}/healthz`, "med-autoscience runner");
  const health = await json("/healthz");
  assert(health.mode === "internal-runner", "runner is not using internal api mode");

  const workspace = await json("/api/workspaces", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ customerId: "portal-user-smoke", userId: "portal-user-smoke", workspaceId: "default" }),
  });
  assert(workspace.workspace?.workspaceId === "default", "workspace was not created");

  const files = await json("/api/workspaces/portal-user-smoke/default/files");
  assert(Array.isArray(files.files?.inputs), "workspace inputs are not listed");
  assert(Array.isArray(files.files?.outputs), "workspace outputs are not listed");

  console.log(JSON.stringify({
    ok: true,
    mode: health.mode,
    workspaceId: workspace.workspace.workspaceId,
    inputCount: files.files.inputs.length,
    outputCount: files.files.outputs.length,
  }, null, 2));
} finally {
  runner.kill();
}
