import { spawn } from "node:child_process";
import http from "node:http";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { mkdir, mkdtemp, readFile, rename, rm, stat, writeFile } from "node:fs/promises";

const repoRoot = process.cwd();
const runtimeRoot = path.join(repoRoot, ".runtime", "med-autoscience");
const portalRuntimeRoot = path.join(repoRoot, ".runtime", "portal");
const runnerEntrypoint = path.join(repoRoot, "adapters", "med-autoscience-runner", "src", "server.mjs");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function exists(targetPath) {
  try {
    await stat(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function freePort() {
  return await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => {
        if (!address || typeof address === "string") {
          reject(new Error("free_port_failed"));
          return;
        }
        resolve(address.port);
      });
    });
  });
}

function request(baseUrl, pathname, { method = "GET", headers = {}, body = null } = {}) {
  const url = new URL(pathname, baseUrl);
  return new Promise((resolve, reject) => {
    const req = http.request(url, { method, headers }, (res) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
      res.on("end", () => {
        resolve({
          status: res.statusCode || 0,
          body: Buffer.concat(chunks).toString("utf8"),
        });
      });
    });
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

async function waitForRunner(baseUrl, child) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    assert(child.exitCode === null, `runner_process_exited:${child.exitCode}`);
    try {
      const response = await request(baseUrl, "/healthz");
      if (response.status === 200) return;
    } catch {}
    await sleep(250);
  }
  throw new Error("runner_start_timeout");
}

async function withIsolatedRuntime(fn) {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "runner-server-plan-"));
  const backupRoot = path.join(tempRoot, "med-autoscience-backup");
  const portalBackupRoot = path.join(tempRoot, "portal-backup");
  const hadRuntime = await exists(runtimeRoot);
  const hadPortalRuntime = await exists(portalRuntimeRoot);
  if (hadRuntime) await rename(runtimeRoot, backupRoot);
  if (hadPortalRuntime) await rename(portalRuntimeRoot, portalBackupRoot);
  try {
    return await fn(tempRoot);
  } finally {
    await rm(runtimeRoot, { recursive: true, force: true }).catch(() => {});
    await rm(portalRuntimeRoot, { recursive: true, force: true }).catch(() => {});
    if (hadRuntime && await exists(backupRoot)) {
      await rename(backupRoot, runtimeRoot);
    }
    if (hadPortalRuntime && await exists(portalBackupRoot)) {
      await rename(portalBackupRoot, portalRuntimeRoot);
    }
    await rm(tempRoot, { recursive: true, force: true }).catch(() => {});
  }
}

async function main() {
  assert(await exists(runnerEntrypoint), `runner entrypoint missing: ${runnerEntrypoint}`);
  const runnerPort = await freePort();
  const runnerUrl = `http://127.0.0.1:${runnerPort}`;
  let child = null;

  try {
    await withIsolatedRuntime(async (tempRoot) => {
      await mkdir(portalRuntimeRoot, { recursive: true });
      await writeFile(path.join(portalRuntimeRoot, "portal-db.json"), `${JSON.stringify({
        users: [{ id: "user-smoke", email: "user-smoke@example.test", name: "User Smoke", role: "user", status: "active", createdAt: new Date().toISOString(), groupId: "", preferences: { theme: "light", commercial: { trialEntitlement: null } } }],
        wallets: [{ userId: "user-smoke", balance: 100, updatedAt: new Date().toISOString() }],
        groups: [],
        workspaceSessions: [],
        taskSpaces: [],
        sessions: [],
        ledger: [],
        userSandboxes: [],
        settings: { allowRegistration: true, announcements: [] },
      }, null, 2)}\n`, "utf8");
      child = spawn(process.execPath, [runnerEntrypoint], {
        cwd: repoRoot,
        env: {
          ...process.env,
          MED_AUTOSCIENCE_RUNNER_PORT: String(runnerPort),
          MED_AUTOSCIENCE_RUNNER_IMAGE: "example.com/runner:test",
          PORTAL_STORAGE_MODE: "json",
        },
        stdio: ["ignore", "pipe", "pipe"],
      });

      await waitForRunner(runnerUrl, child);
      const response = await request(runnerUrl, "/api/runs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          portalUserId: "user-smoke",
          tenantId: "tenant-smoke",
          workspaceId: "workspace-smoke",
          workspaceSessionId: "workspace-session-smoke",
          runtimeSessionId: "runtime-session-smoke",
          runId: "run-smoke",
          serverPlanId: "gpu-a10",
          region: "ap-guangzhou",
          runtimeClass: "kata-qcloud",
          nodeSelector: { "node.kubernetes.io/instance-type": "GPU.A10" },
          tolerations: [{ key: "nvidia.com/gpu", operator: "Equal", value: "present", effect: "NoSchedule" }],
          cpuRequest: "2000m",
          cpuLimit: "4000m",
          memoryRequest: "8Gi",
          memoryLimit: "16Gi",
          gpuCount: 1,
          storageRequest: "20Gi",
          storageLimit: "40Gi",
        }),
      });
      assert(response.status === 200, `start run expected 200, got ${response.status}: ${response.body}`);
      const payload = JSON.parse(response.body || "{}");
      const run = payload.run || {};
      const manifest = await readFile(run.manifestPath, "utf8");

      assert(manifest.includes('runtimeClassName: "kata-qcloud"'), "runtimeClass missing from manifest");
      assert(manifest.includes('node.kubernetes.io/instance-type: "GPU.A10"'), "nodeSelector missing from manifest");
      assert(manifest.includes('key: "nvidia.com/gpu"'), "toleration missing from manifest");
      assert(manifest.includes('nvidia.com/gpu: "1"'), "gpu request missing from manifest");
      assert(manifest.includes('ephemeral-storage: "20Gi"'), "storage request missing from manifest");
      assert(manifest.includes('ephemeral-storage: "40Gi"'), "storage limit missing from manifest");

      console.log(JSON.stringify({
        ok: true,
        runId: run.runId,
        manifestPath: run.manifestPath,
        serverPlanId: run.serverPlanId,
        runtimeClass: run.runtimeClass,
      }, null, 2));
    });
  } finally {
    child?.kill();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
