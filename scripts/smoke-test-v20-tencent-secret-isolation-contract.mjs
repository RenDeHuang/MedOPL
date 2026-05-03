import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { readBillingRuntimeConfig } from "../adapters/billing-aggregator/src/billing-config.mjs";

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");

function withoutProcessSecrets() {
  const env = { ...process.env };
  for (const key of [
    "TENCENT_BILLING_SECRET_ID",
    "TENCENT_BILLING_SECRET_KEY",
    "TENCENT_COS_SECRET_ID",
    "TENCENT_COS_SECRET_KEY",
    "TENCENT_CLOUDAUDIT_SECRET_ID",
    "TENCENT_CLOUDAUDIT_SECRET_KEY",
    "TENCENT_CLOUD_SECRET_ID",
    "TENCENT_CLOUD_SECRET_KEY",
    "TENCENTCLOUD_SECRET_ID",
    "TENCENTCLOUD_SECRET_KEY",
  ]) {
    delete env[key];
  }
  return env;
}

function billingConfig(env) {
  return readBillingRuntimeConfig({
    env: {
      ...withoutProcessSecrets(),
      PORTAL_STORAGE_MODE: "json",
      SERVER_PLAN_CATALOG_JSON: "[]",
      ...env,
    },
    argv: [],
  });
}

async function resourceConfig(env) {
  const original = { ...process.env };
  for (const key of Object.keys(process.env)) delete process.env[key];
  Object.assign(process.env, withoutProcessSecrets(), env);
  const moduleUrl = pathToFileURL(path.join(repoRoot, "adapters/resource-provisioner/src/config.mjs"));
  const imported = await import(`${moduleUrl.href}?secretIsolationCase=${Date.now()}-${Math.random()}`);
  for (const key of Object.keys(process.env)) delete process.env[key];
  Object.assign(process.env, original);
  return imported;
}

{
  const config = billingConfig({
    TENCENT_BILLING_SECRET_ID: "billing-id",
    TENCENT_BILLING_SECRET_KEY: "billing-key",
    TENCENT_COS_SECRET_ID: "cos-id",
    TENCENT_COS_SECRET_KEY: "cos-key",
    TENCENT_CLOUD_SECRET_ID: "legacy-id",
    TENCENT_CLOUD_SECRET_KEY: "legacy-key",
  });

  assert.equal(config.TENCENT_CLOUD_SECRET_ID, "billing-id");
  assert.equal(config.TENCENT_CLOUD_SECRET_KEY, "billing-key");
  assert.equal(config.TENCENT_COS_SECRET_ID, "cos-id");
  assert.equal(config.TENCENT_COS_SECRET_KEY, "cos-key");
}

{
  const config = billingConfig({
    TENCENT_CLOUD_SECRET_ID: "legacy-id",
    TENCENT_CLOUD_SECRET_KEY: "legacy-key",
  });

  assert.equal(config.TENCENT_CLOUD_SECRET_ID, "legacy-id");
  assert.equal(config.TENCENT_CLOUD_SECRET_KEY, "legacy-key");
}

{
  const config = billingConfig({
    TENCENT_CLOUD_SECRET_ID: "legacy-id",
    TENCENT_CLOUD_SECRET_KEY: "legacy-key",
  });

  assert.equal(config.TENCENT_COS_SECRET_ID, "");
  assert.equal(config.TENCENT_COS_SECRET_KEY, "");
}

{
  const config = await resourceConfig({
    TENCENT_BILLING_SECRET_ID: "billing-id",
    TENCENT_BILLING_SECRET_KEY: "billing-key",
    TENCENT_CLOUD_SECRET_ID: "legacy-id",
    TENCENT_CLOUD_SECRET_KEY: "legacy-key",
  });

  assert.equal(config.TENCENT_CLOUD_SECRET_ID, "billing-id");
  assert.equal(config.TENCENT_CLOUD_SECRET_KEY, "billing-key");
  assert.equal(config.tencentCloudConfigured(), true);
}

{
  const config = await resourceConfig({
    TENCENT_CLOUD_SECRET_ID: "legacy-id",
    TENCENT_CLOUD_SECRET_KEY: "legacy-key",
  });

  assert.equal(config.TENCENT_CLOUD_SECRET_ID, "legacy-id");
  assert.equal(config.TENCENT_CLOUD_SECRET_KEY, "legacy-key");
  assert.equal(config.tencentCloudConfigured(), true);
}

console.log(JSON.stringify({
  ok: true,
  contract: "v20_tencent_secret_isolation",
}, null, 2));
