import assert from "node:assert/strict";

const {
  getLabPackage,
  listLabPackages,
} = await import("../services/portal/src/domain/lab-packages.mjs");

const packages = listLabPackages();
assert.equal(packages.length, 2, "v20_regular_users_should_see_two_packages");

const starter = getLabPackage("starter");
const pro = getLabPackage("pro");

assert.equal(starter.id, "starter");
assert.equal(starter.name, "入门套餐");
assert.equal(starter.compute.cores, 2);
assert.equal(starter.storage.includedGb, 10);
assert.equal(starter.billing.freezeDays, 7);
assert.equal(starter.backingServerPlanId, "starter-2c");
assert.equal(starter.audience, "regular");

assert.equal(pro.id, "pro");
assert.equal(pro.name, "进阶套餐");
assert.equal(pro.compute.cores, 8);
assert.equal(pro.storage.includedGb, 100);
assert.equal(pro.billing.freezeDays, 7);
assert.equal(pro.backingServerPlanId, "pro-8c");
assert.equal(pro.audience, "regular");

for (const item of packages) {
  assert.equal(item.currency, "CNY", `package_currency_mismatch:${item.id}`);
  assert.equal(item.billing.weeklyFreezeAmount, Number((item.billing.dailyPrice * 7).toFixed(2)), `weekly_freeze_amount_mismatch:${item.id}`);
  assert.equal(Object.isFrozen(item), true, `package_must_be_immutable:${item.id}`);
}

assert.equal(getLabPackage("unknown"), null, "unknown_package_should_return_null");

console.log(JSON.stringify({
  ok: true,
  contract: "v20_lab_packages",
  packageIds: packages.map((item) => item.id),
}, null, 2));
