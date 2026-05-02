import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const manifest = readFileSync("deploy/tke-package/manifests/05-platform-workloads.yaml", "utf8");
const billingBlock = manifest
  .split(/^---$/m)
  .find((document) =>
    document.includes("kind: Deployment") &&
    document.includes("name: billing-aggregator") &&
    document.includes("app: billing-aggregator")
  );
assert(billingBlock, "billing_aggregator_deployment_missing");

assert(
  billingBlock.includes("envFrom:") &&
    billingBlock.includes("name: portal-platform-config") &&
    billingBlock.includes("name: PORTAL_POSTGRES_URL") &&
    billingBlock.includes("name: portal-postgres-redis-secret") &&
    billingBlock.includes("key: PORTAL_POSTGRES_URL"),
  "billing_aggregator_deployment_must_source_portal_postgres_url_from_portal_postgres_redis_secret",
);

const cronjob = readFileSync("deploy/tke-package/manifests/07-billing-reconcile-cronjob.yaml", "utf8");
assert(
  cronjob.includes("envFrom:") &&
    cronjob.includes("name: portal-platform-config") &&
    cronjob.includes("name: PORTAL_POSTGRES_URL") &&
    cronjob.includes("name: portal-postgres-redis-secret") &&
    cronjob.includes("key: PORTAL_POSTGRES_URL"),
  "billing_reconcile_cronjob_must_source_portal_postgres_url_from_portal_postgres_redis_secret",
);

console.log(JSON.stringify({
  ok: true,
  contract: "billing_aggregator_postgres_env",
}, null, 2));
