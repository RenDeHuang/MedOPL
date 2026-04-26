import { spawn } from "node:child_process";
import http from "node:http";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { mkdir, mkdtemp, rename, rm, stat } from "node:fs/promises";

const repoRoot = process.cwd();
const portalRuntimeRoot = path.join(repoRoot, ".runtime", "portal");
const portalEntrypoint = path.join(repoRoot, "services", "portal", "src", "server.mjs");
const userEmail = `commercial-${Date.now()}@example.test`;
const userPassword = "Commercial-SaaS-2026!";

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
      sendJson(res, 200, { ok: true, runs: [], riskByWorkspace: [] });
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
          name: "S5 标准型",
          provider: "tencent",
          region: "ap-guangzhou",
          zone: "ap-guangzhou-6",
          instanceType: "S5.SMALL1",
          cpu: 1,
          memoryGb: 1,
          gpu: 0,
          minBillableHours: 1,
          riskFactor: 1.2,
          reservationFloor: 0,
          priceStatus: "quoted",
          salable: true,
          currency: "CNY",
          discountPrice: 0.11,
          unitPrice: 0.11,
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
      const payload = {
        launchId: "launch-commercial-smoke",
        launchToken: "launch-token-commercial-smoke",
        runtimeSessionId: "runtime-commercial-smoke",
        oplSessionId: "opl-commercial-smoke",
        bootstrapUrl: "/portal-adapter/api/opl-launch/bootstrap?launch_token=launch-token-commercial-smoke",
      };
      sendJson(res, 200, payload);
      return;
    }
    if (url.pathname === "/api/runs" || url.pathname === "/api/trace-links" || url.pathname === "/api/cost-records") {
      sendJson(res, 200, { items: [] });
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
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "portal-commercial-"));
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
          BILLING_SERVICE_URL: billingUrl,
          PORTAL_OPL_ADAPTER_URL: adapterUrl,
          OPL_WEB_URL: "http://127.0.0.1:19999/opl-web",
        },
        stdio: ["ignore", "pipe", "pipe"],
      });

      await waitForPortal(portalUrl, portal);
      const register = await postForm(portalUrl, "/register", {
        name: "Commercial Smoke",
        email: userEmail,
        password: userPassword,
      });
      assert(register.status === 302, `register expected 302, got ${register.status}: ${register.body}`);
      const cookie = extractCookie(register.headers["set-cookie"], "portal_session");
      assert(cookie, "portal_session cookie missing after register");

      const meResponse = await request(portalUrl, "/portal/api/me", { headers: { cookie } });
      assert(meResponse.status === 200, `me expected 200, got ${meResponse.status}`);
      const me = JSON.parse(meResponse.body || "{}");
      assert(me.accountStatus === "active", `accountStatus mismatch: ${meResponse.body}`);
      assert(me.entitlementStatus === "trial_active", `trial entitlement missing: ${meResponse.body}`);
      assert(me.billingStatus === "trial_only", `billing status should be trial_only for zero wallet trial: ${meResponse.body}`);
      assert(me.commercial?.canEnterWorkbench === true, `canEnterWorkbench should be true: ${meResponse.body}`);

      const overviewResponse = await request(portalUrl, "/portal/api/overview", { headers: { cookie } });
      assert(overviewResponse.status === 200, `overview expected 200, got ${overviewResponse.status}`);
      const overview = JSON.parse(overviewResponse.body || "{}");
      assert(overview.commercial?.canEnterWorkbench === true, "overview commercial status missing");
      assert(overview.onboarding?.items?.some((item) => item.id === "server_plans"), "onboarding server_plans missing");
      assert(overview.serverPlansSummary?.salableCount === 1, `server plan summary mismatch: ${overviewResponse.body}`);

      const plansResponse = await request(portalUrl, "/portal/api/server-plans", { headers: { cookie } });
      assert(plansResponse.status === 200, `server plans expected 200, got ${plansResponse.status}`);
      const plans = JSON.parse(plansResponse.body || "{}");
      assert(plans.freezePolicy?.finalBilling?.includes("腾讯云账单明细"), "freeze policy final billing missing");
      assert(plans.items?.[0]?.priceStatus === "quoted", `quoted server plan missing: ${plansResponse.body}`);

      const launchResponse = await request(portalUrl, "/portal/api/opl/launch", {
        method: "POST",
        headers: { "content-type": "application/json", cookie },
        body: JSON.stringify({ task: "default" }),
      });
      assert(launchResponse.status === 200, `trial zero-wallet launch should enter OPL, got ${launchResponse.status}: ${launchResponse.body}`);
      const launch = JSON.parse(launchResponse.body || "{}");
      assert(launch.ok === true && launch.launchToken, `launch token missing: ${launchResponse.body}`);

      console.log(JSON.stringify({
        ok: true,
        portalUrl,
        userEmail,
        accountStatus: me.accountStatus,
        billingStatus: me.billingStatus,
        entitlementStatus: me.entitlementStatus,
        serverPlanStatus: plans.items[0].priceStatus,
        launchToken: launch.launchToken,
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
