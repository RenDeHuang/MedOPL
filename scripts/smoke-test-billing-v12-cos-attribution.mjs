import assert from "node:assert/strict";
import { spawn } from "node:child_process";

const port = 43311;
const child = spawn(process.execPath, ["adapters/billing-aggregator/src/server.mjs"], {
  env: {
    ...process.env,
    PORT: String(port),
    TENCENT_CLOUD_SECRET_ID: "",
    TENCENT_CLOUD_SECRET_KEY: "",
    TENCENT_PRICE_ENABLED: "0",
    TENCENT_BILLING_ENABLED: "0",
    TENCENT_COS_BILL_BUCKET: "opl-1410708315",
    TENCENT_COS_BILL_REGION: "na-siliconvalley",
    TENCENT_COS_BILL_PREFIX: "daily/",
  },
  stdio: ["ignore", "ignore", "pipe"],
});

try {
  await new Promise((resolve) => setTimeout(resolve, 600));
  const cos = await fetch(`http://127.0.0.1:${port}/billing/cos/status`).then((res) => res.json());
  assert.equal(cos.ok, true);
  assert.equal(cos.bucket, "opl-1410708315");
  assert.equal(cos.prefix, "daily/");

  const attribution = await fetch(`http://127.0.0.1:${port}/billing/attribution?resourceOrderId=order-test`).then((res) => res.json());
  assert.equal(attribution.ok, true);
  assert.equal(attribution.resourceOrderId, "order-test");
  assert.deepEqual(attribution.requiredTags, ["resource_order_id", "run_id", "server_plan_id", "tenant_id", "workspace_id"]);

  const plans = await fetch(`http://127.0.0.1:${port}/server-plans`).then((res) => res.json());
  const ids = new Set((plans.items || []).map((item) => item.id));
  for (const id of ["cpu-2c4g", "cpu-4c8g", "cpu-8c16g", "cpu-16c32g"]) {
    assert.equal(ids.has(id), true, `${id} must be in v12 salable catalog`);
  }
  const cpu2c4g = (plans.items || []).find((item) => item.id === "cpu-2c4g");
  assert.equal(cpu2c4g.memoryGb, 4, "cpu-2c4g should keep hardware memory in product shape");
  assert.equal(cpu2c4g.cpuRequest, "1000m", "cpu-2c4g runner cpu request must fit TKE allocatable CPU after daemonsets");
  assert.equal(cpu2c4g.cpuLimit, "2", "cpu-2c4g runner cpu limit should keep the 2C product ceiling");
  assert.equal(cpu2c4g.memoryRequest, "2Gi", "cpu-2c4g runner request must fit TKE allocatable memory");
  assert.equal(cpu2c4g.memoryLimit, "3Gi", "cpu-2c4g runner limit must leave TKE node system headroom");
  assert.equal(cpu2c4g.nodeSelector?.["gaofenglab/node-pool-role"], "runtime", "server plans must schedule user jobs to the runtime node pool");
  assert.deepEqual(cpu2c4g.tolerations?.[0], {
    key: "gaofenglab/node-pool-role",
    operator: "Equal",
    value: "runtime",
    effect: "NoSchedule",
  }, "server plans must tolerate the runtime node pool taint when present");

  console.log("billing v12 cos attribution smoke passed");
} finally {
  child.kill();
}
