import { spawn } from "node:child_process";
import http from "node:http";
import net from "node:net";
import { readFile } from "node:fs/promises";

const billingEntrypoint = "adapters/billing-aggregator/src/server.mjs";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function freePort() {
  return await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => {
        if (!address || typeof address === "string") reject(new Error("free_port_failed"));
        else resolve(address.port);
      });
    });
  });
}

function requestJson(baseUrl, pathname) {
  return new Promise((resolve, reject) => {
    const req = http.request(new URL(pathname, baseUrl), { headers: { accept: "application/json" } }, (res) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
      res.on("end", () => {
        const raw = Buffer.concat(chunks).toString("utf8");
        resolve({ status: res.statusCode || 0, payload: raw ? JSON.parse(raw) : {} });
      });
    });
    req.on("error", reject);
    req.end();
  });
}

async function waitForBilling(baseUrl, child) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    assert(child.exitCode === null, `billing_process_exited:${child.exitCode}`);
    try {
      const response = await requestJson(baseUrl, "/healthz");
      if (response.status === 200) return response.payload;
    } catch {}
    await sleep(250);
  }
  throw new Error("billing_start_timeout");
}

async function main() {
  const port = await freePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const catalog = [{
    id: "v11-smoke-small",
    name: "V11 Smoke Small",
    provider: "tencent",
    region: "ap-guangzhou",
    zone: "ap-guangzhou-6",
    instanceType: "S5.SMALL1",
    cpu: 1,
    memoryGb: 1,
    storageLimit: "10Gi",
    minBillableHours: 1,
    riskFactor: 1.2,
    provisioningMode: "tke_node_pool",
    nodePoolCreatePayload: { smoke: true },
  }];
  const child = spawn(process.execPath, [billingEntrypoint], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: String(port),
      PORTAL_STORAGE_MODE: "json",
      TENCENT_PRICE_ENABLED: "1",
      TENCENT_BILLING_ENABLED: "1",
      TENCENT_CLOUD_REGION: "ap-guangzhou",
      SERVER_PLAN_CATALOG_JSON: JSON.stringify(catalog),
      TENCENT_CLOUD_SECRET_ID: "",
      TENCENT_CLOUD_SECRET_KEY: "",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  try {
    const health = await waitForBilling(baseUrl, child);
    assert(health.cloudStatus?.credentialsConfigured === false, "health must expose unconfigured cloud account without secrets");
    assert(health.cloudStatus?.readiness?.realPriceReady === false, "real price must not be ready without Tencent credentials");

    const plansResponse = await requestJson(baseUrl, "/server-plans");
    assert(plansResponse.status === 200, `server plans expected 200, got ${plansResponse.status}`);
    const plans = plansResponse.payload;
    assert(plans.cloudStatus?.readiness?.cloudAccountConnected === false, "cloud account readiness should be false without credentials");
    assert(plans.cloudStatus?.readiness?.catalogReady === true, "catalog readiness should be true for configured catalog");
    assert(plans.cloudStatus?.provisioning?.automaticProvisionCount === 1, "automatic provisioning count should reflect tke_node_pool plans");
    assert(plans.items?.[0]?.priceStatus === "not_configured", `plan should be explicit not_configured: ${JSON.stringify(plans.items?.[0])}`);

    const serversView = await readFile("services/portal/frontend/src/views/servers/ServersView.vue", "utf8");
    const overviewView = await readFile("services/portal/frontend/src/views/overview/OverviewView.vue", "utf8");
    assert(serversView.includes('href="/portal/opl"'), "Servers page must keep Portal OPL entry");
    assert(overviewView.includes('const workbenchHref = "/portal/opl";'), "Overview workbench entry must use /portal/opl");
    assert(!serversView.includes("客户先选规格，再冻结，再运行"), "Servers page should not keep the long v10 explainer headline");

    console.log(JSON.stringify({ ok: true, baseUrl, cloudStatus: plans.cloudStatus }, null, 2));
  } finally {
    child.kill();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
