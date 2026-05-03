import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const workloads = await readFile("deploy/tke-package/manifests/05-platform-workloads.yaml", "utf8");
const billingCron = await readFile("deploy/tke-package/manifests/07-billing-reconcile-cronjob.yaml", "utf8");
const source = `${workloads}\n${billingCron}`;

const placeholders = [...source.matchAll(/image:\s+"?(__[A-Z0-9_]+__)"?/g)].map((match) => match[1]);
for (const expected of [
  "__PORTAL_IMAGE__",
  "__OPL_ADAPTER_IMAGE__",
  "__OPL_WEB_IMAGE__",
  "__OPL_WEB_GATEWAY_IMAGE__",
  "__BILLING_IMAGE__",
  "__RESOURCE_PROVISIONER_IMAGE__",
]) {
  assert.ok(placeholders.includes(expected), `missing_image_placeholder:${expected}`);
}

const report = {
  ok: true,
  contract: "v20.2_image_inventory",
  targetTag: "opl-v20.2",
  keepPolicy: {
    keepCurrent: true,
    keepRollbackSet: 1,
    deleteWithoutFinalList: false,
  },
  referencedPlaceholders: [...new Set(placeholders)].sort(),
};

assert.equal(report.keepPolicy.keepCurrent, true);
assert.equal(report.keepPolicy.keepRollbackSet, 1);
assert.equal(report.keepPolicy.deleteWithoutFinalList, false);
assert.equal(report.targetTag, "opl-v20.2");

console.log(JSON.stringify(report, null, 2));
