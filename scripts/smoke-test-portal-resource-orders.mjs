import { spawn } from "node:child_process";
import http from "node:http";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { mkdir, mkdtemp, rename, rm, stat } from "node:fs/promises";

const repoRoot = process.cwd();
const portalRuntimeRoot = path.join(repoRoot, ".runtime", "portal");
const portalEntrypoint = path.join(repoRoot, "services", "portal", "src", "server.mjs");
const userEmail = `resource-order-${Date.now()}@example.test`;
const userPassword = "Resource-Order-2026!";

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
          headers: res.headers,
          body: Buffer.concat(chunks).toString("utf8"),
        });
      });
    });
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

function sendJson(res, status, payload) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function startBillingFixture() {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url || "/", "http://fixture");
    if (url.pathname === "/status") {
      sendJson(res, 200, { ok: true, tencentBillingEnabled: true, tencentCloudConfigured: true });
      return;
    }
    if (url.pathname === "/billing") {
      sendJson(res, 200, {
        ok: true,
        source: "tencent_cloud_bill",
        cloudSource: "tencent_cloud",
        totals: { cpuCost: 0, gpuCost: 0, pvCost: 0, totalCost: 0 },
        items: [],
      });
      return;
    }
    if (url.pathname === "/pending") {
      sendJson(res, 200, { ok: true, totals: { totalCost: 0 }, runs: [] });
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
          id: "s5-small",
          name: "S5 small",
          provider: "tencent",
          region: "ap-guangzhou",
          zone: "ap-guangzhou-6",
          instanceType: "S5.SMALL1",
          cpu: 1,
          memoryGb: 1,
          gpu: 0,
          runtimeClass: "kata-qcloud",
          cpuRequest: "1000m",
          cpuLimit: "1000m",
          memoryRequest: "1Gi",
          memoryLimit: "1Gi",
          storageRequest: "5Gi",
          storageLimit: "10Gi",
          minBillableHours: 1,
          riskFactor: 1.2,
          reservationFloor: 0,
          priceStatus: "quoted",
          salable: true,
          currency: "CNY",
          discountPrice: 0.11,
          unitPrice: 0.11,
          pricingSource: "tencent_cloud_price",
          priceUpdatedAt: "2026-04-27T00:00:00.000Z",
        }],
      });
      return;
    }
    sendJson(res, 404, { error: "not_found" });
  });
  return server;
}

function startAdapterFixture() {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url || "/", "http://fixture");
    if (url.pathname === "/healthz") {
      sendJson(res, 200, { ok: true });
      return;
    }
    if (req.method === "POST" && url.pathname === "/api/opl-launch/tokens") {
      sendJson(res, 200, {
        launchId: "launch-resource-order-smoke",
        launchToken: "launch-token-resource-order-smoke",
        runtimeSessionId: "runtime-resource-order-smoke",
        oplSessionId: "opl-resource-order-smoke",
        bootstrapUrl: "/portal-adapter/api/opl-launch/bootstrap?launch_token=launch-token-resource-order-smoke",
      });
      return;
    }
    sendJson(res, 404, { error: "not_found" });
  });
  return server;
}

function extractCookie(setCookie, name) {
  const headers = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
  for (const header of headers) {
    const cookie = String(header || "").split(";")[0] || "";
    const [cookieName, ...value] = cookie.split("=");
    if (cookieName === name && value.length) return `${cookieName}=${value.join("=")}`;
  }
  return "";
}

function formBody(values) {
  return new URLSearchParams(values).toString();
}

async function postForm(baseUrl, pathname, values, cookie = "") {
  const body = formBody(values);
  return request(baseUrl, pathname, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      "content-length": String(Buffer.byteLength(body)),
      ...(cookie ? { cookie } : {}),
    },
    body,
  });
}

async function postJson(baseUrl, pathname, payload, cookie = "", headers = {}) {
  const body = JSON.stringify(payload);
  return request(baseUrl, pathname, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "content-length": String(Buffer.byteLength(body)),
      ...(cookie ? { cookie } : {}),
      ...headers,
    },
    body,
  });
}

async function waitForPortal(baseUrl, child) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    assert(child.exitCode === null, `portal_process_exited:${child.exitCode}`);
    try {
      const response = await request(baseUrl, "/healthz");
      if (response.status === 200) return;
    } catch {}
    await sleep(250);
  }
  throw new Error("portal_start_timeout");
}

async function withIsolatedPortalRuntime(fn) {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "portal-resource-orders-"));
  const backupRoot = path.join(tempRoot, "portal-runtime-backup");
  const hadRuntime = await exists(portalRuntimeRoot);
  if (hadRuntime) await rename(portalRuntimeRoot, backupRoot);
  try {
    await mkdir(path.dirname(portalRuntimeRoot), { recursive: true });
    return await fn();
  } finally {
    await rm(portalRuntimeRoot, { recursive: true, force: true }).catch(() => {});
    if (hadRuntime && await exists(backupRoot)) {
      await rename(backupRoot, portalRuntimeRoot);
    }
    await rm(tempRoot, { recursive: true, force: true }).catch(() => {});
  }
}

async function listen(server) {
  const port = await freePort();
  await new Promise((resolve) => server.listen(port, "127.0.0.1", resolve));
  return `http://127.0.0.1:${port}`;
}

async function main() {
  assert(await exists(portalEntrypoint), `portal entrypoint missing: ${portalEntrypoint}`);
  const billingServer = startBillingFixture();
  const adapterServer = startAdapterFixture();
  const billingUrl = await listen(billingServer);
  const adapterUrl = await listen(adapterServer);
  const portalPort = await freePort();
  const portalUrl = `http://127.0.0.1:${portalPort}`;
  let portal = null;

  try {
    await withIsolatedPortalRuntime(async () => {
      portal = spawn(process.execPath, [portalEntrypoint], {
        cwd: repoRoot,
        env: {
          ...process.env,
          PORT: String(portalPort),
          PORTAL_STORAGE_MODE: "json",
          PORTAL_OIDC_ENABLED: "0",
          PORTAL_IDENTITY_SYNC_MODE: "local",
          PORTAL_ALLOW_REGISTRATION: "1",
          PORTAL_INTERNAL_AUTH_TOKEN: "resource-order-internal-token",
          BILLING_SERVICE_URL: billingUrl,
          PORTAL_OPL_ADAPTER_URL: adapterUrl,
          OPL_WEB_URL: "http://127.0.0.1:19999/opl-web",
        },
        stdio: ["ignore", "pipe", "pipe"],
      });

      await waitForPortal(portalUrl, portal);
      const register = await postForm(portalUrl, "/register", {
        name: "Resource Order Smoke",
        email: userEmail,
        password: userPassword,
      });
      assert(register.status === 302, `register expected 302, got ${register.status}: ${register.body}`);
      const cookie = extractCookie(register.headers["set-cookie"], "portal_session");
      assert(cookie, "portal_session cookie missing after register");

      const quoteResponse = await postJson(portalUrl, "/portal/api/resource-orders/quote", {
        workspaceId: "default",
        serverPlanId: "s5-small",
        estimatedHours: 1,
        runId: "run-quote-smoke",
      }, cookie);
      assert(quoteResponse.status === 200, `quote expected 200, got ${quoteResponse.status}: ${quoteResponse.body}`);
      const quote = JSON.parse(quoteResponse.body || "{}");
      assert(quote.resourceOrderId, `quote resourceOrderId missing: ${quoteResponse.body}`);
      assert(quote.order?.status === "quoted", `quote status mismatch: ${quoteResponse.body}`);
      assert(quote.order?.freezeAmount === 0.13, `freeze amount should use quoted plan and risk factor: ${quoteResponse.body}`);

      const freezeResponse = await postJson(portalUrl, "/portal/api/resource-orders/freeze", {
        orderId: quote.resourceOrderId,
      }, cookie);
      assert(freezeResponse.status === 200, `freeze expected 200, got ${freezeResponse.status}: ${freezeResponse.body}`);
      const frozen = JSON.parse(freezeResponse.body || "{}");
      assert(frozen.order?.status === "frozen", `freeze status mismatch: ${freezeResponse.body}`);
      assert(frozen.commercial?.activeFreeze === 0.13, `active freeze missing: ${freezeResponse.body}`);
      assert(frozen.commercial?.availableBalance === 49.87, `available balance mismatch: ${freezeResponse.body}`);

      const ordersResponse = await request(portalUrl, "/portal/api/resource-orders", { headers: { cookie } });
      assert(ordersResponse.status === 200, `orders expected 200, got ${ordersResponse.status}: ${ordersResponse.body}`);
      const orders = JSON.parse(ordersResponse.body || "{}");
      assert(orders.items?.some((item) => item.id === quote.resourceOrderId), `order list missing quoted order: ${ordersResponse.body}`);

      const prepareResponse = await postJson(portalUrl, "/portal/internal/resource-orders/prepare-run", {
        userId: orders.items[0].userId,
        workspaceId: "default",
        workspaceSessionId: "runtime-session-smoke",
        runId: "run-prepare-smoke",
        serverPlanId: "s5-small",
        estimatedHours: 1,
      }, "", { "x-portal-internal-token": "resource-order-internal-token" });
      assert(prepareResponse.status === 200, `prepare-run expected 200, got ${prepareResponse.status}: ${prepareResponse.body}`);
      const prepared = JSON.parse(prepareResponse.body || "{}");
      assert(prepared.resourceOrderId, `prepare resourceOrderId missing: ${prepareResponse.body}`);
      assert(prepared.order?.status === "provisioning", `prepare status should be provisioning: ${prepareResponse.body}`);
      assert(prepared.order?.events?.some((item) => item.eventType === "frozen"), `prepare frozen event missing: ${prepareResponse.body}`);

      console.log(JSON.stringify({
        ok: true,
        portalUrl,
        quotedOrderId: quote.resourceOrderId,
        preparedOrderId: prepared.resourceOrderId,
        activeFreeze: prepared.commercial?.activeFreeze,
        availableBalance: prepared.commercial?.availableBalance,
      }, null, 2));
    });
  } finally {
    portal?.kill();
    billingServer.close();
    adapterServer.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
