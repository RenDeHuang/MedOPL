import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const packagesView = await readFile("services/portal/frontend/src/views/packages/PackagesView.vue", "utf8");
const packageSurface = await readFile("services/portal/frontend/src/composables/usePackageSurface.ts", "utf8");
const apiSource = await readFile("services/portal/frontend/src/api/portal/lab.ts", "utf8");
const labRouteSource = await readFile("services/portal/src/routes/lab-package.routes.mjs", "utf8");
const featureRuntimeSource = await readFile("services/portal/src/app/portal-feature-runtime-handlers.mjs", "utf8");

assert(packagesView.includes('import { usePackageSurface } from "@/composables/usePackageSurface"'), "package_view_must_use_package_surface_composable");
assert.equal(packagesView.includes("@/api/portal/lab"), false, "package_view_must_not_import_lab_api_directly");
assert.equal(packagesView.includes("async function loadPackageCatalog"), false, "package_view_must_not_own_catalog_loader");
assert.equal(packagesView.includes("async function loadSubscription"), false, "package_view_must_not_own_subscription_loader");
assert.equal(packagesView.includes("async function loadEntitlement"), false, "package_view_must_not_own_entitlement_loader");
assert.equal(packagesView.includes("async function runPackageAction"), false, "package_view_must_not_own_package_action_runner");

for (const apiCall of ["fetchLabPackages", "fetchLabSubscription", "fetchLabEntitlement"]) {
  assert(packageSurface.includes(apiCall), `package_surface_composable_must_load_${apiCall}`);
}

for (const mutationCall of [
  "activateCustomLabPackage",
  "activateLabPackage",
  "purchaseLabStorageAddon",
  "upgradeLabPackage",
]) {
  assert(packageSurface.includes(mutationCall), `package_surface_composable_must_own_action:${mutationCall}`);
  assert.equal(packagesView.includes(mutationCall), false, `package_view_must_not_own_action:${mutationCall}`);
}

assert.equal(
  packageSurface.includes("Promise.all(["),
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
  assert(packageSurface.includes(state), `package_surface_state_missing:${state}`);
}

for (const loader of [
  "async function loadPackageCatalog",
  "async function loadSubscription",
  "async function loadEntitlement",
  "async function reloadAll",
]) {
  assert(packageSurface.includes(loader), `package_surface_loader_missing:${loader}`);
}

assert(packageSurface.includes("void loadPackageCatalog()"), "package_surface_must_start_catalog_load_independently");
assert(packageSurface.includes("void loadSubscription()"), "package_surface_must_start_subscription_load_independently");
assert(packageSurface.includes("void loadEntitlement()"), "package_surface_must_start_entitlement_load_independently");
assert(packageSurface.includes("catalogError.value"), "package_surface_must_record_catalog_error");
assert(packageSurface.includes("subscriptionError.value"), "package_surface_must_record_subscription_error");
assert(packageSurface.includes("entitlementError.value"), "package_surface_must_record_entitlement_error");
assert(packageSurface.includes("套餐目录加载失败"), "package_surface_must_explain_catalog_load_failure");
assert(packageSurface.includes("订阅状态加载失败"), "package_surface_must_explain_subscription_load_failure");
assert(packageSurface.includes("套餐权益加载失败"), "package_surface_must_explain_entitlement_load_failure");
assert(packageSurface.includes("response?.data?.businessMessage"), "package_surface_error_must_prefer_response_business_message");
assert(packageSurface.includes("response?.data?.message"), "package_surface_error_must_prefer_response_message");
assert.equal(
  packageSurface.includes("Request failed with status code"),
  false,
  "package_surface_must_not_surface_transport_error_copy",
);

assert(apiSource.includes('"/lab-packages"'), "package_api_must_keep_catalog_endpoint");
assert(apiSource.includes('"/lab-subscription"'), "package_api_must_keep_subscription_endpoint");
assert(apiSource.includes('"/lab-entitlement"'), "package_api_must_keep_entitlement_endpoint");
assert(labRouteSource.includes("executePortalProductionCloudOperation"), "lab_package_route_must_bridge_to_production_cloud_operation");
assert(labRouteSource.includes("enableCloudOperationProductionBridge"), "lab_package_route_must_gate_production_cloud_bridge");
assert(labRouteSource.includes("runPackageOpenCloudOperations"), "lab_package_route_must_open_cloud_resources_for_package_click");
assert(labRouteSource.includes("runPackageUpgradeCloudOperations"), "lab_package_route_must_upgrade_cloud_resources_for_package_click");
assert(labRouteSource.includes("runStorageAddonCloudOperation"), "lab_package_route_must_expand_storage_for_package_click");
assert(labRouteSource.includes("cloudOperationPackage"), "lab_package_route_must_return_sanitized_cloud_operation_package_summary");
assert(featureRuntimeSource.includes("PORTAL_ENABLE_CLOUD_OPERATION_PRODUCTION_BRIDGE"), "feature_runtime_must_pass_cloud_bridge_env_to_lab_package_route");
assert(featureRuntimeSource.includes("PORTAL_CLOUD_OPERATION_PACKAGE_C_SECRET_FILE"), "feature_runtime_must_pass_package_c_secret_file_to_lab_package_route");

console.log(JSON.stringify({
  ok: true,
  contract: "v22_portal_package_surface_isolation",
  isolatedSurfaces: ["catalog", "subscription", "entitlement", "production_cloud_operation_bridge"],
}, null, 2));
