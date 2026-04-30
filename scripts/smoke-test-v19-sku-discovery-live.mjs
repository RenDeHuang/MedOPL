import { spawn } from "node:child_process";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const billingEntrypoint = path.join(repoRoot, "adapters", "billing-aggregator", "src", "server.mjs");
const requiredItemFields = [
  "instanceType",
  "cpu",
  "memoryGb",
  "zone",
  "availabilityStatus",
  "statusCategory",
  "soldOutReason",
  "hourlyPrice",
  "currency",
  "canOrder",
];

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

async function waitFor(url, child, label) {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    assert(child.exitCode === null, `${label}_exited:${child.exitCode}`);
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {}
    await sleep(250);
  }
  throw new Error(`${label}_timeout`);
}

async function requestJson(url) {
  const response = await fetch(url, { headers: { accept: "application/json" } });
  const payload = await response.json().catch(() => ({}));
  assert(response.ok, `request_failed:${response.status}:${JSON.stringify(payload)}`);
  return payload;
}

function buildFallbackCatalog() {
  return [
    {
      id: "live-catalog-orderable",
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
      availabilityStatus: "SELL",
      statusCategory: "EnoughStock",
      soldOutReason: "",
      hourlyPrice: 1.35,
      currency: "CNY",
      discountPrice: 1.35,
      unitPrice: 1.35,
      canOrder: true,
      salable: true,
    },
    {
      id: "live-catalog-soldout",
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
      availabilityStatus: "SOLD",
      statusCategory: "SoldOut",
      soldOutReason: "inventory_exhausted",
      hourlyPrice: 2.65,
      currency: "CNY",
      discountPrice: 2.65,
      unitPrice: 2.65,
      canOrder: false,
      salable: false,
    },
  ];
}

function validateContract(payload) {
  assert(payload?.ok === true, "server_plans_not_ok");
  assert(Array.isArray(payload?.items), "server_plans_items_missing");
  assert(payload.items.length > 0, "server_plans_items_empty");
  const firstItem = payload.items[0];
  for (const field of requiredItemFields) {
    assert(field in firstItem, `missing_field:${field}`);
  }
}

async function main() {
  const port = await freePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const credentialsConfigured = Boolean(
    String(process.env.TENCENT_CLOUD_SECRET_ID || process.env.TENCENTCLOUD_SECRET_ID || "").trim() &&
    String(process.env.TENCENT_CLOUD_SECRET_KEY || process.env.TENCENTCLOUD_SECRET_KEY || "").trim(),
  );
  const child = spawn(process.execPath, [billingEntrypoint], {
    cwd: repoRoot,
    env: {
      ...process.env,
      PORT: String(port),
      TENCENT_CLOUD_REGION: "na-siliconvalley",
      TENCENT_PLAN_DISCOVERY_ZONES: "na-siliconvalley-1",
      TENCENT_PLAN_DISCOVERY_ENABLED: credentialsConfigured ? "1" : "0",
      TENCENT_PRICE_ENABLED: credentialsConfigured ? "1" : "0",
      SERVER_PLAN_CATALOG_JSON: JSON.stringify(buildFallbackCatalog()),
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  child.stdout.on("data", (chunk) => process.stdout.write(`[billing] ${chunk}`));
  child.stderr.on("data", (chunk) => process.stderr.write(`[billing] ${chunk}`));

  try {
    await waitFor(`${baseUrl}/healthz`, child, "billing_healthz");
    const payload = await requestJson(`${baseUrl}/server-plans?region=na-siliconvalley&zone=na-siliconvalley-1`);
    validateContract(payload);
    assert(payload.items.every((item) => item.region === "na-siliconvalley"), "region_filter_mismatch");
    assert(payload.items.every((item) => item.zone === "na-siliconvalley-1"), "zone_filter_mismatch");

    if (!credentialsConfigured) {
      console.log(JSON.stringify({
        ok: true,
        skippedLive: true,
        reason: "tencent_cloud_credentials_not_configured",
        source: payload.source,
        itemCount: payload.items.length,
        validatedFields: requiredItemFields,
      }, null, 2));
      return;
    }

    assert(payload.source === "tencent_cloud_live_catalog", `unexpected_live_source:${payload.source}`);
    assert(payload.items.some((item) => item.canOrder === true), "live_catalog_missing_orderable_item");
    console.log(JSON.stringify({
      ok: true,
      skippedLive: false,
      source: payload.source,
      itemCount: payload.items.length,
      orderableCount: payload.items.filter((item) => item.canOrder).length,
      validatedFields: requiredItemFields,
    }, null, 2));
  } finally {
    child.kill();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
