import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";

async function exists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

const routesSource = await readFile("services/portal/frontend/src/app/routes.tsx", "utf8");
const layoutSource = await readFile("services/portal/frontend/src/app/components/Layout.tsx", "utf8");
const appSource = await readFile("services/portal/frontend/src/app/App.tsx", "utf8");
const roleContextSource = await readFile("services/portal/frontend/src/app/contexts/RoleContext.tsx", "utf8");
const oplEntryPageSource = await readFile("services/portal/frontend/src/app/pages/OPLEntry.tsx", "utf8");
const runtimeEnvironmentPageSource = await readFile("services/portal/frontend/src/app/pages/RuntimeEnvironment.tsx", "utf8");
const oplEntryModelSource = await readFile("services/portal/frontend/src/app/data/portalOplEntryModel.ts", "utf8");
const runtimeEnvironmentModelSource = await readFile("services/portal/frontend/src/app/data/portalRuntimeEnvironmentModel.ts", "utf8");
const adminPageSources = await Promise.all([
  "services/portal/frontend/src/app/components/AnnouncementButton.tsx",
  "services/portal/frontend/src/app/components/Layout.tsx",
  "services/portal/frontend/src/app/components/UserMenu.tsx",
  "services/portal/frontend/src/app/pages/BillingAudit.tsx",
  "services/portal/frontend/src/app/pages/OPLEntry.tsx",
  "services/portal/frontend/src/app/pages/Overview.tsx",
  "services/portal/frontend/src/app/pages/PackagesPurchase.tsx",
  "services/portal/frontend/src/app/pages/RuntimeEnvironment.tsx",
  "services/portal/frontend/src/app/pages/Workspace.tsx",
  "services/portal/frontend/src/app/pages/system/Degraded.tsx",
  "services/portal/frontend/src/app/pages/system/Empty.tsx",
  "services/portal/frontend/src/app/pages/system/Error.tsx",
  "services/portal/frontend/src/app/pages/system/Restricted.tsx",
  "services/portal/frontend/src/app/pages/admin/AdminAlerts.tsx",
  "services/portal/frontend/src/app/pages/admin/AdminAudit.tsx",
  "services/portal/frontend/src/app/pages/admin/AdminBillingOps.tsx",
  "services/portal/frontend/src/app/pages/admin/AdminDashboard.tsx",
  "services/portal/frontend/src/app/pages/admin/AdminOps.tsx",
  "services/portal/frontend/src/app/pages/admin/AdminSystem.tsx",
  "services/portal/frontend/src/app/pages/admin/AdminUsers.tsx",
].map(async (filePath) => [filePath, await readFile(filePath, "utf8")]));
const portalModelSources = await Promise.all([
  "services/portal/frontend/src/app/data/portalOverviewModel.ts",
  "services/portal/frontend/src/app/data/portalPackagesPurchaseModel.ts",
  "services/portal/frontend/src/app/data/portalRuntimeEnvironmentModel.ts",
  "services/portal/frontend/src/app/data/portalWorkspaceModel.ts",
  "services/portal/frontend/src/app/data/portalBillingAuditModel.ts",
  "services/portal/frontend/src/app/data/portalOplEntryModel.ts",
].map((filePath) => readFile(filePath, "utf8"))).then((sources) => sources.join("\n"));
const specsIndex = await readFile("docs/specs/README.md", "utf8");
const sourceSpec = await readFile("specs/source/spec.md", "utf8");

for (const retiredRoute of ["/advanced/servers", "/runtime", "/tasks", "/trace"]) {
  assert.equal(routesSource.includes(retiredRoute), false, `retired_package_route_must_not_be_active:${retiredRoute}`);
  assert.equal(layoutSource.includes(retiredRoute), false, `retired_package_nav_must_not_be_active:${retiredRoute}`);
}
assert.equal(routesSource.includes('path: "opl"'), false, "retired_opl_short_route_must_not_be_active");
assert.equal(roleContextSource.includes("../../api/portal/"), false, "role_context_must_not_import_portal_api");
assert(roleContextSource.includes("loadCurrentUser"), "role_context_must_receive_current_user_loader");
assert(appSource.includes("fetchCurrentUser"), "app_composition_root_must_bind_current_user_loader");
assert.equal(oplEntryPageSource.includes("../../api/portal/"), false, "opl_entry_page_must_not_import_portal_api");
assert.equal(runtimeEnvironmentPageSource.includes("../../api/portal/"), false, "runtime_environment_page_must_not_import_portal_api");
assert(oplEntryModelSource.includes("bindOplEntryProviderKey"), "opl_entry_model_must_own_provider_key_action");
assert(runtimeEnvironmentModelSource.includes("activateRuntimeEnvironmentPlan"), "runtime_environment_model_must_own_activation_action");
assert.equal(
  await exists("services/portal/frontend/src/app/components/figma/ImageWithFallback.tsx"),
  false,
  "figma_image_with_fallback_component_must_be_retired",
);
for (const [filePath, sourceText] of adminPageSources) {
  const adminModelImports = sourceText.match(/from "\.\.\/\.\.\/data\/portalAdmin[A-Za-z]+Model"/g) || [];
  if (filePath.includes("/pages/admin/")) {
    assert.equal(adminModelImports.length, 1, `admin_page_must_use_single_admin_model_import:${filePath}`);
    assert.equal(
      sourceText.includes("../../data/portalAdminModels"),
      false,
      `admin_page_must_not_import_aggregate_admin_model:${filePath}`,
    );
  }
  assert.equal(
    /from "\.\.\/(?:\.\.\/)?components\/ui\/(?!core")/.test(sourceText),
    false,
    `page_must_import_ui_via_core:${filePath}`,
  );
  assert(
    sourceText.includes('components/ui/core"') || sourceText.includes('./ui/core"'),
    `page_must_use_ui_core_import:${filePath}`,
  );
}

for (const retiredUiComponent of [
  "accordion.tsx",
  "alert-dialog.tsx",
  "alert.tsx",
  "aspect-ratio.tsx",
  "breadcrumb.tsx",
  "button.tsx",
  "calendar.tsx",
  "card.tsx",
  "carousel.tsx",
  "chart.tsx",
  "checkbox.tsx",
  "collapsible.tsx",
  "command.tsx",
  "context-menu.tsx",
  "drawer.tsx",
  "form.tsx",
  "hover-card.tsx",
  "input.tsx",
  "input-otp.tsx",
  "menubar.tsx",
  "navigation-menu.tsx",
  "pagination.tsx",
  "popover.tsx",
  "radio-group.tsx",
  "resizable.tsx",
  "sidebar.tsx",
  "skeleton.tsx",
  "slider.tsx",
  "sonner.tsx",
  "textarea.tsx",
  "toggle-group.tsx",
  "toggle.tsx",
  "tooltip.tsx",
  "use-mobile.ts",
]) {
  assert.equal(
    await exists(`services/portal/frontend/src/app/components/ui/${retiredUiComponent}`),
    false,
    `unused_ui_component_must_be_retired:${retiredUiComponent}`,
  );
}

for (const route of ["/overview", "/packages", "/resources", "/workspace", "/billing", "/opl-launch"]) {
  assert(routesSource.includes(`path: "${route.slice(1)}"`), `zip_user_route_missing:${route}`);
}

for (const apiCall of [
  "fetchMyResources",
  "fetchPackageCatalog",
  "fetchOverview",
  "fetchWorkspace",
  "fetchBillingSummary",
  "fetchOplLaunchStatus",
]) {
  assert(portalModelSources.includes(apiCall), `portal_zip_model_api_call_missing:${apiCall}`);
}
assert.equal(portalModelSources.includes("fetchSessionTraces"), false, "portal_user_models_must_not_fetch_session_traces");

assert(specsIndex.includes("spec:v22-portal-resource-control-ui-composition-boundary"), "specs_index_must_reference_ui_composition_boundary");
assert(specsIndex.includes("specs/source/spec.md"), "specs_index_must_point_to_source_spec");
assert.equal(/```json/u.test(specsIndex), false, "specs_index_must_not_embed_ui_composition_json");
assert(sourceSpec.includes("`source:portal-resource-control-ui-composition`"), "source_spec_must_own_ui_composition");
assert(sourceSpec.includes("/packages"), "source_spec_must_require_packages_purchase_route");
assert(sourceSpec.includes("/advanced/servers"), "source_spec_must_retire_advanced_servers_route");
assert(sourceSpec.includes("/runtime"), "source_spec_must_retire_runtime_route");
assert(sourceSpec.includes("/tasks"), "source_spec_must_retire_tasks_route");
assert(sourceSpec.includes("/opl"), "source_spec_must_retire_opl_short_route");
assert(sourceSpec.includes("/trace"), "source_spec_must_retire_trace_route");

console.log(JSON.stringify({
  ok: true,
  contract: "v22_portal_package_surface_isolation",
  currentTruth: "figma_make_zip_user_portal_surface",
  retired: [
    "vue_packages_view",
    "vue_package_composable",
    "trace_route",
    "advanced_servers_route",
  ],
}, null, 2));
