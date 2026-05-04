import { execFile } from "node:child_process";
import http from "node:http";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { spawn } from "node:child_process";
import { chmod, mkdir, mkdtemp, readFile, rename, rm, stat, writeFile } from "node:fs/promises";

const repoRoot = process.cwd();
const runtimeRoot = path.join(repoRoot, ".runtime", "med-autoscience");
const portalRuntimeRoot = path.join(repoRoot, ".runtime", "portal");
const runnerEntrypoint = path.join(repoRoot, "adapters", "med-autoscience-runner", "src", "server.mjs");
const execFileAsync = promisify(execFile);

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

async function assertYamlCanParseManifest(manifestPath) {
  try {
    await execFileAsync("python3", ["-c", "import sys, yaml; list(yaml.safe_load_all(open(sys.argv[1], encoding='utf-8')))", manifestPath], {
      cwd: repoRoot,
      timeout: 30000,
      maxBuffer: 1024 * 1024,
    });
  } catch (error) {
    const details = [error?.message, error?.stdout, error?.stderr].filter(Boolean).join("\n").trim();
    throw new Error(`runner manifest must be valid YAML: ${details}`);
  }
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
      const fakeKubectl = path.join(tempRoot, "kubectl");
      await writeFile(fakeKubectl, [
        "#!/bin/sh",
        "if [ \"$1\" = \"auth\" ] && [ \"$2\" = \"can-i\" ]; then echo yes; exit 0; fi",
        "if [ \"$1\" = \"get\" ] && [ \"$2\" = \"namespace\" ]; then echo namespace/$3; exit 0; fi",
        "if [ \"$1\" = \"apply\" ]; then echo job.batch/med-autoscience-run-smoke created; exit 0; fi",
        "echo fake-kubectl-ok",
        "exit 0",
        "",
      ].join("\n"), "utf8");
      await chmod(fakeKubectl, 0o755);
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
          KUBECTL_BIN: fakeKubectl,
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
          resourceOrderId: "resource-order-smoke",
          serverPlanId: "gpu-a10",
          region: "ap-guangzhou",
          runtimeClass: "kata-qcloud",
          nodeSelector: { "node.kubernetes.io/instance-type": "GPU.A10" },
          tolerations: [{ key: "nvidia.com/gpu", operator: "Equal", value: "present", effect: "NoSchedule" }],
          podNetworkingMode: "vpc_cni",
          requiresEniPod: true,
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
      assert(manifest.includes("annotations:"), "pod annotations missing from manifest");
      assert(manifest.includes('tke.cloud.tencent.com/eni-ip: "true"'), "eni pod annotation missing from manifest");
      assert(manifest.includes('node.kubernetes.io/instance-type: "GPU.A10"'), "nodeSelector missing from manifest");
      assert(manifest.includes('key: "nvidia.com/gpu"'), "toleration missing from manifest");
      assert(manifest.includes('nvidia.com/gpu: "1"'), "gpu request missing from manifest");
      assert(manifest.includes('ephemeral-storage: "20Gi"'), "storage request missing from manifest");
      assert(manifest.includes('ephemeral-storage: "40Gi"'), "storage limit missing from manifest");
      assert(manifest.includes("name: workspace-outputs"), "workspace outputs volume missing from manifest");
      assert(manifest.includes("mountPath: /workspace/outputs"), "workspace outputs mount missing from manifest");
      assert(manifest.includes("subPathExpr: med-autoscience/workspaces/$(PORTAL_USER_ID)/$(WORKSPACE_ID)/outputs"), "workspace outputs must use user/workspace PVC subPathExpr");
      assert(manifest.includes("persistentVolumeClaim:"), "workspace outputs must use the shared runtime PVC");
      assert(manifest.includes("claimName: portal-platform-runtime"), "workspace outputs must mount portal-platform-runtime");
      assert(!manifest.includes("hostPath:"), "workspace outputs must not use node-local hostPath");
      assert(manifest.includes("find /workspace/outputs -type f ! -name .keep -size +0c"), "runner output deliverable guard missing from manifest");
      assert(manifest.includes("run-smoke-summary.md"), "runner summary output path missing from manifest");
      assert(manifest.includes("- |-\n"), "runner wrapped command must render as a YAML block scalar");
      for (const [key, value] of [
        ["resourceorderid", "resource-order-smoke"],
        ["runid", "run-smoke"],
        ["serverplanid", "gpu-a10"],
        ["tenantid", "tenant-smoke"],
        ["workspaceid", "workspace-smoke"],
      ]) {
        const pattern = new RegExp(`\\n\\s+${key}: "${value}"`, "g");
        const matches = manifest.match(pattern) || [];
        assert(matches.length === 2, `runner billing label must be present on job and pod metadata: ${key}`);
      }
      await assertYamlCanParseManifest(run.manifestPath);

      const overlayResponse = await request(runnerUrl, "/api/runs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          portalUserId: "user-smoke",
          tenantId: "tenant-smoke",
          workspaceId: "workspace-smoke",
          workspaceSessionId: "workspace-session-smoke",
          runtimeSessionId: "runtime-session-smoke-overlay",
          runId: "run-smoke-overlay",
          resourceOrderId: "resource-order-smoke-overlay",
          serverPlanId: "cpu-overlay",
          podNetworkingMode: "overlay",
          requiresEniPod: false,
          cpuRequest: "250m",
          cpuLimit: "500m",
          memoryRequest: "512Mi",
          memoryLimit: "1Gi",
        }),
      });
      assert(overlayResponse.status === 200, `overlay run expected 200, got ${overlayResponse.status}: ${overlayResponse.body}`);
      const overlayPayload = JSON.parse(overlayResponse.body || "{}");
      const overlayManifest = await readFile(overlayPayload.run.manifestPath, "utf8");
      assert(!overlayManifest.includes("tke.cloud.tencent.com/eni-ip"), "overlay networking must not render eni pod annotation");
      await assertYamlCanParseManifest(overlayPayload.run.manifestPath);

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
