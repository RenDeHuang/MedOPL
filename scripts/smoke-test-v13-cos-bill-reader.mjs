import assert from "node:assert/strict";

const { buildCosBillReader } = await import(new URL("../adapters/billing-aggregator/src/cos-bill-reader.mjs", import.meta.url).href);

const reader = buildCosBillReader({
  bucket: "opl-1410708315",
  region: "na-siliconvalley",
  prefix: "daily/",
  secretId: "",
  secretKey: "",
});

assert.equal(reader.configured(), false, "COS bill reader must stay unconfigured without credentials");

await assert.rejects(
  () => reader.listFiles(),
  /cos_bill_reader_not_configured/,
  "COS bill reader must not fake readable status without credentials",
);

const blockedReader = buildCosBillReader({
  bucket: "opl-1410708315",
  region: "na-siliconvalley",
  prefix: "daily/",
  secretId: "id",
  secretKey: "key",
});

await assert.rejects(
  () => blockedReader.readFile("workspaces/tenant/workspace/output.txt"),
  /cos_bill_key_outside_prefix/,
  "COS bill reader must not read outside the daily/ bill prefix",
);

console.log("v13 COS bill reader contract smoke passed");
