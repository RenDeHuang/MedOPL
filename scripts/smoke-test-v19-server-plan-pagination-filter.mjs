import { spawn } from "node:child_process";
import http from "node:http";
import net from "node:net";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const portalEntrypoint = path.join(repoRoot, "services", "portal", "src", "server.mjs");
const catalogModuleUrl = pathToFileURL(path.join(
  repoRoot,
  "services",
  "portal",
  "frontend",
  "src",
  "views",
  "servers",
  "server-plan-catalog.mjs",
)).href;

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

function startBillingFixture(plans) {
  return http.createServer((req, res) => {
    const url = new URL(req.url || "/", "http://fixture");
    const send = (status, payload) => {
      res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
      res.end(JSON.stringify(payload));
    };

    if (url.pathname === "/status") {
      send(200, {
        ok: true,
        tencentBillingEnabled: true,
        tencentPriceEnabled: true,
        tencentCloudConfigured: true,
        cloudStatus: {
          readiness: {
            cloudAccountConnected: true,
            realPriceReady: true,
            exactBillReady: true,
          },
        },
      });
      return;
    }
    if (url.pathname === "/billing") {
      send(200, {
        ok: true,
        source: "tencent_cloud_bill",
        cloudSource: "tencent_cloud",
        totals: { cpuCost: 0, gpuCost: 0, pvCost: 0, totalCost: 0 },
        items: [],
      });
      return;
    }
    if (url.pathname === "/pending") {
      send(200, { ok: true, runs: [], riskByWorkspace: [] });
      return;
    }
    if (url.pathname === "/server-plans") {
      send(200, {
        ok: true,
        source: "tencent_cloud_live_catalog",
        configured: true,
        priceEnabled: true,
        discoveryEnabled: true,
        discoveredCount: plans.length,
        catalogCount: plans.length,
        candidateCount: plans.length,
        orderableCount: plans.filter((item) => item.canOrder).length,
        items: plans,
        cloudStatus: {
          provider: "tencent_cloud",
          region: "na-siliconvalley",
          readiness: {
            cloudAccountConnected: true,
            realPriceReady: true,
            exactBillReady: true,
            catalogReady: true,
            serverPlansReady: true,
          },
        },
      });
      return;
    }
    send(404, { ok: false, error: "not_found" });
  });
}

async function listen(server) {
  const port = await freePort();
  await new Promise((resolve) => server.listen(port, "127.0.0.1", resolve));
  return `http://127.0.0.1:${port}`;
}

async function waitFor(url, child, label) {
  for (let attempt = 0; attempt < 160; attempt += 1) {
    assert(child.exitCode === null, `${label}_exited:${child.exitCode}`);
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

function buildPlans() {
  return [
    {
      id: "plan-2c4g",
      name: "SA5 2C4G",
      provider: "tencent",
      region: "na-siliconvalley",
      zone: "na-siliconvalley-1",
      instanceType: "SA5.MEDIUM4",
      cpu: 2,
      memoryGb: 4,
      gpu: 0,
      minBillableHours: 1,
      riskFactor: 1.2,
      reservationFloor: 0,
      priceStatus: "quoted",
      availabilityStatus: "SELL",
      statusCategory: "EnoughStock",
      soldOutReason: "",
      hourlyPrice: 1.11,
      currency: "CNY",
      discountPrice: 1.11,
      unitPrice: 1.11,
      canOrder: true,
      salable: true,
    },
    {
      id: "plan-4c8g",
      name: "SA5 4C8G",
      provider: "tencent",
      region: "na-siliconvalley",
      zone: "na-siliconvalley-1",
      instanceType: "SA5.LARGE8",
      cpu: 4,
      memoryGb: 8,
      gpu: 0,
      minBillableHours: 1,
      riskFactor: 1.2,
      reservationFloor: 0,
      priceStatus: "quoted",
      availabilityStatus: "SELL",
      statusCategory: "EnoughStock",
      soldOutReason: "",
      hourlyPrice: 1.55,
      currency: "CNY",
      discountPrice: 1.55,
      unitPrice: 1.55,
      canOrder: true,
      salable: true,
    },
    {
      id: "plan-4c16g-soldout",
      name: "SA5 4C16G",
      provider: "tencent",
      region: "na-siliconvalley",
      zone: "na-siliconvalley-1",
      instanceType: "SA5.XLARGE16",
      cpu: 4,
      memoryGb: 16,
      gpu: 0,
      minBillableHours: 1,
      riskFactor: 1.2,
      reservationFloor: 0,
      priceStatus: "quoted",
      availabilityStatus: "SOLD",
      statusCategory: "SoldOut",
      soldOutReason: "inventory_exhausted",
      hourlyPrice: 2.05,
      currency: "CNY",
      discountPrice: 2.05,
      unitPrice: 2.05,
      canOrder: false,
      salable: false,
    },
    {
      id: "plan-8c16g",
      name: "SA5 8C16G",
      provider: "tencent",
      region: "na-siliconvalley",
      zone: "na-siliconvalley-1",
      instanceType: "SA5.2XLARGE16",
      cpu: 8,
      memoryGb: 16,
      gpu: 0,
      minBillableHours: 1,
      riskFactor: 1.2,
      reservationFloor: 0,
      priceStatus: "quoted",
      availabilityStatus: "SELL",
      statusCategory: "EnoughStock",
      soldOutReason: "",
      hourlyPrice: 2.45,
      currency: "CNY",
      discountPrice: 2.45,
      unitPrice: 2.45,
      canOrder: true,
      salable: true,
    },
    {
      id: "plan-8c32g",
      name: "SA5 8C32G",
      provider: "tencent",
      region: "na-siliconvalley",
      zone: "na-siliconvalley-1",
      instanceType: "SA5.2XLARGE32",
      cpu: 8,
      memoryGb: 32,
      gpu: 0,
      minBillableHours: 1,
      riskFactor: 1.2,
      reservationFloor: 0,
      priceStatus: "quoted",
      availabilityStatus: "SELL",
      statusCategory: "EnoughStock",
      soldOutReason: "",
      hourlyPrice: 3.15,
      currency: "CNY",
      discountPrice: 3.15,
      unitPrice: 3.15,
      canOrder: true,
      salable: true,
    },
    {
      id: "plan-16c64g",
      name: "SA5 16C64G",
      provider: "tencent",
      region: "na-siliconvalley",
      zone: "na-siliconvalley-1",
      instanceType: "SA5.4XLARGE64",
      cpu: 16,
      memoryGb: 64,
      gpu: 0,
      minBillableHours: 1,
      riskFactor: 1.2,
      reservationFloor: 0,
      priceStatus: "quoted",
      availabilityStatus: "SELL",
      statusCategory: "EnoughStock",
      soldOutReason: "",
      hourlyPrice: 5.25,
      currency: "CNY",
      discountPrice: 5.25,
      unitPrice: 5.25,
      canOrder: true,
      salable: true,
    },
  ];
}

async function main() {
  const plans = buildPlans();
  const billingServer = startBillingFixture(plans);
  const billingUrl = await listen(billingServer);
  const portalPort = await freePort();
  const portalUrl = `http://127.0.0.1:${portalPort}`;
  const portal = spawn(process.execPath, [portalEntrypoint], {
    cwd: repoRoot,
    env: {
      ...process.env,
      PORT: String(portalPort),
      PORTAL_OIDC_ENABLED: "0",
      PORTAL_STORAGE_MODE: "json",
      BILLING_SERVICE_URL: billingUrl,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  portal.stdout.on("data", (chunk) => process.stdout.write(`[portal] ${chunk}`));
  portal.stderr.on("data", (chunk) => process.stderr.write(`[portal] ${chunk}`));

  try {
    await waitFor(`${portalUrl}/healthz`, portal, "portal");
    const cookie = await loginPortal(portalUrl);
    const payload = await requestJson(`${portalUrl}/portal/api/server-plans`, {
      headers: { cookie, accept: "application/json" },
    });
    assert(payload.source === "tencent_cloud_live_catalog", `unexpected_source:${payload.source}`);
    assert(Array.isArray(payload.items) && payload.items.length === 6, `unexpected_item_count:${payload.items?.length}`);
    assert(payload.items.some((item) => item.canOrder === false), "missing_unorderable_plan");

    const catalog = await import(catalogModuleUrl);
    const options = catalog.collectServerPlanFilterOptions(payload.items);
    assert(JSON.stringify(options.cpu) === JSON.stringify([2, 4, 8, 16]), `cpu_filter_options_mismatch:${JSON.stringify(options.cpu)}`);
    assert(JSON.stringify(options.memoryGb) === JSON.stringify([4, 8, 16, 32, 64]), `memory_filter_options_mismatch:${JSON.stringify(options.memoryGb)}`);

    const filteredCpu = catalog.filterServerPlans(payload.items, { cpu: 4 });
    assert(filteredCpu.length === 2, `cpu_filter_count_mismatch:${filteredCpu.length}`);

    const filteredMemory = catalog.filterServerPlans(payload.items, { memoryGb: 16 });
    assert(filteredMemory.length === 2, `memory_filter_count_mismatch:${filteredMemory.length}`);

    const filteredBoth = catalog.filterServerPlans(payload.items, { cpu: 4, memoryGb: 16 });
    assert(filteredBoth.length === 1 && filteredBoth[0].id === "plan-4c16g-soldout", "combined_filter_mismatch");
    assert(catalog.planCanOrder(filteredBoth[0]) === false, "soldout_plan_should_be_disabled");

    const page1 = catalog.paginateServerPlans(payload.items, 1, catalog.SERVER_PLAN_PAGE_SIZE);
    const page2 = catalog.paginateServerPlans(payload.items, 2, catalog.SERVER_PLAN_PAGE_SIZE);
    assert(page1.pagination.pageSize === 4, `unexpected_page_size:${page1.pagination.pageSize}`);
    assert(page1.items.length === 4, `page1_count_mismatch:${page1.items.length}`);
    assert(page2.items.length === 2, `page2_count_mismatch:${page2.items.length}`);
    assert(page1.items.some((item) => item.canOrder === false), "page1_should_include_disabled_plan");

    console.log(JSON.stringify({
      ok: true,
      source: payload.source,
      totalItems: payload.items.length,
      filterOptions: options,
      page1Ids: page1.items.map((item) => item.id),
      page2Ids: page2.items.map((item) => item.id),
    }, null, 2));
  } finally {
    portal.kill();
    billingServer.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
