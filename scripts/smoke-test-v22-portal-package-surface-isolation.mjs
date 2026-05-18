import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";

async function exists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

const routesSource = await readFile("services/portal/frontend/src/app/routes.tsx", "utf8");
const layoutSource = await readFile("services/portal/frontend/src/app/components/Layout.tsx", "utf8");
const adapterSource = await readFile("services/portal/frontend/src/app/data/portalAdapters.ts", "utf8");
const figmaContract = await readFile("docs/contracts/v22-portal-figma-make-ui-implementation-boundary.md", "utf8");

for (const retiredPath of [
  "services/portal/frontend/src/views/packages/PackagesView.vue",
  "services/portal/frontend/src/composables/usePackageSurface.ts",
  "services/portal/frontend/src/views/resources/ResourcesView.vue",
  "services/portal/frontend/src/views/servers/ServersView.vue",
]) {
  assert.equal(await exists(retiredPath), false, `retired_vue_package_surface_must_not_exist:${retiredPath}`);
}

for (const retiredRoute of ["/packages", "/advanced/servers", "/runtime", "/tasks"]) {
  assert.equal(routesSource.includes(retiredRoute), false, `retired_package_route_must_not_be_active:${retiredRoute}`);
  assert.equal(layoutSource.includes(retiredRoute), false, `retired_package_nav_must_not_be_active:${retiredRoute}`);
}
assert.equal(routesSource.includes('path: "opl"'), false, "retired_opl_short_route_must_not_be_active");

for (const route of ["/overview", "/resources", "/workspace", "/trace", "/billing", "/opl-launch"]) {
  assert(routesSource.includes(`path: "${route.slice(1)}"`), `zip_user_route_missing:${route}`);
}

for (const apiCall of [
  "fetchMyResources",
  "fetchOverview",
  "fetchWorkspace",
  "fetchSessionTraces",
  "fetchBillingSummary",
  "fetchOplLaunchStatus",
]) {
  assert(adapterSource.includes(apiCall), `portal_zip_adapter_api_call_missing:${apiCall}`);
}

assert(figmaContract.includes('"retiredFrontendRoutes"'), "figma_contract_must_record_retired_frontend_routes");
assert(figmaContract.includes('"/packages"'), "figma_contract_must_retire_packages_route");
assert(figmaContract.includes('"/advanced/servers"'), "figma_contract_must_retire_advanced_servers_route");

console.log(JSON.stringify({
  ok: true,
  contract: "v22_portal_package_surface_isolation",
  currentTruth: "figma_make_zip_user_portal_surface",
  retired: [
    "vue_packages_view",
    "vue_package_composable",
    "packages_route",
    "advanced_servers_route",
  ],
}, null, 2));
