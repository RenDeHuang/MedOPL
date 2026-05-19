import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import { retiredFigmaZipResidue } from "./v22-retired-surface-data.mjs";

const contractPath = "docs/contracts/v22-portal-workbench-management-ui-composition-boundary.md";
const start = "<!-- v22-portal-workbench-management-ui-composition-contract:start -->";
const end = "<!-- v22-portal-workbench-management-ui-composition-contract:end -->";
const userRoutes = ["/overview", "/resources", "/workspace", "/trace", "/billing", "/opl-launch"];
const adminRoutes = [
  "/admin/dashboard",
  "/admin/users",
  "/admin/alerts",
  "/admin/billing-ops",
  "/admin/audit",
  "/admin/system",
  "/admin/ops",
];

async function source(path) {
  return readFile(path, "utf8");
}

async function exists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

function extractJson(markdown) {
  const startIndex = markdown.indexOf(start);
  assert.notEqual(startIndex, -1, "composition_contract_start_marker_missing");
  const endIndex = markdown.indexOf(end, startIndex + start.length);
  assert.notEqual(endIndex, -1, "composition_contract_end_marker_missing");
  const block = markdown.slice(startIndex + start.length, endIndex).trim();
  const match = /^```json\n([\s\S]+)\n```$/.exec(block);
  assert(match, "composition_contract_must_be_single_json_fence");
  return JSON.parse(match[1]);
}

function assertIncludes(text, expected, label) {
  assert(text.includes(expected), `${label}_missing:${expected}`);
}

function assertExcludes(text, forbidden, label) {
  assert.equal(text.includes(forbidden), false, `${label}_must_not_include:${forbidden}`);
}

const markdown = await source(contractPath);
const contract = extractJson(markdown);
const runtimeSuite = await source("scripts/smoke-test-v22-portal-runtime-suite.mjs");
const figmaContract = await source("docs/contracts/v22-portal-figma-make-ui-implementation-boundary.md");
const routesSource = await source("services/portal/frontend/src/app/routes.tsx");
const layoutSource = await source("services/portal/frontend/src/app/components/Layout.tsx");
const adapterSource = await source("services/portal/frontend/src/app/data/portalAdapters.ts");

assert.equal(contract.contract, "v22_portal_workbench_management_ui_composition_boundary", "contract_name_mismatch");
assert.equal(contract.version, 11, "contract_version_mismatch");
assert.equal(contract.model, "gpt-5.4", "contract_model_mismatch");
assert.equal(contract.scope.portalOnly, true, "composition_scope_must_be_portal_only");
assert.equal(contract.scope.implementsUi, true, "composition_contract_must_implement_ui");
assert.equal(contract.scope.callsRealCloud, false, "composition_contract_must_not_call_real_cloud");
assert.equal(contract.scope.readsSecrets, false, "composition_contract_must_not_read_secrets");
assert.equal(contract.scope.modifiesUpstream, false, "composition_contract_must_not_modify_upstream");
assert.equal(contract.scope.modifiesDeploy, false, "composition_contract_must_not_modify_deploy");
assert.equal(contract.contractRole, "ui_boundary_and_zip_surface_eval_entrypoint", "composition_contract_role_mismatch");
assert.equal(contract.uiImplementationSource.kind, "figma_make_zip", "composition_must_use_figma_zip_source");
assert.equal(contract.uiImplementationSource.contract, "docs/contracts/v22-portal-figma-make-ui-implementation-boundary.md", "composition_source_contract_mismatch");
assert.equal(contract.uiImplementationSource.appRoot, "services/portal/frontend/src/app", "composition_app_root_mismatch");
assert.deepEqual(contract.uiImplementationSource.userRoutes, userRoutes, "composition_user_routes_mismatch");
assert.deepEqual(contract.uiImplementationSource.adminRoutes, adminRoutes, "composition_admin_routes_mismatch");
assert.equal(contract.uiImplementationSource.adminConsoleCopiedAsUnroutedResidue, false, "composition_admin_residue_must_be_removed");
assert.equal(contract.uiImplementationSource.activeAdminRouteMounted, true, "composition_admin_must_be_mounted");
assert.equal(contract.uiImplementationSource.adminOpsDefaultProductState.routeMounted, true, "composition_admin_ops_route_must_remain_mounted");
assert.equal(contract.uiImplementationSource.adminOpsDefaultProductState.backendDisabledStatus, 404, "composition_admin_ops_disabled_status_mismatch");
assert.equal(contract.uiImplementationSource.adminOpsDefaultProductState.backendDisabledError, "ops_surface_disabled", "composition_admin_ops_disabled_error_mismatch");
assert.equal(contract.uiImplementationSource.adminOpsDefaultProductState.frontendDisabledCopy, "平台托管运维入口未启用", "composition_admin_ops_disabled_copy_mismatch");
assert.equal(contract.surfaceSmoke.smoke, "scripts/smoke-test-v22-portal-frontend-surface-eval.mjs", "surface_smoke_mismatch");
assert.equal(contract.surfaceSmoke.runtimeReportPath, ".runtime/portal-surface-eval/report.json", "surface_report_path_mismatch");
assert.equal(contract.surfaceSmoke.runtimeReportCommitted, false, "surface_report_must_not_be_committed");

assert.equal(contract.uiArchitecture.method, "figma_make_zip_routes_with_portal_api_adapter", "ui_architecture_method_mismatch");
assert.equal(contract.uiArchitecture.pageRole, "zip_page_with_portal_api_wiring", "page_role_mismatch");
assert.equal(contract.uiArchitecture.surfaceFactsLiveInZipSource, true, "surface_facts_must_live_in_zip_source");
assert.equal(contract.uiArchitecture.apiShapeFactsLiveInPortalApiAdapter, true, "api_shape_facts_must_live_in_portal_adapter");
assert.equal(contract.uiArchitecture.visualWorkbenchFactsLiveInCurrentGate, false, "visual_workbench_must_not_be_current_gate");
assert.equal(contract.uiArchitecture.screenshotRegressionFactsLiveInCurrentGate, false, "screenshot_regression_must_not_be_current_gate");

for (const route of [...userRoutes, ...adminRoutes]) assertIncludes(routesSource, `path: "${route.slice(1)}"`, `route_missing:${route}`);
for (const route of [...userRoutes, ...adminRoutes]) assertIncludes(layoutSource, `path: "${route}"`, `nav_route_missing:${route}`);
for (const apiFunction of ["fetchOverview", "fetchMyResources", "fetchWorkspace", "fetchSessionTraces", "fetchBillingSummary", "fetchBillingDetails", "fetchOplLaunchStatus", "fetchOplBootstrap", "bindOplSession"]) {
  assertIncludes(adapterSource, apiFunction, `adapter_call_missing:${apiFunction}`);
}
for (const apiFunction of ["fetchCurrentUser", "fetchAnnouncements", "fetchAdminOverview", "fetchAdminUsers", "fetchAdminAlerts", "fetchAdminBillingOps", "fetchAdminAudit", "fetchAdminSystem", "fetchAdminOps"]) {
  assertIncludes(adapterSource, apiFunction, `admin_adapter_call_missing:${apiFunction}`);
}
assertIncludes(adapterSource, "ops_surface_disabled", "admin_ops_adapter_must_handle_disabled_product_state");
assertIncludes(adapterSource, "平台托管运维入口未启用", "admin_ops_adapter_must_render_disabled_copy");
const adminOpsPageSource = await source("services/portal/frontend/src/app/pages/admin/AdminOps.tsx");
assertIncludes(adminOpsPageSource, "opsSurfaceEnabled", "admin_ops_page_must_branch_on_disabled_state");
assertIncludes(adminOpsPageSource, "平台托管运维入口未启用", "admin_ops_page_must_render_disabled_product_state");
assertExcludes(adminOpsPageSource, "Portal 数据暂时不可用", "admin_ops_page_must_not_render_generic_error_for_disabled_surface");
assert.equal(await exists(`services/portal/frontend/src/app/${retiredFigmaZipResidue[0]}`), false, "old_admin_console_zip_residue_must_not_exist");
assertExcludes(routesSource, "AdminConsole", "admin_console_must_not_be_mounted");

assertIncludes(runtimeSuite, "scripts/smoke-test-v22-portal-frontend-surface-eval.mjs", "runtime_suite_must_include_surface_eval");
assertIncludes(runtimeSuite, "scripts/smoke-test-v22-portal-figma-make-admin-readiness.mjs", "runtime_suite_must_include_admin_readiness");
assertIncludes(runtimeSuite, "scripts/smoke-test-v22-portal-web-route-alignment.mjs", "runtime_suite_must_include_route_alignment");
assertIncludes(figmaContract, "唯一 Portal UI source-of-truth", "figma_contract_must_own_zip_truth");
assertIncludes(markdown, "React + Vite + TypeScript + react-router + shadcn/Radix + lucide", "composition_contract_must_reference_react_stack");
assertIncludes(markdown, "普通用户和管理员 Portal", "composition_contract_must_record_user_admin_coverage");
assertIncludes(markdown, "retired frontend surface gate", "composition_contract_must_point_to_retired_frontend_gate");
assertExcludes(markdown, "visualWorkbenchFactsLiveInEvalset", "old_visual_workbench_evalset_field");

console.log(JSON.stringify({
  ok: true,
  contract: contract.contract,
  version: contract.version,
  checked: [
    "figma_make_zip_surface_truth",
    "user_and_admin_routes",
    "old_admin_console_removed",
    "visual_workbench_removed_from_current_gate",
    "screenshot_regression_removed_from_current_gate",
  ],
}, null, 2));
