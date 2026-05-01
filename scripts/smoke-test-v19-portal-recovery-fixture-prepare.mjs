import { execFile } from "node:child_process";
import { spawn } from "node:child_process";
import http from "node:http";
import { mkdtemp, readFile, rename, rm, stat } from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const repoRoot = process.cwd();
const portalRuntimeRoot = path.join(repoRoot, ".runtime", "portal");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function exists(targetPath) {
  try {
    await stat(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function freePort() {
  return new Promise((resolve, reject) => {
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

function spawnService(label, command, args, options = {}) {
  const child = spawn(command, args, {
    ...options,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stdout = "";
  let stderr = "";
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk) => {
    stdout += chunk;
  });
  child.stderr.on("data", (chunk) => {
    stderr += chunk;
  });
  return { child, label, readLogs: () => ({ stdout, stderr }) };
}

function sendJson(res, status, payload) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function startBillingFixture() {
  return http.createServer((req, res) => {
    const url = new URL(req.url || "/", "http://billing-fixture");
    if (url.pathname === "/billing") {
      sendJson(res, 200, {
        ok: true,
        source: "tencent_cloud_bill",
        totals: { cpuCost: 0, gpuCost: 0, pvCost: 0, totalCost: 0 },
        items: [],
      });
      return;
    }
    if (url.pathname === "/pending") {
      sendJson(res, 200, { ok: true, totals: { totalCost: 0 }, items: [] });
      return;
    }
    if (url.pathname === "/server-plans") {
      sendJson(res, 200, {
        ok: true,
        source: "tencent_cloud_price",
        configured: true,
        priceEnabled: true,
        catalogCount: 1,
        items: [{
          id: "smoke-s5-small",
          name: "Smoke S5 small",
          provider: "tencent",
          region: "ap-guangzhou",
          zone: "ap-guangzhou-6",
          instanceType: "S5.SMALL1",
          cpu: 1,
          memoryGb: 2,
          gpu: 0,
          runtimeClass: "kata-qcloud",
          cpuRequest: "1000m",
          cpuLimit: "1000m",
          memoryRequest: "2Gi",
          memoryLimit: "2Gi",
          storageRequest: "10Gi",
          storageLimit: "10Gi",
          minBillableHours: 1,
          riskFactor: 1,
          reservationFloor: 0,
          priceStatus: "quoted",
          salable: true,
          currency: "CNY",
          discountPrice: 0.11,
          unitPrice: 0.11,
          pricingSource: "tencent_cloud_price",
          priceUpdatedAt: "2026-05-01T00:00:00.000Z",
        }],
      });
      return;
    }
    sendJson(res, 404, { error: "not_found" });
  });
}

async function waitFor(url, label) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      const response = await fetch(url, { redirect: "manual" });
      if (response.status < 500) return;
    } catch {}
    await sleep(200);
  }
  throw new Error(`${label}_not_ready`);
}

async function withIsolatedPortalRuntime(fn) {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "portal-recovery-prepare-smoke-"));
  const backupRoot = path.join(tempRoot, "portal-runtime-backup");
  const hadRuntime = await exists(portalRuntimeRoot);
  if (hadRuntime) await rename(portalRuntimeRoot, backupRoot);
  try {
    return await fn();
  } finally {
    await rm(portalRuntimeRoot, { recursive: true, force: true }).catch(() => {});
    if (hadRuntime && await exists(backupRoot)) {
      await rename(backupRoot, portalRuntimeRoot);
    }
    await rm(tempRoot, { recursive: true, force: true }).catch(() => {});
  }
}

async function main() {
  const adminEmail = "zitadel-admin@zitadel.localhost";
  const adminPassword = "PortalRecoveryPrepare-2026!";
  const portalPort = await freePort();
  const oplPort = await freePort();
  const runnerPort = await freePort();
  const adapterPort = await freePort();
  const billingPort = await freePort();
  const isolatedMinioPort = await freePort();
  const stateRoot = path.join(os.tmpdir(), `portal-recovery-prepare-adapter-${Date.now()}`);
  const portalUrl = `http://127.0.0.1:${portalPort}`;
  const oplUrl = `http://127.0.0.1:${oplPort}`;
  const runnerUrl = `http://127.0.0.1:${runnerPort}`;
  const adapterUrl = `http://127.0.0.1:${adapterPort}`;
  const billingUrl = `http://127.0.0.1:${billingPort}`;

  let portal = null;
  let opl = null;
  let runner = null;
  let adapter = null;
  let billingServer = null;

  let failure = null;
  await withIsolatedPortalRuntime(async () => {
    try {
      billingServer = startBillingFixture();
      await new Promise((resolve, reject) => {
        billingServer.once("error", reject);
        billingServer.listen(billingPort, "127.0.0.1", resolve);
      });
      opl = spawnService("opl-fixture", "node", ["scripts/fixtures/opl-product-api-fixture.mjs"], {
        cwd: repoRoot,
        env: { ...process.env, PORT: String(oplPort) },
      });
      runner = spawnService("runner-fixture", "node", ["scripts/fixtures/med-autoscience-runner-fixture.mjs"], {
        cwd: repoRoot,
        env: { ...process.env, PORT: String(runnerPort) },
      });
      adapter = spawnService("opl-adapter", "node", ["src/server.mjs"], {
        cwd: path.join(repoRoot, "services", "opl-runtime-bridge"),
        env: {
          ...process.env,
          PORT: String(adapterPort),
          PORTAL_OPL_ADAPTER_PUBLIC_URL: adapterUrl,
          PORTAL_OPL_ADAPTER_STATE_ROOT: stateRoot,
          OPL_PRODUCT_API_URL: oplUrl,
          OPL_WEB_URL: "http://127.0.0.1:19999/opl-web",
          MED_AUTOSCIENCE_RUNNER_URL: runnerUrl,
        },
      });
      portal = spawnService("portal", "node", ["src/server.mjs"], {
        cwd: path.join(repoRoot, "services", "portal"),
        env: {
          ...process.env,
          PORT: String(portalPort),
          PORTAL_STORAGE_MODE: "json",
          PORTAL_OIDC_ENABLED: "0",
          PORTAL_IDENTITY_SYNC_MODE: "local",
          PORTAL_ADMIN_EMAIL: adminEmail,
          PORTAL_ADMIN_PASSWORD: adminPassword,
          PORTAL_ADMIN_NAME: "Portal Recovery Admin",
          PORTAL_OPL_ADAPTER_URL: adapterUrl,
          BILLING_SERVICE_URL: billingUrl,
          MINIO_API_URL: `http://127.0.0.1:${isolatedMinioPort}`,
          MINIO_CONSOLE_URL: `http://127.0.0.1:${isolatedMinioPort}`,
          OPL_WEB_URL: "http://127.0.0.1:19999/opl-web",
        },
      });

      await waitFor(`${oplUrl}/healthz`, "opl_fixture");
      await waitFor(`${runnerUrl}/healthz`, "runner_fixture");
      await waitFor(`${adapterUrl}/healthz`, "opl_adapter");
      await waitFor(`${portalUrl}/healthz`, "portal");

      const { stdout, stderr } = await execFileAsync(process.execPath, ["scripts/live-prepare-v19-portal-recovery-fixture.mjs"], {
        cwd: repoRoot,
        env: {
          ...process.env,
          RUN_PORTAL_RECOVERY_LIVE: "1",
          PORTAL_BASE_URL: portalUrl,
          PORTAL_TEST_LOGIN: "local",
          PORTAL_ADMIN_LOGIN_MODE: "local",
          PORTAL_ADMIN_EMAIL: adminEmail,
          PORTAL_ADMIN_PASSWORD: adminPassword,
          PORTAL_RECOVERY_PREPARE_TRACE: "1",
          PORTAL_RECOVERY_PREPARE_TIMEOUT_MS: "30000",
          PORTAL_RECOVERY_SERVER_PLAN_ID: "",
        },
        encoding: "utf8",
        timeout: 180_000,
        maxBuffer: 1024 * 1024 * 8,
      });

      const payload = JSON.parse(stdout || "{}");
      assert(payload.ok === true, `prepare_fixture_failed:${stderr || stdout}`);
      assert(payload.fixtureFile, "fixture_file_missing");

      const stored = JSON.parse(await readFile(payload.fixtureFile, "utf8"));
      assert(stored.env?.PORTAL_RECOVERY_USER_EMAIL?.startsWith("test-"), "fixture_email_prefix_missing");
      assert(stored.env?.PORTAL_RECOVERY_WORKSPACE_ID?.startsWith("test-"), "fixture_workspace_prefix_missing");
      assert(stored.env?.PORTAL_RECOVERY_RESOURCE_ORDER_ID, "fixture_resource_order_missing");
      assert(stored.env?.PORTAL_RECOVERY_FILE_RELATIVE_PATH, "fixture_file_relative_path_missing");
      assert(stored.env?.PORTAL_RECOVERY_TRACE_SESSION_ID, "fixture_trace_session_missing");
      assert(stored.env?.PORTAL_RECOVERY_WORKSPACE_SESSION_ID, "fixture_workspace_session_missing");
      assert(stored.secretFiles?.PORTAL_RECOVERY_USER_PASSWORD, "fixture_password_file_missing");
      assert(await exists(stored.secretFiles.PORTAL_RECOVERY_USER_PASSWORD), "fixture_password_file_not_written");

      console.log(JSON.stringify({
        ok: true,
        fixtureFile: payload.fixtureFile,
        workspaceId: stored.env.PORTAL_RECOVERY_WORKSPACE_ID,
        resourceOrderId: stored.env.PORTAL_RECOVERY_RESOURCE_ORDER_ID,
        traceSessionId: stored.env.PORTAL_RECOVERY_TRACE_SESSION_ID,
      }, null, 2));
    } catch (error) {
      failure = error;
      throw error;
    } finally {
      for (const service of [portal, adapter, runner, opl]) {
        if (service?.child && service.child.exitCode === null) service.child.kill("SIGTERM");
      }
      if (billingServer) {
        await new Promise((resolve) => billingServer.close(resolve));
      }
      await sleep(1000);
      for (const service of [portal, adapter, runner, opl]) {
        if (service?.child && service.child.exitCode === null) service.child.kill("SIGKILL");
      }
      await rm(stateRoot, { recursive: true, force: true }).catch(() => {});
      if (failure) {
        const logs = Object.fromEntries(
          [portal, adapter, runner, opl]
            .filter(Boolean)
            .map((service) => [service.label, service.readLogs()]),
        );
        console.error(JSON.stringify({ failure: String(failure.message || failure), logs }, null, 2));
      }
    }
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
