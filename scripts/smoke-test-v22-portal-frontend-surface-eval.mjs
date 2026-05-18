import assert from "node:assert/strict";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  retiredFigmaZipResidue,
  retiredFrontendRoutes,
} from "./smoke-test-v22-portal-retired-frontend-surface-gate.mjs";

const repoRoot = process.cwd();
const reportPath = path.join(repoRoot, ".runtime", "portal-surface-eval", "report.json");
const appRoot = "services/portal/frontend/src/app";
const figmaAppRoot = "/tmp/medopl-figma-make-source-admin/src/app";
const expectedUserRoutes = ["/overview", "/resources", "/workspace", "/trace", "/billing", "/opl-launch"];
const expectedAdminRoutes = [
  "/admin/dashboard",
  "/admin/users",
  "/admin/alerts",
  "/admin/billing-ops",
  "/admin/audit",
  "/admin/system",
  "/admin/ops",
];
const expectedRoutes = [...expectedUserRoutes, ...expectedAdminRoutes];
const expectedPages = {
  overview: "Overview.tsx",
  resources: "RuntimeEnvironment.tsx",
  workspace: "Workspace.tsx",
  trace: "TasksResults.tsx",
  billing: "BillingAudit.tsx",
  "opl-launch": "OPLEntry.tsx",
};
const requiredPageLoaders = {
  "Overview.tsx": "loadOverviewModel",
  "RuntimeEnvironment.tsx": "loadRuntimeEnvironmentModel",
  "Workspace.tsx": "loadWorkspaceModel",
  "TasksResults.tsx": "loadTasksResultsModel",
  "BillingAudit.tsx": "loadBillingAuditModel",
  "OPLEntry.tsx": "loadOplEntryModel",
};
const expectedAdminPages = {
  "admin/dashboard": "admin/AdminDashboard.tsx",
  "admin/users": "admin/AdminUsers.tsx",
  "admin/alerts": "admin/AdminAlerts.tsx",
  "admin/billing-ops": "admin/AdminBillingOps.tsx",
  "admin/audit": "admin/AdminAudit.tsx",
  "admin/system": "admin/AdminSystem.tsx",
  "admin/ops": "admin/AdminOps.tsx",
};
const requiredAdminPageLoaders = {
  "admin/AdminDashboard.tsx": "loadAdminDashboardModel",
  "admin/AdminUsers.tsx": "loadAdminUsersModel",
  "admin/AdminAlerts.tsx": "loadAdminAlertsModel",
  "admin/AdminBillingOps.tsx": "loadAdminBillingOpsModel",
  "admin/AdminAudit.tsx": "loadAdminAuditModel",
  "admin/AdminSystem.tsx": "loadAdminSystemModel",
  "admin/AdminOps.tsx": "loadAdminOpsModel",
};
const requiredAdapterCalls = [
  "fetchOverview",
  "fetchMyResources",
  "fetchWorkspace",
  "fetchSessionTraces",
  "fetchBillingSummary",
  "fetchBillingDetails",
  "fetchOplLaunchStatus",
  "fetchOplBootstrap",
  "bindOplSession",
  "fetchCurrentUser",
  "fetchAnnouncements",
  "fetchAdminOverview",
  "fetchAdminUsers",
  "fetchAdminAlerts",
  "fetchAdminBillingOps",
  "fetchAdminAudit",
  "fetchAdminSystem",
  "fetchAdminOps",
];
const forbiddenPublicStateKeys = [
  "rawApiKey",
  "launchToken",
  "runtimeToken",
  "objectKey",
  "localPath",
  "signedUrl",
  "presignedUrl",
  "SecretId",
  "SecretKey",
  "kubeconfig",
];
const forbiddenCopy = [
  "客户工作台",
  "平台管理台",
  "商业化",
  "SaaS 总览",
  "运营总台",
  "告警中心",
  "使用统一账号登录",
  "30 天保护期",
  "30天保护期",
];

async function source(filePath) {
  return readFile(filePath, "utf8");
}

async function exists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

async function listFiles(dir, suffixes) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await listFiles(fullPath, suffixes));
      continue;
    }
    if (suffixes.some((suffix) => entry.name.endsWith(suffix))) files.push(fullPath);
  }
  return files.sort();
}

async function listRelativeFiles(root, suffixes) {
  const files = await listFiles(root, suffixes);
  return files.map((filePath) => path.relative(root, filePath).replaceAll(path.sep, "/")).sort();
}

function assertIncludes(text, expected, label) {
  assert(text.includes(expected), `${label}_missing:${expected}`);
}

function assertExcludes(text, forbidden, label) {
  assert.equal(text.includes(forbidden), false, `${label}_must_not_include:${forbidden}`);
}

function sliceBetween(text, start, end, label) {
  const startIndex = text.indexOf(start);
  assert.notEqual(startIndex, -1, `${label}_start_missing:${start}`);
  const endIndex = text.indexOf(end, startIndex + start.length);
  assert.notEqual(endIndex, -1, `${label}_end_missing:${end}`);
  return text.slice(startIndex, endIndex);
}

function sliceFrom(text, start, label) {
  const startIndex = text.indexOf(start);
  assert.notEqual(startIndex, -1, `${label}_start_missing:${start}`);
  return text.slice(startIndex);
}

const routesSource = await source(`${appRoot}/routes.tsx`);
const layoutSource = await source(`${appRoot}/components/Layout.tsx`);
const announcementButtonSource = await source(`${appRoot}/components/AnnouncementButton.tsx`);
const adapterSource = await source(`${appRoot}/data/portalAdapters.ts`);
const packageJson = JSON.parse(await source("services/portal/frontend/package.json"));
const viteSource = await source("services/portal/frontend/vite.config.ts");
const contractMarkdown = await source("docs/contracts/v22-portal-figma-make-ui-implementation-boundary.md");

assert.equal(await exists(figmaAppRoot), true, "figma_make_extracted_app_source_missing");
assert.deepEqual(
  await listRelativeFiles(appRoot, [".ts", ".tsx"]),
  (await listRelativeFiles(figmaAppRoot, [".ts", ".tsx"]))
    .filter((file) => !retiredFigmaZipResidue.includes(file))
    .concat(["data/portalAdapters.ts"])
    .sort(),
  "app_file_tree_must_match_figma_zip_without_old_admin_console_plus_portal_adapter",
);

assertIncludes(routesSource, "createBrowserRouter", "routes_must_use_react_router");
assertIncludes(routesSource, 'from "react-router"', "routes_must_use_zip_react_router");
assertExcludes(routesSource, "react-router-dom", "routes_must_not_use_non_zip_react_router_dom");
assertExcludes(routesSource, "AdminConsole", "admin_console_must_not_be_mounted");

for (const [routeId, pageFile] of Object.entries(expectedPages)) {
  assertIncludes(routesSource, `path: "${routeId}"`, `route_path_missing:${routeId}`);
  assertIncludes(routesSource, pageFile.replace(".tsx", ""), `route_component_missing:${routeId}`);
  assert.equal(await exists(`${appRoot}/pages/${pageFile}`), true, `page_file_missing:${pageFile}`);
}
for (const [routeId, pageFile] of Object.entries(expectedAdminPages)) {
  assertIncludes(routesSource, `path: "${routeId}"`, `admin_route_path_missing:${routeId}`);
  assertIncludes(routesSource, pageFile.replace("admin/", "").replace(".tsx", ""), `admin_route_component_missing:${routeId}`);
  assert.equal(await exists(`${appRoot}/pages/${pageFile}`), true, `admin_page_file_missing:${pageFile}`);
}

for (const route of expectedRoutes) {
  assertIncludes(layoutSource, `path: "${route}"`, `layout_nav_route_missing:${route}`);
}
for (const label of ["总览", "运行环境", "工作空间", "任务与结果", "账单与审计", "进入 OPL"]) {
  assertIncludes(layoutSource, `name: "${label}"`, `layout_nav_label_missing:${label}`);
}
for (const label of ["管理总览", "用户管理", "公告与待处理事项", "账单处理", "审计记录", "站点设置", "服务状态"]) {
  assertIncludes(layoutSource, `name: "${label}"`, `layout_admin_nav_label_missing:${label}`);
}
assertExcludes(layoutSource, "客户账户", "layout_admin_nav_must_not_use_old_customer_account_copy");
assertExcludes(layoutSource, "工作台版本 v1.2.0", "layout_must_not_show_old_static_version_copy");
assertIncludes(layoutSource, "Portal UI", "layout_footer_must_use_current_portal_ui_copy");
assertIncludes(announcementButtonSource, "announcements = []", "announcement_button_must_default_to_empty_api_state");
assertExcludes(announcementButtonSource, "系统维护通知", "announcement_button_must_not_embed_sample_notice");
assertExcludes(announcementButtonSource, "新功能上线", "announcement_button_must_not_embed_sample_notice");
for (const retired of retiredFrontendRoutes) {
  assertExcludes(routesSource, `path: "${retired.slice(1)}"`, "react_routes_retired_path");
  assertExcludes(layoutSource, `path: "${retired}"`, "layout_retired_path");
}

assert.equal(packageJson.dependencies.vue, undefined, "package_must_not_depend_on_vue");
assert.equal(packageJson.dependencies.pinia, undefined, "package_must_not_depend_on_pinia");
assert.equal(packageJson.dependencies["vue-router"], undefined, "package_must_not_depend_on_vue_router");
assert.equal(packageJson.dependencies["react-router-dom"], undefined, "package_must_not_depend_on_react_router_dom");
assert(packageJson.dependencies.react, "package_must_depend_on_react");
assert(packageJson.dependencies["react-router"], "package_must_depend_on_zip_react_router");
assert(packageJson.dependencies["lucide-react"], "package_must_depend_on_lucide");
assert(packageJson.dependencies["@radix-ui/react-dialog"], "package_must_depend_on_radix_dialog");
assertIncludes(viteSource, "@vitejs/plugin-react", "vite_must_use_react_plugin");
assertIncludes(viteSource, "@tailwindcss/vite", "vite_must_use_tailwind_v4_plugin");
assertExcludes(viteSource, "@vitejs/plugin-vue", "vite_must_not_use_vue_plugin");

for (const [pageFile, loader] of Object.entries(requiredPageLoaders)) {
  const pageSource = await source(`${appRoot}/pages/${pageFile}`);
  assertIncludes(pageSource, loader, `page_must_use_portal_api_loader:${pageFile}`);
  assertIncludes(pageSource, "usePortalQuery", `page_must_use_portal_query:${pageFile}`);
  assertExcludes(pageSource, "const mock", `page_must_not_keep_zip_mock_data:${pageFile}`);
}
for (const [pageFile, loader] of Object.entries(requiredAdminPageLoaders)) {
  const pageSource = await source(`${appRoot}/pages/${pageFile}`);
  assertIncludes(pageSource, loader, `admin_page_must_use_portal_api_loader:${pageFile}`);
  assertIncludes(pageSource, "usePortalQuery", `admin_page_must_use_portal_query:${pageFile}`);
}
for (const apiFunction of requiredAdapterCalls) {
  assertIncludes(adapterSource, apiFunction, `portal_adapter_must_call:${apiFunction}`);
}
const adminOpsPageSource = await source(`${appRoot}/pages/admin/AdminOps.tsx`);
assertIncludes(adapterSource, "ops_surface_disabled", "admin_ops_adapter_must_handle_disabled_product_state");
assertIncludes(adapterSource, "opsSurfaceEnabled", "admin_ops_adapter_must_return_surface_enabled_flag");
assertIncludes(adapterSource, "平台托管运维入口未启用", "admin_ops_adapter_must_map_disabled_state_to_product_copy");
assertIncludes(adminOpsPageSource, "opsSurfaceEnabled", "admin_ops_page_must_branch_on_surface_enabled_flag");
assertIncludes(adminOpsPageSource, "平台托管运维入口未启用", "admin_ops_page_must_render_disabled_product_state");
assertExcludes(adminOpsPageSource, "Portal 数据暂时不可用", "admin_ops_page_must_not_render_generic_error_for_disabled_surface");

const billingLoaderSource = sliceBetween(
  adapterSource,
  "export async function loadAdminBillingOpsModel()",
  "export async function loadAdminAuditModel()",
  "admin_billing_loader_source",
);
const auditLoaderSource = sliceBetween(
  adapterSource,
  "export async function loadAdminAuditModel()",
  "export async function loadAdminSystemModel()",
  "admin_audit_loader_source",
);
const adminSystemLoaderSource = sliceBetween(
  adapterSource,
  "export async function loadAdminSystemModel()",
  "export async function loadAdminOpsModel()",
  "admin_system_loader_source",
);
const adminOpsLoaderSource = sliceFrom(
  adapterSource,
  "export async function loadAdminOpsModel()",
  "admin_ops_loader_source",
);
const adminBillingSource = await source(`${appRoot}/pages/admin/AdminBillingOps.tsx`);
const adminAuditSource = await source(`${appRoot}/pages/admin/AdminAudit.tsx`);
const adminSystemSource = await source(`${appRoot}/pages/admin/AdminSystem.tsx`);
const adminAlertsSource = await source(`${appRoot}/pages/admin/AdminAlerts.tsx`);
const adminDashboardSource = await source(`${appRoot}/pages/admin/AdminDashboard.tsx`);

assertIncludes(billingLoaderSource, "rowKey:", "admin_billing_rows_must_expose_ui_row_key");
assertIncludes(billingLoaderSource, "billingRowKey(", "admin_billing_rows_must_use_stable_source_aware_row_key");
assertIncludes(adapterSource, 'return `billing:${source}:${type}:${event}:${primary}:${index}`;', "admin_billing_row_key_must_include_source_type_event_primary_index");
for (const sourceCollection of ['source: "pendingRuns"', 'source: "warningEvents"', 'source: "adjustments"']) {
  assertIncludes(billingLoaderSource, sourceCollection, `admin_billing_row_key_source_collection_missing:${sourceCollection}`);
}
assertIncludes(billingLoaderSource, "id: stringValue(row.id)", "admin_billing_action_id_must_use_backend_operational_id");
assertExcludes(billingLoaderSource, "id: stringValue(row.runId || row.userId || row.createdAt", "admin_billing_action_id_must_not_use_frontend_fallback_id");
assertIncludes(auditLoaderSource, "rowKey:", "admin_audit_rows_must_expose_ui_row_key");
assertIncludes(auditLoaderSource, "auditRowKey(", "admin_audit_rows_must_use_stable_event_aware_row_key");
assertIncludes(adapterSource, 'return `audit:items:${type}:${detail}:${primary}:${index}`;', "admin_audit_row_key_must_include_source_type_detail_primary_index");
assertIncludes(adminBillingSource, "key={item.rowKey}", "admin_billing_table_must_use_ui_row_key");
assertIncludes(adminAuditSource, "key={event.rowKey}", "admin_audit_table_must_use_ui_row_key");
assertExcludes(adminBillingSource, "key={item.id}", "admin_billing_table_must_not_key_by_business_id");
assertExcludes(adminAuditSource, "key={event.id}", "admin_audit_table_must_not_key_by_business_id");
assertIncludes(adapterSource, "alertRowKey(", "admin_alerts_pending_rows_must_use_stable_event_key");
assertIncludes(adapterSource, 'return `alert:items:${type}:${detail}:${primary}:${action}`;', "admin_alerts_pending_row_key_must_include_type_detail_primary_action");
assertExcludes(adapterSource, "alert:items:${type}:${detail}:${primary}:${index}", "admin_alerts_pending_row_key_must_not_use_list_index");
assertIncludes(adapterSource, "rowKey: alertRowKey(row)", "admin_alerts_dashboard_pending_rows_must_expose_ui_row_key");
assertIncludes(adminAlertsSource, "key={item.rowKey}", "admin_alerts_pending_table_must_use_ui_row_key");
assertExcludes(adminAlertsSource, "key={item.id}", "admin_alerts_pending_table_must_not_key_by_business_id");
assertIncludes(adminDashboardSource, "key={item.rowKey}", "admin_dashboard_pending_summary_must_use_ui_row_key");
assertExcludes(adminDashboardSource, "key={item.id}", "admin_dashboard_pending_summary_must_not_key_by_business_id");
assertIncludes(adminSystemLoaderSource, "rowKey:", "admin_system_key_routes_must_expose_ui_row_key");
assertIncludes(adminSystemLoaderSource, "adminServiceRowKey(", "admin_system_key_routes_must_use_stable_service_row_key");
assertIncludes(adminOpsLoaderSource, "rowKey:", "admin_ops_services_must_expose_ui_row_key");
assertIncludes(adminOpsLoaderSource, "adminServiceRowKey(", "admin_ops_services_must_use_stable_service_row_key");
assertIncludes(adapterSource, 'return `admin-service:${source}:${identity}:${status}:${index}`;', "admin_service_row_key_must_include_source_identity_status_index");
assertIncludes(adminSystemSource, "key={route.rowKey}", "admin_system_key_routes_must_use_ui_row_key");
assertIncludes(adminOpsPageSource, "key={service.rowKey}", "admin_ops_services_must_use_ui_row_key");
assertExcludes(adminSystemSource, "key={route.name}", "admin_system_key_routes_must_not_key_by_display_name");
assertExcludes(adminOpsPageSource, "key={service.name}", "admin_ops_services_must_not_key_by_display_name");

const frontendSources = [];
for (const filePath of await listFiles("services/portal/frontend/src", [".ts", ".tsx", ".css"])) {
  frontendSources.push(await source(filePath));
}
const visibleText = frontendSources.join("\n");
for (const forbidden of forbiddenCopy) assertExcludes(visibleText, forbidden, "frontend_forbidden_copy");
for (const forbidden of forbiddenPublicStateKeys) assertExcludes(visibleText, forbidden, "frontend_forbidden_sensitive_public_key");
assertIncludes(visibleText, "当前页面仅展示状态，不提供资源调整动作。", "runtime_environment_status_only_copy_missing");
assertIncludes(visibleText, "价格待审批", "pricing_pending_approval_copy_missing");
assertIncludes(visibleText, "正式售价未定价", "formal_price_unset_copy_missing");
assertExcludes(visibleText, "释放计算资源", "compute_release_action_must_not_return_to_active_ui");
assertExcludes(visibleText, "7 天保护期", "storage_protection_action_must_not_return_to_active_ui");
assertIncludes(visibleText, "托管科研工作台", "service_truth_copy_missing");
assertIncludes(visibleText, "余额", "balance_copy_missing");
assertIncludes(visibleText, "冻结金额", "frozen_amount_copy_missing");
assertIncludes(visibleText, "进入 OPL", "opl_entry_copy_missing");

assertIncludes(contractMarkdown, "Figma Make ZIP", "contract_must_name_zip_source");
assertIncludes(contractMarkdown, "唯一 Portal UI source-of-truth", "contract_must_define_zip_source_of_truth");
assertIncludes(contractMarkdown, '"currentCoverage": "user_portal_and_admin_portal"', "contract_must_record_user_admin_coverage");
assertIncludes(contractMarkdown, '"activeAdminRouteMounted": true', "contract_must_require_admin_route_mount");
assertIncludes(contractMarkdown, "RoleContext 不是安全边界", "contract_must_record_role_context_boundary");
assertIncludes(contractMarkdown, "ops_surface_disabled", "contract_must_record_admin_ops_disabled_product_state");
assertIncludes(contractMarkdown, "平台托管运维入口未启用", "contract_must_record_admin_ops_disabled_copy");

await mkdir(path.dirname(reportPath), { recursive: true });
const report = {
  ok: true,
  contract: "v22_portal_frontend_surface_eval",
  sourceOfTruth: "figma_make_zip",
  coverage: {
    routes: expectedRoutes.length,
    userPages: Object.keys(expectedPages).length,
    adminPages: Object.keys(expectedAdminPages).length,
    requiredAdapterCalls: requiredAdapterCalls.length,
  },
  checked: [
    "figma_zip_file_tree_parity",
    "react_router_user_admin_routes",
    "retired_routes_removed_from_active_frontend",
    "old_admin_console_removed",
    "page_api_loader_wiring",
    "portal_adapter_api_calls",
    "forbidden_copy",
    "secret_browser_hygiene_static",
    "admin_billing_audit_row_key_wiring",
  ],
};
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
