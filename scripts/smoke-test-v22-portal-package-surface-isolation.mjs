import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const packagesView = await readFile("services/portal/frontend/src/views/packages/PackagesView.vue", "utf8");
const apiSource = await readFile("services/portal/frontend/src/api/portal/lab.ts", "utf8");

for (const apiCall of ["fetchLabPackages", "fetchLabSubscription", "fetchLabEntitlement"]) {
  assert(packagesView.includes(apiCall), `package_surface_must_load_${apiCall}`);
}

assert.equal(
  packagesView.includes("Promise.all(["),
  false,
  "package_surface_must_not_couple_catalog_subscription_entitlement_in_one_promise_all",
);

for (const state of [
  "catalogLoading",
  "catalogError",
  "subscriptionLoading",
  "subscriptionError",
  "entitlementLoading",
  "entitlementError",
]) {
  assert(packagesView.includes(state), `package_surface_state_missing:${state}`);
}

for (const loader of [
  "async function loadPackageCatalog",
  "async function loadSubscription",
  "async function loadEntitlement",
  "async function reloadAll",
]) {
  assert(packagesView.includes(loader), `package_surface_loader_missing:${loader}`);
}

assert(packagesView.includes("void loadPackageCatalog()"), "package_surface_must_start_catalog_load_independently");
assert(packagesView.includes("void loadSubscription()"), "package_surface_must_start_subscription_load_independently");
assert(packagesView.includes("void loadEntitlement()"), "package_surface_must_start_entitlement_load_independently");
assert(packagesView.includes("catalogError.value"), "package_surface_must_record_catalog_error");
assert(packagesView.includes("subscriptionError.value"), "package_surface_must_record_subscription_error");
assert(packagesView.includes("entitlementError.value"), "package_surface_must_record_entitlement_error");
assert(packagesView.includes("套餐目录加载失败"), "package_surface_must_explain_catalog_load_failure");
assert(packagesView.includes("订阅状态加载失败"), "package_surface_must_explain_subscription_load_failure");
assert(packagesView.includes("套餐权益加载失败"), "package_surface_must_explain_entitlement_load_failure");

assert(apiSource.includes('"/lab-packages"'), "package_api_must_keep_catalog_endpoint");
assert(apiSource.includes('"/lab-subscription"'), "package_api_must_keep_subscription_endpoint");
assert(apiSource.includes('"/lab-entitlement"'), "package_api_must_keep_entitlement_endpoint");

console.log(JSON.stringify({
  ok: true,
  contract: "v22_portal_package_surface_isolation",
  isolatedSurfaces: ["catalog", "subscription", "entitlement"],
}, null, 2));
