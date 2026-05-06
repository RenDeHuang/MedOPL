import assert from "node:assert/strict";

const {
  canonicalResourcePlanPublicView,
  getCanonicalResourcePlan,
  listCanonicalResourcePlans,
} = await import("../services/portal/src/domain/lab-packages.mjs");

const plans = listCanonicalResourcePlans();
assert.equal(plans.length, 2, "v22_canonical_plan_count_must_be_2");

const starter = canonicalResourcePlanPublicView(getCanonicalResourcePlan("starter_2c4g_10gb"));
const pro = canonicalResourcePlanPublicView(getCanonicalResourcePlan("pro_8c16g_100gb"));

assert.equal(starter.id, "starter_2c4g_10gb", "starter_plan_id_mismatch");
assert.equal(starter.compute.cpuCores, 2, "starter_plan_cpu_mismatch");
assert.equal(starter.compute.memoryGb, 4, "starter_plan_memory_mismatch");
assert.equal(starter.storage.capacityGb, 10, "starter_plan_storage_mismatch");
assert.equal(starter.storageBackend, "cos_standard_workspace_quota", "starter_plan_storage_backend_mismatch");

assert.equal(pro.id, "pro_8c16g_100gb", "pro_plan_id_mismatch");
assert.equal(pro.compute.cpuCores, 8, "pro_plan_cpu_mismatch");
assert.equal(pro.compute.memoryGb, 16, "pro_plan_memory_mismatch");
assert.equal(pro.storage.capacityGb, 100, "pro_plan_storage_mismatch");
assert.equal(pro.storageBackend, "cos_standard_workspace_quota", "pro_plan_storage_backend_mismatch");

for (const plan of [starter, pro]) {
  assert.equal(plan.region, "na-siliconvalley", `${plan.id}_region_mismatch`);
  assert.equal(plan.zone, "na-siliconvalley-1", `${plan.id}_zone_mismatch`);
  assert.equal(plan.os, "ubuntu_22_04", `${plan.id}_os_mismatch`);
  assert.equal(plan.cloudBillingMode, "pay_as_you_go", `${plan.id}_billing_mode_mismatch`);
  assert.equal(plan.basePrice, null, `${plan.id}_base_price_must_wait_for_product_approval`);
  assert.equal(plan.pendingProductApproval, true, `${plan.id}_must_mark_pending_product_approval`);
  assert.equal("dailyPrice" in plan, false, `${plan.id}_must_not_publish_formal_daily_price`);
  assert.equal("weeklyFreezeAmount" in plan, false, `${plan.id}_must_not_publish_formal_weekly_price`);
}

console.log(JSON.stringify({
  ok: true,
  contract: "v22_resource_plan",
  planIds: plans.map((item) => item.id),
}, null, 2));
