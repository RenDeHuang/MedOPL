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

const pageSpecs = [
  ["overview", "services/portal/frontend/src/app/pages/Overview.tsx", "services/portal/frontend/src/app/data/portalOverviewModel.ts", "loadOverviewModel", "useOverviewModel"],
  ["packages", "services/portal/frontend/src/app/pages/PackagesPurchase.tsx", "services/portal/frontend/src/app/data/portalPackagesPurchaseModel.ts", "fetchPackageCatalog", "usePackagesPurchaseModel"],
  ["resources", "services/portal/frontend/src/app/pages/RuntimeEnvironment.tsx", "services/portal/frontend/src/app/data/portalRuntimeEnvironmentModel.ts", "loadRuntimeEnvironmentModel", "useRuntimeEnvironmentModel"],
  ["workspace", "services/portal/frontend/src/app/pages/Workspace.tsx", "services/portal/frontend/src/app/data/portalWorkspaceModel.ts", "loadWorkspaceModel", "useWorkspaceModel"],
  ["billing", "services/portal/frontend/src/app/pages/BillingAudit.tsx", "services/portal/frontend/src/app/data/portalBillingAuditModel.ts", "loadBillingAuditModel", "useBillingAuditModel"],
  ["opl", "services/portal/frontend/src/app/pages/OPLEntry.tsx", "services/portal/frontend/src/app/data/portalOplEntryModel.ts", "loadOplEntryModel", "useOplEntryModel"],
  ["admin-dashboard", "services/portal/frontend/src/app/pages/admin/AdminDashboard.tsx", "services/portal/frontend/src/app/data/portalAdminOpsModel.ts", "loadAdminDashboardModel", "useAdminDashboardModel"],
  ["admin-users", "services/portal/frontend/src/app/pages/admin/AdminUsers.tsx", "services/portal/frontend/src/app/data/portalAdminUsersModel.ts", "loadAdminUsersModel", "useAdminUsersModel"],
  ["admin-alerts", "services/portal/frontend/src/app/pages/admin/AdminAlerts.tsx", "services/portal/frontend/src/app/data/portalAdminOpsModel.ts", "loadAdminAlertsModel", "useAdminAlertsModel"],
  ["admin-billing-ops", "services/portal/frontend/src/app/pages/admin/AdminBillingOps.tsx", "services/portal/frontend/src/app/data/portalAdminOpsModel.ts", "loadAdminBillingOpsModel", "useAdminBillingOpsModel"],
  ["admin-audit", "services/portal/frontend/src/app/pages/admin/AdminAudit.tsx", "services/portal/frontend/src/app/data/portalAdminOpsModel.ts", "loadAdminAuditModel", "useAdminAuditModel"],
  ["admin-system", "services/portal/frontend/src/app/pages/admin/AdminSystem.tsx", "services/portal/frontend/src/app/data/portalAdminOpsModel.ts", "loadAdminSystemModel", "useAdminSystemModel"],
  ["admin-ops", "services/portal/frontend/src/app/pages/admin/AdminOps.tsx", "services/portal/frontend/src/app/data/portalAdminOpsModel.ts", "loadAdminOpsModel", "useAdminOpsModel"],
  ["layout-current-user", "services/portal/frontend/src/app/components/Layout.tsx", "services/portal/frontend/src/app/data/portalLayoutModel.ts", "loadCurrentUserModel", "useCurrentUserModel"],
  ["layout-announcements", "services/portal/frontend/src/app/components/Layout.tsx", "services/portal/frontend/src/app/data/portalLayoutModel.ts", "loadAnnouncementModel", "useAnnouncementModel"],
];

for (const retiredPath of [
  "services/portal/frontend/src/composables/useBillingSurface.ts",
  "services/portal/frontend/src/composables/useWorkspaceSurface.ts",
  "services/portal/frontend/src/composables/useOverviewSurface.ts",
  "services/portal/frontend/src/composables/useResourcesSurface.ts",
  "services/portal/frontend/src/composables/useTraceSurface.ts",
  "services/portal/frontend/src/app/pages/TasksResults.tsx",
  "services/portal/frontend/src/app/data/portalTasksResultsModel.ts",
  "services/portal/frontend/src/composables/useAdminUsersSurface.ts",
  "services/portal/frontend/src/app/data/portalAdminModels.ts",
  "services/portal/frontend/src/app/data/portalAdminAlertsModel.ts",
  "services/portal/frontend/src/app/data/portalAdminAuditModel.ts",
  "services/portal/frontend/src/app/data/portalAdminBillingOpsModel.ts",
  "services/portal/frontend/src/app/data/portalAdminDashboardModel.ts",
  "services/portal/frontend/src/app/data/portalAdminSharedModel.ts",
  "services/portal/frontend/src/app/data/portalAdminSystemModel.ts",
]) {
  assert.equal(await exists(retiredPath), false, `retired_vue_composable_must_not_exist:${retiredPath}`);
}

for (const [name, pagePath, modelPath, loader, hook] of pageSpecs) {
  const pageSource = await readFile(pagePath, "utf8");
  const modelSource = await readFile(modelPath, "utf8");
  assert.equal(pageSource.includes("portalQuery"), false, `page_must_not_import_portal_query_directly:${name}`);
  assert(pageSource.includes(hook), `page_must_use_owned_portal_query_hook:${name}:${hook}`);
  assert(modelSource.includes(`function ${loader}`) || modelSource.includes(`function ${loader}(`), `portal_model_loader_missing:${loader}`);
  assert(modelSource.includes(`function ${hook}`) || modelSource.includes(`function ${hook}(`), `portal_model_hook_missing:${hook}`);
  assert(modelSource.includes("usePortalQuery"), `portal_model_must_own_query_hook:${name}`);
}

const apiCallSources = await Promise.all([
  "services/portal/frontend/src/app/data/portalOverviewModel.ts",
  "services/portal/frontend/src/app/data/portalRuntimeEnvironmentModel.ts",
  "services/portal/frontend/src/app/data/portalWorkspaceModel.ts",
  "services/portal/frontend/src/app/data/portalPackagesPurchaseModel.ts",
  "services/portal/frontend/src/app/data/portalBillingAuditModel.ts",
  "services/portal/frontend/src/app/data/portalOplEntryModel.ts",
].map((filePath) => readFile(filePath, "utf8")));
const portalModelSources = apiCallSources.join("\n");
const oplEntryPageSource = await readFile("services/portal/frontend/src/app/pages/OPLEntry.tsx", "utf8");
const oplEntryModelSource = await readFile("services/portal/frontend/src/app/data/portalOplEntryModel.ts", "utf8");
const workspacePageSource = await readFile("services/portal/frontend/src/app/pages/Workspace.tsx", "utf8");
const workspaceModelSource = await readFile("services/portal/frontend/src/app/data/portalWorkspaceModel.ts", "utf8");
const adminUsersPageSource = await readFile("services/portal/frontend/src/app/pages/admin/AdminUsers.tsx", "utf8");
const adminUsersModelSource = await readFile("services/portal/frontend/src/app/data/portalAdminUsersModel.ts", "utf8");
const adminPageSources = await Promise.all([
  "services/portal/frontend/src/app/pages/admin/AdminDashboard.tsx",
  "services/portal/frontend/src/app/pages/admin/AdminUsers.tsx",
  "services/portal/frontend/src/app/pages/admin/AdminAlerts.tsx",
  "services/portal/frontend/src/app/pages/admin/AdminBillingOps.tsx",
  "services/portal/frontend/src/app/pages/admin/AdminAudit.tsx",
  "services/portal/frontend/src/app/pages/admin/AdminSystem.tsx",
  "services/portal/frontend/src/app/pages/admin/AdminOps.tsx",
].map((filePath) => readFile(filePath, "utf8")));

for (const apiCall of [
  "fetchOverview",
  "fetchPackageCatalog",
  "fetchMyResources",
  "fetchWorkspace",
  "fetchBillingSummary",
  "fetchBillingDetails",
  "createOplLaunch",
  "fetchOplBootstrap",
  "bindOplSession",
]) {
  assert(portalModelSources.includes(apiCall), `portal_models_must_call_api:${apiCall}`);
}

for (const pageOwnedLaunchState of [
  "const getSteps",
  "switch (pageState)",
  "let suggestions",
]) {
  assert.equal(
    oplEntryPageSource.includes(pageOwnedLaunchState),
    false,
    `opl_entry_page_must_not_own_launch_state_model:${pageOwnedLaunchState}`,
  );
}

for (const modelOwnedLaunchState of [
  "function buildOplEntryLaunchSteps",
  "function buildOplEntryFailurePanel",
  "function buildOplEntryViewState",
  "function buildOplEntryCommercialActionView",
  "commercialAction",
  "return_to_opl_task",
]) {
  assert(
    oplEntryModelSource.includes(modelOwnedLaunchState),
    `opl_entry_model_must_own_launch_state_model:${modelOwnedLaunchState}`,
  );
}

const packagesPageSource = await readFile("services/portal/frontend/src/app/pages/PackagesPurchase.tsx", "utf8");
const packagesModelSource = await readFile("services/portal/frontend/src/app/data/portalPackagesPurchaseModel.ts", "utf8");
for (const modelOwnedPurchaseProjection of [
  "function buildPurchaseActionProjectionFromSearch",
  "purchaseProjection",
  "selectPlanAction",
  "rechargeOrCreditAction",
  "openRuntimeStorageAction",
  "returnToOplAction",
  "returnToOplTaskContract",
  "full_opl_webui_resume_implementation",
  "canOpenRuntimeStorage",
]) {
  assert(
    packagesModelSource.includes(modelOwnedPurchaseProjection),
    `packages_model_must_own_runtime_required_purchase_projection:${modelOwnedPurchaseProjection}`,
  );
}
for (const pageOwnedPurchaseParsing of [
  "new URLSearchParams(window.location.search)",
  "params.get(\"taskIntent\")",
  "params.get(\"runtimePlanId\")",
  "params.get(\"sessionId\")",
]) {
  assert.equal(
    packagesPageSource.includes(pageOwnedPurchaseParsing),
    false,
    `packages_page_must_not_parse_runtime_required_purchase_query:${pageOwnedPurchaseParsing}`,
  );
}
for (const pagePurchaseProjectionMarker of [
  "model.purchaseProjection",
  "model.purchaseProjection.selectPlanAction.label",
  "model.purchaseProjection.rechargeOrCreditAction.href",
  "model.purchaseProjection.openRuntimeStorageAction.href",
  "model.purchaseProjection.returnToOplTaskContract.returnToOplDeeplink",
]) {
  assert(
    packagesPageSource.includes(pagePurchaseProjectionMarker),
    `packages_page_must_render_runtime_required_purchase_projection:${pagePurchaseProjectionMarker}`,
  );
}
assert.equal(
  packagesPageSource.includes("<Button asChild disabled="),
  false,
  "packages_page_must_not_render_disabled_purchase_action_as_link",
);

for (const pageOwnedWorkspaceState of [
  "const filteredInputFiles",
  "const filteredOutputFiles",
  "const downloadable =",
  "model.outputFiles.some((file) => file.canDownload)",
]) {
  assert.equal(
    workspacePageSource.includes(pageOwnedWorkspaceState),
    false,
    `workspace_page_must_not_own_file_view_model:${pageOwnedWorkspaceState}`,
  );
}

for (const modelOwnedWorkspaceState of [
  "function filterWorkspaceFiles",
  "function buildWorkspaceViewState",
  "downloadableOutputFiles",
  "hasDownloadableOutputFiles",
]) {
  assert(
    workspaceModelSource.includes(modelOwnedWorkspaceState),
    `workspace_model_must_own_file_view_model:${modelOwnedWorkspaceState}`,
  );
}

for (const pageOwnedAdminUsersState of [
  "query.data.users.filter",
  "user.name.toLowerCase()",
  "Number(rechargeAmount)",
  "Number(refundAmount)",
  "refundReason.trim()",
]) {
  assert.equal(
    adminUsersPageSource.includes(pageOwnedAdminUsersState),
    false,
    `admin_users_page_must_not_own_filter_or_wallet_payload:${pageOwnedAdminUsersState}`,
  );
}

for (const modelOwnedAdminUsersState of [
  "function filterAdminUsers",
  "function buildAdminUserRechargePayload",
  "function buildAdminUserRefundPayload",
]) {
  assert(
    adminUsersModelSource.includes(modelOwnedAdminUsersState),
    `admin_users_model_must_own_filter_or_wallet_payload:${modelOwnedAdminUsersState}`,
  );
}

for (const source of adminPageSources) {
  assert.equal(
    source.includes("../../data/portalAdminModels"),
    false,
    "admin_page_must_not_import_aggregate_admin_model",
  );
}

console.log(JSON.stringify({
  ok: true,
  contract: "v22_portal_frontend_surface_composables",
  currentTruth: "portal_models_replace_retired_vue_composables",
  surfaces: pageSpecs.map(([name]) => name),
}, null, 2));
