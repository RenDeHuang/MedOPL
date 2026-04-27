import { spawn } from "node:child_process";
import { once } from "node:events";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as sleep } from "node:timers/promises";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function spawnBilling(port, extraEnv = {}) {
  const child = spawn(process.execPath, ["src/server.mjs"], {
    cwd: path.join(repoRoot, "adapters", "billing-aggregator"),
    env: {
      ...process.env,
      PORT: String(port),
      AUTO_RECONCILE_ENABLED: "0",
      PORTAL_STORAGE_MODE: "json",
      TENCENT_BILLING_ENABLED: "0",
      TENCENT_BILLING_REQUIRED: "0",
      TENCENT_PRICE_ENABLED: "0",
      TENCENT_PLAN_DISCOVERY_ENABLED: "0",
      OPENCOST_BASE_URL: "",
      SERVER_PLAN_CATALOG_JSON: "[]",
      ...extraEnv,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.on("data", (chunk) => process.stdout.write(chunk));
  child.stderr.on("data", (chunk) => process.stderr.write(chunk));
  return child;
}

async function waitFor(url) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {}
    await sleep(250);
  }
  throw new Error(`service_not_ready:${url}`);
}

async function stop(child) {
  if (!child || child.exitCode !== null || child.killed) return;
  child.kill("SIGTERM");
  try {
    await Promise.race([
      once(child, "exit"),
      sleep(3000).then(() => {
        if (child.exitCode === null) child.kill("SIGKILL");
      }),
    ]);
  } catch {}
}

async function json(url) {
  const response = await fetch(url, { headers: { accept: "application/json" } });
  const payload = await response.json().catch(() => ({}));
  assert(response.ok, `${url} failed: ${response.status} ${JSON.stringify(payload)}`);
  return payload;
}

async function runCase({ port, extraEnv, expectedConfigured, expectedPriceImageConfigured, expectedCatalogConfigured }) {
  const service = spawnBilling(port, extraEnv);
  try {
    await waitFor(`http://127.0.0.1:${port}/healthz`);
    const status = await json(`http://127.0.0.1:${port}/status`);
    const cloudOnly = await json(`http://127.0.0.1:${port}/cloud/status`);
    const serverPlans = await json(`http://127.0.0.1:${port}/server-plans`);
    const cloud = status.cloudStatus || {};
    const plansCloud = serverPlans.cloudStatus || {};

    assert(cloud.credentialsConfigured === expectedConfigured, `credentialsConfigured mismatch:${cloud.credentialsConfigured}`);
    assert(cloud.priceImageConfigured === expectedPriceImageConfigured, `priceImageConfigured mismatch:${cloud.priceImageConfigured}`);
    assert(cloud.catalogConfigured === expectedCatalogConfigured, `catalogConfigured mismatch:${cloud.catalogConfigured}`);
    assert(cloudOnly.cloudStatus?.credentialsConfigured === expectedConfigured, "cloud/status credentials mismatch");
    assert(plansCloud.credentialsConfigured === expectedConfigured, `serverPlans credentialsConfigured mismatch:${plansCloud.credentialsConfigured}`);
    assert(status.pendingSource === "metering_pending", `pendingSource mismatch:${status.pendingSource}`);

    const serialized = JSON.stringify({ status, cloudOnly, serverPlans });
    const forbiddenValues = [
      extraEnv.TENCENT_CLOUD_SECRET_ID,
      extraEnv.TENCENT_CLOUD_SECRET_KEY,
      extraEnv.TENCENT_PRICE_IMAGE_ID,
    ].filter(Boolean);
    for (const value of forbiddenValues) {
      assert(!serialized.includes(String(value)), `secret_leaked:${value}`);
    }

    return {
      credentialsConfigured: cloud.credentialsConfigured,
      priceImageConfigured: cloud.priceImageConfigured,
      catalogConfigured: cloud.catalogConfigured,
      exactBillingSource: cloud.exactBillingSource,
      pendingSource: cloud.pendingSource,
    };
  } finally {
    await stop(service);
  }
}

async function main() {
  const withoutSecrets = await runCase({
    port: 19324,
    extraEnv: {},
    expectedConfigured: false,
    expectedPriceImageConfigured: false,
    expectedCatalogConfigured: false,
  });

  const withConfiguredEnv = await runCase({
    port: 19325,
    extraEnv: {
      TENCENT_CLOUD_SECRET_ID: "configured-secret-id",
      TENCENT_CLOUD_SECRET_KEY: "configured-secret-key",
      TENCENT_PRICE_IMAGE_ID: "img-configured",
      SERVER_PLAN_CATALOG_JSON: JSON.stringify([{ id: "catalog-plan", zone: "ap-guangzhou-6", instanceType: "SA2.SMALL1" }]),
    },
    expectedConfigured: true,
    expectedPriceImageConfigured: true,
    expectedCatalogConfigured: true,
  });

  console.log(JSON.stringify({
    ok: true,
    withoutSecrets,
    withConfiguredEnv,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
