import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import http from "node:http";
import net from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const portalDbFile = path.join(repoRoot, ".runtime", "portal", "portal-db.json");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

function spawnService(label, cwd, entrypoint, env) {
  const child = spawn(process.execPath, [entrypoint], {
    cwd,
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.on("data", (chunk) => process.stdout.write(`[${label}] ${chunk}`));
  child.stderr.on("data", (chunk) => process.stderr.write(`[${label}] ${chunk}`));
  return child;
}

async function waitFor(url, label) {
  for (let attempt = 0; attempt < 160; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.status < 500) return;
    } catch {}
    await sleep(250);
  }
  throw new Error(`${label}_not_ready`);
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, options);
  const payload = await response.json().catch(() => ({}));
  assert(response.ok, `${url} failed: ${JSON.stringify(payload)}`);
  return payload;
}

async function seedPortalWallet(userId, balance = 100) {
  const db = JSON.parse(await readFile(portalDbFile, "utf8"));
  db.wallets = Array.isArray(db.wallets) ? db.wallets : [];
  const existing = db.wallets.find((item) => item.userId === userId);
  if (existing) {
    existing.balance = balance;
    existing.updatedAt = new Date().toISOString();
  } else {
    db.wallets.push({
      userId,
      balance,
      updatedAt: new Date().toISOString(),
    });
  }
  await writeFile(portalDbFile, `${JSON.stringify(db, null, 2)}\n`, "utf8");
}

function startPortalInternalFixture() {
  const preparedOrders = [];
  return {
    preparedOrders,
    server: http.createServer(async (req, res) => {
      const url = new URL(req.url || "/", "http://fixture");
      const send = (status, payload) => {
        res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
        res.end(JSON.stringify(payload));
      };
      if (req.method === "POST" && url.pathname === "/portal/internal/resource-orders/prepare-run") {
        const chunks = [];
        for await (const chunk of req) chunks.push(chunk);
        const body = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
        const resourceOrderId = `order-${String(body.runId || "missing-run")}`;
        const order = {
          id: resourceOrderId,
          status: "frozen",
          tenantId: body.tenantId || "",
          userId: body.userId || "",
          workspaceId: body.workspaceId || "",
          workspaceSessionId: body.workspaceSessionId || "",
          runId: body.runId || "",
          serverPlanId: body.serverPlanId || "",
          estimatedHours: Number(body.estimatedHours || 0),
          idempotencyKey: body.idempotencyKey || "",
        };
        preparedOrders.push(order);
        send(200, { ok: true, resourceOrderId, order });
        return;
      }
      send(404, { ok: false, error: "not_found" });
    }),
  };
}

async function listen(server) {
  const port = await freePort();
  await new Promise((resolve) => server.listen(port, "127.0.0.1", resolve));
  return `http://127.0.0.1:${port}`;
}

async function main() {
  const runtimeRoot = await mkdtemp(path.join(tmpdir(), "opl-v10-resource-order-"));
  const kubectlFixture = path.join(runtimeRoot, "fake-kubectl-resource-order.cmd");
  await writeFile(kubectlFixture, `@echo off
setlocal

if "%1"=="get" (
  if "%2"=="namespace" (
    echo {"kind":"Namespace","metadata":{"name":"%3"}}
    exit /b 0
  )
  if "%2"=="job" (
    echo {"status":{"succeeded":1}}
    exit /b 0
  )
)

if "%1"=="create" (
  if "%2"=="namespace" (
    echo namespace/%3 created
    exit /b 0
  )
)

if "%1"=="apply" (
  echo job.batch/fake-job configured
  exit /b 0
)

echo ok
exit /b 0
`, "utf8");
  const portalInternal = startPortalInternalFixture();
  const portalInternalUrl = await listen(portalInternal.server);
  const runnerPort = await freePort();
  const runnerUrl = `http://127.0.0.1:${runnerPort}`;
  const adapterPort = await freePort();
  const adapterUrl = `http://127.0.0.1:${adapterPort}`;

  const runner = spawnService("runner", path.join(repoRoot, "adapters", "med-autoscience-runner"), "src/server.mjs", {
    ...process.env,
    MED_AUTOSCIENCE_RUNNER_PORT: String(runnerPort),
    PORTAL_STORAGE_MODE: "json",
    KUBECTL_BIN: kubectlFixture,
    BILLING_RECONCILE_URL: "http://127.0.0.1:9/reconcile",
  });
  const adapter = spawnService("adapter", path.join(repoRoot, "services", "opl-runtime-bridge"), "src/server.mjs", {
    ...process.env,
    PORT: String(adapterPort),
    PORTAL_STORAGE_MODE: "json",
    PORTAL_OPL_ADAPTER_PUBLIC_URL: adapterUrl,
    PORTAL_OPL_ADAPTER_STATE_ROOT: path.join(runtimeRoot, "adapter-state"),
    OPL_WEB_URL: "http://127.0.0.1:19999/opl-web",
    MED_AUTOSCIENCE_RUNNER_URL: runnerUrl,
    PORTAL_INTERNAL_BASE_URL: portalInternalUrl,
  });

  try {
    await waitFor(`${runnerUrl}/healthz`, "runner");
    await waitFor(`${adapterUrl}/healthz`, "adapter");

    const tokenResponse = await requestJson(`${adapterUrl}/api/opl-launch/tokens`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        portalUserId: "user-demo",
        tenantId: "tenant-demo",
        portalUserEmail: "user@example.com",
        portalUserName: "User Demo",
        workspaceId: "lab-a",
        workspaceTitle: "Lab A",
        workspaceSessionId: "ws-a",
        sourceSurface: "portal-control-plane",
        serverPlanId: "gpu-a10-v8",
        region: "ap-guangzhou",
        runtimeClass: "nvidia",
        nodeSelector: { "pool.medopl.ai/name": "gpu-pool-a10" },
        tolerations: [{ key: "nvidia.com/gpu", operator: "Exists", effect: "NoSchedule" }],
        cpuRequest: "8",
        cpuLimit: "8",
        memoryRequest: "32Gi",
        memoryLimit: "32Gi",
        storageRequest: "20Gi",
        storageLimit: "50Gi",
      }),
    });
    const launchToken = tokenResponse.launchToken;
    assert(launchToken, "launch_token_missing");
    await seedPortalWallet("user-demo", 100);

    const runResponse = await requestJson(`${adapterUrl}/api/opl-launch/runs`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        launchToken,
        runId: "run-resource-order-smoke",
        estimatedHours: 2,
        agentId: "mas",
        toolName: "med-autoscience",
      }),
    });
    const run = runResponse.run;
    assert(run.resourceOrderId === "order-run-resource-order-smoke", `resource_order_not_attached:${run.resourceOrderId}`);
    assert(portalInternal.preparedOrders.length === 1, `prepare_run_call_count:${portalInternal.preparedOrders.length}`);
    assert(portalInternal.preparedOrders[0].status === "frozen", `prepare_run_status:${portalInternal.preparedOrders[0].status}`);
    assert(portalInternal.preparedOrders[0].estimatedHours === 2, `prepare_run_estimated_hours:${portalInternal.preparedOrders[0].estimatedHours}`);

    const manifest = await readFile(run.manifestPath, "utf8");
    assert(manifest.includes('resource_order_id: "order-run-resource-order-smoke"'), "manifest_missing_resource_order_label");
    assert(manifest.includes('- name: RESOURCE_ORDER_ID'), "manifest_missing_resource_order_env_name");
    assert(manifest.includes('value: "order-run-resource-order-smoke"'), "manifest_missing_resource_order_env_value");

    const statusResponse = await requestJson(`${runnerUrl}/api/runs/${encodeURIComponent(run.runId)}/status`);
    assert(statusResponse.run?.billingReconcile?.status === "runner_noop", `runner_should_not_reconcile:${JSON.stringify(statusResponse.run?.billingReconcile || null)}`);

    console.log(JSON.stringify({
      ok: true,
      runId: run.runId,
      resourceOrderId: run.resourceOrderId,
      preparedOrderCount: portalInternal.preparedOrders.length,
      manifestPath: run.manifestPath,
    }, null, 2));
  } finally {
    adapter.kill();
    runner.kill();
    portalInternal.server.close();
    await rm(runtimeRoot, { recursive: true, force: true }).catch(() => {});
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
