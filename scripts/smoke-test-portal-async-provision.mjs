import { spawn } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import http from "node:http";
import net from "node:net";
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

async function listen(server) {
  const port = await freePort();
  await new Promise((resolve) => server.listen(port, "127.0.0.1", resolve));
  return `http://127.0.0.1:${port}`;
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, options);
  const payload = await response.json().catch(() => ({}));
  assert(response.ok, `${url} failed: ${JSON.stringify(payload)}`);
  return payload;
}

async function loginPortal(baseUrl) {
  const body = new URLSearchParams({
    email: process.env.PORTAL_ADMIN_EMAIL || "zitadel-admin@zitadel.localhost",
    password: process.env.PORTAL_ADMIN_PASSWORD || "Password1!",
  });
  const response = await fetch(`${baseUrl}/login`, {
    method: "POST",
    redirect: "manual",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  assert(response.status === 302, `login_failed:${response.status}`);
  const setCookie = response.headers.get("set-cookie") || "";
  const match = setCookie.match(/portal_session=([^;]+)/);
  assert(match, "portal_session_missing");
  return `portal_session=${match[1]}`;
}

async function ensurePortalWallet(userId, minBalance = 100) {
  const raw = await readFile(portalDbFile, "utf8");
  const db = JSON.parse(raw);
  db.wallets = Array.isArray(db.wallets) ? db.wallets : [];
  const wallet = db.wallets.find((item) => item.userId === userId);
  if (wallet) {
    wallet.balance = Math.max(Number(wallet.balance || 0), minBalance);
    wallet.updatedAt = new Date().toISOString();
  } else {
    db.wallets.push({ userId, balance: minBalance, updatedAt: new Date().toISOString() });
  }
  await writeFile(portalDbFile, `${JSON.stringify(db, null, 2)}\n`, "utf8");
}

function startBillingFixture(plan) {
  return http.createServer((req, res) => {
    const url = new URL(req.url || "/", "http://fixture");
    const send = (status, payload) => {
      res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
      res.end(JSON.stringify(payload));
    };
    if (url.pathname === "/status") {
      send(200, { ok: true, tencentBillingEnabled: true, tencentPriceEnabled: true, tencentCloudConfigured: true });
      return;
    }
    if (url.pathname === "/billing") {
      send(200, { ok: true, totals: { totalCost: 0 }, items: [] });
      return;
    }
    if (url.pathname === "/pending") {
      send(200, { ok: true, runs: [], riskByWorkspace: [] });
      return;
    }
    if (url.pathname === "/server-plans") {
      send(200, { ok: true, source: "tencent_cloud_price", items: [plan] });
      return;
    }
    send(404, { ok: false, error: "not_found" });
  });
}

function startProvisionerFixture() {
  const calls = [];
  return {
    calls,
    server: http.createServer(async (req, res) => {
      const url = new URL(req.url || "/", "http://fixture");
      const send = (status, payload) => {
        res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
        res.end(JSON.stringify(payload));
      };
      if (req.method === "GET" && url.pathname === "/cloud/resources") {
        send(200, { ok: true, summary: { nodePoolCount: 0 }, nodePools: [], instances: [] });
        return;
      }
      if (req.method === "POST" && url.pathname === "/resource-orders/provision-async") {
        const chunks = [];
        for await (const chunk of req) chunks.push(chunk);
        const body = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
        calls.push(body);
        send(202, {
          ok: true,
          accepted: true,
          order: {
            id: "provisioner-order-smoke",
            status: "provisioning",
            resourceOrderId: body.resourceOrderId,
            requestId: "req-async-smoke",
          },
        });
        return;
      }
      send(404, { ok: false, error: "not_found" });
    }),
  };
}

async function main() {
  const plan = {
    id: "cpu-2c4g",
    name: "2C4G",
    provider: "tencent",
    region: "na-siliconvalley",
    zone: "na-siliconvalley-1",
    instanceType: "S5.SMALL2",
    cpu: 2,
    memoryGb: 4,
    unitPrice: 0.44,
    discountPrice: 0.44,
    currency: "CNY",
    minBillableHours: 1,
    riskFactor: 1,
    reservationFloor: 0,
    pricingSource: "tencent_cloud_price",
    provisioningMode: "tke_node_pool_create",
    imageId: "img-487zeit5",
  };
  const billingServer = startBillingFixture(plan);
  const billingUrl = await listen(billingServer);
  const provisionerFixture = startProvisionerFixture();
  const provisionerUrl = await listen(provisionerFixture.server);
  const portalPort = await freePort();
  const portalUrl = `http://127.0.0.1:${portalPort}`;
  const portal = spawnService("portal", path.join(repoRoot, "services", "portal"), "src/server.mjs", {
    ...process.env,
    PORT: String(portalPort),
    PORTAL_OIDC_ENABLED: "0",
    PORTAL_STORAGE_MODE: "json",
    BILLING_SERVICE_URL: billingUrl,
    RESOURCE_PROVISIONER_URL: provisionerUrl,
    OPL_WEB_URL: "http://127.0.0.1:19999/opl-web",
  });

  try {
    const suffix = String(Date.now());
    const runId = `run-async-smoke-${suffix}`;
    const failedRunId = `run-async-failed-${suffix}`;
    await waitFor(`${portalUrl}/healthz`, "portal");
    const cookie = await loginPortal(portalUrl);
    const me = await requestJson(`${portalUrl}/portal/api/me`, { headers: { cookie } });
    await ensurePortalWallet(me.id, 100);
    const frozen = await requestJson(`${portalUrl}/portal/api/resource-orders/freeze`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ task: "default", serverPlanId: plan.id, runId, storageSizeGb: 10 }),
    });
    assert(frozen.order?.status === "frozen", `order_not_frozen:${frozen.order?.status}`);

    const provisioned = await requestJson(`${portalUrl}/portal/api/resource-orders/provision`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ resourceOrderId: frozen.resourceOrderId, runId }),
    });
    assert(provisioned.order?.status === "provisioning", `provision_should_return_pending:${provisioned.order?.status}`);
    assert(provisionerFixture.calls.length === 1, `provisioner_call_count:${provisionerFixture.calls.length}`);

    const callback = await requestJson(`${portalUrl}/portal/internal/resource-orders/provisioning-result`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        resourceOrderId: frozen.resourceOrderId,
        status: "running",
        nodePoolId: "np-async-smoke",
        requestId: "req-async-smoke",
        runId,
      }),
    });
    assert(callback.order?.status === "running", `callback_should_mark_running:${callback.order?.status}`);
    assert(callback.order?.cloudResourceIds?.includes("np-async-smoke"), "callback_should_attach_node_pool");

    const failedFrozen = await requestJson(`${portalUrl}/portal/api/resource-orders/freeze`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ task: "default", serverPlanId: plan.id, runId: failedRunId, storageSizeGb: 10 }),
    });
    const failedProvision = await requestJson(`${portalUrl}/portal/api/resource-orders/provision`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ resourceOrderId: failedFrozen.resourceOrderId, runId: failedRunId }),
    });
    assert(failedProvision.order?.status === "provisioning", `failed_case_should_start_provisioning:${failedProvision.order?.status}`);
    const failedCallback = await requestJson(`${portalUrl}/portal/internal/resource-orders/provisioning-result`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        resourceOrderId: failedFrozen.resourceOrderId,
        status: "failed",
        requestId: "req-async-failed",
        runId: failedRunId,
        reason: "node_pool_ready_timeout",
      }),
    });
    assert(failedCallback.order?.status === "failed", `callback_should_mark_failed:${failedCallback.order?.status}`);
    assert(failedCallback.order?.failedReason === "node_pool_ready_timeout", `failed_reason_missing:${failedCallback.order?.failedReason}`);

    console.log(JSON.stringify({
      ok: true,
      resourceOrderId: frozen.resourceOrderId,
      provisionStatus: provisioned.order.status,
      callbackStatus: callback.order.status,
      failedResourceOrderId: failedFrozen.resourceOrderId,
      failedCallbackStatus: failedCallback.order.status,
    }, null, 2));
  } finally {
    portal.kill();
    billingServer.close();
    provisionerFixture.server.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
